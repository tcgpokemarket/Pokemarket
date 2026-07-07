import { createClient } from "@/lib/supabase/client";
import type { Database, LiveShow, LiveShowBid, LiveShowItem, LiveShowMessage } from "@/lib/supabase/types";

export type LiveShowDirectoryItem = Pick<LiveShow, "id" | "seller_id" | "title" | "description" | "thumbnail" | "status" | "auction_state" | "scheduled_start" | "scheduled_end" | "viewer_count" | "peak_viewers" | "created_at" | "updated_at" | "auction_settings">;

export async function listLiveShows() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("live_shows")
    .select("id, seller_id, title, description, thumbnail, status, auction_state, scheduled_start, scheduled_end, viewer_count, peak_viewers, created_at, updated_at, auction_settings")
    .order("viewer_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveShowDirectoryItem[];
}

export async function listLiveShowsBySeller(sellerId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("live_shows")
    .select("id, seller_id, title, description, thumbnail, status, auction_state, scheduled_start, scheduled_end, viewer_count, peak_viewers, created_at, updated_at, auction_settings")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveShowDirectoryItem[];
}

export async function getLiveShowDetails(showId: string) {
  const supabase = createClient();

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
    giveaways: (giveaways ?? []) as Database["public"]["Tables"]["giveaways"]["Row"][],
  };
}
