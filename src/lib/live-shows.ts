import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Database, LiveShow, LiveShowBid, LiveShowItem, LiveShowMessage } from "@/lib/supabase/types";

export type LiveShowProductState = Database["public"]["Tables"]["show_products"]["Row"];
export type LiveShowProductInsert = Database["public"]["Tables"]["show_products"]["Insert"];
export type LiveShowInsert = Database["public"]["Tables"]["live_shows"]["Insert"];
export type LiveShowEventInsert = Database["public"]["Tables"]["show_events"]["Insert"];
export type LiveShowGiveawayRow = Database["public"]["Tables"]["giveaways"]["Row"];
export type LiveShowGiveawayEntryRow = Database["public"]["Tables"]["giveaway_entries"]["Row"];
export type LiveShowGiveawayWinnerRow = Database["public"]["Tables"]["giveaway_winners"]["Row"];
export type LiveShowGiveawayFollowRow = Database["public"]["Tables"]["giveaway_follow_actions"]["Row"];
export type LiveShowGiveawayAuditRow = Database["public"]["Tables"]["giveaway_audit_logs"]["Row"];

export const LIVE_BID_STEP = 1;
export const LIVE_SLOW_MODE_SECONDS = 5;
export const LIVE_SNIPE_EXTENSION_SECONDS = 10;
export const LIVE_MAX_CHAT_LENGTH = 140;
export const LIVE_BID_SWIPE_LOCK_MS = 1200;
export const LIVE_DEFAULT_MAX_BID_ENABLED = false;

export function getNextSwipeBid(currentBid: number) {
  return Number(currentBid) + LIVE_BID_STEP;
}

export function normalizeAuctionSettings(settings: unknown) {
  const value = (settings ?? {}) as {
    min_increment?: number;
    anti_snipe_seconds?: number;
    chat_slow_mode_seconds?: number;
    max_bids_enabled?: boolean;
  };

  return {
    min_increment: Math.max(1, Math.floor(Number(value.min_increment ?? LIVE_BID_STEP))),
    anti_snipe_seconds: Math.max(0, Math.floor(Number(value.anti_snipe_seconds ?? LIVE_SNIPE_EXTENSION_SECONDS))),
    chat_slow_mode_seconds: Math.max(0, Math.floor(Number(value.chat_slow_mode_seconds ?? LIVE_SLOW_MODE_SECONDS))),
    max_bids_enabled: Boolean(value.max_bids_enabled ?? LIVE_DEFAULT_MAX_BID_ENABLED),
  };
}

export function getProxyBidResult(args: {
  currentBid: number;
  currentLeaderId: string | null;
  challengerId: string;
  challengerMaxBid: number;
  currentLeaderMaxBid: number | null;
  increment?: number;
}) {
  const increment = Math.max(1, Math.floor(Number(args.increment ?? LIVE_BID_STEP)));
  const currentBid = Math.max(0, Math.floor(Number(args.currentBid)));
  const challengerMaxBid = Math.max(0, Math.floor(Number(args.challengerMaxBid)));
  const currentLeaderMaxBid = args.currentLeaderMaxBid == null ? currentBid : Math.max(0, Math.floor(Number(args.currentLeaderMaxBid)));
  const challengerWins = challengerMaxBid > currentLeaderMaxBid;
  const displayedBid = challengerWins
    ? Math.min(challengerMaxBid, currentLeaderMaxBid + increment)
    : Math.min(currentLeaderMaxBid, challengerMaxBid + increment);

  return {
    winnerId: challengerWins ? args.challengerId : args.currentLeaderId,
    displayedBid,
    hiddenMaxBid: challengerMaxBid,
    bidderWon: challengerWins,
  };
}

export function getLeaderSwipeBid(args: { currentBid: number; currentLeaderMaxBid: number | null; increment?: number }) {
  const increment = Math.max(1, Math.floor(Number(args.increment ?? LIVE_BID_STEP)));
  const currentBid = Math.max(0, Math.floor(Number(args.currentBid)));
  const currentLeaderMaxBid = args.currentLeaderMaxBid == null ? currentBid + increment : Math.max(0, Math.floor(Number(args.currentLeaderMaxBid)));
  return Math.min(currentBid + increment, currentLeaderMaxBid);
}

export function isProxyBidLocked(currentBid: number, nextBid: number) {
  return nextBid <= currentBid;
}

export function isBidRequestUnique(lastBidAt: string | null | undefined, now: number, lockMs = LIVE_BID_SWIPE_LOCK_MS) {
  if (!lastBidAt) return true;
  return now - new Date(lastBidAt).getTime() >= lockMs;
}

