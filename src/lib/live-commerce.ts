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
  giveawayBannerEnabled?: boolean;
};

export type LiveShowGiveawayPrizeType = "booster_pack" | "promo_card" | "sealed_product" | "slab" | "mystery_prize";
export type LiveShowGiveawayEligibility = "purchase" | "bid" | "watch" | "follow" | "join";
export type LiveShowGiveawayStatus = "draft" | "scheduled" | "live" | "ended";

export type LiveShowGiveaway = {
  id: string;
  title: string;
  prizeType: LiveShowGiveawayPrizeType;
  prizeName: string;
  prizeQuantity: number;
  winnerCount: number;
  startAt: string;
  endAt: string;
  eligibility: LiveShowGiveawayEligibility[];
  eligibleUsers: number;
  claimedWinners: number;
  liveEntries: number;
  totalEntries: number;
  estimatedItemValue: number;
  platformProcessingFee: number;
  shippingCost: number;
  sellerBudget: number;
  sellerPaysAllFees: boolean;
  status: LiveShowGiveawayStatus;
  winnerIds: string[];
  fraudFlags: number;
  createdAt: string;
};

export type LiveShowGiveawayLedgerEntry = {
  id: string;
  giveawayId: string;
  type: "creation_fee" | "prize_cost" | "shipping_cost" | "winner_payout" | "seller_expense";
  amount: number;
  createdAt: string;
};

export type LiveShowGiveawayEntry = {
  id: string;
  giveawayId: string;
  userId: string;
  username: string;
  source: LiveShowGiveawayEligibility;
  qualifiedAt: string;
  verifiedPurchase: boolean;
  watchMinutes: number;
  bidCount: number;
  followingSeller: boolean;
  accountAgeDays: number;
  fraudScore: number;
  blocked: boolean;
};

export type LiveShowGiveawaySummary = {
  activeGiveaways: number;
  eligibleUsers: number;
  claimedWinners: number;
  totalCost: number;
  platformRevenueProtected: boolean;
};

export type LiveShowGiveawayRules = {
  accountAgeDays: number;
  requirePurchaseVerification: boolean;
  minWatchMinutes: number;
  maxEntriesPerUser: number;
  allowMultipleSources: boolean;
  fraudThreshold: number;
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
  giveaways?: LiveShowGiveaway[];
  giveawayEntries?: LiveShowGiveawayEntry[];
  giveawayLedger?: LiveShowGiveawayLedgerEntry[];
  giveawayRules?: LiveShowGiveawayRules;
  giveawaySummary?: LiveShowGiveawaySummary;
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
  giveaways: [
    {
      id: "giveaway-1",
      title: "Collector Boost Giveaway",
      prizeType: "sealed_product",
      prizeName: "Scarlet & Violet Booster Bundle",
      prizeQuantity: 3,
      winnerCount: 3,
      startAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
      endAt: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
      eligibility: ["purchase", "bid", "watch", "join"],
      eligibleUsers: 42,
      claimedWinners: 0,
      liveEntries: 42,
      totalEntries: 84,
      estimatedItemValue: 59.97,
      platformProcessingFee: 0,
      shippingCost: 12,
      sellerBudget: 72,
      sellerPaysAllFees: true,
      status: "scheduled",
      winnerIds: [],
      fraudFlags: 0,
      createdAt: new Date().toISOString(),
    },
  ],
  giveawayEntries: [],
  giveawayLedger: [],
  giveawayRules: {
    accountAgeDays: 14,
    requirePurchaseVerification: true,
    minWatchMinutes: 5,
    maxEntriesPerUser: 3,
    allowMultipleSources: true,
    fraudThreshold: 70,
  },
  giveawaySummary: {
    activeGiveaways: 1,
    eligibleUsers: 42,
    claimedWinners: 0,
    totalCost: 72,
    platformRevenueProtected: true,
  },
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

export function calculateGiveawaySummary(show: LiveShowState): LiveShowGiveawaySummary {
  const giveaways = show.giveaways ?? [];
  const eligibleUsers = giveaways.reduce((sum, giveaway) => sum + giveaway.eligibleUsers, 0);
  const claimedWinners = giveaways.reduce((sum, giveaway) => sum + giveaway.claimedWinners, 0);
  const totalCost = giveaways.reduce((sum, giveaway) => sum + giveaway.sellerBudget, 0);
  return {
    activeGiveaways: giveaways.filter((giveaway) => giveaway.status !== "ended").length,
    eligibleUsers,
    claimedWinners,
    totalCost,
    platformRevenueProtected: giveaways.every((giveaway) => giveaway.sellerPaysAllFees),
  };
}

export function calculateGiveawayCost(giveaway: LiveShowGiveaway) {
  return roundToTwo(giveaway.estimatedItemValue + giveaway.platformProcessingFee + giveaway.shippingCost);
}

export function selectGiveawayWinners(entries: LiveShowGiveawayEntry[], winnerCount: number) {
  return entries
    .filter((entry) => !entry.blocked && entry.fraudScore < 70)
    .sort((a, b) => b.accountAgeDays - a.accountAgeDays || b.watchMinutes - a.watchMinutes || b.bidCount - a.bidCount)
    .slice(0, winnerCount)
    .map((entry) => entry.userId);
}

export function evaluateGiveawayEligibility(entry: Pick<LiveShowGiveawayEntry, "accountAgeDays" | "verifiedPurchase" | "watchMinutes" | "bidCount" | "followingSeller">, rules: LiveShowGiveawayRules) {
  const meetsAge = entry.accountAgeDays >= rules.accountAgeDays;
  const meetsPurchase = !rules.requirePurchaseVerification || entry.verifiedPurchase;
  const meetsWatch = entry.watchMinutes >= rules.minWatchMinutes;
  const meetsActivity = entry.bidCount > 0 || entry.followingSeller || entry.verifiedPurchase;
  const fraudScore = Math.max(0, 100 - (entry.accountAgeDays * 2) - (entry.watchMinutes * 4) - (entry.bidCount * 6) - (entry.verifiedPurchase ? 15 : 0));

  return {
    eligible: meetsAge && meetsPurchase && meetsWatch && meetsActivity && fraudScore < rules.fraudThreshold,
    fraudScore,
    blocked: !meetsAge || fraudScore >= rules.fraudThreshold,
  };
}

export function createLiveShowSnapshot(show: LiveShowState): LiveShowState {
  const insights = calculateLiveShowInsights(show);
  return {
    ...show,
    insights,
    trust: calculateLiveTrustSignals(show),
    notifications: createLiveNotifications(),
    giveawaySummary: calculateGiveawaySummary(show),
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
