export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'

function createAdminClient() { return _createAdminClient() as any }

import { writeAuditLog } from '@/lib/rips'

type ActionType = 'vault' | 'unvault' | 'list' | 'ship'

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

  let body: { digitalInventoryId?: string; action?: ActionType; price?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }

  const { digitalInventoryId, action } = body
  if (!digitalInventoryId || !action) return NextResponse.json({ error: 'digitalInventoryId and action are required.' }, { status: 400 })

  const validActions: ActionType[] = ['vault', 'unvault', 'list', 'ship']
  if (!validActions.includes(action)) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: item, error: fetchErr } = await admin
    .from('digital_inventory')
    .select('*')
    .eq('id', digitalInventoryId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr || !item) return NextResponse.json({ error: 'Item not found.' }, { status: 404 })

  const allowed = getAllowedActions(item.status)
  if (!allowed.includes(action)) {
    return NextResponse.json({ error: `Cannot perform '${action}' on an item with status '${item.status}'.` }, { status: 409 })
  }

  if (action === 'list') {
    const requestedPrice = Number(body.price)
    const marketValue = Number(item.market_value_at_acquisition ?? 0)
    const salePrice = Number.isFinite(requestedPrice) && requestedPrice > 0 ? requestedPrice : marketValue
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      return NextResponse.json({ error: 'A valid sale price is required.' }, { status: 400 })
    }

    if (item.listing_id) return NextResponse.json({ error: 'This card is already linked to a listing.' }, { status: 409 })

    const { data: physical } = item.physical_inventory_id
      ? await admin.from('rip_physical_inventory').select('*').eq('id', item.physical_inventory_id).maybeSingle()
      : { data: null }

    const { data: listing, error: listingErr } = await admin
      .from('listings')
      .insert({
        seller_id: user.id,
        card_name: physical?.card_name ?? 'Pokemon Card',
        set_name: physical?.set_name ?? 'Unknown Set',
        card_number: physical?.card_number ?? null,
        rarity: physical?.rarity ?? null,
        condition: physical?.condition ?? 'Near Mint',
        category: physical?.grade ? 'graded' : 'single',
        price: salePrice,
        quantity: 1,
        description: 'Rips Vault card',
        grade_company: physical?.grade_company ?? null,
        grade_score: physical?.grade ? Number(physical.grade) || null : null,
        images: physical?.image_url ? [physical.image_url] : [],
        status: 'active',
      })
      .select('id')
      .single()

    if (listingErr || !listing) {
      console.error('[rips/action] listing create error:', listingErr)
      return NextResponse.json({ error: 'Unable to create marketplace listing.' }, { status: 500 })
    }

    const { error: linkErr } = await admin
      .from('digital_inventory')
      .update({ status: 'listed', listing_id: listing.id, updated_at: new Date().toISOString() })
      .eq('id', digitalInventoryId)
      .eq('user_id', user.id)
      .in('status', ['available', 'vaulted'])

    if (linkErr) {
      await admin.from('listings').delete().eq('id', listing.id).eq('seller_id', user.id)
      console.error('[rips/action] inventory link error:', linkErr)
      return NextResponse.json({ error: 'Unable to link the card to its listing.' }, { status: 500 })
    }

    await writeAuditLog({
      event_type: 'inventory_action_list',
      user_id: user.id,
      digital_inventory_id: digitalInventoryId,
      physical_inventory_id: item.physical_inventory_id,
      payload: { previous_status: item.status, new_status: 'listed', action, listing_id: listing.id, price: salePrice },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ status: 'listed', listingId: listing.id, price: salePrice })
  }

  const newStatus = getNextStatus(action)
  const { error: updateErr } = await admin
    .from('digital_inventory')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', digitalInventoryId)
    .eq('user_id', user.id)

  if (updateErr) {
    console.error('[rips/action] update error:', updateErr)
    return NextResponse.json({ error: 'Update failed. Please try again.' }, { status: 500 })
  }

  await writeAuditLog({
    event_type: `inventory_action_${action}`,
    user_id: user.id,
    digital_inventory_id: digitalInventoryId,
    physical_inventory_id: item.physical_inventory_id,
    payload: { previous_status: item.status, new_status: newStatus, action },
    ip_address: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ status: newStatus })
}

function getAllowedActions(status: string): ActionType[] {
  switch (status) {
    case 'available': return ['vault', 'list', 'ship']
    case 'vaulted': return ['unvault', 'list', 'ship']
    default: return []
  }
}

function getNextStatus(action: ActionType): string {
  switch (action) {
    case 'vault': return 'vaulted'
    case 'unvault': return 'available'
    case 'ship': return 'shipping'
    case 'list': return 'listed'
  }
}
