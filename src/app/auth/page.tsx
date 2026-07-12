import { Suspense } from "react";
import AuthClient from "./AuthClient";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.18),_transparent_32%),linear-gradient(180deg,#09090f_0%,#11111c_45%,#09090f_100%)] px-4 py-10 text-white sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-8">
          <a href="/" className="inline-flex items-center gap-3 text-2xl font-black tracking-tight">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e22400] to-[#ffab01] text-sm font-black text-black shadow-lg shadow-black/30">TCG</div>
            <span className="text-white">Poke</span>
            <span className="text-yellow-400">Market</span>
          </a>

          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-yellow-400">
            Secure marketplace access
          </div>

          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Sign in to buy, sell, and manage your Pokémon collection.
            </h1>
            <p className="max-w-xl text-base leading-7 text-gray-300 sm:text-lg">
              Access your dashboard, wallet, orders, seller tools, and live auction activity from one account.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Protected seller tools",
              "Buyer checkout and orders",
              "Live auctions and watchlists",
              "Fast mobile-friendly access",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300 backdrop-blur">
                {item}
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex items-center gap-3 text-sm font-semibold text-yellow-400">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400/15 text-base">★</span>
              Trusted collector marketplace
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Keep your account, listings, and orders in one secure place while the public storefront stays open for browsing.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#0f1627]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <Suspense fallback={null}>
            <AuthClient />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
