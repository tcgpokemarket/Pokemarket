import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applySecurityHeaders } from "./headers";
import type { AppRole } from "./lib/security";

const PUBLIC_PATHS = [
  "/auth",
  "/auth/signin",
  "/auth/callback",
  "/auth/reset-password",
  "/login",
  "/signup",
  "/about",
  "/cards",
  "/collection",
  "/help",
  "/live",
  "/listings",
  "/policies",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/shipping-policy",
  "/seller-agreement",
  "/marketplace-rules",
  "/dmca",
] as const;

function isPathMatch(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((route) => isPathMatch(pathname, route));
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("/auth") || value === "/login" || value === "/signup") return "/dashboard";
  return value;
}

function getDestination(role: AppRole | null, redirectTo: string | null) {
  if (redirectTo) return redirectTo;
  if (role === "admin" || role === "super_admin") return "/admin";
  return "/dashboard";
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isAuthPage = isPathMatch(pathname, "/auth") || pathname === "/login" || pathname === "/signup";
  const isPublicPage = isPublicPath(pathname);
  const isProtectedPage = !isPublicPage && !isAuthPage && !isApiPath(pathname);
  const isProtectedApi = isApiPath(pathname);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAuthPage && user) {
    const redirectTo = getSafeRedirect(searchParams.get("redirectTo"));
    const url = new URL(getDestination((user.app_metadata?.role ?? user.user_metadata?.role) as AppRole | null, redirectTo), request.url);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  if ((isProtectedPage || isProtectedApi) && !user) {
    if (isProtectedApi) {
      return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    const url = new URL(`/auth?redirectTo=${encodeURIComponent(`${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`)}`, request.url);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
