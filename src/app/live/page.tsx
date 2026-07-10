import Link from "next/link";

const categories = ["Pokémon", "Sealed", "Singles", "Graded", "Accessories"];

function formatState(state?: string | null) {
  return (state ?? "upcoming").replaceAll("_", " ");
}

type LiveShowRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  seller_id: string;
  viewer_count: number | null;
  scheduled_start: string | null;
  auction_settings: Record<string, unknown> | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function buildRestUrl(table: string, select: string, filters: Array<[string, string]> = [], limit = 1000) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  url.searchParams.set("limit", String(limit));
  for (const [key, value] of filters) url.searchParams.set(key, value);
  return url;
}

async function fetchPublicRows<T>(table: string, select: string, filters: Array<[string, string]> = [], limit = 1000) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [] as T[];

  const response = await fetch(buildRestUrl(table, select, filters, limit).toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    cache: "force-cache",
  });

  if (!response.ok) return [] as T[];
  return (await response.json()) as T[];
}

export default async function LivePage() {
  const shows = await fetchPublicRows<LiveShowRow>(
    "live_shows",
    "id, title, description, status, seller_id, viewer_count, scheduled_start, auction_settings",
    [["order", "created_at.desc"]],
    12,
  );

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

        {!shows.length ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-gray-300">
            No live shows are scheduled yet.
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {shows.map((show) => (
              <article key={show.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">{formatState(show.status)}</div>
                <h2 className="mt-2 text-2xl font-black">{show.title}</h2>
                <p className="mt-2 text-sm text-gray-300 line-clamp-3">{show.description ?? "No description provided."}</p>
                <div className="mt-4 space-y-2 text-sm text-gray-400">
                  <div className="flex items-center justify-between"><span>Seller</span><span>{show.seller_id}</span></div>
                  <div className="flex items-center justify-between"><span>Viewers</span><span>{show.viewer_count ?? 0}</span></div>
                  <div className="flex items-center justify-between"><span>Products</span><span>{Number(show.auction_settings?.product_count ?? 0)}</span></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">{show.scheduled_start ? new Date(show.scheduled_start).toLocaleString() : "Schedule coming soon"}</span>
                  <Link href={`/live/${show.id}`} className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300">
                    Join show
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
