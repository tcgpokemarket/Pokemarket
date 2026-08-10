export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'

function createAdminClient() { return _createAdminClient() as any }

export async function GET(req: NextRequest) {
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

  const ripResultId = req.nextUrl.searchParams.get('ripResultId')
  if (!ripResultId) {
    return NextResponse.json({ error: 'ripResultId is required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('digital_inventory')
    .select('id, status')
    .eq('rip_result_id', ripResultId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 })
  }

  return NextResponse.json(data)
}
