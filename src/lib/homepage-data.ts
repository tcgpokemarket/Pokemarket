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

const EMPTY_HOME = {
  liveNow: EMPTY_LIVE_SHOWS,
  featuredLiveShows: EMPTY_LIVE_SHOWS,
  endingSoonAuctions: EMPTY_LIVE_SHOWS,
  trendingMarketplace: EMPTY_LISTINGS,
  recentlyAdded: EMPTY_LISTINGS,
  popularCategories: EMPTY_POPULAR_CATEGORIES,
  featuredSellers: EMPTY_SELLERS,
  activity: EMPTY_ACTIVITY,
  upcomingLiveShows: EMPTY_LIVE_SHOWS,
};

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
  return { id: listing.id, card_name: listing.card_name, set_name: listing.set_name, price: listing.price, category: listing.category, images: listing.images ?? [] };
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

function emptyHomeData(): HomepageData {
  return emptyHome();
}

export async function getHomepageData(): Promise<HomepageData> {
  try {
    const supabase = await createClient();
    const [listingsResult, sellersResult] = await Promise.all([
      supabase.from("listings").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(12),
      supabase.from("sellers").select("*").order("sales_count", { ascending: false }).limit(8),
    ]);

    const trendingMarketplace = (listingsResult.data ?? []).map(mapListing);
    const featuredSellers = (sellersResult.data ?? []).map((seller) => mapSeller(seller as SellerRow)).filter(Boolean) as HomepageSeller[];

    return {
      liveNow: [],
      featuredLiveShows: [],
      endingSoonAuctions: [],
      trendingMarketplace,
      recentlyAdded: trendingMarketplace.slice(0, 4),
      popularCategories: EMPTY_POPULAR_CATEGORIES,
      featuredSellers,
      activity: [],
      upcomingLiveShows: [],
    };
  } catch {
    return emptyHomeData();
  }
}
