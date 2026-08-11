"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeRedirect } from "@/lib/redirect";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign in");

  useEffect(() => {
    let active = true;

    const complete = async () => {
      const client = createClient();
      const code = searchParams.get("code");
      const requestedRedirect = normalizeRedirect(searchParams.get("redirectTo"));
      // Account confirmation and OAuth both finish on-site. Never send the user to a
      // Vercel dashboard/host page or an external URL.
      const redirectTo = requestedRedirect === "/dashboard" ? "/profile" : requestedRedirect;

      try {
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data: { user } } = await client.auth.getUser();
        if (!user) {
          router.replace(`/auth/signin?confirmed=pending&redirectTo=${encodeURIComponent("/profile")}`);
          return;
        }

        if (active) setMessage("Account confirmed");
        router.replace(redirectTo || "/profile");
      } catch {
        if (active) setMessage("Confirmation could not be completed");
        router.replace(`/auth/signin?confirmed=error&redirectTo=${encodeURIComponent("/profile")}`);
      }
    };

    void complete();
    return () => { active = false; };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-4 text-center text-gray-200">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-2xl shadow-black/20">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-yellow-400/25 border-t-yellow-400" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">TCG Poke Market</p>
        <p className="mt-3 text-lg font-bold text-white">{message}</p>
        <p className="mt-2 text-sm text-gray-400">Returning you to your profile.</p>
      </div>
    </div>
  );
}
