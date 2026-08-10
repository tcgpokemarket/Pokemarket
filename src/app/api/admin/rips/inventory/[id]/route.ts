export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/rips'

function adminDb() { return _createAdminClient() as any }

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  const { id } = await ctx.params
  const db = adminDb()

  const [{ data: card }, { data: auditLogs }, { data: snapshots }] = await Promise.all([
    db
      .from('rip_physical_inventory')
      .select('*, pack:pack_id(id, name, status), version:pack_version_id(id, version_number)')
      .eq('id', id)
      .maybeSingle(),
    db
      .from('rip_audit_logs')
      .select('*')
      .eq('physical_inventory_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('rip_pricing_snapshots')
      .select('*')
      .eq('card_name', id) // will filter by card_name below if card loaded
      .limit(0), // placeholder — overridden below
  ])

  if (!card) {
    return NextResponse.json({ error: 'Card not found.' }, { status: 404 })
  }

  // Fetch pricing snapshots by card name
  const { data: prices } = await db
    .from('rip_pricing_snapshots')
    .select('*')
    .eq('card_name', card.card_name)
    .order('recorded_at', { ascending: false })
    .limit(10)

  // Fetch rip result if card was used in a rip
  const { data: ripResult } = await db
    .from('rip_results')
    .select('*, transaction:transaction_id(id, status, created_at, user_id)')
    .eq('physical_inventory_id', id)
    .maybeSingle()

  return NextResponse.json({
    card,
    auditLogs: auditLogs ?? [],
    pricingSnapshots: prices ?? [],
    ripResult: ripResult ?? null,
  })
}

// PATCH: update card details (non-destructive fields only)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  const { id } = await ctx.params

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const db = adminDb()

  const { data: existing } = await db
    .from('rip_physical_inventory')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Card not found.' }, { status: 404 })
  }

  // Status transitions require audit + safety checks
  const newStatus = body.inventory_status
  if (newStatus && newStatus !== existing.inventory_status) {
    const protectedFrom = ['allocated', 'shipped', 'sold']
    if (protectedFrom.includes(existing.inventory_status) && !body.admin_override) {
      return NextResponse.json(
        {
          error: `Cannot change status from "${existing.inventory_status}" without admin_override: true.`,
          requires_override: true,
        },
        { status: 409 },
      )
    }
  }

  // Only allow updating safe fields
  const allowed = [
    'card_name', 'set_name', 'set_id', 'card_number', 'card_id',
    'language', 'condition', 'grade', 'grade_company', 'certification_number',
    'image_url', 'market_value', 'acquisition_cost', 'warehouse_location',
    'notes', 'inventory_status',
  ]
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data: updated, error: updateErr } = await db
    .from('rip_physical_inventory')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? undefined
  await writeAuditLog({
    event_type: newStatus && newStatus !== existing.inventory_status
      ? 'MANUAL_CORRECTION'
      : 'CARD_UPDATED',
    admin_id: auth.user.id,
    physical_inventory_id: id,
    pack_id: existing.pack_id,
    payload: {
      old_values: existing,
      new_values: update,
      admin_override: body.admin_override ?? false,
    },
    ip_address: ip,
  })

  return NextResponse.json({ card: updated })
}
