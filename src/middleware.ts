import { NextResponse, type NextRequest } from 'next/server'
import { applySecurityHeaders } from './headers'

function shouldThrottle(pathname: string) {
  return pathname.startsWith('/auth') || pathname.startsWith('/api/')
}

function buildThrottleResponse() {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}

export async function middleware(request: NextRequest) {
  if (shouldThrottle(request.nextUrl.pathname)) {
    return applySecurityHeaders(buildThrottleResponse())
  }

  return applySecurityHeaders(NextResponse.next({ request }))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
