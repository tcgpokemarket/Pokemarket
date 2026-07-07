import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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
  if (current.count >= 8) {
    current.lockedUntil = Date.now() + 10 * 60 * 1000
  }
  authAttempts.set(key, current)
}

function clearFailures(key: string) {
  authAttempts.delete(key)
}

function shouldThrottle(pathname: string) {
  return pathname.startsWith('/auth') || pathname.startsWith('/api/')
}

function buildThrottleResponse(request: NextRequest) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}

export async function middleware(request: NextRequest) {
  const clientKey = getClientKey(request)
  const pathname = request.nextUrl.pathname
  const adminEmails = getAdminEmails()
  const isProtected = ['/sell', '/dashboard', '/admin', '/api/admin'].some((p) => pathname.startsWith(p))
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (shouldThrottle(pathname) && isLockedOut(clientKey)) {
    return applySecurityHeaders(buildThrottleResponse(request))
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              path: '/',
            })
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = Boolean(user?.email && adminEmails.includes(user.email.toLowerCase()))

  if (shouldThrottle(pathname) && user) {
    clearFailures(clientKey)
  }

  if (isProtected && !user) {
    if (shouldThrottle(pathname)) noteFailure(clientKey)
    recordAuditEvent({
      event_type: 'api.denied',
      actor_id: null,
      action: 'protected_route_redirect',
      resource_type: 'route',
      resource_id: pathname,
      previous_value: null,
      new_value: null,
      ip_address: clientKey,
      user_agent: request.headers.get('user-agent'),
    })
    recordSecurityEvent({
      event_type: 'auth.redirect',
      severity: 'medium',
      ip_address: clientKey,
      user_agent: request.headers.get('user-agent'),
      details: { pathname },
    })
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  if (isAdminPath && !isAdmin) {
    recordAuditEvent({
      event_type: 'api.denied',
      actor_id: user?.id ?? null,
      action: 'admin_route_redirect',
      resource_type: 'route',
      resource_id: pathname,
      previous_value: null,
      new_value: null,
      ip_address: clientKey,
      user_agent: request.headers.get('user-agent'),
    })
    recordSecurityEvent({
      event_type: 'auth.admin_block',
      severity: 'high',
      actor_id: user?.id ?? null,
      ip_address: clientKey,
      user_agent: request.headers.get('user-agent'),
      details: { pathname },
    })
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return applySecurityHeaders(NextResponse.redirect(url))
  }

  return applySecurityHeaders(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
