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
    <main className="min-h-screen bg-[#08111f] text-white">
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              TCG Poké Market
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-tight sm:text-6xl">
              A cleaner marketplace foundation for collectors and sellers.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-gray-300">
              Buy cards, run live shows, manage your wallet, and keep your shop organized in one focused experience built for production use.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/auth?redirectTo=%2F" className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-yellow-300">
                Sign in or create account
              </Link>
              <Link href="/listings" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5">
                Browse marketplace
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

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-3xl border border-white/10 bg-[#121826] p-5 transition hover:border-yellow-400/40 hover:bg-[#141b2c]">
                  <div className="text-lg font-bold text-white">{link.label}</div>
                  <p className="mt-2 text-sm leading-6 text-gray-400">{link.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-[#121826] p-6 sm:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">Collectors</div>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                Find cards, watch live drops, and keep track of what matters.
              </p>
            </div>
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">Sellers</div>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                Manage listings, shipping, verification, and wallet activity in one place.
              </p>
            </div>
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">Admins</div>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                Review users, disputes, payouts, and operational health from a secure control surface.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
