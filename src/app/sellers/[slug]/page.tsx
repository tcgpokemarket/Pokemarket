import Link from "next/link";
import { notFound } from "next/navigation";
import { choosePrimaryImage, evaluateImageMatch } from "@/lib/image-verification";
import { VerifiedImage } from "@/components/listings/VerifiedImage";
import type { Listing } from "@/lib/supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const DEFAULT_POLICIES = [
  "All listings are authentic, sourced from real inventory, and updated automatically when stock changes.",
  "Orders are processed through marketplace escrow and buyer protection flows.",
  "Live auction wins are converted into real orders and payment deadlines are enforced.",
];

const DEFAULT_CATEGORIES = ["Singles", "Sealed", "Graded", "Accessories"];

type SellerStoreRow = {
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  verified: boolean;
  featured: boolean;
  theme: Record<string, string> | null;
};

type SellerStorefront = {
  id: string;
  display_name: string;
  storefront_slug: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  verified: boolean;
  rating: number;
  follower_count: number;
  sales_count: number;
  total_revenue: number;
  total_listings: number;
  total_live_shows: number;
};

type ProfileRow = {
  username: string | null;
  full_name: string | null;
  is_seller?: boolean | null;
  avatar_url?: string | null;
  seller_rating?: number | null;
  total_sales?: number | null;
};

type LiveShowRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  viewer_count: number | null;
  scheduled_start: string | null;
};

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

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const rows = await fetchPublicRows<Pick<SellerStoreRow, "slug">>("seller_stores", "slug", [["slug", "not.is.null"]], 2000);
  const slugs = rows.filter((row): row is { slug: string } => Boolean(row.slug)).map((row) => ({ slug: row.slug }));
  return slugs.length ? slugs : [{ slug: "preview" }];
}

function getPreviewSeller(slug: string): SellerStorefront {
  return {
    id: slug,
    display_name: "Seller Storefront Preview",
    storefront_slug: slug,
    bio: "This storefront is using a safe placeholder until live seller records are available.",
    avatar_url: null,
    banner_url: null,
    verified: false,
    rating: 0,
    follower_count: 0,
    sales_count: 0,
    total_revenue: 0,
    total_listings: 0,
    total_live_shows: 0,
  };
}


