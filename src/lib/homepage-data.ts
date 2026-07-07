import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, LiveShow, Listing } from "@/lib/supabase/types";

export type HomepageLiveShow = Pick<LiveShow, "id" | "seller_id" | "title" | "description" | "thumbnail" | "status" | "auction_state" | "scheduled_start" | "scheduled_end" | "viewer_count" | "peak_viewers" | "auction_settings" | "created_at">;
export type HomepageListing = Pick<Listing, "id" | "seller_id" | "card_name" | "set_name" | "card_number" | "condition" | "category" | "price" | "images" | "status" | "created_at">;
export type HomepageSeller = {
  id: string;
  display_name: string;
  storefront_slug: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  verified: boolean;
  rating: number;
  follower_count: number;
  sales_count: number;
  total_revenue: number;
  total_listings: number;
  total_live_shows: number;
};
export type HomepageCategory = {
  name: string;
  count: number;
};
export type HomepageActivity = {
  type: "purchase" | "auction" | "follow" | "collection";
  title: string;
  subtitle: string;
  created_at: string;
};

export async function getHomepageData() {
  const admin = createAdminClient();

  const [liveShowsResult, listingsResult, sellersResult, ordersResult, followersResult, categoriesResult] = await Promise.all([
    admin
      .from("live_shows")
      .select("id, seller_id, title, description, thumbnail, status, auction_state, scheduled_start, scheduled_end, viewer_count, peak_viewers, auction_settings, created_at")
      .order("viewer_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("listings")
      .select("id, seller_id, card_name, set_name, card_number, condition, category, price, images, status, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(24),
    admin
      .from("sellers")
      .select("id, display_name, storefront_slug, bio, avatar_url, banner_url, verified, rating, follower_count, sales_count, total_revenue, total_listings, total_live_shows")
      .order("sales_count", { ascending: false })
      .limit(12),
    admin
      .from("orders")
      .select("id, buyer_id, seller_id, listing_id, status, total_amount, created_at")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("seller_followers")
      .select("id, seller_id, follower_id, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("listings")
      .select("category")
      .eq("status", "active"),
  ]);

  const liveShows = (liveShowsResult.data ?? []) as HomepageLiveShow[];
  const listings = (listingsResult.data ?? []) as HomepageListing[];
  const sellers = (sellersResult.data ?? []) as HomepageSeller[];
  const completedOrders = (ordersResult.data ?? []) as Array<Pick<Database["public"]["Tables"]["orders"]["Row"], "id" | "buyer_id" | "seller_id" | "listing_id" | "status" | "total_amount" | "created_at">>;
  const followers = (followersResult.data ?? []) as Array<Pick<Database["public"]["Tables"]["seller_followers"]["Row"], "id" | "seller_id" | "follower_id" | "created_at">>;
  const categories = (categoriesResult.data ?? []) as Array<Pick<Listing, "category">>;

  const liveNow = liveShows.filter((show) => show.status === "live");
  const featuredLiveShows = [...liveShows].sort((a, b) => (b.peak_viewers ?? 0) - (a.peak_viewers ?? 0)).slice(0, 6);
  const endingSoonAuctions = listings
    .map((listing) => ({ listing, secondsLeft: Number((listing as { auction_seconds_left?: number }).auction_seconds_left ?? 0) }))
    .sort((a, b) => a.secondsLeft - b.secondsLeft)
    .slice(0, 6);
  const trendingMarketplace = listings.slice(0, 12);
  const recentlyAdded = listings.slice(0, 12);
  const upcomingLiveShows = liveShows
    .filter((show) => show.status !== "live" && show.scheduled_start)
    .sort((a, b) => new Date(String(a.scheduled_start)).getTime() - new Date(String(b.scheduled_start)).getTime())
    .slice(0, 6);
  const featuredSellers = sellers.slice(0, 8);
  const popularCategories = Object.entries(
    categories.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const activity: HomepageActivity[] = [
    ...completedOrders.slice(0, 4).map((order) => ({
      type: "purchase" as const,
      title: `Order completed`,
      subtitle: `Order ${order.id.slice(0, 8)} · $${Number(order.total_amount ?? 0).toFixed(2)}`,
      created_at: order.created_at,
    })),
    ...liveShows.slice(0, 4).map((show) => ({
      type: "auction" as const,
      title: `Live show update`,
      subtitle: `${show.title} · ${show.viewer_count} viewers`,
      created_at: show.created_at,
    })),
    ...followers.slice(0, 4).map((follow) => ({
      type: "follow" as const,
      title: `Seller followed`,
      subtitle: `Seller ${follow.seller_id.slice(0, 8)} gained a new follower`,
      created_at: follow.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

  return {
    liveNow,
    featuredLiveShows,
    endingSoonAuctions,
    trendingMarketplace,
    recentlyAdded,
    popularCategories,
    featuredSellers,
    activity,
    upcomingLiveShows,
  };
}
