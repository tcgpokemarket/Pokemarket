"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeRedirect } from "@/lib/redirect";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // searchParams.get("redirectTo") may be encoded by the provider; normalizeRedirect
    // safely decodes once, enforces same-origin and loop protection, and returns a path.
    const redirectTo = normalizeRedirect(searchParams.get("redirectTo"));
    router.replace(redirectTo);
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
