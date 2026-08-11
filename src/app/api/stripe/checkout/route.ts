/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function adminDb() { return _createAdminClient() as any }

async function getUserFromRequest() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
  )
  return supabase.auth.getUser()
}

export async function POST(req: Request) {
  try {
    const { data: { user }, error: authError } = await getUserFromRequest()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { listingId, quantity = 1, idempotencyKey } = body as { listingId?: string; quantity?: number; idempotencyKey?: string }
    if (!listingId) return NextResponse.json({ error: 'missing listingId' }, { status: 400 })
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return NextResponse.json({ error: 'invalid quantity' }, { status: 400 })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' as '2026-06-24.dahlia' })
    const admin = adminDb()

    const { data: listing, error: listErr } = await admin.from('listings').select('*').eq('id', listingId).maybeSingle()
    if (listErr) return NextResponse.json({ error: 'listing lookup failed' }, { status: 500 })
    if (!listing || listing.status !== 'active') return NextResponse.json({ error: 'Listing unavailable' }, { status: 400 })
    if (listing.seller_id === user.id) return NextResponse.json({ error: 'You cannot purchase your own listing.' }, { status: 400 })
    if (Number(listing.price) <= 0) return NextResponse.json({ error: 'Invalid listing price' }, { status: 400 })
    if (quantity > Number(listing.quantity ?? 1)) return NextResponse.json({ error: 'Insufficient quantity available.' }, { status: 409 })

    // Rips Vault cards represent one physical/digital item and must never be split across orders.
    const { data: ripInventory } = await admin.from('digital_inventory').select('id,status,user_id').eq('listing_id', listing.id).maybeSingle()
    if (ripInventory) {
      if (ripInventory.user_id !== listing.seller_id || ripInventory.status !== 'listed') return NextResponse.json({ error: 'Vault item is unavailable.' }, { status: 409 })
      if (quantity !== 1) return NextResponse.json({ error: 'Vault cards can only be purchased one at a time.' }, { status: 400 })
    }

    const orderPayload: any = {
      buyer_id: user.id,
      seller_id: listing.seller_id,
      listing_id: listing.id,
      unit_price: listing.price,
      quantity,
      total_amount: Math.round(Number(listing.price) * 100) * quantity,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    const { data: orderData, error: orderErr } = await admin.from('orders').insert(orderPayload).select().single()
    if (orderErr) return NextResponse.json({ error: 'order creation failed' }, { status: 500 })

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'usd', product_data: { name: listing.card_name }, unit_amount: Math.round(Number(listing.price) * 100) }, quantity }],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/orders/${orderData.id}/thank-you`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/listings/${listingId}`,
        metadata: { order_id: orderData.id },
      },
      { idempotencyKey: idempotencyKey ?? `checkout-${orderData.id}` },
    )

    await admin.from('orders').update({ stripe_checkout_session_id: session.id }).eq('id', orderData.id)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
