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
  if (!pack_id) {
    return NextResponse.json({ error: 'pack_id is required.' }, { status: 400 })
  }
  if (!pack_version_id) {
    return NextResponse.json({ error: 'pack_version_id is required.' }, { status: 400 })
  }

  const db = adminDb()

  // Load existing rows to check status safety
  const { data: existing, error: fetchErr } = await db
    .from('rip_physical_inventory')
    .select('id, inventory_status, pack_id, pack_version_id, card_name')
    .in('id', ids)

  if (fetchErr) {
    return NextResponse.json({ error: 'Failed to load inventory.' }, { status: 500 })
  }

  const protectedStatuses = ['allocated', 'shipped', 'sold']
  const blocked = (existing ?? []).filter((r: any) => protectedStatuses.includes(r.inventory_status))

  if (blocked.length > 0) {
    return NextResponse.json(
      {
        error: `${blocked.length} card(s) cannot be reassigned because they are already allocated, shipped, or sold.`,
        blocked: blocked.map((r: any) => ({ id: r.id, card_name: r.card_name, status: r.inventory_status })),
      },
      { status: 409 },
    )
  }

  const { error: updateErr } = await db
    .from('rip_physical_inventory')
    .update({
      pack_id,
      pack_version_id,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? undefined

  for (const row of existing ?? []) {
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
      },
      ip_address: ip,
    })
  }

  return NextResponse.json({ assigned: ids.length })
}
