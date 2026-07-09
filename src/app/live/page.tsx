import Link from "next/link";

const categories = ["Pokémon", "Sealed", "Singles", "Graded", "Accessories"];

const shows = [
  { id: "live-1", title: "Charizard Chase Room", description: "Big hits, fast bids, and a packed live room.", status: "live", seller_id: "collector-vault", viewer_count: 182, price: 145 },
  { id: "live-2", title: "Slab Showcase", description: "Fresh PSA and BGS slabs in the spotlight.", status: "scheduled", seller_id: "slab-society", viewer_count: 116, price: 88 },
  { id: "live-3", title: "Sealed Saturday", description: "Booster boxes, bundles, and quick drops.", status: "live", seller_id: "break-night", viewer_count: 91, price: 62 },
  { id: "live-4", title: "Vintage Hits", description: "Old-school favorites and collector grabs.", status: "scheduled", seller_id: "poke-pulse", viewer_count: 74, price: 34 },
];

function formatState(state?: string | null) {
  return (state ?? "upcoming").replaceAll("_", " ");
}

export default function LivePage() {
  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Live auctions
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Watch live drops, bid in real time, and follow the action.</h1>
            <p className="mt-4 max-w-2xl text-lg text-gray-300">
              Browse active shows, upcoming streams, and featured sellers across Pokémon singles, sealed products, and graded cards.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Verified sellers only
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">Support</div>
            <div className="mt-2 text-lg font-black text-white">Need live auction help?</div>
            <p className="mt-2 text-sm leading-6 text-gray-300">Ask about bidding rules, giveaways, or live show issues anytime.</p>
            <Link href="/support" className="mt-4 inline-flex text-sm font-semibold text-yellow-400">Open support →</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => (
            <div key={category} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
              {category}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {shows.map((show) => (
            <article key={show.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">{formatState(show.status)}</div>
              <h2 className="mt-2 text-2xl font-black">{show.title}</h2>
              <p className="mt-2 text-sm text-gray-300 line-clamp-3">{show.description ?? "No description provided."}</p>
              <div className="mt-4 space-y-2 text-sm text-gray-400">
                <div className="flex items-center justify-between"><span>Seller</span><span>{show.seller_id}</span></div>
                <div className="flex items-center justify-between"><span>Viewers</span><span>{show.viewer_count ?? 0}</span></div>
                <div className="flex items-center justify-between"><span>Products</span><span>0</span></div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400">${show.price.toFixed(2)}+</span>
                <Link href={`/live/${show.id}`} className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300">
                  Join show
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
