"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Listing, Order, Profile, SellerWallet } from "@/lib/supabase/types";
import { buildSellerFeeConfig, calculateFeeBreakdown, formatPercent, summarizeSellerEarnings } from "@/lib/seller-fees";
import { calculateLiveShowInsights, createLiveShowSnapshot, getLiveShow } from "@/lib/live-commerce";
import type { LiveShowDirectoryItem } from "@/lib/live-shows-client";
import { listLiveShowsBySeller } from "@/lib/live-shows-client";
import { recordAuditEvent, recordSecurityEvent } from "@/lib/audit-log";
import { recordDeviceSession } from "@/lib/device-security";

type Tab = "overview" | "listings" | "purchases" | "sales" | "fees" | "live";

type DashboardOrder = Order & {
  listings?: { card_name?: string; images?: string[] } | null;
  profiles?: { username?: string | null } | null;
};

function groupByTracking(orders: DashboardOrder[]) {
  const groups = new Map<string, DashboardOrder[]>();
  for (const order of orders) {
    const key = order.tracking_number ? `tracking:${order.tracking_number}` : `order:${order.id}`;
    const current = groups.get(key) ?? [];
    current.push(order);
    groups.set(key, current);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
}

function formatGroupTitle(items: DashboardOrder[]) {
  const count = items.length;
  const total = items.reduce((sum, item) => sum + (item.total_amount ?? 0), 0);
  return `${count} order${count === 1 ? "" : "s"} · $${total.toFixed(2)}`;
}

export default function DashboardClient({ orderSuccess }: { orderSuccess: boolean }) {
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<SellerWallet | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [purchases, setPurchases] = useState<DashboardOrder[]>([]);
  const [sales, setSales] = useState<DashboardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [brainCopied, setBrainCopied] = useState(false);

  useEffect(() => {
    const client = createClient();
    setSupabase(client);

    const init = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        router.push("/auth?redirectTo=/dashboard");
        return;
      }

      const [{ data: profileData }, { data: walletData }, { data: listingData }, { data: purchaseData }, { data: salesData }] = await Promise.all([
        client.from("profiles").select("*").eq("id", user.id).single(),
        client.from("seller_wallets").select("*").eq("seller_id", user.id).single(),
        client.from("listings").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
        client.from("orders").select("*, listings(card_name, set_name, images)").eq("buyer_id", user.id).order("created_at", { ascending: false }),
        client.from("orders").select("*, listings(card_name, set_name, images), profiles!buyer_id(username)").eq("seller_id", user.id).order("created_at", { ascending: false }),
      ]);

      setProfile(profileData);
      setWallet(walletData ?? null);
      setListings(listingData ?? []);
      setPurchases((purchaseData ?? []) as DashboardOrder[]);
      setSales((salesData ?? []) as DashboardOrder[]);
      setLoading(false);
    };

    init();

    if (orderSuccess) {
      setTimeout(() => router.replace("/dashboard"), 100);
    }
  }, [orderSuccess, router]);

  const handleSignOut = async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      recordAuditEvent({
        event_type: "auth.logout",
        actor_id: user.id,
        action: "sign_out",
        resource_type: "auth",
        resource_id: user.id,
        previous_value: null,
        new_value: null,
        ip_address: null,
        user_agent: typeof window === "undefined" ? null : window.navigator.userAgent,
      });
      recordSecurityEvent({ event_type: "auth.logout", severity: "low", actor_id: user.id, details: { source: "dashboard" } });
      recordDeviceSession({
        user_id: user.id,
        device_name: "Signed out device",
        device_hash: typeof window === "undefined" ? null : btoa(`${window.navigator.userAgent}|${window.location.hostname}`).slice(0, 64),
        ip_address: null,
        user_agent: typeof window === "undefined" ? null : window.navigator.userAgent,
        last_seen_at: new Date().toISOString(),
        active: false,
      });
    }
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm("Remove this listing?")) return;
    setListings((l) => l.filter((x) => x.id !== id));
  };

  const completedSales = useMemo(() => sales.filter((o) => ["paid", "shipped", "delivered", "completed"].includes(o.status)), [sales]);
  const feeConfig = useMemo(() => buildSellerFeeConfig({}), []);
  const sellerSummary = useMemo(() => summarizeSellerEarnings({ orders: completedSales, config: feeConfig }), [completedSales, feeConfig]);
  const freeSalesUsed = sellerSummary.freeSalesUsed;
  const freeSalesRemaining = sellerSummary.freeSalesRemaining;
  const upcomingFeeExample = calculateFeeBreakdown({ itemSubtotal: 100, shipping: 0, salesTax: 0, orders: completedSales, config: feeConfig });

  const liveInsights = calculateLiveShowInsights(createLiveShowSnapshot(getLiveShow()));
  const [sellerLiveShows, setSellerLiveShows] = useState<LiveShowDirectoryItem[]>([]);
  const [liveShowsLoading, setLiveShowsLoading] = useState(false);
  const [liveShowTitle, setLiveShowTitle] = useState("New live show");
  const [liveShowDescription, setLiveShowDescription] = useState("Run a separate live room for this drop.");
  const [liveShowStatusMessage, setLiveShowStatusMessage] = useState<string | null>(null);
  const [liveShowStartTime, setLiveShowStartTime] = useState(new Date(Date.now() + 1000 * 60 * 30).toISOString().slice(0, 16));
  const [liveShowFeatured, setLiveShowFeatured] = useState(false);
  const [liveShowProductsCount, setLiveShowProductsCount] = useState(0);
  const [liveShowFilter, setLiveShowFilter] = useState("all");
  const [liveShowSearch, setLiveShowSearch] = useState("");
  const [activeLiveShowId, setActiveLiveShowId] = useState<string | null>(null);
  const [liveShowBoost, setLiveShowBoost] = useState(false);
  const [liveShowModerators, setLiveShowModerators] = useState<string[]>([]);
  const [liveShowAnalyticsOpen, setLiveShowAnalyticsOpen] = useState(false);
  const [liveShowQueueMode, setLiveShowQueueMode] = useState("standard");
  const [liveShowCategory, setLiveShowCategory] = useState("Pokémon");
  const [liveShowPriceFloor, setLiveShowPriceFloor] = useState(0);
  const [liveShowPriceCeiling, setLiveShowPriceCeiling] = useState(0);
  const [liveShowProductType, setLiveShowProductType] = useState("Singles");
  const [liveShowScheduledOnly, setLiveShowScheduledOnly] = useState(false);
  const [liveShowAutoModeration, setLiveShowAutoModeration] = useState(true);
  const [liveShowSummaryText, setLiveShowSummaryText] = useState("");
  const [liveShowRoomMessage, setLiveShowRoomMessage] = useState<string | null>(null);
  const [liveShowAnalyticsMode, setLiveShowAnalyticsMode] = useState("viewer_count");
  const shippingPerformance = useMemo(() => {
    const shipped = sales.filter((order) => order.status === "shipped").length;
    const delivered = sales.filter((order) => order.status === "delivered").length;
    return shipped > 0 ? Math.round((delivered / shipped) * 100) : 100;
  }, [sales]);
  const buyerRetention = useMemo(() => {
    const buyerCounts = new Map<string, number>();
    for (const order of sales) {
      buyerCounts.set(order.buyer_id, (buyerCounts.get(order.buyer_id) ?? 0) + 1);
    }
    const repeatBuyers = Array.from(buyerCounts.values()).filter((count) => count > 1).length;
    return sales.length > 0 ? Math.round((repeatBuyers / buyerCounts.size) * 100) || 0 : 0;
  }, [sales]);
  const avgBidValue = liveInsights.averageBidValue;
  const revenuePerShow = liveInsights.revenuePerShow;
  const conversionRate = liveInsights.conversionRate;
  const earningsBreakdown = sellerSummary.netEarnings;
  const showTrustScore = 100;
  const notificationsEnabled = false;
  const totalLiveShowSales = sellerLiveShows.reduce((sum) => sum, 0);
  const showQueueSize = sellerLiveShows.length;
  const auctionHealth = Math.max(0, 100 - Math.max(0, 100 - shippingPerformance));
  const giveawaySummary = { activeGiveaways: 0, eligibleUsers: 0, claimedWinners: 0, totalCost: 0, platformRevenueProtected: true };
  const giveaway = null;
  const giveawaySecondsLeft = 0;
  const giveawayMinutes = 0;
  const giveawaySeconds = 0;
  const giveawayCost = 0;
  const giveawayProgress = 0;

  useEffect(() => {
    if (!supabase || !profile?.id) return;
    let alive = true;
    setLiveShowsLoading(true);
    listLiveShowsBySeller(profile.id)
      .then((rows) => {
        if (!alive) return;
        setSellerLiveShows(rows);
        setActiveLiveShowId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setSellerLiveShows([]);
      })
      .finally(() => {
        if (!alive) return;
        setLiveShowsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [profile?.id, supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a]">
        <div className="text-lg animate-pulse text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  const activeListings = listings.filter((l) => l.status === "active").length;
  const totalRevenue = completedSales.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const ordersToVerified = Math.max(0, 100 - (wallet?.completed_orders_count ?? sellerSummary.lifetimeSales));
  const payoutTier = wallet?.completed_orders_count && wallet.completed_orders_count >= 100 ? "Verified Seller (Instant Eligible)" : "Standard Payout";
  const nextPayout = wallet?.next_payout_at ? new Date(wallet.next_payout_at).toLocaleDateString() : "Daily at 12:00 AM PST";
  const availableBalance = wallet?.available_balance ?? 0;
  const pendingBalance = wallet?.pending_balance ?? sellerSummary.upcomingPayouts;
  const instantEligible = Boolean(wallet?.instant_payout_enabled && (wallet?.completed_orders_count ?? 0) >= 100 && !wallet?.fraud_flag);
  const brainSummary = [
    `TcgPoké Market dashboard summary for ${profile?.full_name ?? "user"}`,
    `Active listings: ${activeListings}`,
    `Total sales: ${profile?.total_sales ?? 0}`,
    `Revenue: $${totalRevenue.toFixed(2)}`,
    `Purchases: ${purchases.length}`,
    `Sales: ${sales.length}`,
    `Current seller tier: ${sellerSummary.tierName}`,
  ].join("\n");

  const handleCopyBrainSummary = async () => {
    try {
      await navigator.clipboard.writeText(brainSummary);
      setBrainCopied(true);
      setTimeout(() => setBrainCopied(false), 2000);
    } catch {
      setBrainCopied(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "listings", label: `Listings (${listings.length})` },
    { key: "purchases", label: `Purchases (${purchases.length})` },
    { key: "sales", label: `Sales (${sales.length})` },
    { key: "fees", label: "Fees & Earnings" },
    { key: "live", label: "Live Studio" },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/listings" className="text-sm text-gray-300 hover:text-white">Browse</a>
            <a href="/dashboard/fees" className="text-sm text-gray-300 hover:text-white">Fee Admin</a>
            <a href="/admin" className="text-sm text-gray-300 hover:text-white">Admin</a>
            <a href="/sell" className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">+ New Listing</a>
            <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Seller dashboard
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/20 text-xl font-black text-yellow-400">
                {profile?.username?.[0]?.toUpperCase() ?? profile?.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <h1 className="text-3xl font-black sm:text-4xl">{profile?.full_name ?? "My Dashboard"}</h1>
                {profile?.username && <p className="text-sm text-gray-400">@{profile.username}</p>}
              </div>
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-gray-300">
              Manage listings, review sales, track seller fees, and keep your live auctions moving with a polished control center.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-widest text-yellow-400">Quick action</p>
                <h2 className="mt-2 text-xl font-black">Copy dashboard summary</h2>
              </div>
              <button
                onClick={handleCopyBrainSummary}
                className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-400 transition-colors hover:bg-yellow-400/20"
              >
                {brainCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-400">Grab a clean summary of your store metrics for notes or planning.</p>
          </div>
        </div>



        <div className="mb-8 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all ${tab === t.key ? "bg-yellow-400 text-black" : "text-gray-400 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Active Listings", value: activeListings, icon: "🃏" },
                { label: "Total Sales", value: profile?.total_sales ?? 0, icon: "✅" },
                { label: "Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: "💰" },
                { label: "Purchases", value: purchases.length, icon: "🛒" },
                { label: "Live Show Revenue", value: `$${revenuePerShow.toFixed(2)}`, icon: "🎥" },
                { label: "Conversion Rate", value: `${conversionRate.toFixed(1)}%`, icon: "📈" },
                { label: "Avg Bid", value: `$${avgBidValue.toFixed(2)}`, icon: "🏷️" },
                { label: "Buyer Retention", value: `${Math.max(buyerRetention, liveInsights.buyerRetention).toFixed(0)}%`, icon: "🔁" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                  <div className="mb-2 text-3xl">{stat.icon}</div>
                  <div className="text-2xl font-black text-white">{stat.value}</div>
                  <div className="mt-1 text-sm text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Payout tier</div>
                <h3 className="mt-2 text-xl font-black">{payoutTier}</h3>
                <p className="mt-2 text-sm text-gray-400">Orders completed: {wallet?.completed_orders_count ?? sellerSummary.lifetimeSales} / 100</p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.min(100, ((wallet?.completed_orders_count ?? sellerSummary.lifetimeSales) / 100) * 100)}%` }} />
                </div>
                <p className="mt-3 text-sm text-gray-400">{instantEligible ? "Instant payout is available." : `Instant payout unlocks in ${ordersToVerified} completed orders.`}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Wallet</div>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Available balance</span><span>${availableBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Pending balance</span><span>${pendingBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Lifetime earnings</span><span>${(wallet?.lifetime_earnings ?? totalRevenue).toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Next payout</span><span>{nextPayout}</span></div>
                </div>
                <button className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-400/20" disabled={!instantEligible}>
                  {instantEligible ? "Request instant payout" : "Instant payout locked"}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Live trust</div>
                <h3 className="mt-2 text-xl font-black">Score {showTrustScore}</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Queue items</span><span>{showQueueSize}</span></div>
                  <div className="flex items-center justify-between"><span>Shipping performance</span><span>{shippingPerformance}%</span></div>
                  <div className="flex items-center justify-between"><span>Notifications</span><span>{notificationsEnabled ? "On" : "Off"}</span></div>
                  <div className="flex items-center justify-between"><span>Auction health</span><span>{auctionHealth}%</span></div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/10 via-red-500/10 to-blue-500/10 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Seller room summary</div>
                <h3 className="mt-2 text-xl font-black">{sellerLiveShows.length} rooms in your storefront</h3>
                <div className="mt-3 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3"><span>Active rooms</span><span>{sellerLiveShows.filter((room) => room.status === "live").length}</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3"><span>Scheduled rooms</span><span>{sellerLiveShows.filter((room) => room.status === "scheduled").length}</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3"><span>Featured rooms</span><span>{sellerLiveShows.filter((room) => Boolean((room.auction_settings as any)?.featured)).length}</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3"><span>Total viewers</span><span>{sellerLiveShows.reduce((sum, room) => sum + (room.viewer_count ?? 0), 0)}</span></div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.min(100, sellerLiveShows.length * 10)}%` }} />
                </div>
                <p className="mt-3 text-sm text-gray-300">Each room keeps its own bids, chat, viewers, and auction queue isolated by seller_id and show_id.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Wallet impact</div>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Active room revenue</span><span>${totalLiveShowSales.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Seller balance</span><span>${availableBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Pending balance</span><span>${pendingBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Total rooms</span><span>{sellerLiveShows.length}</span></div>
                  <div className="flex items-center justify-between"><span>Platform fee model</span><span>{sellerSummary.tierName}</span></div>
                </div>
                <p className="mt-3 text-sm text-gray-400">Seller payouts, fees, refunds, and disputes are tracked per seller_id instead of one shared owner account.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold">What to do next</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-300">
                  <a href="/sell" className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 hover:border-yellow-400/40">
                    <span>Add a new listing</span>
                    <span className="text-yellow-400">→</span>
                  </a>
                  <a href="/dashboard/fees" className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 hover:border-yellow-400/40">
                    <span>Review fee settings</span>
                    <span className="text-yellow-400">→</span>
                  </a>
                  <a href="/live" className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 hover:border-yellow-400/40">
                    <span>Check live show tools</span>
                    <span className="text-yellow-400">→</span>
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold">Show earnings breakdown</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Revenue per show</span><span>${revenuePerShow.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Average bid value</span><span>${avgBidValue.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Buyer retention</span><span>{Math.max(buyerRetention, liveInsights.buyerRetention).toFixed(0)}%</span></div>
                  <div className="flex items-center justify-between"><span>Earnings breakdown</span><span>${earningsBreakdown.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold">Shipping performance</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Delivered / shipped</span><span>{shippingPerformance}%</span></div>
                  <div className="flex items-center justify-between"><span>Auto label readiness</span><span>{liveInsights.shippingPerformance}%</span></div>
                  <div className="flex items-center justify-between"><span>Combined shipping</span><span>Enabled</span></div>
                  <div className="flex items-center justify-between"><span>Fraud/trust monitoring</span><span>{showTrustScore >= 80 ? "Healthy" : "Watch"}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "fees" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">Fees & Earnings</div>
                  <h2 className="text-2xl font-black">Your seller fee summary</h2>
                  <p className="mt-2 text-sm text-gray-400">The first {sellerSummary.freeSalesRemaining > 0 ? freeSalesUsed + freeSalesRemaining : sellerSummary.lifetimeSales} sales are tracked automatically and fee tiers update as you grow.</p>
                </div>
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-400">
                  Current tier: <span className="font-bold">{sellerSummary.tierName}</span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  { label: "Current marketplace fee", value: formatPercent(sellerSummary.marketplaceFeePercent) },
                  { label: "Free sales remaining", value: sellerSummary.freeSalesRemaining.toString() },
                  { label: "Lifetime sales", value: sellerSummary.lifetimeSales.toString() },
                  { label: "Monthly sales", value: sellerSummary.monthlySales.toString() },
                  { label: "Gross revenue", value: `$${sellerSummary.grossRevenue.toFixed(2)}` },
                  { label: "Marketplace fees paid", value: `$${sellerSummary.marketplaceFeesPaid.toFixed(2)}` },
                  { label: "Payment processing fees", value: `$${sellerSummary.paymentProcessingFees.toFixed(2)}` },
                  { label: "Net earnings", value: `$${sellerSummary.netEarnings.toFixed(2)}` },
                  { label: "Upcoming payouts", value: `$${sellerSummary.upcomingPayouts.toFixed(2)}` },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                    <div className="text-xs uppercase tracking-widest text-gray-500">{metric.label}</div>
                    <div className="mt-2 text-xl font-black">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">Free sales progress</h3>
                  <p className="text-sm text-gray-400">X of 100 free sales used</p>
                </div>
                <div className="text-right text-sm text-gray-300">
                  {freeSalesUsed} of {feeConfig.freeSalesLimit} free sales used
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-yellow-400"
                  style={{ width: `${Math.min(100, feeConfig.freeSalesLimit > 0 ? (freeSalesUsed / feeConfig.freeSalesLimit) * 100 : 0)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-gray-400">
                Marketplace fee: 0% for the first {feeConfig.freeSalesLimit} completed sales, then {feeConfig.standardMarketplaceFeePercent}% unless a power seller tier applies.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-bold">Checkout fee preview</h3>
              <p className="mt-1 text-sm text-gray-400">Example on a $100 item sale.</p>
              <div className="mt-4 space-y-2 text-sm">
                {[
                  ["Item subtotal", `$${upcomingFeeExample.itemSubtotal.toFixed(2)}`],
                  ["Shipping", `$${upcomingFeeExample.shipping.toFixed(2)}`],
                  ["Sales tax", `$${upcomingFeeExample.salesTax.toFixed(2)}`],
                  ["Payment processing fee", `$${upcomingFeeExample.paymentProcessingFee.toFixed(2)}`],
                  ["Marketplace fee", `$${upcomingFeeExample.marketplaceFee.toFixed(2)}`],
                  ["Seller payout", `$${upcomingFeeExample.sellerPayout.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "listings" && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">My Listings</h2>
              <a href="/sell" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">+ New Listing</a>
            </div>
            {listings.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <div className="mb-3 text-5xl">🃏</div>
                <p>No listings yet. <a href="/sell" className="text-yellow-400 hover:underline">Create your first one.</a></p>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((l) => (
                  <div key={l.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
                      {l.images?.[0] ? <img src={l.images[0]} alt="" className="h-full w-full rounded-xl object-cover" /> : "🃏"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{l.card_name}</p>
                      <p className="text-xs text-gray-400">{l.set_name} · {l.condition}</p>
                    </div>
                    <span className={`rounded-lg border px-2 py-1 text-xs font-medium capitalize`}>{l.status}</span>
                    <span className="font-black text-white">${l.price.toFixed(2)}</span>
                    <div className="flex gap-2">
                      <a href={`/listings/${l.id}`} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white">View</a>
                      <button onClick={() => handleDeleteListing(l.id)} className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:text-red-300">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "purchases" && (
          <div>
            <h2 className="mb-5 text-xl font-bold">My Purchases</h2>
            {purchases.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <div className="mb-3 text-5xl">🛒</div>
                <p>No purchases yet. <a href="/listings" className="text-yellow-400 hover:underline">Browse listings.</a></p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map((o) => (
                  <div key={o.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{o.listings?.card_name ?? "Card"}</p>
                      <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</p>
                      {o.tracking_number && <p className="mt-1 text-xs text-blue-400">Tracking: {o.tracking_number}</p>}
                    </div>
                    <span className={`rounded-lg border px-2 py-1 text-xs font-medium capitalize`}>{o.status}</span>
                    <span className="font-black">${o.total_amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "sales" && (
          <div>
            <h2 className="mb-5 text-xl font-bold">My Sales</h2>
            {sales.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <div className="mb-3 text-5xl">💰</div>
                <p>No sales yet. <a href="/sell" className="text-yellow-400 hover:underline">Create a listing.</a></p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupByTracking(sales).map((group) => {
                  const first = group.items[0];
                  const total = group.items.reduce((sum, item) => sum + (item.total_amount ?? 0), 0);
                  const tracking = first.tracking_number;
                  return (
                    <div key={group.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{formatGroupTitle(group.items)}</p>
                          <p className="text-xs text-gray-400">
                            {first.profiles?.username ? `Buyer @${first.profiles.username}` : "Buyer"} · {new Date(first.created_at).toLocaleDateString()}
                          </p>
                          {tracking && <p className="mt-1 text-xs text-blue-400">Tracking: {tracking}</p>}
                        </div>
                        <div className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={`rounded-lg border px-2 py-1 text-xs font-medium capitalize`}>{first.status}</span>
                            <span className={`rounded-lg border px-2 py-1 text-xs font-medium capitalize`}>payout {first.payout_status ?? "pending"}</span>
                          </div>
                          <div className="mt-2 font-black text-green-400">+${total.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {group.items.map((item) => (
                          <div key={item.id} className="rounded-xl border border-white/10 bg-[#13131f] p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg">
                                {item.listings?.images?.[0] ? <img src={item.listings.images[0]} alt="" className="h-full w-full rounded-lg object-cover" /> : "🃏"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{item.listings?.card_name ?? "Card"}</p>
                                <p className="text-xs text-gray-400">${item.total_amount.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 text-xs text-gray-500">Shipping, payout, and fulfillment actions are handled through the operations team.</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "live" && (
          <div className="space-y-6 rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <div>
              <p className="text-sm uppercase tracking-widest text-yellow-400">Seller live rooms</p>
              <h2 className="mt-1 text-2xl font-black">Manage multiple live shows</h2>
              <p className="mt-2 text-sm text-gray-400">Each show is its own room with its own bids, chat, product queue, and viewers.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">Show title</label>
                    <input value={liveShowTitle} onChange={(e) => setLiveShowTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">Start time</label>
                    <input type="datetime-local" value={liveShowStartTime} onChange={(e) => setLiveShowStartTime(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm text-gray-300">Description</label>
                    <textarea value={liveShowDescription} onChange={(e) => setLiveShowDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gray-300"><input type="checkbox" checked={liveShowFeatured} onChange={(e) => setLiveShowFeatured(e.target.checked)} /> Feature room</label>
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gray-300"><input type="checkbox" checked={liveShowAutoModeration} onChange={(e) => setLiveShowAutoModeration(e.target.checked)} /> Auto moderation</label>
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gray-300"><input type="checkbox" checked={liveShowScheduledOnly} onChange={(e) => setLiveShowScheduledOnly(e.target.checked)} /> Scheduled only</label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input value={liveShowCategory} onChange={(e) => setLiveShowCategory(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Category" />
                  <input value={liveShowProductType} onChange={(e) => setLiveShowProductType(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Product type" />
                  <input type="number" min="0" value={liveShowProductsCount} onChange={(e) => setLiveShowProductsCount(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Products" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="number" min="0" value={liveShowPriceFloor} onChange={(e) => setLiveShowPriceFloor(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Price floor" />
                  <input type="number" min="0" value={liveShowPriceCeiling} onChange={(e) => setLiveShowPriceCeiling(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Price ceiling" />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!supabase || !profile) return;
                      const payload = {
                        seller_id: profile.id,
                        title: liveShowTitle,
                        description: liveShowDescription,
                        status: liveShowScheduledOnly ? "scheduled" : "live",
                        auction_state: liveShowScheduledOnly ? "upcoming" : "live",
                        scheduled_start: new Date(liveShowStartTime).toISOString(),
                        viewer_count: 0,
                        peak_viewers: 0,
                        host_permissions: ["host", "moderate_chat", "start_auction", "end_auction"],
                        auction_settings: {
                          category: liveShowCategory,
                          product_type: liveShowProductType,
                          price_floor: liveShowPriceFloor,
                          price_ceiling: liveShowPriceCeiling,
                          featured: liveShowFeatured,
                          auto_moderation: liveShowAutoModeration,
                          queue_mode: liveShowQueueMode,
                          boost: liveShowBoost,
                        },
                      };
                      const { data, error } = await supabase.from("live_shows").insert(payload as any).select("*").single();
                      const createdRoom = data as { id: string; title: string } | null;
                      if (error) {
                        setLiveShowStatusMessage(error.message);
                        return;
                      }
                      setLiveShowStatusMessage(`Created ${createdRoom?.title ?? "live room"}`);
                      const rows = await listLiveShowsBySeller(profile.id);
                      setSellerLiveShows(rows);
                      setActiveLiveShowId(createdRoom?.id ?? rows[0]?.id ?? null);
                    }}
                    className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black"
                  >
                    Create live room
                  </button>
                  <button type="button" onClick={() => setLiveShowStatusMessage("Seller rooms load independently by show_id.")} className="rounded-xl border border-white/20 px-4 py-3 text-gray-300 hover:bg-white/5">
                    Room isolation note
                  </button>
                </div>

                {liveShowStatusMessage && <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">{liveShowStatusMessage}</div>}
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm uppercase tracking-widest text-gray-500">Your rooms</div>
                    <div className="text-lg font-black">{sellerLiveShows.length} total</div>
                  </div>
                  <div className="text-xs text-gray-500">{liveShowsLoading ? "Refreshing..." : "Realtime-ready"}</div>
                </div>

                <input value={liveShowSearch} onChange={(e) => setLiveShowSearch(e.target.value)} placeholder="Search rooms" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />

                <div className="flex flex-wrap gap-2 text-xs">
                  {["all", "live", "scheduled", "ended"].map((state) => (
                    <button key={state} type="button" onClick={() => setLiveShowFilter(state)} className={`rounded-full border px-3 py-1 ${liveShowFilter === state ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-white/10 bg-white/5 text-gray-300"}`}>
                      {state}
                    </button>
                  ))}
                </div>

                <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                  {sellerLiveShows
                    .filter((room) => (liveShowFilter === "all" ? true : room.status === liveShowFilter))
                    .filter((room) => !liveShowSearch || room.title.toLowerCase().includes(liveShowSearch.toLowerCase()) || (room.description ?? "").toLowerCase().includes(liveShowSearch.toLowerCase()))
                    .map((room) => (
                      <div key={room.id} className={`rounded-2xl border p-4 ${activeLiveShowId === room.id ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-[#13131f]"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{room.title}</div>
                            <div className="text-xs text-gray-400">{room.description ?? "No description"}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span>{room.status}</span>
                              <span>•</span>
                              <span>{room.viewer_count} viewers</span>
                              <span>•</span>
                              <span>Peak {room.peak_viewers}</span>
                            </div>
                          </div>
                          <a href={`/live/${room.id}`} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/5">Open room</a>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button type="button" onClick={() => setActiveLiveShowId(room.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Select</button>
                          <button type="button" onClick={() => setLiveShowRoomMessage(`Room ${room.id} is isolated by show_id and does not share bids, chat, or viewers.`)} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Verify isolation</button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                <div className="font-bold text-white">Room analytics</div>
                <div className="mt-2 space-y-2">
                  <div>Mode: {liveShowAnalyticsMode}</div>
                  <div>Featured rooms: {sellerLiveShows.filter((room) => Boolean((room.auction_settings as any)?.featured)).length}</div>
                  <div>Scheduled rooms: {sellerLiveShows.filter((room) => room.status === "scheduled").length}</div>
                  <div>Live rooms: {sellerLiveShows.filter((room) => room.status === "live").length}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                <div className="font-bold text-white">Moderator management</div>
                <div className="mt-2 space-y-2">
                  <div>Moderators assigned: {liveShowModerators.length}</div>
                  <div>Queue mode: {liveShowQueueMode}</div>
                  <div>Boost enabled: {liveShowBoost ? "Yes" : "No"}</div>
                  <div>Auto moderation: {liveShowAutoModeration ? "On" : "Off"}</div>
                </div>
              </div>
            </div>

            {liveShowRoomMessage && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">{liveShowRoomMessage}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
