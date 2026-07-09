import Link from "next/link";
import { getHomepageData } from "@/lib/homepage-data";
import type { HomepageActivity, HomepageListing, HomepageLiveShow, HomepageSeller } from "@/lib/homepage-data";

const EMPTY_HOMEPAGE = {
  liveNow: [] as HomepageLiveShow[],
  featuredLiveShows: [] as HomepageLiveShow[],
  endingSoonAuctions: [] as HomepageLiveShow[],
  trendingMarketplace: [] as HomepageListing[],
  recentlyAdded: [] as HomepageListing[],
  popularCategories: [] as { label: string; count: number }[],
  featuredSellers: [] as HomepageSeller[],
  activity: [] as HomepageActivity[],
  upcomingLiveShows: [] as HomepageLiveShow[],
};

function isSingleListing(listing: HomepageListing) {
  return listing.category === "single";
}

function isGradedListing(listing: HomepageListing) {
  return listing.category === "graded";
}

function isSealedListing(listing: HomepageListing) {
  return listing.category === "sealed";
}

export const metadata = {
  title: "TcgPoké Market | Live Pokémon Auctions & Marketplace",
  description: "Shop live Pokémon breaks, auctions, singles, sealed products, and collector storefronts with secure checkout and seller tools.",
};

const feedChips = [
  { label: "For You", href: "/live", active: true },
  { label: "Followed Hosts", href: "/sellers" },
  { label: "Pokémon Cards", href: "/listings?category=single" },
  { label: "Trading Card Games", href: "/listings?category=sealed" },
  { label: "Slabs", href: "/listings?category=graded" },
  { label: "Sealed", href: "/listings?category=sealed" },
];

const bottomNav = [
  { label: "Home", href: "/", icon: "⌂", active: true },
  { label: "Categories", href: "/listings", icon: "⌕" },
  { label: "Seller Hub", href: "/sell", icon: "▦" },
  { label: "Activity", href: "/messages", icon: "♡" },
  { label: "Account", href: "/dashboard", icon: "◉" },
];

