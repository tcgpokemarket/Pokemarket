export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/rips'

function createAdminClient() { return _createAdminClient() as any }

type ActionType = 'vault' | 'unvault' | 'ship' | 'sell_back'

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

  let body: { digitalInventoryId?: string; action?: ActionType }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }

  const { digitalInventoryId, action } = body
  if (!digitalInventoryId || !action) return NextResponse.json({ error: 'digitalInventoryId and action are required.' }, { status: 400 })

  const validActions: ActionType[] = ['vault', 'unvault', 'ship', 'sell_back']
  if (!validActions.includes(action)) return NextResponse.json({ error: 'Invalid action. Rips cards can only be vaulted, shipped, or sold back to TCG Poke Market.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: item, error: fetchErr } = await admin
    .from('digital_inventory')
    .select('*')
    .eq('id', digitalInventoryId)
    .eq('user_id', user.id)
    .eq('source_type', 'rip')
    .maybeSingle()

  if (fetchErr || !item) return NextResponse.json({ error: 'Rips item not found.' }, { status: 404 })

  if (item.listing_id || item.status === 'listed') {
    return NextResponse.json({ error: 'Rips cards cannot be listed on the marketplace.' }, { status: 409 })
  }

  const allowed = getAllowedActions(item.status)
  if (!allowed.includes(action)) {
    return NextResponse.json({ error: `Cannot perform '${action}' on an item with status '${item.status}'.` }, { status: 409 })
  }

  if (action === 'sell_back') {
    const buybackPrice = Number(item.rip_buyback_price)
    if (!Number.isFinite(buybackPrice) || buybackPrice < 0) {
      return NextResponse.json({ error: 'This Rips card does not have a locked buyback price.' }, { status: 409 })
    }

    const { data: existing } = await admin
      .from('rip_buyback_requests')
      .select('id,status,buyback_price')
      .eq('digital_inventory_id', digitalInventoryId)
      .maybeSingle()

    if (existing && !['rejected', 'cancelled'].includes(existing.status)) {
      return NextResponse.json({ error: 'A buyback request already exists for this card.', request: existing }, { status: 409 })
    }

    const { data: request, error: buybackErr } = await admin
      .from('rip_buyback_requests')
      .upsert({ digital_inventory_id: digitalInventoryId, user_id: user.id, rip_result_id: item.rip_result_id, buyback_price: buybackPrice, status: 'requested', requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'digital_inventory_id' })
      .select('id,buyback_price,status')
      .single()

    if (buybackErr || !request) {
      console.error('[rips/action] buyback request error:', buybackErr)
      return NextResponse.json({ error: 'Unable to create buyback request.' }, { status: 500 })
    }

    const { error: updateErr } = await admin
      .from('digital_inventory')
      .update({ status: 'locked', fulfillment_choice: 'buyback', buyback_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', digitalInventoryId)
      .eq('user_id', user.id)
      .in('status', ['available', 'vaulted'])

    if (updateErr) return NextResponse.json({ error: 'Unable to lock card for buyback.' }, { status: 500 })

    await writeAuditLog({ event_type: 'rip_buyback_requested', user_id: user.id, digital_inventory_id: digitalInventoryId, physical_inventory_id: item.physical_inventory_id, payload: { buyback_price: buybackPrice, source: 'rip' }, ip_address: req.headers.get('x-forwarded-for') ?? undefined })

    return NextResponse.json({ status: 'buyback_requested', requestId: request.id, buybackPrice })
  }

  const newStatus = getNextStatus(action)
  const fulfillmentChoice = action === 'vault' || action === 'unvault' ? 'vault' : 'ship'

  // Shipping is intentionally not marked paid here. A shipping-payment endpoint/webhook
  // must set shipping_paid_at before fulfillment can advance beyond `shipping`.
  const { error: updateErr } = await admin
    .from('digital_inventory')
    .update({ status: newStatus, fulfillment_choice: fulfillmentChoice, updated_at: new Date().toISOString() })
    .eq('id', digitalInventoryId)
    .eq('user_id', user.id)
    .in('status', ['available', 'vaulted'])

  if (updateErr) {
    console.error('[rips/action] update error:', updateErr)
    return NextResponse.json({ error: 'Update failed. Please try again.' }, { status: 500 })
  }

  await writeAuditLog({ event_type: `inventory_action_${action}`, user_id: user.id, digital_inventory_id: digitalInventoryId, physical_inventory_id: item.physical_inventory_id, payload: { previous_status: item.status, new_status: newStatus, action, fulfillment_choice: fulfillmentChoice }, ip_address: req.headers.get('x-forwarded-for') ?? undefined })

  return NextResponse.json({ status: newStatus, fulfillmentChoice })
}

function getAllowedActions(status: string): ActionType[] {
  switch (status) {
    case 'available': return ['vault', 'ship', 'sell_back']
    case 'vaulted': return ['unvault', 'ship', 'sell_back']
    default: return []
  }
}

function getNextStatus(action: ActionType): string {
  switch (action) {
    case 'vault': return 'vaulted'
    case 'unvault': return 'available'
    case 'ship': return 'shipping'
    case 'sell_back': return 'locked'
  }
}
