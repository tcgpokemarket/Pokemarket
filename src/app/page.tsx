import Link from "next/link";
import { getHomepageData } from "@/lib/homepage-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getHomepageData();
  const showcases = data.liveNow.length ? data.liveNow : data.featuredLiveShows.length ? data.featuredLiveShows : data.upcomingLiveShows;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.12),_transparent_28%),linear-gradient(180deg,#09090f_0%,#11111c_46%,#09090f_100%)] px-4 py-6 text-white sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-2xl font-black tracking-tight">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e22400] to-[#ffab01] text-sm font-black text-black">TCG</div>
            <span>Poke<span className="text-yellow-400">Market</span></span>
          </Link>
          <Link href="/auth" className="rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-black">Sign in</Link>
        </header>

        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-400">Live showcases</p>
              <h1 className="mt-2 text-4xl font-black sm:text-5xl">Watch what's happening now.</h1>
              <p className="mt-3 text-white/60">Browse live Pokémon shows without signing in. Sign in only when you want to participate.</p>
            </div>
          </div>

          {showcases.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
              <h2 className="text-2xl font-black">No live showcases right now</h2>
              <p className="mt-2 text-white/60">Check back soon for live shows and upcoming events.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {showcases.map((show) => (
                <Link key={show.id} href={`/live/${show.id}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:bg-white/10">
                  <div className="aspect-video overflow-hidden bg-black/30">
                    {show.thumbnail ? <img src={show.thumbnail} alt={show.title} className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-5xl">🎴</div>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-300">{show.status === "live" ? "LIVE" : "UPCOMING"}</span>
                      <span className="text-xs text-white/50">{show.viewer_count ?? 0} watching</span>
                    </div>
                    <h2 className="mt-3 line-clamp-2 font-bold">{show.title}</h2>
                    {show.description && <p className="mt-1 line-clamp-2 text-sm text-white/50">{show.description}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
