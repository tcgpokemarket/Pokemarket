export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/rips'
import { fetchCardPrice } from '@/lib/prices'

function adminDb() { return _createAdminClient() as any }

// ─── GET: list inventory with search/filter/sort/pagination ──────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50')))
  const offset = (page - 1) * limit

  const search = sp.get('search')?.trim() ?? ''
  const statusFilter = sp.get('status')?.trim() ?? ''
  const packFilter = sp.get('pack_id')?.trim() ?? ''
  const versionFilter = sp.get('pack_version_id')?.trim() ?? ''
  const gradeFilter = sp.get('grade')?.trim() ?? ''
  const langFilter = sp.get('language')?.trim() ?? ''
  const setFilter = sp.get('set_name')?.trim() ?? ''
  const condFilter = sp.get('condition')?.trim() ?? ''
  const assignedFilter = sp.get('assigned')?.trim() ?? '' // 'yes' | 'no'
  const sort = sp.get('sort') ?? 'created_at'
  const order = sp.get('order') === 'asc'

  const db = adminDb()

  let q = db
    .from('rip_physical_inventory')
    .select('*, pack:pack_id(name, status), version:pack_version_id(version_number)', { count: 'exact' })

  if (search) {
    q = q.or(
      `card_name.ilike.%${search}%,card_number.ilike.%${search}%,set_name.ilike.%${search}%,certification_number.ilike.%${search}%,id.ilike.%${search}%`,
    )
  }
  if (statusFilter) q = q.eq('inventory_status', statusFilter)
  if (packFilter) q = q.eq('pack_id', packFilter)
  if (versionFilter) q = q.eq('pack_version_id', versionFilter)
  if (gradeFilter) q = q.eq('grade', gradeFilter)
  if (langFilter) q = q.eq('language', langFilter)
  if (setFilter) q = q.ilike('set_name', `%${setFilter}%`)
  if (condFilter) q = q.eq('condition', condFilter)
  if (assignedFilter === 'yes') q = q.not('pack_id', 'is', null)
  if (assignedFilter === 'no') q = q.is('pack_id', null)

  const validSorts = ['created_at', 'updated_at', 'card_name', 'market_value', 'inventory_status']
  const safeSort = validSorts.includes(sort) ? sort : 'created_at'

  q = q.order(safeSort, { ascending: order }).range(offset, offset + limit - 1)

  const { data, count, error } = await q

  if (error) {
    console.error('[admin/rips/inventory] GET error:', error)
    return NextResponse.json({ error: 'Failed to load inventory.' }, { status: 500 })
  }

  return NextResponse.json({
    inventory: data ?? [],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

// ─── POST: create single card ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const cardName = String(body.card_name ?? '').trim()
  if (!cardName) {
    return NextResponse.json({ error: 'card_name is required.' }, { status: 400 })
  }

  const db = adminDb()

  // Duplicate check by certification number
  if (body.certification_number) {
    const { data: existing } = await db
      .from('rip_physical_inventory')
      .select('id')
      .eq('certification_number', body.certification_number.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `A card with certification number "${body.certification_number}" already exists.` },
        { status: 409 },
      )
    }
  }

  const payload = {
    card_id: body.card_id ?? null,
    card_name: cardName,
    set_name: body.set_name ?? null,
    set_id: body.set_id ?? null,
    card_number: body.card_number ?? null,
    language: body.language ?? 'en',
    condition: body.condition ?? 'NM',
    grade: body.grade ?? null,
    grade_company: body.grade_company ?? null,
    certification_number: body.certification_number ?? null,
    image_url: body.image_url ?? null,
    market_value: body.market_value != null ? parseFloat(body.market_value) : null,
    acquisition_cost: body.acquisition_cost != null ? parseFloat(body.acquisition_cost) : null,
    pack_id: body.pack_id ?? null,
    pack_version_id: body.pack_version_id ?? null,
    warehouse_location: body.warehouse_location ?? null,
    notes: body.notes ?? null,
    inventory_status: 'available',
    ownership_status: 'platform',
  }

  const { data: inserted, error: insertErr } = await db
    .from('rip_physical_inventory')
    .insert(payload)
    .select('*')
    .single()

  if (insertErr) {
    console.error('[admin/rips/inventory] POST insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Async price snapshot
  fetchCardPrice(cardName, payload.set_name ?? '').then(async (price) => {
    if (price.marketPrice !== null) {
      await db.from('rip_pricing_snapshots').insert({
        rip_result_id: null,
        card_name: cardName,
        set_name: payload.set_name,
        market_price: price.marketPrice,
        low_price: price.lowPrice,
        high_price: price.highPrice,
        source: price.source,
      }).catch(() => {})
    }
  }).catch(() => {})

  await writeAuditLog({
    event_type: 'CARD_CREATED',
    admin_id: auth.user.id,
    physical_inventory_id: inserted.id,
    pack_id: payload.pack_id ?? undefined,
    payload: { card_name: cardName, method: 'manual' },
    ip_address: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ card: inserted }, { status: 201 })
}