function formatTimeRemaining(target?: string | null) {
  if (!target) return "Starting soon";
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "Live now";
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function categoryBadge(category: string) {
  if (category === "graded") return "Slab";
  if (category === "sealed") return "Sealed";
  if (category === "accessory") return "Accessory";
  return "Single";
}

function ListingCard({ listing }: { listing: HomepageListing }) {
  const image = listing.images?.[0] ?? null;
  const badge = categoryBadge(listing.category);
  const motion = listing.price > 100 ? "+8%" : listing.price > 50 ? "+3%" : "+1%";

  return (
    <Link href={`/listings/${listing.id}`} className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#121826] transition hover:-translate-y-1 hover:border-yellow-400/40">
      <div className="relative aspect-[4/5] bg-white/5">
        {image ? (
          <img src={image} alt={listing.card_name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🃏</div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">{badge}</div>
        <div className="absolute right-3 top-3 rounded-full bg-emerald-400/90 px-3 py-1 text-[11px] font-bold text-black">{motion}</div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-bold text-white">{listing.card_name}</h3>
        <p className="mt-1 text-xs text-gray-400">{listing.set_name}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-lg font-black text-yellow-400">{formatMoney(listing.price)}</span>
          <span className="text-xs text-gray-400">Trending</span>
        </div>
      </div>
    </Link>
  );
}

function LiveCard({ show }: { show: HomepageLiveShow }) {
  const currentBid = Number((show.auction_settings as { current_bid?: number } | null | undefined)?.current_bid ?? 0);
  const currentItem = String((show.auction_settings as { current_item?: string } | null | undefined)?.current_item ?? "Featured auction item");
  const thumbnail = show.thumbnail ?? null;

  return (
    <Link href={`/live/${show.id}`} className="group overflow-hidden rounded-[2rem] border border-white/10 bg-[#121826] transition hover:-translate-y-1 hover:border-yellow-400/40">
      <div className="relative aspect-[4/5] bg-gradient-to-br from-yellow-400/20 via-fuchsia-500/10 to-cyan-500/10">
        {thumbnail ? (
          <img src={thumbnail} alt={show.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">🎴</div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-500/30">
          Live · {show.viewer_count ?? 0}
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-white">
          {formatTimeRemaining(show.scheduled_start ?? show.scheduled_end)}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-xl">⚡</div>
          <div>
            <div className="text-sm font-bold text-white">{show.title}</div>
            <div className="text-xs text-gray-400">{currentItem}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-gray-400">
          <div className="flex items-center justify-between"><span>Seller</span><span>{show.seller_id.slice(0, 8)}</span></div>
          <div className="flex items-center justify-between"><span>Current bid</span><span>{formatMoney(currentBid)}</span></div>
          <div className="flex items-center justify-between"><span>Status</span><span>{show.status === "live" ? "Streaming" : "Queued"}</span></div>
        </div>
      </div>
    </Link>
  );
}

function SellerCard({ seller }: { seller: HomepageSeller }) {
  return (
    <Link href={`/sellers/${seller.storefront_slug}`} className="min-w-[230px] snap-start rounded-[1.75rem] border border-white/10 bg-[#121826] p-4 transition hover:-translate-y-1 hover:border-yellow-400/40">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {seller.avatar_url ? (
              <img src={seller.avatar_url} alt={seller.display_name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl">⚡</span>
          )}
        </div>
        <div>
          <div className="text-sm font-bold text-white">{seller.display_name}</div>
          <div className="text-xs text-gray-400">{seller.verified ? "Verified seller" : "Collector seller"}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-300">
        <div><span className="block text-xs text-gray-500">Rating</span>{seller.rating.toFixed(1)}</div>
        <div><span className="block text-xs text-gray-500">Sales</span>{seller.sales_count}</div>
      </div>
    </Link>
  );
}

function ActivityCard({ activity }: { activity: HomepageActivity }) {
  const icon = activity.type === "purchase" ? "🛒" : activity.type === "auction" ? "🎥" : activity.type === "follow" ? "⭐" : "🗂️";
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-xl">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-white">{activity.title}</div>
          <div className="text-xs text-gray-400">{activity.subtitle}</div>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const data = await getHomepageData().catch(() => EMPTY_HOMEPAGE);

  const liveNow = data.liveNow.slice(0, 4);
  const featuredLive = data.featuredLiveShows.slice(0, 4);
  const trendingSingles = data.trendingMarketplace.filter(isSingleListing).slice(0, 4);
  const trendingSlabs = data.trendingMarketplace.filter(isGradedListing).slice(0, 4);
  const trendingSealed = data.trendingMarketplace.filter(isSealedListing).slice(0, 4);
  const sellerHighlights = data.featuredSellers.slice(0, 4);
  const recommended = data.trendingMarketplace.slice(0, 8);
  const totalViewers = [...data.liveNow, ...data.featuredLiveShows].reduce((sum: number, show: HomepageLiveShow) => sum + (show.viewer_count ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#08111f]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </Link>
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/live" className="text-sm font-medium text-gray-300 transition hover:text-yellow-400">Live</Link>
            <Link href="/listings" className="text-sm font-medium text-gray-300 transition hover:text-yellow-400">Marketplace</Link>
            <Link href="/sell" className="text-sm font-medium text-gray-300 transition hover:text-yellow-400">Sell</Link>
            <Link href="/dashboard" className="text-sm font-medium text-gray-300 transition hover:text-yellow-400">Dashboard</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sell" className="hidden rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5 sm:inline-flex">
              Start Selling
            </Link>
            <Link href="/live" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300">
              Join Live Auction
            </Link>
          </div>
        </div>
      </nav>

      <main className="pb-24">
        <section className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 grid grid-cols-5 gap-2 overflow-hidden">
              <div className="flex min-w-0 items-center justify-center gap-2 rounded-[1rem] border-2 border-white bg-yellow-400 px-2 py-2 text-black shadow-lg shadow-yellow-400/20">
                <span className="text-lg">⚡</span>
                <div className="min-w-0 text-left">
                  <div className="truncate text-[10px] font-black uppercase leading-none tracking-[0.16em]">For You</div>
                  <div className="truncate text-[10px] font-semibold leading-none">Live</div>
                </div>
              </div>
              {feedChips.slice(1).map((chip: (typeof feedChips)[number]) => (
                <Link key={chip.label} href={chip.href} className="flex min-w-0 items-center justify-center rounded-[1rem] border border-white/10 bg-[#1a2233] px-2 py-2 text-[10px] font-semibold leading-none text-gray-200 transition hover:border-yellow-400/40 hover:text-white">
                  <span className="truncate text-center">{chip.label}</span>
                </Link>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[2rem] border border-white/10 bg-[#121826] p-4 shadow-2xl shadow-black/20 sm:p-5">
                <div className="flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-[#0f1727] px-4 py-4">
                  <span className="text-2xl text-gray-500">⌕</span>
                  <div className="flex-1">
                    <div className="text-sm text-gray-400">Search TcgPoké Market</div>
                    <div className="text-base font-semibold text-white">Live shows, cards, sellers, deals</div>
                  </div>
                  <Link href="/listings" className="hidden rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black sm:inline-flex">Search</Link>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-white/10 bg-[#0f1727] p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Viewers online</div>
                    <div className="mt-2 text-3xl font-black">{totalViewers}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-[#0f1727] p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Live shows</div>
                    <div className="mt-2 text-3xl font-black">{data.liveNow.length + data.featuredLiveShows.length}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-[#0f1727] p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Escrow</div>
                    <div className="mt-2 text-lg font-black text-emerald-400">Protected</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Live now</h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">The most active rooms right now, styled like a live shopping feed.</p>
              </div>
              <Link href="/live" className="text-sm font-semibold text-yellow-400 hover:underline">View all →</Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
              {liveNow.map((show: HomepageLiveShow) => <LiveCard key={show.id} show={show} />)}
              {!liveNow.length && <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-6 text-sm text-gray-400">No live rooms right now.</div>}
            </div>
          </div>
        </section>

        <section className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Featured hosts</h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">Collectors with active rooms and storefronts.</p>
              </div>
              <Link href="/sellers" className="text-sm font-semibold text-yellow-400 hover:underline">Explore →</Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
              {sellerHighlights.map((seller: HomepageSeller) => <SellerCard key={seller.id} seller={seller} />)}
              {!sellerHighlights.length && <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-6 text-sm text-gray-400">No featured sellers available.</div>}
            </div>
          </div>
        </section>

        <section className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Trending marketplace</h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">Top cards and collectibles with a feed-style presentation.</p>
              </div>
              <Link href="/listings" className="text-sm font-semibold text-yellow-400 hover:underline">Browse →</Link>
            </div>
            <div className="space-y-8">
              <div>
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">Singles</div>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                  {trendingSingles.map((listing: HomepageListing) => <div key={listing.id} className="min-w-[240px] snap-start"><ListingCard listing={listing} /></div>)}
                  {!trendingSingles.length && <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-6 text-sm text-gray-400">No singles to show.</div>}
                </div>
              </div>
              <div>
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">Slabs</div>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                  {trendingSlabs.map((listing: HomepageListing) => <div key={listing.id} className="min-w-[240px] snap-start"><ListingCard listing={listing} /></div>)}
                  {!trendingSlabs.length && <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-6 text-sm text-gray-400">No slabs to show.</div>}
                </div>
              </div>
              <div>
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">Sealed</div>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                  {trendingSealed.map((listing: HomepageListing) => <div key={listing.id} className="min-w-[240px] snap-start"><ListingCard listing={listing} /></div>)}
                  {!trendingSealed.length && <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-6 text-sm text-gray-400">No sealed items to show.</div>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Recommended for you</h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">A quick scan of the hottest items across the marketplace.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recommended.map((listing: HomepageListing) => <ListingCard key={listing.id} listing={listing} />)}
              {!recommended.length && <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-6 text-sm text-gray-400">No recommendations available yet.</div>}
            </div>
          </div>
        </section>

        <section className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Community activity</h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">Recent purchase, auction, and follower activity.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {data.activity.map((activity: HomepageActivity) => <ActivityCard key={`${activity.type}-${activity.title}`} activity={activity} />)}
              {!data.activity.length && <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-6 text-sm text-gray-400">No recent activity yet.</div>}
            </div>
          </div>
        </section>

        <section className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Upcoming live shows</h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">Scheduled drops with reminders and countdowns.</p>
              </div>
              <Link href="/live" className="text-sm font-semibold text-yellow-400 hover:underline">Schedule →</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredLive.map((show) => (
                <Link key={show.id} href={`/live/${show.id}`} className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#121826] transition hover:border-yellow-400/40">
                  <div className="aspect-[4/3] bg-gradient-to-r from-yellow-400/20 via-red-500/10 to-blue-500/10">
                    {show.thumbnail ? (
                                  <img src={show.thumbnail} alt={show.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-gray-400">
                      <span>{formatTimeRemaining(show.scheduled_start)}</span>
                      <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-yellow-300">{show.viewer_count} watching</span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-white">{show.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{show.description ?? "Scheduled live show"}</p>
                  </div>
                </Link>
              ))}
              {!featuredLive.length && <div className="rounded-[1.75rem] border border-white/10 bg-[#121826] p-6 text-sm text-gray-400">No upcoming live shows are scheduled.</div>}
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#08111f]/95 px-3 py-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-5 gap-1 text-center text-[11px] text-gray-300">
          {bottomNav.map((item) => (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center justify-center rounded-2xl px-1 py-2 ${item.active ? "text-white" : ""}`}>
              <span className={`text-xl ${item.active ? "text-yellow-400" : "text-gray-300"}`}>{item.icon}</span>
              <span className="mt-1 font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
