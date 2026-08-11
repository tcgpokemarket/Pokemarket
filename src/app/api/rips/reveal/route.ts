export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { fetchCardPrice } from '@/lib/prices'

function createAdminClient() { return _createAdminClient() as any }
import { getTransactionById, getRipResultForTransaction, writeAuditLog } from '@/lib/rips'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll(toSet) { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { transactionId?: string; checkoutSessionId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }
  const { transactionId, checkoutSessionId } = body
  if (!transactionId) return NextResponse.json({ error: 'transactionId is required.' }, { status: 400 })

  const tx = await getTransactionById(transactionId, user.id)
  if (!tx) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 })
  if (['revealed', 'completed'].includes(tx.status)) {
    const result = await getRipResultForTransaction(transactionId, user.id)
    if (result) return NextResponse.json({ result })
  }
  if (tx.status === 'failed' || tx.status === 'refunded') return NextResponse.json({ error: `Transaction is ${tx.status}.` }, { status: 409 })

  if (!['paid', 'allocating', 'allocated', 'revealed', 'completed'].includes(tx.status)) {
    const sessionId = checkoutSessionId ?? tx.stripe_checkout_session_id
    if (!sessionId) return NextResponse.json({ error: 'Payment not confirmed. Complete checkout first.' }, { status: 402 })
    let session
    try { session = await stripe.checkout.sessions.retrieve(sessionId) } catch (err) {
      console.error('[rips/reveal] stripe retrieve error:', err)
      return NextResponse.json({ error: 'Unable to verify payment. Please try again.' }, { status: 502 })
    }
    if (session.payment_status !== 'paid') return NextResponse.json({ error: 'Payment has not been completed.' }, { status: 402 })
    if (session.metadata?.transaction_id !== transactionId) return NextResponse.json({ error: 'Session mismatch.' }, { status: 403 })
    const admin = createAdminClient()
    await admin.from('rip_transactions').update({ status: 'paid', payment_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', transactionId).eq('status', 'payment_processing')
    await writeAuditLog({ event_type: 'payment_confirmed', transaction_id: transactionId, user_id: user.id, pack_id: tx.pack_id, payload: { session_id: sessionId } })
  }

  if (!tx.pack_version_id) return NextResponse.json({ error: 'Pack version unavailable. Contact support.' }, { status: 500 })
  const admin = createAdminClient()
  const { data: inventoryId, error: allocErr } = await admin.rpc('allocate_rip_card', { p_transaction_id: transactionId, p_pack_id: tx.pack_id, p_pack_version_id: tx.pack_version_id, p_user_id: user.id })
  if (allocErr) {
    console.error('[rips/reveal] allocate_rip_card error:', allocErr)
    if ((allocErr.message ?? '').includes('no_inventory_available')) return NextResponse.json({ error: 'No inventory available. Contact support for a refund.' }, { status: 503 })
    return NextResponse.json({ error: 'Card allocation failed. Please try again.' }, { status: 500 })
  }

  const { data: inventory } = await admin.from('rip_physical_inventory').select('*').eq('id', inventoryId).single()
  if (!inventory) return NextResponse.json({ error: 'Inventory record missing. Contact support.' }, { status: 500 })

  // Always attempt a fresh market-price lookup at reveal time. The inventory
  // value is only the fallback if the pricing provider is unavailable.
  let livePrice: Awaited<ReturnType<typeof fetchCardPrice>> | null = null
  try { livePrice = await fetchCardPrice(inventory.card_name, inventory.set_name ?? '') } catch (err) { console.warn('[rips/reveal] pricing lookup failed; using inventory value:', err) }
  const marketValueAtRip = livePrice?.marketPrice ?? inventory.market_value ?? null
  const pricingSource = livePrice?.source ?? 'inventory_snapshot'

  const { data: result, error: resultErr } = await admin.from('rip_results').upsert({
    transaction_id: transactionId, user_id: user.id, pack_id: tx.pack_id, pack_version_id: tx.pack_version_id,
    physical_inventory_id: inventoryId, card_id: inventory.card_id, card_name: inventory.card_name, set_name: inventory.set_name,
    card_number: inventory.card_number, rarity: inventory.rarity, condition: inventory.condition, grade: inventory.grade,
    grade_company: inventory.grade_company, image_url: inventory.image_url, market_value_at_rip: marketValueAtRip,
    pack_price_at_rip: tx.amount, randomization_ref: `tx:${transactionId}`,
  }, { onConflict: 'transaction_id' }).select('*').single()
  if (resultErr || !result) return NextResponse.json({ error: 'Failed to record result. Contact support.' }, { status: 500 })

  if (livePrice) {
    await admin.from('rip_pricing_snapshots').insert({
      rip_result_id: result.id, card_name: inventory.card_name, set_name: inventory.set_name,
      market_price: livePrice.marketPrice ?? marketValueAtRip, low_price: livePrice.lowPrice ?? null,
      high_price: livePrice.highPrice ?? null, source: pricingSource,
    })
  }

  const { data: diItem } = await admin.from('digital_inventory').upsert({
    user_id: user.id, physical_inventory_id: inventoryId, rip_result_id: result.id, source_type: 'rip',
    source_transaction_id: transactionId, status: 'available', market_value_at_acquisition: marketValueAtRip,
  }, { onConflict: 'physical_inventory_id' }).select('id').single()

  await admin.from('rip_transactions').update({ status: 'revealed', revealed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', transactionId)
  await writeAuditLog({ event_type: 'card_revealed', transaction_id: transactionId, user_id: user.id, pack_id: tx.pack_id,
    physical_inventory_id: inventoryId, digital_inventory_id: diItem?.id,
    payload: { card_name: inventory.card_name, rarity: inventory.rarity, market_value: marketValueAtRip, pricing_source: pricingSource } })

  return NextResponse.json({ result: { ...result, market_value_at_rip: marketValueAtRip, pricing_source: pricingSource, price_low: livePrice?.lowPrice ?? null, price_high: livePrice?.highPrice ?? null } })
}
