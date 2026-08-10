export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/rips'

function adminDb() { return _createAdminClient() as any }

type BulkAction = 'lock' | 'update_location' | 'unassign'

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  let body: { ids?: string[]; action?: BulkAction; location?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { ids, action } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required.' }, { status: 400 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 items per bulk operation.' }, { status: 400 })
  }

  const validActions: BulkAction[] = ['lock', 'update_location', 'unassign']
  if (!action || !validActions.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(', ')}` }, { status: 400 })
  }

  const db = adminDb()
  const ip = req.headers.get('x-forwarded-for') ?? undefined

  // Load rows to validate state
  const { data: rows, error: fetchErr } = await db
    .from('rip_physical_inventory')
    .select('id, inventory_status, pack_id, pack_version_id, card_name, warehouse_location')
    .in('id', ids)

  if (fetchErr) return NextResponse.json({ error: 'Failed to load inventory.' }, { status: 500 })

  const protectedStatuses = ['allocated', 'shipped', 'sold']
  const blocked = (rows ?? []).filter((r: any) => protectedStatuses.includes(r.inventory_status))

  if (action !== 'update_location' && blocked.length > 0) {
    return NextResponse.json(
      { error: `${blocked.length} card(s) are allocated/shipped/sold and cannot be modified.` },
      { status: 409 },
    )
  }

  let updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
  let eventType: string

  switch (action) {
    case 'lock':
      updatePayload.inventory_status = 'destroyed' // maps to LOCKED in UI
      eventType = 'CARD_LOCKED'
      break
    case 'update_location':
      if (!body.location) {
        return NextResponse.json({ error: 'location is required for update_location action.' }, { status: 400 })
      }
      updatePayload.warehouse_location = body.location
      eventType = 'CARD_UPDATED'
      break
    case 'unassign':
      updatePayload.pack_id = null
      updatePayload.pack_version_id = null
      eventType = 'CARD_UNASSIGNED'
      break
  }

  const { error: updateErr } = await db
    .from('rip_physical_inventory')
    .update(updatePayload)
    .in('id', ids)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  for (const row of rows ?? []) {
    await writeAuditLog({
      event_type: eventType,
      admin_id: auth.user.id,
      physical_inventory_id: row.id,
      pack_id: row.pack_id,
      payload: {
        action,
        card_name: row.card_name,
        old_status: row.inventory_status,
        new_status: updatePayload.inventory_status ?? row.inventory_status,
        old_location: row.warehouse_location,
        new_location: updatePayload.warehouse_location ?? row.warehouse_location,
      },
      ip_address: ip,
    })
  }

  return NextResponse.json({ updated: ids.length })
}
