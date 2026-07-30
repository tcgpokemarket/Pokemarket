import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "TCG Poke Market | Buy, Sell & Go Live",
  description: "A cleaner marketplace foundation for Pokémon cards, live shows, seller tools, and account management.",
};

const quickLinks = [
  { href: "/listings", label: "Browse marketplace", description: "Shop singles, sealed products, and graded cards." },
  { href: "/live", label: "Live auctions", description: "Watch live shows and join active auctions." },
  { href: "/sell", label: "Seller tools", description: "Create listings, manage stock, and run shows." },
  { href: "/dashboard", label: "Dashboard", description: "Review wallet, orders, listings, and payouts." },
] as const;

const pillars = [
  "Clean auth and routing",
  "Protected seller and admin flows",
  "Wallet and order visibility",
  "Mobile-first marketplace layout",
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.12),_transparent_28%),linear-gradient(180deg,#08111f_0%,#090b14_100%)] text-white">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-yellow-300">
              <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">TCG Poké Market</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300">Collector-first marketplace</span>
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">
                A premium marketplace foundation for collectors and sellers.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
                Buy cards, run live shows, manage your wallet, and keep your shop organized in one focused experience built for daily marketplace work.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/auth?redirectTo=%2F" className="rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-yellow-300">
                Sign in or create account
              </Link>
              <Link href="/listings" className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5">
                Browse marketplace
              </Link>
              <Link href="/sell" className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5">
                Sell cards
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {pillars.map((pillar) => (
                <div key={pillar} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
                  {pillar}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-[1.5rem] border border-white/10 bg-[#121826] p-5 transition hover:-translate-y-0.5 hover:border-yellow-400/40 hover:bg-[#141b2c]">
                  <div className="text-lg font-bold text-white">{link.label}</div>
                  <p className="mt-2 text-sm leading-6 text-gray-400">{link.description}</p>
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Built for</div>
              <div className="mt-2 text-sm text-gray-300">Mobile browsing, live auctions, quick listing creation, and fast account access.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-sm uppercase tracking-[0.3em] text-yellow-300">Collectors</div>
            <p className="mt-3 text-sm leading-7 text-gray-300">Find cards, watch live drops, and keep track of what matters.</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-sm uppercase tracking-[0.3em] text-yellow-300">Sellers</div>
            <p className="mt-3 text-sm leading-7 text-gray-300">Manage listings, shipping, verification, and wallet activity in one place.</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-sm uppercase tracking-[0.3em] text-yellow-300">Admins</div>
            <p className="mt-3 text-sm leading-7 text-gray-300">Review users, disputes, payouts, and operational health from a secure control surface.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
