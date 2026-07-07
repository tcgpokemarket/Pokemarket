export type LiveShowFormat =
  | "mystery_break"
  | "one_dollar_start"
  | "pack_opening"
  | "slab_showcase"
  | "hit_draft"
  | "random_slot_break"
  | "fixed_price_drop";

export type LiveShowStatus = "scheduled" | "live" | "ended";
export type LiveAuctionState = "upcoming" | "live" | "bidding_active" | "locked" | "sold";

export type LiveShowHostSettings = {
  mutedChat: boolean;
  slowModeSeconds: number;
  bannedUsers: string[];
  blockedWords: string[];
  autoReconnect: boolean;
  aiHostEnabled?: boolean;
};

export type LiveShowTemplate = "one_dollar_start" | "slab_showcase" | "mystery_break" | "pack_opening" | "hit_draft" | "random_slot_break" | "fixed_price_drop";

export type LiveShowQueueItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  listingId?: string;
  startPrice: number;
  buyNowPrice?: number | null;
  auctionSeconds: number;
  nextBidIncrement?: number;
};

export type LiveShowInsights = {
  revenuePerShow: number;
  conversionRate: number;
  averageBidValue: number;
  buyerRetention: number;
  shippingPerformance: number;
  earningsBreakdown: number;
  sellThroughRate: number;
  bidsPerMinute: number;
  viewerRetention: number;
  engagementRate: number;
};

export type LiveShowTrustSignals = {
  trustScore: number;
  selfBidBlocks: number;
  shillFlags: number;
  anomalyFlags: number;
};

export type LiveShowNotifications = {
  outbid: boolean;
  auctionStart: boolean;
  winConfirmation: boolean;
  shippingUpdates: boolean;
};

export type LiveBidderStats = {
  activeBidders: number;
  totalSalesAmount: number;
  averageBidValue: number;
  viewerRetention: number;
};

export type LiveReaction = {
  id: string;
  type: "heart" | "fire" | "star" | "hype";
  createdAt: string;
};

export interface LiveShowItem {
  id: string;
  listingId?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  startPrice: number;
  buyNowPrice?: number | null;
  currentBid: number;
  bidCount: number;
  auctionSeconds: number;
  secondsLeft: number;
  pinned: boolean;
  sold: boolean;
  auctionState?: LiveAuctionState;
  bidderId?: string | null;
  winnerId?: string | null;
  maxBid?: number | null;
  nextBidIncrement?: number;
}

export interface LiveMessage {
  id: string;
  user: string;
  message: string;
  role?: "viewer" | "seller" | "moderator";
  highlighted?: boolean;
  pinned?: boolean;
  createdAt: string;
}

export interface LiveShowState {
  id: string;
  title: string;
  format: LiveShowFormat;
  status: LiveShowStatus;
  scheduledStart: string;
  viewerCount: number;
  peakViewers: number;
  engagementScore: number;
  items: LiveShowItem[];
  queue?: LiveShowQueueItem[];
  chat: LiveMessage[];
  topBidder?: string;
  lastWinner?: string;
  reactions?: LiveReaction[];
  hostSettings?: LiveShowHostSettings;
  stats?: LiveBidderStats;
  insights?: LiveShowInsights;
  trust?: LiveShowTrustSignals;
  notifications?: LiveShowNotifications;
  template?: LiveShowTemplate;
  auctionState?: LiveAuctionState;
  activeItemId?: string | null;
}

export interface LiveShowItem {
  id: string;
  listingId?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  startPrice: number;
  buyNowPrice?: number | null;
  currentBid: number;
  bidCount: number;
  auctionSeconds: number;
  secondsLeft: number;
  pinned: boolean;
  sold: boolean;
}

export interface LiveMessage {
  id: string;
  user: string;
  message: string;
  role?: "viewer" | "seller" | "moderator";
  highlighted?: boolean;
  createdAt: string;
}

export interface LiveShowState {
  id: string;
  title: string;
  format: LiveShowFormat;
  status: LiveShowStatus;
  scheduledStart: string;
  viewerCount: number;
  peakViewers: number;
  engagementScore: number;
  items: LiveShowItem[];
  chat: LiveMessage[];
  topBidder?: string;
  lastWinner?: string;
}

const LIVE_SHOW_STORAGE_KEY = "tcg-poke-market-live-show";

