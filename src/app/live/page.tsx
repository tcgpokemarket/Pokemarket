import Link from "next/link";
import { listActiveLiveShows, listFeaturedLiveShows, listUpcomingLiveShows } from "@/lib/live-shows-client";

const categories = ["Pokémon", "Sealed", "Singles", "Graded", "Accessories"];

function formatState(state?: string | null) {
  return (state ?? "upcoming").replaceAll("_", " ");
}

function formatMoney(value?: number | null) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export default async function LivePage() {
  const [liveNow, featured, upcoming] = await Promise.all([
    listActiveLiveShows(),
    listFeaturedLiveShows(),
    listUpcomingLiveShows(),
  ]);

  const liveShows = [...liveNow, ...featured, ...upcoming].slice(0, 12);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.12),_transparent_28%),linear-gradient(180deg,#08111f_0%,#090b14_100%)] text-white">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-yellow-300">
              <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">Live auctions</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300">Real-time commerce</span>
            </div>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight sm:text-6xl">Watch live drops, bid in real time, and follow the action.</h1>
            <p className="max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">Browse active shows, upcoming streams, and featured sellers across Pokémon singles, sealed products, and graded cards.</p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-300">Verified sellers only</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-300">Fast room access</span>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
            <div className="text-xs uppercase tracking-[0.3em] text-yellow-300">Support</div>
            <div className="mt-2 text-lg font-black text-white">Need live auction help?</div>
            <p className="mt-2 text-sm leading-6 text-gray-300">Ask about bidding rules, giveaways, or live show issues anytime.</p>
            <Link href="/support" className="mt-4 inline-flex text-sm font-semibold text-yellow-300">Open support →</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => (
            <div key={category} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-200">
              {category}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {liveShows.length ? liveShows.map((show) => (
            <Link key={show.id} href={`/live/${show.id}`} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-yellow-400/40 hover:bg-white/8">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.3em] text-yellow-300">{formatState(show.status)}</div>
                <div className="text-xs text-gray-400">{show.viewer_count ?? 0} viewers</div>
              </div>
              <div className="mt-3 text-xl font-black text-white">{show.title}</div>
              <div className="mt-2 text-sm leading-6 text-gray-300">{show.description ?? "No description provided."}</div>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <span>{show.seller_id.slice(0, 8)}</span>
                <span>{show.created_at ? new Date(show.created_at).toLocaleString() : "Starting soon"}</span>
              </div>
            </Link>
          )) : (
            <div className="md:col-span-2 xl:col-span-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-8 text-center text-gray-300">
              No live shows are available right now.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
