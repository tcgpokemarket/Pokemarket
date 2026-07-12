import { createClient } from "@/lib/supabase/client";

export type LiveShowDirectoryItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  viewer_count: number | null;
  seller_id: string;
  created_at: string;
  updated_at: string;
  thumbnail: string | null;
  auction_settings: Record<string, unknown> | null;
};

function normalizeRoom(row: Record<string, any>): LiveShowDirectoryItem {
  const createdAt = row.created_at ?? new Date().toISOString();
  return {
    id: row.id,
    title: row.title ?? "Live room",
    description: row.description ?? null,
    status: row.status ?? "scheduled",
    viewer_count: row.viewer_count ?? 0,
    seller_id: row.seller_id,
    created_at: createdAt,
    updated_at: row.updated_at ?? createdAt,
    thumbnail: row.thumbnail ?? null,
    auction_settings: row.auction_settings ?? null,
  };
}

async function fetchRoomsForSeller(sellerId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("live_shows")
    .select("id, seller_id, title, description, thumbnail, status, viewer_count, updated_at, created_at, auction_settings")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => normalizeRoom(row as Record<string, any>));
}

export async function listLiveShowsBySeller(sellerId: string): Promise<LiveShowDirectoryItem[]> {
  try {
    return await fetchRoomsForSeller(sellerId);
  } catch {
    return [];
  }
}

export async function listActiveLiveShows(): Promise<LiveShowDirectoryItem[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("live_shows")
      .select("id, seller_id, title, description, thumbnail, status, viewer_count, updated_at, created_at, auction_settings")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(12);
    return (data ?? []).map((row) => normalizeRoom(row as Record<string, any>));
  } catch {
    return [];
  }
}

export async function listFeaturedLiveShows(): Promise<LiveShowDirectoryItem[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("live_shows")
      .select("id, seller_id, title, description, thumbnail, status, viewer_count, updated_at, created_at, auction_settings")
      .order("created_at", { ascending: false })
      .limit(12);
    return (data ?? [])
      .map((row) => normalizeRoom(row as Record<string, any>))
      .filter((room) => Boolean((room.auction_settings as { featured?: boolean } | null | undefined)?.featured));
  } catch {
    return [];
  }
}

export async function listUpcomingLiveShows(): Promise<LiveShowDirectoryItem[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("live_shows")
      .select("id, seller_id, title, description, thumbnail, status, viewer_count, updated_at, created_at, auction_settings")
      .in("status", ["scheduled", "upcoming"])
      .order("created_at", { ascending: false })
      .limit(12);
    return (data ?? []).map((row) => normalizeRoom(row as Record<string, any>));
  } catch {
    return [];
  }
}

export async function getLiveShowDetails(showId: string) {
  const supabase = createClient();
  const [{ data: show }, { data: products }, { data: bids }, { data: chat }, { data: giveaways }] = await Promise.all([
    supabase.from("live_shows").select("*").eq("id", showId).single(),
    supabase.from("show_products").select("*").eq("show_id", showId).order("created_at", { ascending: false }),
    supabase.from("live_bids").select("*").eq("show_id", showId).order("created_at", { ascending: false }),
    supabase.from("live_chat").select("*").eq("show_id", showId).order("created_at", { ascending: true }),
    supabase.from("giveaways").select("*").eq("show_id", showId).order("created_at", { ascending: false }),
  ]);

  if (!show) throw new Error("Show not found");

  return {
    show: show as import("@/lib/supabase/types").LiveShow,
    products: (products ?? []) as import("@/lib/supabase/types").LiveShowItem[],
    bids: (bids ?? []) as import("@/lib/supabase/types").LiveShowBid[],
    chat: (chat ?? []) as import("@/lib/supabase/types").LiveShowMessage[],
    giveaways: giveaways ?? [],
  };
}
