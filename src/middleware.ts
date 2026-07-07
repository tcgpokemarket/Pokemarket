import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { applySecurityHeaders } from './headers'
import { recordAuditEvent, recordSecurityEvent } from './lib/audit-log'

const authAttempts = new Map<string, { count: number; lockedUntil: number; lastSeen: number }>()

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.ip || 'unknown'
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? 'tcgpokemarketadmin@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function isLockedOut(key: string) {
  const entry = authAttempts.get(key)
  return Boolean(entry && entry.lockedUntil > Date.now())
}

function noteFailure(key: string) {
  const current = authAttempts.get(key) ?? { count: 0, lockedUntil: 0, lastSeen: Date.now() }
  current.count += 1
  current.lastSeen = Date.now()
  if (current.count >= 8) current.lockedUntil = Date.now() + 10 * 60 * 1000
  authAttempts.set(key, current)
}

function clearFailures(key: string) {
  authAttempts.delete(key)
}

function shouldThrottle(pathname: string) {
  return pathname.startsWith('/auth') || pathname.startsWith('/api/')
}

function buildThrottleResponse() {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}

export async function middleware(request: NextRequest) {
  const clientKey = getClientKey(request)
  const pathname = request.nextUrl.pathname
  const adminEmails = getAdminEmails()

  const isProtected = ['/sell', '/dashboard', '/admin', '/api/admin'].some((p) => pathname.startsWith(p))

  if (shouldThrottle(pathname) && isLockedOut(clientKey)) {
    return applySecurityHeaders(buildThrottleResponse())
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (isProtected && !user) {
      if (shouldThrottle(pathname)) noteFailure(clientKey)

      const url = request.nextUrl.clone()
      url.pathname = '/auth/signin'
      url.searchParams.set('redirectTo', request.nextUrl.pathname)

      return applySecurityHeaders(NextResponse.redirect(url))
    }
  }

  if (shouldThrottle(pathname)) clearFailures(clientKey)

  return applySecurityHeaders(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
