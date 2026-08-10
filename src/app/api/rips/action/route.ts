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
  // 1. Authenticate
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse
  let body: { digitalInventoryId?: string; action?: ActionType }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { digitalInventoryId, action } = body

  if (!digitalInventoryId || !action) {
    return NextResponse.json(
      { error: 'digitalInventoryId and action are required.' },
      { status: 400 },
    )
  }

  const validActions: ActionType[] = ['vault', 'unvault', 'list', 'ship']
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 3. Load and assert ownership
  const { data: item, error: fetchErr } = await admin
    .from('digital_inventory')
    .select('*')
    .eq('id', digitalInventoryId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr || !item) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 })
  }

  // 4. Validate allowed transitions
  const allowed = getAllowedActions(item.status)
  if (!allowed.includes(action)) {
    return NextResponse.json(
      { error: `Cannot perform '${action}' on an item with status '${item.status}'.` },
      { status: 409 },
    )
  }

  // 5. Apply transition
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
    payload: {
      previous_status: item.status,
      new_status: newStatus,
      action,
    },
    ip_address: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ status: newStatus })
}

function getAllowedActions(status: string): ActionType[] {
  switch (status) {
    case 'available':
      return ['vault', 'list', 'ship']
    case 'vaulted':
      return ['unvault', 'list', 'ship']
    default:
      return []
  }
}

function getNextStatus(action: ActionType): string {
  switch (action) {
    case 'vault':
      return 'vaulted'
    case 'unvault':
      return 'available'
    case 'list':
      return 'allocated'
    case 'ship':
      return 'shipping'
  }
}
