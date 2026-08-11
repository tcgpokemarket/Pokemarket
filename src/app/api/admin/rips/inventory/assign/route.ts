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
    db.from('rip_packs').select('id, name, status, active_version_id').eq('id', pack_id).maybeSingle(),
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

  // A card assigned to a pack is still inventory available for the rip.
  // 'allocated' is reserved for the moment a paid rip transaction claims it.
  const protectedStatuses = ['shipped', 'sold', 'returned', 'destroyed']
  const blocked = existing.filter((r: any) => protectedStatuses.includes(r.inventory_status))

  if (blocked.length > 0) {
    return NextResponse.json(
      {
        error: `${blocked.length} card(s) cannot be reassigned because they are already shipped, sold, returned, or destroyed.`,
        blocked: blocked.map((r: any) => ({ id: r.id, card_name: r.card_name, status: r.inventory_status })),
      },
      { status: 409 },
    )
  }

  // Assignment links the card to the pack/version but keeps it available so
  // the public Rips allocator can select it. A successful paid rip changes
  // this same row to 'allocated'.
  const { error: updateErr } = await db
    .from('rip_physical_inventory')
    .update({
      pack_id,
      pack_version_id,
      inventory_status: 'available',
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Keep the denormalized pack inventory fields synchronized with the actual
  // physical inventory. Make the assigned pack/version live once an admin has
  // explicitly put inventory into it; empty packs remain draft/sold-out.
  const { count: availableCount, error: countErr } = await db
    .from('rip_physical_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('pack_id', pack_id)
    .eq('inventory_status', 'available')

  if (countErr) {
    return NextResponse.json({ error: 'Cards assigned, but pack inventory count could not be synchronized.' }, { status: 500 })
  }

  const { count: totalCount, error: totalErr } = await db
    .from('rip_physical_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('pack_id', pack_id)

  if (totalErr) {
    return NextResponse.json({ error: 'Cards assigned, but pack inventory total could not be synchronized.' }, { status: 500 })
  }

  const packUpdate: Record<string, unknown> = {
    inventory_count: totalCount ?? 0,
    available_quantity: availableCount ?? 0,
    active_version_id: pack_version_id,
    status: 'active',
    updated_at: new Date().toISOString(),
  }

  const { error: packUpdateErr } = await db
    .from('rip_packs')
    .update(packUpdate)
    .eq('id', pack_id)

  if (packUpdateErr) {
    return NextResponse.json({ error: `Cards assigned, but pack could not be synchronized: ${packUpdateErr.message}` }, { status: 500 })
  }

  // Version 1 must be marked active when it becomes the pack's active version.
  await db
    .from('rip_pack_versions')
    .update({ activated_at: new Date().toISOString(), deactivated_at: null })
    .eq('id', pack_version_id)

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
        old_inventory_status: row.inventory_status,
        new_pack_id: pack_id,
        new_pack_version_id: pack_version_id,
        card_name: row.card_name,
        new_inventory_status: 'available',
      },
      ip_address: ip,
    })
  }

  return NextResponse.json({
    assigned: ids.length,
    pack_id,
    pack_version_id,
    status: 'available',
    pack_status: 'active',
    inventory_count: totalCount ?? 0,
    available_quantity: availableCount ?? 0,
  })
}
