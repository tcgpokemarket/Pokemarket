import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { choosePrimaryImage, evaluateImageMatch } from "@/lib/image-verification";
import { VerifiedImage } from "@/components/listings/VerifiedImage";
import type { Listing } from "@/lib/supabase/types";
import { getSocialCounts } from "@/lib/social-network";
type ProfileRow = {
  username: string | null;
  full_name: string | null;
};

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

  const [listingsResult, reviewsResult, profileResult] = await Promise.all([
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
    supabase.from("profiles").select("username, full_name").eq("id", sellerData.id).maybeSingle(),
  ]);

  const listings = (listingsResult.data ?? []) as Listing[];
  const reviews = (reviewsResult.data ?? []) as Array<{
    id: string;
    title: string | null;
    body: string | null;
    rating: number;
  }>;
  const profile = profileResult.data as { username: string | null; full_name: string | null } | null;
  const socialCounts = await getSocialCounts(sellerData.id).catch(() => ({ followers: sellerData.follower_count, following: 0, friends: 0 }));
  const activeProfile = profile as ProfileRow | null;
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
          <div>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Active listings</h2>
                <p className="text-sm text-gray-400">Available products from this storefront.</p>
              </div>
            </div>

            {!listings.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">No active listings yet.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
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

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-black">Storefront stats</h3>
              <div className="mt-4 space-y-3 text-sm text-gray-300">
                <div className="flex items-center justify-between"><span>Active listings</span><span>{sellerData.total_listings}</span></div>
                <div className="flex items-center justify-between"><span>Total revenue</span><span>${sellerData.total_revenue.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span>Profile type</span><span>{sellerData.verified ? "Verified" : "Standard"}</span></div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-black">Recent reviews</h3>
              <div className="mt-4 space-y-4">
                {reviews.length ? reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-sm">{review.title ?? "Buyer review"}</div>
                      <div className="text-yellow-400 text-sm">★ {Number(review.rating).toFixed(1)}</div>
                    </div>
                    {review.body && <p className="mt-2 text-sm leading-6 text-gray-400">{review.body}</p>}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No reviews yet.</div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
