"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SiteShell from "@/components/site-shell";
import { createClient } from "@/lib/supabase/client";
import { getAppRole } from "@/lib/security";

const AUTH_PATHS = ["/auth", "/auth/signin", "/auth/callback", "/auth/reset-password", "/login", "/signup"] as const;

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/about",
  "/cards",
  "/collection",
  "/help",
  "/support",
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
  "/cart",
]);

function isPathMatch(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((route) => isPathMatch(pathname, route));
}

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/profile/") || pathname.startsWith("/sellers/")) return true;
  if (pathname.startsWith("/listings/") && pathname !== "/listings/create") return true;
  return false;
}

function getRequestedPath(pathname: string, searchParams: URLSearchParams) {
  const search = searchParams.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
}

function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("/auth") || value === "/login" || value === "/signup") return null;
  return value;
}

function getDestination(userRole: ReturnType<typeof getAppRole>, redirectTo: string | null) {
  if (redirectTo) return redirectTo;
  if (userRole === "admin" || userRole === "super_admin") return "/admin";
  return "/dashboard";
}

function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-4 text-center text-gray-200">
      <div className="max-w-sm rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-yellow-400/25 border-t-yellow-400" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">TCG Poke Market</p>
        <p className="mt-3 text-lg font-bold text-white">{label}</p>
        <p className="mt-2 text-sm text-gray-400">Please wait a moment while we check your session.</p>
      </div>
    </div>
  );
}

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [authState, setAuthState] = useState<"loading" | "ready" | "redirecting">("loading");

  const isAuthPage = isAuthPath(pathname);
  const isPublicPage = isPublicPath(pathname);
  const isProtectedPage = !isPublicPage && !isAuthPage;
  const requestedPath = useMemo(() => getRequestedPath(pathname, searchParams), [pathname, searchParams]);

  useEffect(() => {
    let alive = true;
    const client = createClient();

    const run = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!alive) return;

      const redirectTo = getSafeRedirect(searchParams.get("redirectTo"));

      if (isAuthPage) {
        if (user) {
          setAuthState("redirecting");
          router.replace(getDestination(getAppRole(user), redirectTo));
          return;
        }

        setAuthState("ready");
        return;
      }

      if (isProtectedPage && !user) {
        setAuthState("redirecting");
        router.replace(`/auth?redirectTo=${encodeURIComponent(requestedPath)}`);
        return;
      }

      setAuthState("ready");
    };

    run().catch(() => {
      if (!alive) return;
      if (isProtectedPage) {
        setAuthState("redirecting");
        router.replace(`/auth?redirectTo=${encodeURIComponent(requestedPath)}`);
      } else {
        setAuthState("ready");
      }
    });

    return () => {
      alive = false;
    };
  }, [isAuthPage, isProtectedPage, pathname, requestedPath, router, searchParams]);

  if (authState !== "ready") {
    return <FullPageLoader label={isAuthPage ? "Opening your account" : "Checking access"} />;
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (isPublicPage) {
    return <SiteShell>{children}</SiteShell>;
  }

  return <SiteShell>{children}</SiteShell>;
}
