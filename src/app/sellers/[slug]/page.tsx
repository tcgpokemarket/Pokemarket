import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { choosePrimaryImage, evaluateImageMatch } from "@/lib/image-verification";
import { VerifiedImage } from "@/components/listings/VerifiedImage";
import type { Listing } from "@/lib/supabase/types";
import { getSocialCounts } from "@/lib/social-network";
import { listLiveShowsBySeller } from "@/lib/live-shows-client";
type ProfileRow = {
  username: string | null;
  full_name: string | null;
};

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

const DEFAULT_POLICIES = [
  "All listings are authentic, sourced from real inventory, and updated automatically when stock changes.",
  "Orders are processed through marketplace escrow and buyer protection flows.",
  "Live auction wins are converted into real orders and payment deadlines are enforced.",
];

const DEFAULT_CATEGORIES = ["Singles", "Sealed", "Graded", "Accessories"];

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

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

export default async function SellerStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("sellers")
    .select("*")
    .eq("storefront_slug", slug)
    .single();

  if (!seller) {
    notFound();
  }

  const sellerData = seller as SellerStorefront;

  const [listingsResult, reviewsResult, profileResult, storeResult, liveShowsResult] = await Promise.all([
    supabase
      .from("listings")
      .select("*")
      .eq("seller_id", sellerData.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("seller_reviews")
      .select("*")
      .eq("seller_id", sellerData.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("profiles").select("username, full_name, is_seller, avatar_url, seller_rating, total_sales").eq("id", sellerData.id).maybeSingle(),
    supabase.from("seller_stores").select("*").eq("seller_id", sellerData.id).maybeSingle(),
    listLiveShowsBySeller(sellerData.id),
  ]);

  const listings = (listingsResult.data ?? []) as Listing[];
  const reviews = (reviewsResult.data ?? []) as Array<{
    id: string;
    title: string | null;
    body: string | null;
    rating: number;
  }>;
  const profile = profileResult.data as { username: string | null; full_name: string | null; is_seller?: boolean | null; avatar_url?: string | null; seller_rating?: number | null; total_sales?: number | null } | null;
  const store = storeResult.data as SellerStoreRow | null;
  const liveShows = liveShowsResult ?? [];
  const socialCounts = await getSocialCounts(sellerData.id).catch(() => ({ followers: sellerData.follower_count, following: 0, friends: 0 }));
  const activeProfile = profile as ProfileRow | null;
  const shopName = store?.name ?? sellerData.display_name;
  const shopSlug = store?.slug ?? sellerData.storefront_slug;
  const shopCategories = DEFAULT_CATEGORIES;
  const sellerSales = profile?.total_sales ?? sellerData.sales_count;
  const sellerRating = profile?.seller_rating ?? sellerData.rating;
  const featuredListings = listings.slice(0, 4);
  const soldItems = listings.filter((listing) => listing.status === "sold").slice(0, 6);
  const activeLiveShows = liveShows.filter((show) => show.status === "live" || show.status === "scheduled");
  const policies = store?.description ? [store.description, ...DEFAULT_POLICIES] : DEFAULT_POLICIES;
  const shippingInfo = "Ships with the listing shipping profile and marketplace checkout rules.";
  const sellerStatus = profile?.is_seller || sellerData.verified ? "Approved seller" : "Seller not approved";
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
                  {sellerData.avatar_url ? (
                    <img src={sellerData.avatar_url} alt={sellerData.display_name} className="h-full w-full object-cover" />
                  ) : (
                    sellerData.display_name[0]?.toUpperCase() ?? "S"
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-sm uppercase tracking-[0.3em] text-yellow-400">Seller storefront</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black sm:text-4xl">{sellerData.display_name}</h1>
                    {sellerData.verified && <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">Verified seller</span>}
                  </div>
                  <p className="mt-1 text-sm text-gray-400">@{sellerData.storefront_slug}{activeProfile?.username ? ` · public profile @${activeProfile.username}` : ""}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.rating.toFixed(1)}</div>
                  <div className="text-xs text-gray-400">Rating</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{socialCounts.followers}</div>
                  <div className="text-xs text-gray-400">Followers</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{socialCounts.following}</div>
                  <div className="text-xs text-gray-400">Following</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{socialCounts.friends}</div>
                  <div className="text-xs text-gray-400">Friends</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.sales_count}</div>
                  <div className="text-xs text-gray-400">Sales</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.total_live_shows}</div>
                  <div className="text-xs text-gray-400">Live shows</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{listings.length}</div>
                  <div className="text-xs text-gray-400">Listings</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.total_live_shows}</div>
                  <div className="text-xs text-gray-400">Shows</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.total_revenue.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">Revenue</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.total_listings}</div>
                  <div className="text-xs text-gray-400">Total listings</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.verified ? "Yes" : "No"}</div>
                  <div className="text-xs text-gray-400">Verified</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{sellerData.display_name.slice(0, 1).toUpperCase()}</div>
                  <div className="text-xs text-gray-400">Badge</div>
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
                  <Link href={`/social`} className="rounded-full border border-white/10 px-4 py-2 text-white transition hover:bg-white/5">Follow shop</Link>
                  <Link href={`/listings?seller=${sellerData.id}`} className="rounded-full bg-yellow-400 px-4 py-2 font-semibold text-black transition hover:bg-yellow-300">Browse inventory</Link>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Shop slug</div><div className="mt-2 text-sm font-semibold text-white">/{shopSlug}</div></div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Shop rating</div><div className="mt-2 text-sm font-semibold text-white">{sellerRating.toFixed(1)} / 5.0</div></div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Shop sales</div><div className="mt-2 text-sm font-semibold text-white">{sellerSales}</div></div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Verification</div><div className="mt-2 text-sm font-semibold text-white">{sellerStatus}</div></div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Followers</div><div className="mt-2 text-2xl font-black text-yellow-400">{socialCounts.followers}</div></div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Following</div><div className="mt-2 text-2xl font-black text-yellow-400">{socialCounts.following}</div></div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4"><div className="text-xs uppercase tracking-[0.3em] text-gray-500">Favorites</div><div className="mt-2 text-2xl font-black text-yellow-400">{socialCounts.friends}</div></div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Live auctions</h2>
                  <p className="text-sm text-gray-400">Upcoming and active live rooms tied to this seller.</p>
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
                      <span>{(show as { scheduled_start?: string | null }).scheduled_start ? new Date((show as { scheduled_start?: string | null }).scheduled_start as string).toLocaleString() : "No start time"}</span>
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
                  {shopCategories.map((category) => <span key={category} className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1 text-gray-300">{category}</span>)}
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
                      <a
                        key={listing.id}
                        href={`/listings/${listing.id}`}
                        className="block overflow-hidden rounded-2xl border border-white/10 bg-[#13131f] transition-all hover:border-yellow-400/40"
                      >
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
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">{shippingInfo}</div>
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
                <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1">{shopCategories.length} categories</span>
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
