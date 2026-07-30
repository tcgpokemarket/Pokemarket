import type { Metadata } from "next";
import { Suspense } from "react";
import AuthClient from "./AuthClient";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Access your TCG Poke Market account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthPage() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.16),_transparent_30%),linear-gradient(180deg,#080a12_0%,#0f1627_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <section className="rounded-[2.25rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
            <div className="mb-5 flex items-center gap-3 px-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e22400] to-[#ffab01] text-sm font-black text-black shadow-lg shadow-black/30">TCG</div>
              <div className="leading-tight">
                <div className="text-lg font-black text-white">Poke Market</div>
                <div className="text-xs uppercase tracking-[0.25em] text-gray-400">Collector-first access</div>
              </div>
            </div>
            <div className="space-y-4 text-sm text-gray-300">
              <p>Sign in to browse, buy, sell, and manage your wallet from one focused marketplace.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Google sign-in",
                  "Password reset",
                  "Remember me",
                  "Safe redirects",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">{item}</div>
                ))}
              </div>
            </div>
          </section>
          <section className="rounded-[2.25rem] border border-white/10 bg-[#0f1627]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
            <Suspense fallback={null}>
              <AuthClient />
            </Suspense>
          </section>
        </div>
      </div>
    </main>
  );
}
