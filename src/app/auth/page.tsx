import type { Metadata } from "next";
import { Suspense } from "react";
import AuthClient from "./AuthClient";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Access your TCG Poke Market account, listings, wallet, and seller tools.",
  robots: {
    index: false,
    follow: false,
  },
};

const highlights = [
  "Secure email sign in",
  "Seller and wallet access",
  "Live show and listing tools",
  "Protected account routing",
] as const;

export default function AuthPage() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.16),_transparent_30%),linear-gradient(180deg,#080a12_0%,#0f1627_100%)] px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-6 rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-yellow-400">
            TCG Poke Market
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              A premium account gateway for collectors, sellers, and live commerce.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
              Sign in to manage your wallet, listings, orders, seller tools, and protected account pages in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {highlights.map((highlight) => (
              <div key={highlight} className="rounded-2xl border border-white/10 bg-[#121826] px-4 py-4 text-sm text-gray-300">
                {highlight}
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-[#121826] p-5">
              <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">Buyers</div>
              <p className="mt-3 text-sm leading-6 text-gray-300">Browse listings, complete purchases, and keep track of your collection.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#121826] p-5">
              <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">Sellers</div>
              <p className="mt-3 text-sm leading-6 text-gray-300">Create listings, run live shows, and monitor wallet balances.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#121826] p-5">
              <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">Admins</div>
              <p className="mt-3 text-sm leading-6 text-gray-300">Review operational tools with protected access and role-based routing.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-[2.5rem] border border-white/10 bg-[#0f1627]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Suspense fallback={null}>
            <AuthClient />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
