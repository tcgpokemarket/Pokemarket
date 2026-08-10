export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'
import { getInventoryStats } from '@/lib/admin-rips'

export async function GET() {
  const auth = await requireAdminUser()
  if (auth.error) return auth.error

  try {
    const stats = await getInventoryStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[admin/rips/inventory/stats]', err)
    return NextResponse.json({ error: 'Failed to load stats.' }, { status: 500 })
  }
}
