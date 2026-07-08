import Link from "next/link";
import { getHomepageData } from "@/lib/homepage-data";
import type { HomepageActivity, HomepageListing, HomepageLiveShow, HomepageSeller } from "@/lib/homepage-data";

export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { label: "Live Shows", href: "/live" },
  { label: "Marketplace", href: "/listings" },
  { label: "Sell", href: "/sell" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Help", href: "/help" },
];

const SELLER_BENEFITS = [
  "Seller onboarding and approval",
  "Dashboard access for listings, inventory, and payouts",
  "Live show tools for auctions and community selling",
  "Storefront exposure to collectors across the marketplace",
];

function getSellHref() {
  return "/sell";
}

function SellHeroCard() {
  return (
    <div className="rounded-[2rem] border border-yellow-400/20 bg-yellow-400/10 p-6 text-sm text-gray-300">
      <div className="text-xs font-semibold uppercase tracking-[0.35em] text-yellow-400">Sell on TcgPoké Market</div>
      <div className="mt-3 text-xl font-black text-white">One seller destination for onboarding, listings, and live selling.</div>
      <p className="mt-3 leading-6 text-gray-300">Start selling, manage your storefront, and launch live shows from one streamlined path.</p>
      <div className="mt-5 grid gap-2">
        {SELLER_BENEFITS.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-gray-300">
            {item}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={getSellHref()} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300">
          Sell on TcgPoké Market
        </Link>
        <Link href="/sell/onboarding" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
          Seller onboarding guide
        </Link>
      </div>
    </div>
  );
}

const CATEGORY_SHORTCUTS = [
  { label: "Singles", href: "/listings?category=single" },
  { label: "Graded Cards", href: "/listings?category=graded" },
  { label: "Sealed Products", href: "/listings?category=sealed" },
  { label: "Accessories", href: "/listings?category=accessory" },
  { label: "Live Auctions", href: "/live" },
];

const FALLBACK_PROMO = {
  title: "Live marketplace",
  body: "Browse live shows, auction rooms, and seller storefronts in one place.",
  cta: "Browse live shows",
};

function formatTimeRemaining(target?: string | null) {
  if (!target) return "Scheduled";
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return "Starting soon";
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function sectionHeader(title: string, subtitle: string, href?: string, ctaLabel?: string) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">{subtitle}</p>
      </div>
      {href && ctaLabel && (
        <Link href={href} className="text-sm font-semibold text-yellow-400 hover:underline">
          {ctaLabel} →
        </Link>
      )}
    </div>
  );
}

