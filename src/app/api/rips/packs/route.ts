export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getActivePacks } from '@/lib/rips'

export async function GET() {
  try {
    const packs = await getActivePacks()

    // Strip jurisdiction_availability — clients must not receive the full rules map
    const safe = packs.map(({ jurisdiction_availability: _j, ...rest }) => rest)

    return NextResponse.json({ packs: safe })
  } catch (err) {
    console.error('[rips/packs] GET error:', err)
    return NextResponse.json({ error: 'Unable to load packs.' }, { status: 500 })
  }
}
