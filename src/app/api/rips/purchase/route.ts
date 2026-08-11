export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe'
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
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { packId?: string; idempotencyKey?: string; jurisdiction?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }

  const { packId, idempotencyKey, jurisdiction } = body
  if (!packId || !idempotencyKey) return NextResponse.json({ error: 'packId and idempotencyKey are required.' }, { status: 400 })

  const existing = await getTransactionByIdempotencyKey(idempotencyKey)
  if (existing) {
    if (existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({
      transactionId: existing.id,
      checkoutUrl: existing.stripe_checkout_session_id ? `https://checkout.stripe.com/pay/${existing.stripe_checkout_session_id}` : null,
      status: existing.status,
    })
  }

  const pack = await getPackById(packId)
  if (!pack || pack.status !== 'active') return NextResponse.json({ error: 'Pack not available.' }, { status: 404 })
  if (pack.available_quantity <= 0) return NextResponse.json({ error: 'Pack sold out.' }, { status: 409 })

  const now = new Date().toISOString()
  if (pack.starts_at && pack.starts_at > now) return NextResponse.json({ error: 'Pack not yet available.' }, { status: 409 })
  if (pack.ends_at && pack.ends_at < now) return NextResponse.json({ error: 'Pack no longer available.' }, { status: 409 })

  const jCode = jurisdiction ?? 'US'
  if (!await isJurisdictionAllowed(jCode, packId)) return NextResponse.json({ error: 'Rips are not available in your region.' }, { status: 403 })

  const { allowed: limitOk } = await checkUserPackLimit(user.id, packId, pack.max_per_user)
  if (!limitOk) return NextResponse.json({ error: 'You have reached the purchase limit for this pack.' }, { status: 409 })

  const version = await getActivePackVersion(packId)
  if (!version) return NextResponse.json({ error: 'Pack configuration unavailable. Please try again.' }, { status: 503 })

  const admin = createAdminClient()
  const { data: tx, error: txError } = await admin.from('rip_transactions').insert({
    idempotency_key: idempotencyKey,
    user_id: user.id,
    pack_id: packId,
    pack_version_id: version.id,
    status: 'pending',
    amount: pack.price,
    currency: 'usd',
    jurisdiction: jCode,
    ip_address: req.headers.get('x-forwarded-for') ?? null,
  }).select('id').single()

  if (txError || !tx) {
    const conflict = await getTransactionByIdempotencyKey(idempotencyKey)
    if (conflict) return NextResponse.json({ transactionId: conflict.id, checkoutUrl: null, status: conflict.status })
    console.error('[rips/purchase] insert tx error:', txError)
    return NextResponse.json({ error: 'Failed to create transaction. Please try again.' }, { status: 500 })
  }

  try {
    const stripe = getStripe()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured')

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(pack.price) * 100),
          product_data: {
            name: `Poké Rips — ${pack.name}`,
            description: pack.description ?? undefined,
            images: pack.cover_image_url ? [pack.cover_image_url] : undefined,
          },
        },
        quantity: 1,
      }],
      metadata: { transaction_id: tx.id, pack_id: packId, pack_version_id: version.id, user_id: user.id, idempotency_key: idempotencyKey },
      success_url: `${appUrl}/rips/rip/${tx.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/rips/${packId}?cancelled=1`,
    })

    await admin.from('rip_transactions').update({
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      status: 'payment_processing',
      updated_at: new Date().toISOString(),
      error_message: null,
    }).eq('id', tx.id)

    await writeAuditLog({ event_type: 'purchase_initiated', transaction_id: tx.id, user_id: user.id, pack_id: packId, payload: { pack_version_id: version.id, amount: pack.price, jurisdiction: jCode }, ip_address: req.headers.get('x-forwarded-for') ?? undefined })

    return NextResponse.json({ transactionId: tx.id, checkoutUrl: session.url, status: 'payment_processing' })
  } catch (err) {
    console.error('[rips/purchase] checkout creation failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown Stripe error'
    await admin.from('rip_transactions').update({ status: 'failed', error_message: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', tx.id)
    return NextResponse.json({ error: 'Payment session could not be created. Please try again.', details: process.env.NODE_ENV === 'development' ? message : undefined }, { status: 502 })
  }
}
