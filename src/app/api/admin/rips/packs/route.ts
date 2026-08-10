export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { getPackInventorySummary } from '@/lib/admin-rips'

function adminDb() { return _createAdminClient() as any }

// GET /api/admin/rips/packs — list all packs with versions
export async function GET(req: NextRequest) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  const sp = req.nextUrl.searchParams
  const withInventory = sp.get('inventory') === '1'
  const packId = sp.get('pack_id')

  const db = adminDb()

  if (packId && withInventory) {
    const summary = await getPackInventorySummary(packId)
    return NextResponse.json(summary)
  }

  const { data: packs } = await db
    .from('rip_packs')
    .select('id, name, status, price, available_quantity, inventory_count, active_version_id, sort_order')
    .order('sort_order')

  // Load versions for all packs
  const { data: versions } = await db
    .from('rip_pack_versions')
    .select('id, pack_id, version_number, price, activated_at, deactivated_at')
    .order('version_number')

  const versionsByPack: Record<string, any[]> = {}
  for (const v of versions ?? []) {
    if (!versionsByPack[v.pack_id]) versionsByPack[v.pack_id] = []
    versionsByPack[v.pack_id].push(v)
  }

  const result = (packs ?? []).map((p: any) => ({
    ...p,
    versions: versionsByPack[p.id] ?? [],
  }))

  return NextResponse.json({ packs: result })
}
