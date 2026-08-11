import { createClient } from "@/lib/supabase/server";
import type { Listing, Profile } from "@/lib/supabase/types";

type ListingRow = Pick<Listing, "id" | "card_name" | "set_name" | "price" | "category" | "images">;
type SellerRow = Pick<Profile, "id" | "full_name" | "username" | "avatar_url" | "seller_rating" | "total_sales"> & {
  display_name: string;
  storefront_slug: string;
  verified: boolean;
  rating: number;
  sales_count: number;
};

export type HomepageListing = ListingRow;
export type HomepageSeller = SellerRow;
export type HomepageLiveShow = {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  viewer_count: number | null;
  status: string;
  seller_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  auction_settings: Record<string, unknown> | null;
};
export type HomepageActivity = {
  type: "purchase" | "auction" | "follow" | "listing";
  title: string;
  subtitle: string;
};

export type HomepageData = {
  liveNow: HomepageLiveShow[];
  featuredLiveShows: HomepageLiveShow[];
  endingSoonAuctions: HomepageLiveShow[];
  trendingMarketplace: HomepageListing[];
  recentlyAdded: HomepageListing[];
  popularCategories: { label: string; count: number }[];
  featuredSellers: HomepageSeller[];
  activity: HomepageActivity[];
  upcomingLiveShows: HomepageLiveShow[];
};

const EMPTY_LISTINGS: HomepageListing[] = [];
const EMPTY_SELLERS: HomepageSeller[] = [];
const EMPTY_LIVE_SHOWS: HomepageLiveShow[] = [];
const EMPTY_ACTIVITY: HomepageActivity[] = [];
const EMPTY_POPULAR_CATEGORIES = [
  { label: "Singles", count: 0 },
  { label: "Sealed", count: 0 },
  { label: "Slabs", count: 0 },
  { label: "Accessories", count: 0 },
];

function emptyHome(): HomepageData {
  return {
    liveNow: [],
    featuredLiveShows: [],
    endingSoonAuctions: [],
    trendingMarketplace: [],
    recentlyAdded: [],
    popularCategories: EMPTY_POPULAR_CATEGORIES,
    featuredSellers: [],
    activity: [],
    upcomingLiveShows: [],
  };
}

function mapListing(listing: ListingRow): HomepageListing {
  return {
    id: listing.id,
    card_name: listing.card_name,
    set_name: listing.set_name,
    price: listing.price,
    category: listing.category,
    images: listing.images ?? [],
  };
}

function mapSeller(seller: SellerRow | null | undefined): HomepageSeller | null {
  if (!seller) return null;
  return {
    id: seller.id,
    display_name: seller.display_name,
    storefront_slug: seller.storefront_slug,
    full_name: seller.display_name,
    username: seller.storefront_slug,
    avatar_url: seller.avatar_url,
    verified: seller.verified,
    rating: seller.rating,
    sales_count: seller.sales_count,
    seller_rating: seller.rating,
    total_sales: seller.sales_count,
  };
}

function mapLiveShow(row: Record<string, unknown>): HomepageLiveShow {
  return {
    id: String(row.id),
    title: String(row.title ?? "Live showcase"),
    description: (row.description as string | null) ?? null,
    thumbnail: (row.thumbnail as string | null) ?? null,
    viewer_count: typeof row.viewer_count === "number" ? row.viewer_count : 0,
    status: String(row.status ?? "scheduled"),
    seller_id: String(row.seller_id),
    scheduled_start: (row.scheduled_start as string | null) ?? null,
    scheduled_end: (row.scheduled_end as string | null) ?? null,
    auction_settings: (row.auction_settings as Record<string, unknown> | null) ?? null,
  };
}

export async function getHomepageData(): Promise<HomepageData> {
  try {
    const supabase = await createClient();
    const [listingsResult, sellersResult, liveShowsResult] = await Promise.all([
      supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("sellers")
        .select("*")
        .order("sales_count", { ascending: false })
        .limit(8),
      supabase
        .from("live_shows")
        .select("id, seller_id, title, description, thumbnail, status, viewer_count, scheduled_start, scheduled_end, auction_settings, created_at, updated_at")
        .in("status", ["live", "scheduled", "upcoming"])
        .order("created_at", { ascending: false })
        .limit(24),
    ]);

    const trendingMarketplace = (listingsResult.data ?? []).map((listing) => mapListing(listing as ListingRow));
    const featuredSellers = (sellersResult.data ?? [])
      .map((seller) => mapSeller(seller as SellerRow))
      .filter(Boolean) as HomepageSeller[];

    const liveShows = (liveShowsResult.data ?? []).map((row) => mapLiveShow(row as Record<string, unknown>));
    const liveNow = liveShows.filter((show) => show.status === "live");
    const upcomingLiveShows = liveShows.filter((show) => show.status === "scheduled" || show.status === "upcoming");
    const featuredLiveShows = liveShows.filter((show) => Boolean(show.auction_settings?.featured));

    // Ending-soon showcases are live rooms with a known scheduled end time.
    const now = Date.now();
    const endingSoonAuctions = liveNow
      .filter((show) => {
        if (!show.scheduled_end) return false;
        const end = Date.parse(show.scheduled_end);
        return Number.isFinite(end) && end > now && end - now <= 60 * 60 * 1000;
      })
      .sort((a, b) => Date.parse(a.scheduled_end ?? "") - Date.parse(b.scheduled_end ?? ""))
      .slice(0, 8);

    return {
      liveNow,
      featuredLiveShows: featuredLiveShows.length ? featuredLiveShows : liveNow.slice(0, 8),
      endingSoonAuctions,
      trendingMarketplace,
      recentlyAdded: trendingMarketplace.slice(0, 4),
      popularCategories: EMPTY_POPULAR_CATEGORIES,
      featuredSellers,
      activity: EMPTY_ACTIVITY,
      upcomingLiveShows: upcomingLiveShows.slice(0, 12),
    };
  } catch {
    return emptyHome();
  }
}
