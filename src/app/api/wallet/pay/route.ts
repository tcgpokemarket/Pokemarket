import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

async function getClient() {
  const store = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: () => {} } })
}

export async function POST(req: Request) {
  try {
    const supabase = await getClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { listingId, quantity = 1, idempotencyKey } = await req.json()
    if (!listingId || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 })
    const admin = createAdminClient() as any
    const { data: listing, error: listingError } = await admin.from('listings').select('*').eq('id', listingId).maybeSingle()
    if (listingError) return NextResponse.json({ error: 'Listing lookup failed' }, { status: 500 })
    if (!listing || listing.status !== 'active') return NextResponse.json({ error: 'Listing unavailable' }, { status: 400 })
    if (listing.seller_id === user.id) return NextResponse.json({ error: 'You cannot purchase your own listing.' }, { status: 400 })
    const unitPrice = Number(listing.price)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return NextResponse.json({ error: 'Invalid listing price' }, { status: 400 })
    if (quantity > Number(listing.quantity ?? 1)) return NextResponse.json({ error: 'Insufficient quantity available.' }, { status: 409 })
    const total = Math.round(unitPrice * 100 * quantity) / 100
    const key = idempotencyKey || `wallet-${user.id}-${listingId}-${quantity}-${Date.now()}`

    const { data: balance, error: debitError } = await supabase.rpc('wallet_debit_customer', { p_user_id: user.id, p_amount: total, p_reference_id: listingId, p_idempotency_key: key })
    if (debitError) {
      const message = debitError.message?.includes('insufficient_wallet_balance') ? 'Insufficient wallet balance.' : 'Wallet payment failed.'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { data: order, error: orderError } = await admin.from('orders').insert({ buyer_id: user.id, seller_id: listing.seller_id, listing_id: listing.id, unit_price: listing.price, quantity, total_amount: Math.round(total * 100), status: 'paid', created_at: new Date().toISOString() }).select().single()
    if (orderError) {
      await supabase.rpc('wallet_credit_customer', { p_user_id: user.id, p_amount: total, p_reference_id: listingId, p_idempotency_key: `${key}-rollback` })
      return NextResponse.json({ error: 'Order creation failed; wallet payment was reversed.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, orderId: order.id, balance })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Wallet checkout failed' }, { status: 500 })
  }
}
