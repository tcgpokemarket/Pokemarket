export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/rips'

function adminDb() { return _createAdminClient() as any }

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  let body: { ids?: string[]; pack_id?: string; pack_version_id?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { ids, pack_id, pack_version_id } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required.' }, { status: 400 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 items per bulk operation.' }, { status: 400 })
  }
  if (!pack_id) {
    return NextResponse.json({ error: 'pack_id is required.' }, { status: 400 })
  }
  if (!pack_version_id) {
    return NextResponse.json({ error: 'pack_version_id is required.' }, { status: 400 })
  }

  const db = adminDb()

  // Validate the selected pack and version before touching inventory.
  const [{ data: pack, error: packErr }, { data: version, error: versionErr }] = await Promise.all([
    db.from('rip_packs').select('id, name').eq('id', pack_id).maybeSingle(),
    db.from('rip_pack_versions').select('id, pack_id, version_number').eq('id', pack_version_id).maybeSingle(),
  ])

  if (packErr || !pack) {
    return NextResponse.json({ error: 'Selected pack was not found.' }, { status: 404 })
  }
  if (versionErr || !version) {
    return NextResponse.json({ error: 'Selected pack version was not found.' }, { status: 404 })
  }
  if (version.pack_id !== pack_id) {
    return NextResponse.json({ error: 'Selected pack version does not belong to the selected pack.' }, { status: 400 })
  }

  // Load existing rows to check status safety.
  const { data: existing, error: fetchErr } = await db
    .from('rip_physical_inventory')
    .select('id, inventory_status, pack_id, pack_version_id, card_name')
    .in('id', ids)

  if (fetchErr) {
    return NextResponse.json({ error: 'Failed to load inventory.' }, { status: 500 })
  }

  if (!existing || existing.length !== ids.length) {
    return NextResponse.json({ error: 'One or more selected inventory cards were not found.' }, { status: 404 })
  }

  const protectedStatuses = ['allocated', 'shipped', 'sold', 'returned', 'destroyed']
  const blocked = existing.filter((r: any) => protectedStatuses.includes(r.inventory_status))

  if (blocked.length > 0) {
    return NextResponse.json(
      {
        error: `${blocked.length} card(s) cannot be reassigned because they are already allocated, shipped, or sold.`,
        blocked: blocked.map((r: any) => ({ id: r.id, card_name: r.card_name, status: r.inventory_status })),
      },
      { status: 409 },
    )
  }

  // Assignment is a real inventory state transition. Keep the pack, version,
  // and status synchronized so the card immediately appears as allocated to
  // the selected pack/version everywhere in the admin UI and in rip allocation.
  const { error: updateErr } = await db
    .from('rip_physical_inventory')
    .update({
      pack_id,
      pack_version_id,
      inventory_status: 'allocated',
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? undefined

  for (const row of existing) {
    await writeAuditLog({
      event_type: 'PACK_ASSIGNED',
      admin_id: auth.user.id,
      physical_inventory_id: row.id,
      pack_id,
      payload: {
        old_pack_id: row.pack_id,
        old_pack_version_id: row.pack_version_id,
        new_pack_id: pack_id,
        new_pack_version_id: pack_version_id,
        card_name: row.card_name,
        new_inventory_status: 'allocated',
      },
      ip_address: ip,
    })
  }

  return NextResponse.json({
    assigned: ids.length,
    pack_id,
    pack_version_id,
    status: 'allocated',
  })
}