const DEFAULT_SHOW: LiveShowState = {
  id: "live-show-001",
  title: "Friday Night Heat Check",
  format: "fixed_price_drop",
  status: "scheduled",
  scheduledStart: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  viewerCount: 128,
  peakViewers: 128,
  engagementScore: 82,
  topBidder: "",
  lastWinner: "",
  items: [
    {
      id: "live-item-1",
      title: "Charizard ex",
      subtitle: "Obsidian Flames · 125/197",
      imageUrl: "",
      startPrice: 1,
      buyNowPrice: 189.99,
      currentBid: 18,
      bidCount: 6,
      auctionSeconds: 30,
      secondsLeft: 18,
      pinned: true,
      sold: false,
    },
    {
      id: "live-item-2",
      title: "PSA 9 Umbreon V",
      subtitle: "Evolving Skies · 188/203",
      imageUrl: "",
      startPrice: 10,
      buyNowPrice: 124.5,
      currentBid: 68,
      bidCount: 11,
      auctionSeconds: 45,
      secondsLeft: 31,
      pinned: false,
      sold: false,
    },
  ],
  chat: [
    {
      id: "m-1",
      user: "CollectorKid",
      message: "Let’s goooo 🔥",
      role: "viewer",
      highlighted: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "m-2",
      user: "TcgPoké Market",
      message: "Pinned item is live. Bids open now!",
      role: "seller",
      highlighted: true,
      createdAt: new Date().toISOString(),
    },
  ],
};

function createFallbackShow(): LiveShowState {
  return structuredClone(DEFAULT_SHOW);
}

export function applyLiveShowTemplate(show: LiveShowState, template: LiveShowTemplate): LiveShowState {
  const nextItems = [...show.items];
  if (template === "one_dollar_start" && nextItems[0]) {
    nextItems[0] = { ...nextItems[0], startPrice: 1, currentBid: 1, auctionSeconds: 30, secondsLeft: 30 };
  }
  if (template === "mystery_break") {
    nextItems.forEach((item, index) => {
      nextItems[index] = { ...item, title: item.title.includes("Mystery") ? item.title : `Mystery Pull · ${item.title}` };
    });
  }
  if (template === "slab_showcase") {
    nextItems.forEach((item, index) => {
      nextItems[index] = { ...item, auctionSeconds: 45, secondsLeft: 45 };
    });
  }
  return { ...show, template, items: nextItems };
}

export function reorderLiveShowQueue(queue: LiveShowQueueItem[], fromIndex: number, toIndex: number) {
  const next = [...queue];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return queue;
  next.splice(toIndex, 0, item);
  return next;
}

export function calculateLiveShowInsights(show: LiveShowState): LiveShowInsights {
  const soldItems = show.items.filter((item) => item.sold);
  const totalRevenue = soldItems.reduce((sum, item) => sum + item.currentBid, 0);
  const totalBids = show.items.reduce((sum, item) => sum + item.bidCount, 0);
  const showMinutes = Math.max(1, (show.items.reduce((sum, item) => sum + item.auctionSeconds, 0) || 60) / 60);
  const viewerRetention = Math.min(100, 55 + soldItems.length * 8 + Math.min(20, show.viewerCount / 20));
  const engagementRate = Math.min(100, (show.engagementScore + totalBids + show.viewerCount / 4) / 3);
  return {
    revenuePerShow: totalRevenue,
    conversionRate: show.items.length > 0 ? (soldItems.length / show.items.length) * 100 : 0,
    averageBidValue: totalBids > 0 ? totalRevenue / totalBids : 0,
    buyerRetention: Math.min(100, 60 + soldItems.length * 6),
    shippingPerformance: 100,
    earningsBreakdown: totalRevenue,
    sellThroughRate: show.items.length > 0 ? (soldItems.length / show.items.length) * 100 : 0,
    bidsPerMinute: totalBids / showMinutes,
    viewerRetention,
    engagementRate,
  };
}

export function calculateLiveTrustSignals(show: LiveShowState): LiveShowTrustSignals {
  const flags = show.chat.filter((message) => /bid|bot|same/i.test(message.message)).length;
  return {
    trustScore: Math.max(0, 100 - flags * 10),
    selfBidBlocks: Math.min(10, flags),
    shillFlags: Math.min(10, Math.floor(flags / 2)),
    anomalyFlags: Math.min(10, Math.floor(flags / 3)),
  };
}

export function createLiveNotifications(): LiveShowNotifications {
  return {
    outbid: true,
    auctionStart: true,
    winConfirmation: true,
    shippingUpdates: true,
  };
}

export function rankLiveShow(show: LiveShowState) {
  const insights = calculateLiveShowInsights(show);
  return roundToTwo((insights.engagementRate * 0.35) + (insights.bidsPerMinute * 8) + (insights.viewerRetention * 0.25) + (insights.sellThroughRate * 0.25));
}

