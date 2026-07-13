import { Suspense } from "react";
import Link from "next/link";
import AuthClient from "./AuthClient";

const trustPoints = [
  "Protected seller tools",
  "Live auction control room",
  "Secure checkout and order tracking",
  "Collector profiles and trust scores",
];

const metrics = [
  { label: "Marketplace access", value: "One secure account" },
  { label: "Seller tools", value: "Listings, payouts, live shows" },
  { label: "Buyer tools", value: "Orders, watchlists, rewards" },
];

const featureCards = [
  {
    title: "Built for collectors",
    text: "Browse, bid, and manage your collection from a single account with a cleaner, faster experience.",
  },
  {
    title: "Ready for live auctions",
    text: "Open your seller dashboard, launch a show, and move from setup to control room without extra steps.",
  },
  {
    title: "Trusted by design",
    text: "Protected routes, session-based access, and account-only seller tools help keep the marketplace secure.",
  },
  {
    title: "Mobile-friendly access",
    text: "Sign in quickly on desktop or mobile and pick up where you left off across the marketplace.",
  },
];

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(226,36,0,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(255,171,1,0.16),_transparent_22%),linear-gradient(180deg,#080a12_0%,#111625_48%,#080a12_100%)] px-4 py-8 text-white sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3 text-2xl font-black tracking-tight">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e22400] to-[#ffab01] text-sm font-black text-black shadow-lg shadow-black/30">
              TCG
            </div>
            <span className="text-white">Poke</span>
            <span className="text-yellow-400">Market</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
            <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Secure collector access
            </span>
            <Link href="/help" className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/5">
              Help
            </Link>
            <Link href="/policies" className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/5">
              Policies
            </Link>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <section className="space-y-8">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-yellow-400">
                Collector-first marketplace access
              </div>
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                  Sign in to buy, sell, and run live auctions on TcgPoké Market.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
                  Access your dashboard, listings, live shows, wallet, orders, and seller tools from one secure account built for Pokémon collectors.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-widest text-gray-500">{metric.label}</div>
                  <div className="mt-2 text-sm font-bold text-white">{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {trustPoints.map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-[#111827]/70 px-4 py-4 text-sm text-gray-200 shadow-lg shadow-black/10">
                  {item}
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {featureCards.map((card) => (
                <div key={card.title} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                  <h2 className="text-lg font-bold text-white">{card.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-gray-300">{card.text}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.75rem] border border-yellow-400/20 bg-yellow-400/10 p-5 text-sm text-yellow-50 shadow-lg shadow-yellow-400/10">
              <p className="font-semibold text-yellow-300">Fast path to your account</p>
              <p className="mt-2 leading-6 text-yellow-50/90">
                Sign in once and the marketplace will take you straight to the right experience — buyer, seller, or admin — without extra clicks.
              </p>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-[#0f1627]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
            <Suspense fallback={null}>
              <AuthClient />
            </Suspense>
          </aside>
        </div>
      </div>
    </div>
  );
}
