export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'

function createAdminClient() { return _createAdminClient() as any }
import {
  getPackById,
  getActivePackVersion,
  isJurisdictionAllowed,
  checkUserPackLimit,
  getTransactionByIdempotencyKey,
  writeAuditLog,
} from '@/lib/rips'

export async function POST(req: NextRequest) {
  // 1. Authenticate caller
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse request
  let body: { packId?: string; idempotencyKey?: string; jurisdiction?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { packId, idempotencyKey, jurisdiction } = body

  if (!packId || !idempotencyKey) {
    return NextResponse.json(
      { error: 'packId and idempotencyKey are required.' },
      { status: 400 },
    )
  }

  // 3. Idempotency check — return existing transaction if key already used
  const existing = await getTransactionByIdempotencyKey(idempotencyKey)
  if (existing) {
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({
      transactionId: existing.id,
      checkoutUrl: existing.stripe_checkout_session_id
        ? `https://checkout.stripe.com/pay/${existing.stripe_checkout_session_id}`
        : null,
      status: existing.status,
    })
  }

  // 4. Load and validate pack
  const pack = await getPackById(packId)
  if (!pack || pack.status !== 'active') {
    return NextResponse.json({ error: 'Pack not available.' }, { status: 404 })
  }

  if (pack.available_quantity <= 0) {
    return NextResponse.json({ error: 'Pack sold out.' }, { status: 409 })
  }

  const now = new Date().toISOString()
  if (pack.starts_at && pack.starts_at > now) {
    return NextResponse.json({ error: 'Pack not yet available.' }, { status: 409 })
  }
  if (pack.ends_at && pack.ends_at < now) {
    return NextResponse.json({ error: 'Pack no longer available.' }, { status: 409 })
  }

  // 5. Jurisdiction check
  const jCode = jurisdiction ?? 'US'
  const allowed = await isJurisdictionAllowed(jCode, packId)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rips are not available in your region.' },
      { status: 403 },
    )
  }

  // 6. Per-user limit check
  const { allowed: limitOk } = await checkUserPackLimit(
    user.id,
    packId,
    pack.max_per_user,
  )
  if (!limitOk) {
    return NextResponse.json(
      { error: 'You have reached the purchase limit for this pack.' },
      { status: 409 },
    )
  }

  // 7. Load active pack version
  const version = await getActivePackVersion(packId)
  if (!version) {
    return NextResponse.json(
      { error: 'Pack configuration unavailable. Please try again.' },
      { status: 503 },
    )
  }

  // 8. Create a pending transaction record (idempotent via UNIQUE key)
  const admin = createAdminClient()
  const { data: tx, error: txError } = await admin
    .from('rip_transactions')
    .insert({
      idempotency_key: idempotencyKey,
      user_id: user.id,
      pack_id: packId,
      pack_version_id: version.id,
      status: 'pending',
      amount: pack.price,
      currency: 'usd',
      jurisdiction: jCode,
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })
    .select('id')
    .single()

  if (txError || !tx) {
    // Unique constraint violation means another request with same key landed first
    const conflict = await getTransactionByIdempotencyKey(idempotencyKey)
    if (conflict) {
      return NextResponse.json({
        transactionId: conflict.id,
        checkoutUrl: null,
        status: conflict.status,
      })
    }
    console.error('[rips/purchase] insert tx error:', txError)
    return NextResponse.json(
      { error: 'Failed to create transaction. Please try again.' },
      { status: 500 },
    )
  }

  const transactionId = tx.id

  // 9. Create Stripe Checkout Session
  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(pack.price * 100),
            product_data: {
              name: `Poké Rips — ${pack.name}`,
              description: pack.description ?? undefined,
              images: pack.cover_image_url ? [pack.cover_image_url] : undefined,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        transaction_id: transactionId,
        pack_id: packId,
        pack_version_id: version.id,
        user_id: user.id,
        idempotency_key: idempotencyKey,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/rips/rip/${transactionId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/rips/${packId}?cancelled=1`,
    })
  } catch (err) {
    console.error('[rips/purchase] stripe error:', err)
    // Mark transaction as failed so it's not orphaned
    await admin
      .from('rip_transactions')
      .update({ status: 'failed', error_message: 'Stripe session creation failed.', updated_at: new Date().toISOString() })
      .eq('id', transactionId)
    return NextResponse.json(
      { error: 'Payment session could not be created. Please try again.' },
      { status: 502 },
    )
  }

  // 10. Attach Stripe session id to transaction and advance status
  await admin
    .from('rip_transactions')
    .update({
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : null,
      status: 'payment_processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)

  await writeAuditLog({
    event_type: 'purchase_initiated',
    transaction_id: transactionId,
    user_id: user.id,
    pack_id: packId,
    payload: { pack_version_id: version.id, amount: pack.price, jurisdiction: jCode },
    ip_address: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({
    transactionId,
    checkoutUrl: session.url,
    status: 'payment_processing',
  })
}
