"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SiteShell from "@/components/site-shell";
import { createClient } from "@/lib/supabase/client";
import { getAppRole } from "@/lib/security";
import { normalizeRedirect, buildRedirectForProvider } from "@/lib/redirect";
import LiveShowFormLabels from "@/components/live/LiveShowFormLabels";

const AUTH_PATHS = ["/auth", "/auth/signin", "/auth/callback", "/auth/reset-password"] as const;

const PUBLIC_PATHS = new Set(AUTH_PATHS);
const PROTECTED_EXACT_PATHS = new Set([
  "/dashboard",
  "/messages",
  "/sell",
  "/admin",
]);
const PROTECTED_PREFIXES = ["/dashboard/", "/messages/", "/sell/", "/admin/"];

function isPathMatch(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((route) => isPathMatch(pathname, route));
}

function isProtectedPath(pathname: string) {
  return PROTECTED_EXACT_PATHS.has(pathname) || PROTECTED_PREFIXES.some((route) => pathname.startsWith(route));
}

function getRequestedPath(pathname: string, searchParams: URLSearchParams) {
  const search = searchParams.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
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
  const [authState, setAuthState] = useState<"loading" | "ready">("loading");

  const isAuthPage = isAuthPath(pathname);
  const isProtectedPage = isProtectedPath(pathname);
  const requestedPath = useMemo(() => getRequestedPath(pathname, searchParams), [pathname, searchParams]);

  useEffect(() => {
    let alive = true;
    const client = createClient();

    const run = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!alive) return;

      const currentHash = typeof window !== "undefined" ? window.location.hash : "";
      const rawRedirect = searchParams.get("redirectTo");
      const redirectTo = rawRedirect ? normalizeRedirect(rawRedirect) : null;

      if (isAuthPage) {
        if (user) {
          router.replace(getDestination(getAppRole(user), redirectTo));
          return;
        }
        setAuthState("ready");
        return;
      }

      if (isProtectedPage && !user) {
        const encoded = buildRedirectForProvider(requestedPath, currentHash);
        router.replace(`/auth?redirectTo=${encoded}`);
        return;
      }

      setAuthState("ready");
    };

    run().catch(() => {
      if (!alive) return;
      if (isProtectedPage) {
        const currentHash = typeof window !== "undefined" ? window.location.hash : "";
        const encoded = buildRedirectForProvider(requestedPath, currentHash);
        router.replace(`/auth?redirectTo=${encoded}`);
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

  return (
    <SiteShell>
      {children}
      <LiveShowFormLabels />
    </SiteShell>
  );
}
