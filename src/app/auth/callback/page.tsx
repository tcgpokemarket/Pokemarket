"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (
    value.startsWith("/auth") ||
    value.startsWith("/api") ||
    value.startsWith("//") ||
    value === "/login" ||
    value === "/signup"
  ) {
    return "/dashboard";
  }
  return value;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let alive = true;

    const run = async () => {
      const client = createClient();
      const code = searchParams.get("code");

      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error && alive) {
          router.replace("/auth?message=google_sign_in_failed");
          return;
        }
      }

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const [{ data: { user } }, { data: { session } }] = await Promise.all([client.auth.getUser(), client.auth.getSession()]);
        const activeUser = user ?? session?.user ?? null;

        if (!alive) return;

        if (activeUser) {
          const redirectTo = getSafeRedirect(searchParams.get("redirectTo"));
          const reason = searchParams.get("reason") === "session_expired" ? "session_expired" : null;
          const role = (activeUser.app_metadata?.role ?? activeUser.user_metadata?.role) as string | null;
          const destination = redirectTo === "/dashboard" && role === "seller" ? "/sell" : redirectTo;
          router.replace(reason ? `${destination}?reason=${encodeURIComponent(reason)}` : destination);
          return;
        }

        if (searchParams.get("reason") === "session_expired") {
          router.replace("/auth?reason=session_expired");
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (alive) router.replace("/auth");
    };

    run().catch(() => {
      if (alive) router.replace("/dashboard");
    });

    return () => {
      alive = false;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-4 text-center text-gray-200">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-2xl shadow-black/20">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-yellow-400/25 border-t-yellow-400" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">TCG Poke Market</p>
        <p className="mt-3 text-lg font-bold text-white">Completing sign in</p>
        <p className="mt-2 text-sm text-gray-400">You’ll be redirected in a moment.</p>
      </div>
    </div>
  );
}