export default async function SellerStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [sellerRow] = await fetchPublicRows<SellerStorefront>("sellers", "*", [["storefront_slug", `eq.${slug}`]], 1);
  const sellerData = sellerRow ?? getPreviewSeller(slug);
  if (sellerData.id === slug && slug === "preview") {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
          <div className="text-6xl">🏪</div>
          <h1 className="mt-4 text-3xl font-black">Seller storefront preview</h1>
          <p className="mt-3 text-gray-400">The public seller directory is empty right now, so this route stays exportable with a safe placeholder.</p>
          <a href="/listings" className="mt-6 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">Browse listings</a>
        </main>
      </div>
    );
  }


  const [listingsResult, reviewsResult, profileResult, storeResult, liveShowsResult] = await Promise.all([
    fetchPublicRows<Listing>("listings", "*", [["seller_id", `eq.${sellerData.id}`], ["status", "eq.active"]], 2000),
    fetchPublicRows<{ id: string; title: string | null; body: string | null; rating: number }>("seller_reviews", "*", [["seller_id", `eq.${sellerData.id}`]], 6),
    fetchPublicRows<ProfileRow>("profiles", "username, full_name, is_seller, avatar_url, seller_rating, total_sales", [["id", `eq.${sellerData.id}`]], 1),
    fetchPublicRows<SellerStoreRow>("seller_stores", "*", [["seller_id", `eq.${sellerData.id}`]], 1),
    fetchPublicRows<LiveShowRow>("live_shows", "id, title, description, status, viewer_count, scheduled_start", [["seller_id", `eq.${sellerData.id}`]], 12),
  ]);

  const profile = profileResult[0] ?? null;
  const store = storeResult[0] ?? null;
  const listings = listingsResult ?? [];
  const reviews = reviewsResult ?? [];
  const liveShows = liveShowsResult ?? [];
  const shopName = store?.name ?? sellerData.display_name;
  const shopSlug = store?.slug ?? sellerData.storefront_slug;
  const sellerSales = profile?.total_sales ?? sellerData.sales_count;
  const sellerRating = profile?.seller_rating ?? sellerData.rating;
  const sellerStatus = profile?.is_seller || sellerData.verified ? "Approved seller" : "Seller not approved";
  const activeLiveShows = liveShows.filter((show) => show.status === "live" || show.status === "scheduled");
  const soldItems = listings.filter((listing) => listing.status === "sold").slice(0, 6);
  const policies = store?.description ? [store.description, ...DEFAULT_POLICIES] : DEFAULT_POLICIES;
  const storeTheme = store?.theme ?? null;
  const accent = storeTheme?.accent ?? "#e22400";
  const secondary = storeTheme?.secondary ?? "#ffab01";
  const highlight = storeTheme?.highlight ?? "#fefb41";

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span>TCG</span>
            <span className="text-yellow-400">Poke</span>
            <span>Market</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <a href="/listings" className="text-gray-300 hover:text-white">Browse</a>
            <a href="/live" className="text-gray-300 hover:text-white">Live</a>
            <a href="/sell" className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300">Sell on TcgPoké Market</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="h-56 bg-gradient-to-r from-yellow-400/25 via-[#ffab01]/20 to-[#e22400]/25" />
          <div className="px-6 pb-6 sm:px-8">
            <div className="-mt-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="flex items-end gap-5">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#13131f] text-4xl font-black text-yellow-400 shadow-2xl shadow-black/30">
                  {sellerData.avatar_url ? <img src={sellerData.avatar_url} alt={sellerData.display_name} className="h-full w-full object-cover" /> : sellerData.display_name[0]?.toUpperCase() ?? "S"}
                </div>
                <div className="pb-2">
                  <p className="text-sm uppercase tracking-[0.3em] text-yellow-400">Seller storefront</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black sm:text-4xl">{sellerData.display_name}</h1>
                    {sellerData.verified && <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">Verified seller</span>}
                  </div>
                  <p className="mt-1 text-sm text-gray-400">@{sellerData.storefront_slug}{profile?.username ? ` · public profile @${profile.username}` : ""}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.rating.toFixed(1)}</div>
                  <div className="text-xs text-gray-400">Rating</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.follower_count}</div>
                  <div className="text-xs text-gray-400">Followers</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.sales_count}</div>
                  <div className="text-xs text-gray-400">Sales</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.total_listings}</div>
                  <div className="text-xs text-gray-400">Total listings</div>
                </div>
              </div>
            </div>

            {sellerData.bio && <p className="mt-6 max-w-3xl text-sm leading-6 text-gray-300">{sellerData.bio}</p>}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Shop details</h2>
                  <p className="text-sm text-gray-400">Dedicated storefront URL, verified status, and seller tools.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Link href={`/messages?shop=${shopSlug}`} className="rounded-full border border-white/10 px-4 py-2 text-white transition hover:bg-white/5">Message seller</Link>
                  <Link href="/social" className="rounded-full border border-white/10 px-4 py-2 text-white transition hover:bg-white/5">Follow shop</Link>
                  <Link href={`/listings?seller=${sellerData.id}`} className="rounded-full bg-yellow-400 px-4 py-2 font-semibold text-black transition hover:bg-yellow-300">Browse inventory</Link>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Shop slug</div><div className="mt-2 text-sm font-semibold text-white">/{shopSlug}</div></div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Shop rating</div><div className="mt-2 text-sm font-semibold text-white">{sellerRating.toFixed(1)} / 5.0</div></div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Shop sales</div><div className="mt-2 text-sm font-semibold text-white">{sellerSales}</div></div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Verification</div><div className="mt-2 text-sm font-semibold text-white">{sellerStatus}</div></div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Live auctions</h2>
                  <p className="text-sm text-gray-400">Upcoming and active live rooms tied to this sellerData.</p>
                </div>
                <Link href="/live" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5">View all live auctions</Link>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeLiveShows.length ? activeLiveShows.map((show) => (
                  <Link key={show.id} href={`/live/${show.id}`} className="rounded-2xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/40">
                    <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">{show.status}</div>
                    <div className="mt-2 text-lg font-black text-white">{show.title}</div>
                    <div className="mt-1 text-sm text-gray-400">{show.description ?? "No description provided."}</div>
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span>{show.viewer_count ?? 0} viewers</span>
                      <span>{show.scheduled_start ? new Date(show.scheduled_start).toLocaleString() : "No start time"}</span>
                    </div>
                  </Link>
                )) : (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No live auctions scheduled yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Active listings</h2>
                  <p className="text-sm text-gray-400">Available products from this storefront.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {DEFAULT_CATEGORIES.map((category) => <span key={category} className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1 text-gray-300">{category}</span>)}
                </div>
              </div>
              {!listings.length ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">No active listings yet.</div>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {listings.map((listing) => {
                    const primaryImage = choosePrimaryImage((listing.images ?? []).map((imageUrl) => evaluateImageMatch(
                      { name: listing.card_name, setName: listing.set_name, cardNumber: listing.card_number },
                      { imageUrl, source: "seller_unverified", setName: listing.set_name, cardNumber: listing.card_number },
                    )));

                    return (
                      <a key={listing.id} href={`/listings/${listing.id}`} className="block overflow-hidden rounded-2xl border border-white/10 bg-[#13131f] transition-all hover:border-yellow-400/40">
                        <div className="flex h-40 items-center justify-center overflow-hidden bg-white/5">
                          {primaryImage ? (
                            <VerifiedImage listing={listing} image={primaryImage} className="h-full w-full" />
                          ) : (
                            <span className="text-4xl">🃏</span>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="text-sm font-bold">{listing.card_name}</div>
                          <div className="mt-1 text-xs text-gray-400">{listing.set_name}</div>
                          <div className="mt-3 text-lg font-black text-white">${listing.price.toFixed(2)}</div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-black">Sold items history</h3>
                <div className="mt-4 space-y-3">
                  {soldItems.length ? soldItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm">
                      <div className="font-semibold text-white">{item.card_name}</div>
                      <div className="text-gray-400">{item.set_name}</div>
                      <div className="mt-2 text-yellow-400">${item.price.toFixed(2)}</div>
                    </div>
                  )) : <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No sold items yet.</div>}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-black">Shop policies and shipping</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-300">
                  {policies.map((policy) => <div key={policy} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">{policy}</div>)}
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">Ships with the listing shipping profile and marketplace checkout rules.</div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">Shop profile</div>
              <h3 className="mt-2 text-2xl font-black text-white">{shopName}</h3>
              <p className="mt-2 text-sm text-gray-400">/{shopSlug}</p>
              {sellerData.banner_url ? <img src={sellerData.banner_url} alt={`${shopName} banner`} className="mt-4 h-40 w-full rounded-2xl object-cover" /> : <div className="mt-4 h-40 rounded-2xl border border-white/10 bg-gradient-to-r from-yellow-400/20 via-[#ffab01]/15 to-[#e22400]/20" />}
              {store?.logo_url && <img src={store.logo_url} alt={`${shopName} logo`} className="mt-4 h-20 w-20 rounded-2xl border border-white/10 object-cover" />}
              {sellerData.bio && <p className="mt-4 text-sm leading-6 text-gray-300">{sellerData.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-300">
                <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1">{sellerStatus}</span>
                <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1">{sellerSales} sales</span>
                <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1">{DEFAULT_CATEGORIES.length} categories</span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-black">Shop search</h3>
              <form action="/listings" method="get" className="mt-4 space-y-3">
                <input name="seller" defaultValue={sellerData.id} type="hidden" />
                <input name="query" placeholder="Search this shop" className="w-full rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white outline-none" />
                <button className="w-full rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black">Search shop inventory</button>
              </form>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-black">Reviews</h3>
              <div className="mt-4 space-y-4">
                {reviews.length ? reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-sm">{review.title ?? "Buyer review"}</div>
                      <div className="text-yellow-400 text-sm">★ {Number(review.rating).toFixed(1)}</div>
                    </div>
                    {review.body && <p className="mt-2 text-sm leading-6 text-gray-400">{review.body}</p>}
                  </div>
                )) : <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No reviews yet.</div>}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
