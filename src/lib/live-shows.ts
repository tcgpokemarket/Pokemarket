import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Database, LiveShow, LiveShowBid, LiveShowItem, LiveShowMessage } from "@/lib/supabase/types";

export type LiveShowProductState = Database["public"]["Tables"]["show_products"]["Row"];
export type LiveShowProductInsert = Database["public"]["Tables"]["show_products"]["Insert"];
export type LiveShowInsert = Database["public"]["Tables"]["live_shows"]["Insert"];
export type LiveShowEventInsert = Database["public"]["Tables"]["show_events"]["Insert"];
export type LiveShowGiveawayRow = Database["public"]["Tables"]["giveaways"]["Row"];

export const LIVE_BID_STEP = 1;
export const LIVE_SLOW_MODE_SECONDS = 5;
export const LIVE_SNIPE_EXTENSION_SECONDS = 10;
export const LIVE_MAX_CHAT_LENGTH = 140;

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

export function validateBidAmount(currentBid: number, incomingBid: number, minIncrement = LIVE_BID_STEP) {
  return incomingBid >= currentBid + minIncrement;
}

export function applyAntiSnipingExtension(secondsLeft: number, extensionSeconds = LIVE_SNIPE_EXTENSION_SECONDS) {
  return secondsLeft <= extensionSeconds ? Math.max(secondsLeft, extensionSeconds) : secondsLeft;
}