export function isAuctionBidAllowed(args: { showStatus: string; productSold: boolean; productPassed: boolean; sellerId: string; bidderId: string; sellerFraudFlag: boolean | null; }) {
  if (args.showStatus !== "live") return { ok: false, reason: "Show is not live" } as const;
  if (args.productSold || args.productPassed) return { ok: false, reason: "Item is not available" } as const;
  if (args.sellerId === args.bidderId) return { ok: false, reason: "Seller cannot bid on their own item" } as const;
  if (args.sellerFraudFlag) return { ok: false, reason: "Seller account is restricted" } as const;
  return { ok: true } as const;
}

export function getAuctionStartBid(amount: number) {
  return Math.max(1, Math.floor(Number(amount) || 1));
}

export async function getLiveShowById(showId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("live_shows")
    .select("*")
    .eq("id", showId)
    .single();

  if (error) throw new Error(error.message);
  return data as LiveShow;
}

export async function getLiveShowDetails(showId: string) {
  const supabase = await createServerClient();

  const [{ data: show, error: showError }, { data: products, error: productsError }, { data: bids, error: bidsError }, { data: chat, error: chatError }, { data: giveaways, error: giveawaysError }] = await Promise.all([
    supabase.from("live_shows").select("*").eq("id", showId).single(),
    supabase.from("show_products").select("*").eq("show_id", showId).order("sort_order", { ascending: true }),
    supabase.from("live_bids").select("*").eq("show_id", showId).order("created_at", { ascending: false }).limit(100),
    supabase.from("live_chat").select("*").eq("show_id", showId).order("created_at", { ascending: true }).limit(100),
    supabase.from("giveaways").select("*").eq("show_id", showId).order("created_at", { ascending: false }),
  ]);

  if (showError) throw new Error(showError.message);
  if (productsError) throw new Error(productsError.message);
  if (bidsError) throw new Error(bidsError.message);
  if (chatError) throw new Error(chatError.message);
  if (giveawaysError) throw new Error(giveawaysError.message);

  return {
    show: show as LiveShow,
    products: (products ?? []) as LiveShowItem[],
    bids: (bids ?? []) as LiveShowBid[],
    chat: (chat ?? []) as LiveShowMessage[],
    giveaways: (giveaways ?? []) as LiveShowGiveawayRow[],
  };
}

export type LiveShowDirectoryItem = Pick<LiveShow, "id" | "seller_id" | "title" | "description" | "thumbnail" | "status" | "auction_state" | "scheduled_start" | "scheduled_end" | "viewer_count" | "peak_viewers" | "created_at" | "updated_at" | "auction_settings">;

export async function listActiveLiveShows() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("live_shows")
    .select("id, seller_id, title, description, thumbnail, status, auction_state, scheduled_start, scheduled_end, viewer_count, peak_viewers, created_at, updated_at, auction_settings")
    .eq("status", "live")
    .order("viewer_count", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveShowDirectoryItem[];
}

export async function listUpcomingLiveShows() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("live_shows")
    .select("id, seller_id, title, description, thumbnail, status, auction_state, scheduled_start, scheduled_end, viewer_count, peak_viewers, created_at, updated_at, auction_settings")
    .neq("status", "live")
    .order("scheduled_start", { ascending: true, nullsFirst: true })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveShowDirectoryItem[];
}

export async function listFeaturedLiveShows() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("live_shows")
    .select("id, seller_id, title, description, thumbnail, status, auction_state, scheduled_start, scheduled_end, viewer_count, peak_viewers, created_at, updated_at, auction_settings")
    .eq("status", "live")
    .order("peak_viewers", { ascending: false })
    .limit(6);

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveShowDirectoryItem[];
}

export async function listShowModerators(showId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("show_events").select("id, created_by, event_type, payload, created_at").eq("show_id", showId).order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createShowEvent(input: LiveShowEventInsert) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("show_events").insert(input as any);
  if (error) throw new Error(error.message);
}

export async function getGiveawaysForShow(showId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("giveaways")
    .select("*")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveShowGiveawayRow[];
}

export function isGiveawayActive(giveaway: LiveShowGiveawayRow) {
  const now = Date.now();
  const start = new Date(giveaway.start_at).getTime();
  const end = new Date(giveaway.end_at).getTime();
  return now >= start && now <= end && giveaway.status === "live";
}

export function validateBidAmount(currentBid: number, incomingBid: number, minIncrement = LIVE_BID_STEP) {
  return incomingBid >= currentBid + minIncrement;
}

export function applyAntiSnipingExtension(secondsLeft: number, extensionSeconds = LIVE_SNIPE_EXTENSION_SECONDS) {
  return secondsLeft <= extensionSeconds ? Math.max(secondsLeft, extensionSeconds) : secondsLeft;
}
