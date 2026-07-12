import { NextResponse, type NextRequest } from 'next/server'
import { applySecurityHeaders } from './headers'

export async function middleware(request: NextRequest) {
  return applySecurityHeaders(NextResponse.next({ request }))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
