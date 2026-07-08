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
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-2xl shadow-black/30 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-yellow-400">Live marketplace</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Many sellers live at once.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-300 md:text-base">
            Browse active rooms, jump between streams, and track every auction independently with separate viewers, chat, bids, and product queues.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-xs uppercase tracking-widest text-gray-500">Active live</div><div className="mt-2 text-2xl font-black text-yellow-400">{activeShows.length}</div></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-xs uppercase tracking-widest text-gray-500">Featured</div><div className="mt-2 text-2xl font-black text-yellow-400">{featuredShows.length}</div></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-xs uppercase tracking-widest text-gray-500">Upcoming</div><div className="mt-2 text-2xl font-black text-yellow-400">{upcomingShows.length}</div></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-xs uppercase tracking-widest text-gray-500">Total rooms</div><div className="mt-2 text-2xl font-black text-yellow-400">{filtered.length}</div></div>
          </div>
        </div>

        <div className="mt-6">
          {SUPPORT_PROMPT}
        </div>

        <form className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-[#13131f] p-4 md:grid-cols-6">
          <input name="search" defaultValue={search} placeholder="Search shows" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none md:col-span-2" />
          <input name="seller" defaultValue={seller} placeholder="Seller ID" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" />
          <input name="priceMin" defaultValue={params.priceMin ?? ""} placeholder="Min price" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" />
          <input name="priceMax" defaultValue={params.priceMax ?? ""} placeholder="Max price" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" />
          <select name="sort" defaultValue={sort} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none">
            <option value="viewers">Most viewers</option>
            <option value="newest">Newest live</option>
            <option value="live">Currently live</option>
          </select>
          <button className="rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black">Filter</button>
        </form>

        <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
          {categories.map((category) => (
            <span key={category} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{category}</span>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedShows.map((show) => (
            <Link
              key={show.id}
              href={`/live/${show.id}`}
              className="group rounded-3xl border border-white/10 bg-[#13131f] p-4 transition-transform duration-200 hover:-translate-y-1 hover:border-yellow-400/40 hover:shadow-2xl hover:shadow-black/30"
            >
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-gray-400">
                <span>{formatState(show.auction_state)}</span>
                <span className={`rounded-full px-3 py-1 font-semibold ${show.status === "live" ? "bg-red-400/10 text-red-300" : "bg-yellow-400/10 text-yellow-300"}`}>{show.status}</span>
              </div>
              <h2 className="mt-4 text-2xl font-black group-hover:text-yellow-400">{show.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-gray-400">{show.description ?? "Live auction show"}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-gray-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="text-xs uppercase tracking-widest text-gray-500">Viewers</div><div className="mt-1 font-bold text-white">{show.viewer_count}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="text-xs uppercase tracking-widest text-gray-500">Peak</div><div className="mt-1 font-bold text-white">{show.peak_viewers}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="text-xs uppercase tracking-widest text-gray-500">Started</div><div className="mt-1 font-bold text-white">{new Date(show.created_at).toLocaleDateString()}</div></div>
              </div>
            </Link>
          ))}
        </div>

        {!sortedShows.length && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#13131f] p-8 text-center text-gray-300">
            No live shows match these filters yet.
          </div>
        )}
      </div>
    </div>
  );
}
