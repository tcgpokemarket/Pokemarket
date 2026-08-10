import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isAdmin } from '@/lib/security'
import type { User } from '@supabase/supabase-js'

type AdminResult =
  | { user: User; error?: never }
  | { user?: never; error: NextResponse }

/**
 * Verify the request is from an authenticated admin.
 * Must be called at the top of every admin API route handler.
 * The service-role key is never needed here — cookie auth is sufficient
 * to establish identity; the admin client is used separately for DB ops.
 */
export async function requireAdminUser(_req?: NextRequest): Promise<AdminResult> {
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

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!isAdmin(user)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user }
}