function LiveCard({ show }: { show: HomepageLiveShow }) {
  const countdown = formatTimeRemaining(show.scheduled_end ?? show.scheduled_start);
  const currentBid = Number((show.auction_settings as { current_bid?: number } | null | undefined)?.current_bid ?? 0);
  const currentItem = String((show.auction_settings as { current_item?: string } | null | undefined)?.current_item ?? "Featured auction item");

  return (
    <Link href={`/live/${show.id}`} className="group block rounded-3xl border border-white/10 bg-[#13131f] p-4 transition hover:-translate-y-1 hover:border-yellow-400/40">
      <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/10 via-white/5 to-transparent">
        {show.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={show.thumbnail} alt={show.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🃏</div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-gray-400">
        <span>{show.status === "live" ? "Live now" : formatTimeRemaining(show.scheduled_start)}</span>
        <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-yellow-300">{show.viewer_count} watching</span>
      </div>
      <h3 className="mt-3 text-lg font-bold group-hover:text-yellow-400">{show.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-gray-400">{show.description ?? "Live auction show"}</p>
      <div className="mt-4 grid gap-2 text-sm text-gray-300">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"><span>Current item</span><span className="font-semibold text-white">{currentItem}</span></div>
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"><span>Highest bid</span><span className="font-semibold text-white">{currentBid ? formatMoney(currentBid) : "—"}</span></div>
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"><span>Countdown</span><span className="font-semibold text-white">{countdown}</span></div>
      </div>
      <div className="mt-4 inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition group-hover:bg-yellow-300">Join Live</div>
    </Link>
  );
}

function AuctionCard({ item }: { item: { listing: HomepageListing; secondsLeft: number } }) {
  const { listing, secondsLeft } = item;
  const sellerLabel = listing.seller_id.slice(0, 8);
  return (
    <Link href={`/listings/${listing.id}`} className="min-w-[260px] flex-1 rounded-3xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/40">
      <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/5 bg-white/5">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt={listing.card_name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🃏</div>
        )}
      </div>
      <div className="mt-4 text-xs uppercase tracking-widest text-gray-400">Seller {sellerLabel}</div>
      <h3 className="mt-2 text-lg font-bold">{listing.card_name}</h3>
      <p className="mt-1 text-sm text-gray-400">{listing.set_name}</p>
      <div className="mt-4 grid gap-2 text-sm text-gray-300">
        <div className="flex items-center justify-between"><span>Current bid</span><span className="font-semibold text-white">{formatMoney(listing.price)}</span></div>
        <div className="flex items-center justify-between"><span>Remaining time</span><span className="font-semibold text-white">{secondsLeft > 0 ? `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s` : "Ending"}</span></div>
        <div className="flex items-center justify-between"><span>Bid count</span><span className="font-semibold text-white">View item</span></div>
      </div>
      <div className="mt-4 inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Watch</div>
    </Link>
  );
}

function SellerCard({ seller }: { seller: HomepageSeller }) {
  return (
    <Link href={`/sellers/${seller.storefront_slug}`} className="min-w-[280px] flex-1 rounded-3xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/40">
      <div className="h-28 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-r from-yellow-400/20 via-red-500/10 to-blue-500/10">
        {seller.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={seller.banner_url} alt={seller.display_name} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="-mt-8 flex items-end gap-3 px-1">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#08111f] text-2xl font-black text-yellow-400">
          {seller.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.avatar_url} alt={seller.display_name} className="h-full w-full object-cover" />
          ) : (
            seller.display_name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="pb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">{seller.display_name}</h3>
            {seller.verified && <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-300">Verified</span>}
          </div>
          <div className="text-xs text-gray-400">{seller.follower_count} followers</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-gray-300">
        <div className="flex items-center justify-between"><span>Items sold</span><span className="font-semibold text-white">{seller.sales_count}</span></div>
        <div className="flex items-center justify-between"><span>Rating</span><span className="font-semibold text-white">{seller.rating.toFixed(1)}</span></div>
        <div className="flex items-center justify-between"><span>Live rooms</span><span className="font-semibold text-white">{seller.total_live_shows}</span></div>
      </div>
      <div className="mt-4 flex gap-2">
        <span className="inline-flex flex-1 justify-center rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">View Store</span>
        <span className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Follow</span>
      </div>
    </Link>
  );
}

function ActivityCard({ activity }: { activity: HomepageActivity }) {
  const badge = {
    purchase: "Purchase",
    auction: "Auction",
    follow: "Follow",
    collection: "Collection",
  }[activity.type];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-gray-400">
        <span>{badge}</span>
        <span>{new Date(activity.created_at).toLocaleString()}</span>
      </div>
      <div className="mt-2 font-semibold text-white">{activity.title}</div>
      <div className="mt-1 text-sm text-gray-400">{activity.subtitle}</div>
    </div>
  );
}

function CategoryPill({ name, count }: { name: string; count: number }) {
  return (
    <Link href={`/listings?category=${encodeURIComponent(name.toLowerCase().replace(/\s+/g, ""))}`} className="min-w-[180px] rounded-2xl border border-white/10 bg-[#13131f] px-4 py-4 text-left transition hover:border-yellow-400/40">
      <div className="text-sm font-semibold text-white">{name}</div>
      <div className="mt-1 text-xs text-gray-400">{count} listings</div>
    </Link>
  );
}

export default async function Home() {
  const data = await getHomepageData().catch(() => ({
    liveNow: [],
    featuredLiveShows: [],
    endingSoonAuctions: [],
    trendingMarketplace: [],
    recentlyAdded: [],
    popularCategories: [],
    featuredSellers: [],
    activity: [],
    upcomingLiveShows: [],
  }));

  const promo = FALLBACK_PROMO;

  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <nav className="sticky top-0 z-50 border-b border-yellow-400/15 bg-[#08111f]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
            <span className="text-2xl">⚡</span>
            <span>TCG</span>
            <span className="text-yellow-400">Poke</span>
            <span>Market</span>
          </Link>
          <div className="hidden items-center gap-5 md:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="text-sm font-medium text-gray-300 transition hover:text-yellow-400">
                {link.label}
              </Link>
            ))}
          </div>
          <Link href="/listings" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300">
            Shop Marketplace
          </Link>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-white/10 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-stretch">
              <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-2xl shadow-black/30 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.35em] text-yellow-400">
                  <span>Live marketplace</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-normal text-gray-300">Verified sellers</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-normal text-gray-300">Secure checkout</span>
                </div>
                <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  Live auctions, marketplace listings, and collector storefronts in one place.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
                  Discover active sellers, browse current inventory, and move between live shows and fixed-price listings without leaving the marketplace.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                    <span className="text-gray-500">⌕</span>
                    <input aria-label="Search marketplace" placeholder="Search live shows, sellers, cards, sets" className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500" />
                  </label>
                  <Link href="/listings" className="rounded-2xl bg-yellow-400 px-5 py-3.5 text-center text-sm font-bold text-black transition hover:bg-yellow-300">
                    Shop Marketplace
                  </Link>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {CATEGORY_SHORTCUTS.map((category) => (
                    <Link key={category.label} href={category.href} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition hover:border-yellow-400/40 hover:text-yellow-300">
                      {category.label}
                    </Link>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/live" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300">
                    Browse Live Shows
                  </Link>
                  <Link href="/listings" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
                    Shop Marketplace
                  </Link>
                  <Link href="/sell" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
                    Sell on TcgPoké Market
                  </Link>
                  <Link href="/sell/onboarding" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
                    Seller onboarding guide
                  </Link>
                  <Link href="/sellers" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
                    Explore Sellers
                  </Link>
                </div>
              </div>

              <aside className="space-y-4 rounded-[2rem] border border-white/10 bg-[#13131f] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-yellow-400">Marketplace notice</div>
                    <div className="mt-1 text-lg font-bold">{promo.title}</div>
                  </div>
                  <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">Live</span>
                </div>
                <p className="text-sm leading-6 text-gray-300">{promo.body}</p>
                <Link href="/live" className="inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">
                  {promo.cta}
                </Link>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white">Featured live shows</div>
                  <div className="mt-3 space-y-3">
                    {data.featuredLiveShows.slice(0, 3).map((show) => (
                      <Link key={show.id} href={`/live/${show.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#08111f] p-3 transition hover:border-yellow-400/40">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
                          {show.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={show.thumbnail} alt={show.title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{show.title}</div>
                          <div className="text-xs text-gray-400">{show.viewer_count} watching · {formatTimeRemaining(show.scheduled_end ?? show.scheduled_start)}</div>
                        </div>
                      </Link>
                    ))}
                    {!data.featuredLiveShows.length && <div className="text-sm text-gray-400">No live shows are active right now.</div>}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Live now", "Currently live sellers with real-time bidding and chat.", "/live", "View all live shows")}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.liveNow.map((show) => <LiveCard key={show.id} show={show} />)}
              {!data.liveNow.length && <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No sellers are live at the moment.</div>}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Featured auctions", "Auctions with the strongest closing activity and most recent bidding.", "/listings", "Browse marketplace")}
            <div className="flex gap-4 overflow-x-auto pb-2">
              {data.endingSoonAuctions.map((item) => <AuctionCard key={item.listing.id} item={item} />)}
              {!data.endingSoonAuctions.length && <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No auctions are ending soon.</div>}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Trending marketplace", "Trending listings across the catalog. Swipe horizontally on mobile.")}
            <div className="flex gap-4 overflow-x-auto pb-2">
              {data.trendingMarketplace.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`} className="min-w-[220px] rounded-3xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/40">
                  <div className="aspect-square overflow-hidden rounded-2xl border border-white/5 bg-white/5">
                    {listing.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.images[0]} alt={listing.card_name} className="h-full w-full object-cover" />
                    ) : <div className="flex h-full items-center justify-center text-4xl">🃏</div>}
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-white">{listing.card_name}</h3>
                  <p className="mt-1 text-xs text-gray-400">{listing.set_name}</p>
                  <div className="mt-3 text-lg font-black text-yellow-400">{formatMoney(listing.price)}</div>
                </Link>
              ))}
              {!data.trendingMarketplace.length && <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No trending items to show.</div>}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Featured sellers", "Professional storefronts with active listings and live rooms.", "/sellers", "Explore sellers")}
            <div className="flex gap-4 overflow-x-auto pb-2">
              {data.featuredSellers.map((seller) => <SellerCard key={seller.id} seller={seller} />)}
              {!data.featuredSellers.length && <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No featured sellers are available yet.</div>}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Recently added", "Newest active listings from across the marketplace.", "/listings", "View all listings")}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.recentlyAdded.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`} className="rounded-3xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/40">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/5 bg-white/5">
                    {listing.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.images[0]} alt={listing.card_name} className="h-full w-full object-cover" />
                    ) : <div className="flex h-full items-center justify-center text-4xl">🃏</div>}
                  </div>
                  <div className="mt-4 text-sm font-bold">{listing.card_name}</div>
                  <div className="mt-1 text-xs text-gray-400">{listing.set_name}</div>
                  <div className="mt-3 text-lg font-black text-white">{formatMoney(listing.price)}</div>
                </Link>
              ))}
              {!data.recentlyAdded.length && <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No recent listings yet.</div>}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Popular categories", "Categories based on active marketplace inventory.")}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {data.popularCategories.map((category) => <CategoryPill key={category.name} {...category} />)}
              {!data.popularCategories.length && <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-gray-400">No category data available yet.</div>}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Recommended for you", "Personalized picks if you are signed in. Otherwise, see items the marketplace is already surfacing.")}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {data.trendingMarketplace.slice(0, 8).map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`} className="rounded-3xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/40">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/5 bg-white/5">
                    {listing.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.images[0]} alt={listing.card_name} className="h-full w-full object-cover" />
                    ) : <div className="flex h-full items-center justify-center text-4xl">🃏</div>}
                  </div>
                  <div className="mt-4 text-sm font-bold">{listing.card_name}</div>
                  <div className="mt-1 text-xs text-gray-400">{listing.set_name}</div>
                  <div className="mt-3 text-lg font-black text-yellow-400">{formatMoney(listing.price)}</div>
                </Link>
              ))}
              {!data.trendingMarketplace.length && <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No recommendations available yet.</div>}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Community activity", "Recent completed purchases, auction results, and follow activity.")}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {data.activity.map((item) => <ActivityCard key={`${item.type}-${item.created_at}-${item.title}`} activity={item} />)}
              {!data.activity.length && <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No recent marketplace activity yet.</div>}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {sectionHeader("Upcoming live shows", "Scheduled shows with reminders and countdowns.", "/live", "Browse live schedule")}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.upcomingLiveShows.map((show) => (
                <Link key={show.id} href={`/live/${show.id}`} className="overflow-hidden rounded-3xl border border-white/10 bg-[#13131f] transition hover:border-yellow-400/40">
                  <div className="aspect-[16/9] overflow-hidden bg-gradient-to-r from-yellow-400/20 via-red-500/10 to-blue-500/10">
                    {show.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
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
                    <div className="mt-4 inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Set reminder</div>
                  </div>
                </Link>
              ))}
              {!data.upcomingLiveShows.length && <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No upcoming live shows are scheduled.</div>}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 text-xl font-black">
                <span className="text-2xl">⚡</span>
                <span>TCG</span>
                <span className="text-yellow-400">Poke</span>
                <span>Market</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-400">A collector-focused marketplace for live auctions, storefronts, and fixed-price listings.</p>
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Help</div>
              <div className="mt-4 flex flex-col gap-3 text-sm text-gray-400">
                <a href="/help" className="hover:text-yellow-400">Help Center</a>
                <a href="/policies" className="hover:text-yellow-400">Policies</a>
                <a href="/terms" className="hover:text-yellow-400">Terms</a>
                <a href="/privacy" className="hover:text-yellow-400">Privacy</a>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Sell</div>
              <div className="mt-4 flex flex-col gap-3 text-sm text-gray-400">
                <a href="/sell" className="hover:text-yellow-400">Sell on TcgPoké Market</a>
                <a href="/seller-agreement" className="hover:text-yellow-400">Seller Agreement</a>
                <a href="/shipping-policy" className="hover:text-yellow-400">Shipping Policy</a>
                <a href="/refund-policy" className="hover:text-yellow-400">Refund Policy</a>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Contact</div>
              <div className="mt-4 flex flex-col gap-3 text-sm text-gray-400">
                <a href="mailto:tcgpokemarketadmin@gmail.com" className="hover:text-yellow-400">Contact</a>
                <a href="/live" className="hover:text-yellow-400">Live Shows</a>
                <a href="/sellers" className="hover:text-yellow-400">Social links</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
