import { createClient } from "@/lib/supabase/server";
import type { Listing, Profile } from "@/lib/supabase/types";

type ListingRow = Pick<Listing, "id" | "card_name" | "set_name" | "price" | "category" | "images"> & { seller_id?: string | null; status?: string | null; created_at?: string | null };
type SellerRow = Pick<Profile, "id" | "full_name" | "username" | "avatar_url" | "seller_rating" | "total_sales"> & { display_name: string; storefront_slug: string; verified: boolean; rating: number; sales_count: number };
export type HomepageListing = ListingRow & { profiles?: Pick<Profile, "username" | "seller_rating" | "verification_status"> | null };
export type HomepageSeller = SellerRow;
export type HomepageLiveShow = { id: string; title: string; description: string | null; thumbnail: string | null; viewer_count: number | null; status: string; seller_id: string; scheduled_start: string | null; scheduled_end: string | null; auction_settings: Record<string, unknown> | null };
export type HomepageActivity = { type: "purchase" | "auction" | "follow" | "listing"; title: string; subtitle: string };
export type HomepageData = { liveNow: HomepageLiveShow[]; featuredLiveShows: HomepageLiveShow[]; endingSoonAuctions: HomepageLiveShow[]; trendingMarketplace: HomepageListing[]; recentlyAdded: HomepageListing[]; popularCategories: { label: string; count: number }[]; featuredSellers: HomepageSeller[]; activity: HomepageActivity[]; upcomingLiveShows: HomepageLiveShow[] };

const CATEGORIES = [{ label: "Singles", count: 0 }, { label: "Sealed", count: 0 }, { label: "Slabs", count: 0 }, { label: "Accessories", count: 0 }];
function emptyHome(): HomepageData { return { liveNow: [], featuredLiveShows: [], endingSoonAuctions: [], trendingMarketplace: [], recentlyAdded: [], popularCategories: CATEGORIES, featuredSellers: [], activity: [], upcomingLiveShows: [] }; }

export async function getHomepageData(): Promise<HomepageData> {
  try {
    const supabase = await createClient();
    const [listingsResult, sellersResult, liveShowsResult] = await Promise.all([
      supabase.from("listings").select("id,card_name,set_name,price,category,images,seller_id,status,created_at,profiles:seller_id(username,seller_rating,verification_status)").eq("status", "active").order("created_at", { ascending: false }).limit(12),
      supabase.from("sellers").select("*").order("sales_count", { ascending: false }).limit(8),
      supabase.from("live_shows").select("id,seller_id,title,description,thumbnail,status,viewer_count,scheduled_start,scheduled_end,auction_settings,created_at,updated_at").in("status", ["live", "scheduled", "upcoming"]).order("created_at", { ascending: false }).limit(24),
    ]);

    const trendingMarketplace = (listingsResult.data ?? []) as HomepageListing[];
    const featuredSellers = (sellersResult.data ?? []).map((seller) => {
      const row = seller as Partial<HomepageSeller> & { display_name?: string | null; storefront_slug?: string | null; verified?: boolean | null; rating?: number | null; sales_count?: number | null };
      return {
        ...(row as HomepageSeller),
        display_name: row.display_name ?? row.full_name ?? row.username ?? "Seller",
        storefront_slug: row.storefront_slug ?? row.username ?? row.id ?? "",
        verified: Boolean(row.verified),
        rating: Number(row.rating ?? row.seller_rating ?? 0),
        sales_count: Number(row.sales_count ?? row.total_sales ?? 0),
      };
    }) as HomepageSeller[];
    const liveShows = (liveShowsResult.data ?? []) as HomepageLiveShow[];
    const liveNow = liveShows.filter((show) => show.status === "live");
    const upcomingLiveShows = liveShows.filter((show) => show.status === "scheduled" || show.status === "upcoming");
    const featuredLiveShows = liveShows.filter((show) => Boolean(show.auction_settings?.featured));
    const now = Date.now();
    const endingSoonAuctions = liveNow.filter((show) => { const end = show.scheduled_end ? Date.parse(show.scheduled_end) : NaN; return Number.isFinite(end) && end > now && end - now <= 3600000; }).sort((a, b) => Date.parse(a.scheduled_end ?? "") - Date.parse(b.scheduled_end ?? "")).slice(0, 8);
    return { liveNow, featuredLiveShows: featuredLiveShows.length ? featuredLiveShows : liveNow.slice(0, 8), endingSoonAuctions, trendingMarketplace, recentlyAdded: trendingMarketplace.slice(0, 4), popularCategories: CATEGORIES, featuredSellers, activity: [], upcomingLiveShows: upcomingLiveShows.slice(0, 12) };
  } catch { return emptyHome(); }
}
