export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/rips'

function createAdminClient() { return _createAdminClient() as any }
type ActionType = 'vault' | 'unvault' | 'ship' | 'sell_back'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll() { return cookieStore.getAll() }, setAll(toSet) { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { digitalInventoryId?: string; action?: ActionType; shippingCheckoutSessionId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }
  const { digitalInventoryId, action, shippingCheckoutSessionId } = body
  if (!digitalInventoryId || !action) return NextResponse.json({ error: 'digitalInventoryId and action are required.' }, { status: 400 })
  if (!(['vault', 'unvault', 'ship', 'sell_back'] as ActionType[]).includes(action)) return NextResponse.json({ error: 'Rips cards can only be vaulted, shipped after shipping is paid, or sold back to TCG Poke Market.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: item, error: fetchErr } = await admin.from('digital_inventory').select('*').eq('id', digitalInventoryId).eq('user_id', user.id).eq('source_type', 'rip').maybeSingle()
  if (fetchErr || !item) return NextResponse.json({ error: 'Rips item not found.' }, { status: 404 })
  if (item.listing_id || item.status === 'listed') return NextResponse.json({ error: 'Rips cards cannot be listed on the marketplace.' }, { status: 409 })

  if (action === 'sell_back') {
    const buybackPrice = Number(item.rip_buyback_price)
    if (!Number.isFinite(buybackPrice) || buybackPrice < 0) return NextResponse.json({ error: 'This Rips card does not have a locked buyback price.' }, { status: 409 })
    if (!['available', 'vaulted'].includes(item.status)) return NextResponse.json({ error: 'This card is not available for buyback.' }, { status: 409 })
    const { data: existing } = await admin.from('rip_buyback_requests').select('id,status,buyback_price').eq('digital_inventory_id', digitalInventoryId).maybeSingle()
    if (existing && !['rejected', 'cancelled'].includes(existing.status)) return NextResponse.json({ error: 'A buyback request already exists for this card.', request: existing }, { status: 409 })
    const { data: request, error: buybackErr } = await admin.from('rip_buyback_requests').upsert({ digital_inventory_id: digitalInventoryId, user_id: user.id, rip_result_id: item.rip_result_id, buyback_price: buybackPrice, status: 'requested', requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'digital_inventory_id' }).select('id,buyback_price,status').single()
    if (buybackErr || !request) return NextResponse.json({ error: 'Unable to create buyback request.' }, { status: 500 })
    const { error: updateErr } = await admin.from('digital_inventory').update({ status: 'locked', fulfillment_choice: 'buyback', buyback_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', digitalInventoryId).eq('user_id', user.id).in('status', ['available', 'vaulted'])
    if (updateErr) return NextResponse.json({ error: 'Unable to lock card for buyback.' }, { status: 500 })
    await writeAuditLog({ event_type: 'rip_buyback_requested', user_id: user.id, digital_inventory_id: digitalInventoryId, physical_inventory_id: item.physical_inventory_id, payload: { buyback_price: buybackPrice, source: 'rip' }, ip_address: req.headers.get('x-forwarded-for') ?? undefined })
    return NextResponse.json({ status: 'buyback_requested', requestId: request.id, buybackPrice })
  }

  if (action === 'ship') {
    if (!['available', 'vaulted'].includes(item.status)) return NextResponse.json({ error: 'This card is not available for shipping.' }, { status: 409 })
    if (shippingCheckoutSessionId) {
      try {
        const stripe = getStripe()
        const session = await stripe.checkout.sessions.retrieve(shippingCheckoutSessionId)
        if (session.metadata?.digital_inventory_id !== digitalInventoryId || session.metadata?.user_id !== user.id || session.metadata?.purpose !== 'rips_shipping') return NextResponse.json({ error: 'Invalid shipping payment session.' }, { status: 403 })
        if (session.payment_status !== 'paid') return NextResponse.json({ error: 'Shipping payment has not been completed.' }, { status: 402 })
        const { error } = await admin.from('digital_inventory').update({ status: 'shipping', fulfillment_choice: 'ship', shipping_paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', digitalInventoryId).eq('user_id', user.id).in('status', ['available', 'vaulted'])
        if (error) return NextResponse.json({ error: 'Unable to start shipping fulfillment.' }, { status: 500 })
        await writeAuditLog({ event_type: 'rip_shipping_paid', user_id: user.id, digital_inventory_id: digitalInventoryId, physical_inventory_id: item.physical_inventory_id, payload: { checkout_session_id: shippingCheckoutSessionId }, ip_address: req.headers.get('x-forwarded-for') ?? undefined })
        return NextResponse.json({ status: 'shipping', shippingPaid: true })
      } catch { return NextResponse.json({ error: 'Unable to verify shipping payment.' }, { status: 502 }) }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!appUrl) return NextResponse.json({ error: 'Site URL is not configured.' }, { status: 500 })
    const shippingCents = Math.max(0, Number(process.env.RIPS_SHIPPING_FEE_CENTS || 599))
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', unit_amount: shippingCents, product_data: { name: 'Rips card shipping' } }, quantity: 1 }],
      metadata: { purpose: 'rips_shipping', digital_inventory_id: digitalInventoryId, user_id: user.id },
      success_url: `${appUrl}/profile?rip_shipping=success&inventory_id=${digitalInventoryId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/profile?rip_shipping=cancelled&inventory_id=${digitalInventoryId}`,
    })
    return NextResponse.json({ status: item.status, requiresShippingPayment: true, shippingFeeCents: shippingCents, checkoutUrl: session.url, checkoutSessionId: session.id })
  }

  if (action === 'vault') {
    if (!['available'].includes(item.status)) return NextResponse.json({ error: 'This card cannot be vaulted from its current status.' }, { status: 409 })
    const { error } = await admin.from('digital_inventory').update({ status: 'vaulted', fulfillment_choice: 'vault', updated_at: new Date().toISOString() }).eq('id', digitalInventoryId).eq('user_id', user.id).eq('status', 'available')
    if (error) return NextResponse.json({ error: 'Unable to vault card.' }, { status: 500 })
    await writeAuditLog({ event_type: 'inventory_action_vault', user_id: user.id, digital_inventory_id: digitalInventoryId, physical_inventory_id: item.physical_inventory_id, payload: { previous_status: item.status, new_status: 'vaulted' }, ip_address: req.headers.get('x-forwarded-for') ?? undefined })
    return NextResponse.json({ status: 'vaulted', fulfillmentChoice: 'vault' })
  }

  if (action === 'unvault') {
    if (item.status !== 'vaulted') return NextResponse.json({ error: 'This card is not vaulted.' }, { status: 409 })
    const { error } = await admin.from('digital_inventory').update({ status: 'available', fulfillment_choice: 'vault', updated_at: new Date().toISOString() }).eq('id', digitalInventoryId).eq('user_id', user.id).eq('status', 'vaulted')
    if (error) return NextResponse.json({ error: 'Unable to unvault card.' }, { status: 500 })
    return NextResponse.json({ status: 'available', fulfillmentChoice: 'vault' })
  }

  return NextResponse.json({ error: 'Unsupported Rips action.' }, { status: 400 })
}
