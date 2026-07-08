import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buy, Sell & Trade Pokémon Cards",
  description: "TCG Poke Market is a collector-focused Pokémon TCG marketplace for singles, sealed products, graded cards, and live auctions.",
};

const highlights = [
  {
    title: "Trusted marketplace",
    text: "Buy and sell with clear listings, seller profiles, and transparent checkout breakdowns.",
  },
  {
    title: "Collector-first catalog",
    text: "Browse Pokémon singles, sealed products, graded cards, and accessories in one place.",
  },
  {
    title: "Live events",
    text: "Run live breaks, auctions, and drops with real-time commerce tools.",
  },
];

const links = [
  { href: "/listings", label: "Browse listings" },
  { href: "/sell", label: "Sell cards" },
  { href: "/cards", label: "Card lookup" },
  { href: "/cart", label: "Cart" },
  { href: "/live", label: "Live shows" },
  { href: "/about", label: "About us" },
  { href: "/help", label: "Help & support" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <section>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-400">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              Pokémon TCG marketplace
            </div>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Buy, sell, and trade Pokémon cards with confidence.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-300">
              A collector-focused marketplace for singles, sealed products, graded cards, and live auctions — with transparent checkout and seller tools.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/listings" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300">
                Browse listings
              </a>
              <a href="/live" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
                View live shows
              </a>
              <a href="/sell" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
                Sell cards
              </a>
            </div>
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-4">
              {highlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                  <div className="text-sm font-semibold text-yellow-400">{item.title}</div>
                  <p className="mt-2 text-sm text-gray-300">{item.text}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {links.map((link) => (
              <a key={link.label} href={link.href} className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-gray-200 transition hover:border-yellow-400/40 hover:text-yellow-300">
                {link.label}
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
