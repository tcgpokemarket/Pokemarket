import Link from "next/link";
import SupportInlineCard from "@/components/support/support-inline-card";
import { listActiveLiveShows, listFeaturedLiveShows, listUpcomingLiveShows } from "@/lib/live-shows";
import type { LiveShowDirectoryItem } from "@/lib/live-shows";

export const dynamic = "force-dynamic";

const SUPPORT_PROMPT = <SupportInlineCard title="Need live auction help?" description="Ask about bidding rules, giveaways, or live show issues anytime." href="/support" />;

function formatState(state?: string | null) {
  return (state ?? "upcoming").replaceAll("_", " ");
}

function matchesSearch(show: { title: string; description: string | null }, search: string) {
  if (!search) return true;
  const haystack = `${show.title} ${show.description ?? ""}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function getPriceBand(show: LiveShowDirectoryItem) {
  const settings = (show.auction_settings as { min_price?: number; max_price?: number } | undefined) ?? {};
  return {
    min: Number(settings.min_price ?? 0),
    max: Number(settings.max_price ?? Number.MAX_SAFE_INTEGER),
  };
}

export default async function LivePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const search = typeof params.search === "string" ? params.search : "";
  const seller = typeof params.seller === "string" ? params.seller : "";
  const productType = typeof params.productType === "string" ? params.productType : "";
  const sort = typeof params.sort === "string" ? params.sort : "viewers";
  const priceMin = Number(typeof params.priceMin === "string" ? params.priceMin : 0);
  const priceMax = Number(typeof params.priceMax === "string" ? params.priceMax : Number.MAX_SAFE_INTEGER);

  let activeShows: LiveShowDirectoryItem[] = [];
  let featuredShows: LiveShowDirectoryItem[] = [];
  let upcomingShows: LiveShowDirectoryItem[] = [];

  try {
    [activeShows, featuredShows, upcomingShows] = await Promise.all([
      listActiveLiveShows(),
      listFeaturedLiveShows(),
      listUpcomingLiveShows(),
    ]);
  } catch {
    activeShows = [];
    featuredShows = [];
    upcomingShows = [];
  }

  const shows = [...activeShows, ...featuredShows, ...upcomingShows];

  const filtered = shows.filter((show) => {
    const band = getPriceBand(show);
    const matchesSeller = !seller || show.seller_id === seller;
    const matchesProductType = !productType || String((show.auction_settings as any)?.product_type ?? "").toLowerCase() === productType.toLowerCase();
    const matchesBand = band.min <= priceMax && band.max >= priceMin;
    return matchesSearch(show, search) && matchesSeller && matchesProductType && matchesBand;
  });

  const sortedShows = [...filtered].sort((a, b) => {
    if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "live") return (b.viewer_count ?? 0) - (a.viewer_count ?? 0);
    return (b.viewer_count ?? 0) - (a.viewer_count ?? 0);
  });
  const categories = ["Pokémon", "Sealed", "Singles", "Graded", "Accessories"];

  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <nav className="sticky top-0 z-50 border-b border-yellow-400/15 bg-[#08111f]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <Link href="/listings" className="hover:text-white">Listings</Link>
            <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link href="/support" className="hover:text-white">Support</Link>
          </div>
        </div>
      </nav>

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
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            {SUPPORT_PROMPT}
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
          {sortedShows.map((show) => (
            <article key={show.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">{formatState(show.status)}</div>
              <h2 className="mt-2 text-2xl font-black">{show.title}</h2>
              <p className="mt-2 text-sm text-gray-300 line-clamp-3">{show.description ?? "No description provided."}</p>
              <div className="mt-4 space-y-2 text-sm text-gray-400">
                <div className="flex items-center justify-between"><span>Seller</span><span>{show.seller_id}</span></div>
                <div className="flex items-center justify-between"><span>Viewers</span><span>{show.viewer_count ?? 0}</span></div>
                <div className="flex items-center justify-between"><span>Products</span><span>{(show as { product_count?: number }).product_count ?? 0}</span></div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400">{getPriceBand(show).min > 0 ? `$${getPriceBand(show).min.toFixed(2)}+` : "All prices"}</span>
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
