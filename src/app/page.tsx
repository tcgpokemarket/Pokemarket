import Link from "next/link";
import { getHomepageData } from "@/lib/homepage-data";
import ListingCard from "@/components/listings/ListingCard";
import type { Listing, Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type HomeListing = Listing & {
  profiles?: Pick<Profile, "username" | "seller_rating" | "verification_status"> | null;
};

export default async function Home() {
  const data = await getHomepageData();
  const listings = data.trendingMarketplace as HomeListing[];
  const showcases = data.liveNow.length ? data.liveNow : data.featuredLiveShows.length ? data.featuredLiveShows : data.upcomingLiveShows;

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="border-b border-white/10 bg-[#0f0f1a]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-black">TCG<span className="text-yellow-400">Poke</span>Market</Link>
          <div className="flex items-center gap-3">
            <Link href="/listings" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:text-white">Browse</Link>
            <Link href="/live" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:text-white">Live Shows</Link>
            <Link href="/sell" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:text-white">Sell</Link>
            <Link href="/auth" className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Sign In</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">Marketplace</p>
          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-4xl font-black sm:text-5xl">Pokémon cards</h1><p className="mt-3 max-w-2xl text-white/60">Browse active listings, live shows, and upcoming events.</p></div>
            <div className="flex gap-3"><Link href="/listings" className="rounded-xl bg-yellow-400 px-5 py-3 font-black text-black">Browse listings</Link><Link href="/live" className="rounded-xl border border-white/15 px-5 py-3 font-bold">Watch live</Link></div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Listings</h2><Link href="/listings" className="text-sm font-semibold text-yellow-400">View all</Link></div>
          {listings.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{listings.slice(0, 12).map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div> : <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">No active listings yet.</div>}
        </section>

        <section className="mt-10" aria-label="Live shows">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Live Shows</h2><Link href="/live" className="text-sm font-semibold text-yellow-400">View all</Link></div>
          {showcases.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{showcases.slice(0, 8).map((show) => <Link key={show.id} href={`/live/${show.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10"><div className="aspect-video bg-black/30">{show.thumbnail ? <img src={show.thumbnail} alt={show.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl">🎴</div>}</div><div className="p-4"><div className="flex justify-between text-xs"><span className="font-bold text-yellow-400">{show.status === "live" ? "LIVE" : "UPCOMING"}</span><span className="text-white/50">{show.viewer_count ?? 0} watching</span></div><h3 className="mt-2 line-clamp-2 font-bold">{show.title}</h3></div></Link>)}</div> : <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">No live or upcoming shows right now.</div>}
        </section>
      </div>
    </main>
  );
}