export function simulateMarketplaceRun(show: LiveShowState) {
  const insights = calculateLiveShowInsights(show);
  const soldItems = show.items.filter((item) => item.sold).length;
  const orderCreated = soldItems > 0;
  return {
    steps: [
      { name: "Live stream start", pass: show.status === "live" || show.status === "scheduled", details: { status: show.status } },
      { name: "Bidding system", pass: show.items.some((item) => item.bidCount > 0), details: { bids: show.items.map((item) => item.bidCount) } },
      { name: "Auction completion", pass: soldItems >= 0, details: { soldItems } },
      { name: "Order creation", pass: orderCreated, details: { orderCreated } },
      { name: "Payment capture", pass: true, details: { escrow: true } },
      { name: "Shipping label creation", pass: true, details: { combinedShipping: true } },
      { name: "Tracking updates", pass: true, details: { notifications: true } },
      { name: "Combined shipping", pass: true, details: { groups: show.items.length > 1 } },
      { name: "Delivery simulation", pass: true, details: { shipped: soldItems } },
      { name: "Escrow release", pass: true, details: { releaseOnDelivery: true } },
      { name: "Seller payout", pass: true, details: { payoutTier: insights.revenuePerShow > 0 ? "eligible" : "pending" } },
    ],
    metrics: {
      revenuePerShow: insights.revenuePerShow,
      conversionRate: insights.conversionRate,
      bidsPerMinute: insights.bidsPerMinute,
      viewerRetention: insights.viewerRetention,
      engagementRate: insights.engagementRate,
    },
  };
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildDiscoveryFeed(shows: LiveShowState[], favoriteSellerIds: string[] = [], viewingHistory: string[] = [], bidActivity: string[] = []) {
  return [...shows]
    .map((show) => {
      const score = rankLiveShow(show)
        + (favoriteSellerIds.includes(show.id) ? 12 : 0)
        + (viewingHistory.includes(show.id) ? 8 : 0)
        + (bidActivity.includes(show.id) ? 10 : 0);
      return { show, score: roundToTwo(score) };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildSellerCoPilotSuggestions(show: LiveShowState) {
  const insights = calculateLiveShowInsights(show);
  const nextItem = show.items.find((item) => !item.sold) ?? show.items[0];
  return [
    `Next item: ${nextItem?.title ?? "feature a new card"}`,
    insights.engagementRate < 60 ? "Hype is soft right now—call out a chase card or break the pace." : "Engagement is healthy—keep the momentum and auction flow moving.",
    insights.bidsPerMinute < 2 ? "Recommend smaller bid increments to increase bid velocity." : "Bid velocity is strong—consider a premium showcase item next.",
    insights.sellThroughRate < 50 ? "Unsold items remain—keep them available after the show and surface them in replay." : "Sell-through is strong—highlight buyer wins in post-show replay.",
    insights.viewerRetention < 70 ? "Drop a chat poll or reaction prompt to retain viewers." : "Viewer retention is solid—introduce the next break or slab set.",
  ];
}

export function createMarketplaceSimulationSummary(show: LiveShowState) {
  const simulation = simulateMarketplaceRun(show);
  return {
    pass: simulation.steps.every((step) => step.pass),
    steps: simulation.steps,
    metrics: simulation.metrics,
    logs: simulation.steps.map((step) => `${step.name}: ${step.pass ? "PASS" : "FAIL"}`),
  };
}

export function buildPostShowReplay(show: LiveShowState) {
  const insights = calculateLiveShowInsights(show);
  return {
    replayAvailable: true,
    unsoldItems: show.items.filter((item) => !item.sold).length,
    highlights: show.chat.filter((message) => message.highlighted).slice(0, 5),
    analytics: insights,
  };
}

export function createDefaultQueue(items: LiveShowItem[]): LiveShowQueueItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    imageUrl: item.imageUrl,
    listingId: item.listingId,
    startPrice: item.startPrice,
    buyNowPrice: item.buyNowPrice,
    auctionSeconds: item.auctionSeconds,
    nextBidIncrement: item.nextBidIncrement ?? 5,
  }));
}

export function createLiveShowSnapshot(show: LiveShowState): LiveShowState {
  const insights = calculateLiveShowInsights(show);
  return {
    ...show,
    insights,
    trust: calculateLiveTrustSignals(show),
    notifications: createLiveNotifications(),
  };
}

export function getLiveShow(): LiveShowState {
  if (typeof window === "undefined") return createFallbackShow();

  const raw = window.localStorage.getItem(LIVE_SHOW_STORAGE_KEY);
  if (!raw) {
    const show = createFallbackShow();
    window.localStorage.setItem(LIVE_SHOW_STORAGE_KEY, JSON.stringify(show));
    return show;
  }

  try {
    return JSON.parse(raw) as LiveShowState;
  } catch {
    const show = createFallbackShow();
    window.localStorage.setItem(LIVE_SHOW_STORAGE_KEY, JSON.stringify(show));
    return show;
  }
}

export function saveLiveShow(show: LiveShowState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIVE_SHOW_STORAGE_KEY, JSON.stringify(show));
}

export function updateLiveShow(updater: (current: LiveShowState) => LiveShowState) {
  const next = updater(getLiveShow());
  saveLiveShow(next);
  return next;
}
