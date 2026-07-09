export * from "@/lib/live-shows-client";

export const LIVE_BID_STEP = 1;
export const LIVE_SNIPE_EXTENSION_SECONDS = 15;
export const LIVE_MAX_CHAT_LENGTH = 280;

export function normalizeAuctionSettings(settings: unknown) {
  const value = (settings ?? {}) as Record<string, unknown>;
  return {
    min_increment: Number(value.min_increment ?? LIVE_BID_STEP),
    anti_snipe_seconds: Number(value.anti_snipe_seconds ?? LIVE_SNIPE_EXTENSION_SECONDS),
    max_bids_enabled: Boolean(value.max_bids_enabled),
    featured: Boolean(value.featured),
    ...value,
  };
}

export function isAuctionBidAllowed(args: { showStatus?: string | null; productSold?: boolean; productPassed?: boolean; sellerId?: string; bidderId?: string; sellerFraudFlag?: boolean | null }) {
  if (!args.showStatus || args.showStatus !== "live") return { ok: false, reason: "Show is not live" };
  if (args.productSold) return { ok: false, reason: "Item already sold" };
  if (args.productPassed) return { ok: false, reason: "Item has passed" };
  if (args.sellerFraudFlag) return { ok: false, reason: "Seller account under review" };
  if (args.sellerId && args.bidderId && args.sellerId === args.bidderId) return { ok: false, reason: "Sellers cannot bid on their own show" };
  return { ok: true, reason: null };
}

export function isBidRequestUnique(previousCreatedAt: string | null | undefined, now: number) {
  if (!previousCreatedAt) return true;
  return now - new Date(previousCreatedAt).getTime() > 500;
}

export function getNextSwipeBid(currentBid: number) {
  return Number(currentBid) + LIVE_BID_STEP;
}

export function getLeaderSwipeBid(args: { currentBid: number; currentLeaderMaxBid: number | null; increment: number }) {
  return Number(args.currentBid) + Math.max(Number(args.increment), Number(args.currentLeaderMaxBid ?? 0) > Number(args.currentBid) ? Number(args.increment) : 0);
}

export function getProxyBidResult(args: { currentBid: number; currentLeaderId: string | null; challengerId: string; challengerMaxBid: number; currentLeaderMaxBid: number | null; increment: number }) {
  const leaderMaxBid = Number(args.currentLeaderMaxBid ?? 0);
  const challengerBeatsLeader = args.challengerMaxBid > leaderMaxBid;
  const winnerId = challengerBeatsLeader ? args.challengerId : args.currentLeaderId ?? args.challengerId;
  const displayedBid = getNextSwipeBid(args.currentBid + Math.max(args.increment, 0));
  return { winnerId, displayedBid, hiddenMaxBid: challengerBeatsLeader ? args.challengerMaxBid : leaderMaxBid, bidderWon: winnerId === args.challengerId };
}

export function applyAntiSnipingExtension(secondsLeft: number | null | undefined, extensionSeconds: number) {
  const current = Number(secondsLeft ?? 0);
  if (current <= extensionSeconds) return current + extensionSeconds;
  return current;
}

export function createShowEvent(input: { show_id: string; event_type: string; payload: unknown; created_by: string }) {
  return input;
}

export function isGiveawayActive(giveaway: { status?: string | null; start_at?: string | null; end_at?: string | null }) {
  if (giveaway.status && giveaway.status !== "live") return false;
  const now = Date.now();
  const start = giveaway.start_at ? new Date(giveaway.start_at).getTime() : Number.NEGATIVE_INFINITY;
  const end = giveaway.end_at ? new Date(giveaway.end_at).getTime() : Number.POSITIVE_INFINITY;
  return now >= start && now <= end;
}
