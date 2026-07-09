import type { Database } from "@/lib/supabase/types";
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
  const title = row.title ?? row.show_products?.title ?? "Live room";
  const description = row.description ?? row.show_products?.subtitle ?? null;
  const createdAt = row.created_at ?? new Date().toISOString();
  return {
    id: row.id,
    title,
    description,
    status: row.status ?? "scheduled",
    viewer_count: row.viewer_count ?? row.viewers ?? 0,
    seller_id: row.seller_id,
    created_at: createdAt,
    updated_at: row.updated_at ?? createdAt,
    thumbnail: row.thumbnail ?? row.show_products?.image_url ?? null,
    auction_settings: row.auction_settings ?? { featured: Boolean(row.featured) },
  };
}

async function fetchRoomsForSeller(sellerId: string) {
  const supabase = createClient();
  const [liveRooms, scheduledRooms, upcomingRooms] = await Promise.all([
    supabase.from("auction_orders").select("*").eq("seller_id", sellerId).eq("status", "live"),
    supabase.from("auction_orders").select("*").eq("seller_id", sellerId).eq("status", "scheduled"),
    supabase.from("auction_orders").select("*").eq("seller_id", sellerId).eq("status", "upcoming"),
  ]);

  const rooms = [
    ...(liveRooms.data ?? []),
    ...(scheduledRooms.data ?? []),
    ...(upcomingRooms.data ?? []),
  ].map((row) => normalizeRoom(row as Record<string, any>));

  return rooms.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
    const { data } = await supabase.from("auction_orders").select("*").eq("status", "live").order("created_at", { ascending: false }).limit(12);
    return (data ?? []).map((row) => normalizeRoom(row as Record<string, any>));
  } catch {
    return [];
  }
}

export async function listFeaturedLiveShows(): Promise<LiveShowDirectoryItem[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase.from("auction_orders").select("*").order("created_at", { ascending: false }).limit(12);
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
    const { data } = await supabase.from("auction_orders").select("*").eq("status", "upcoming").order("created_at", { ascending: false }).limit(12);
    return (data ?? []).map((row) => normalizeRoom(row as Record<string, any>));
  } catch {
    return [];
  }
}
