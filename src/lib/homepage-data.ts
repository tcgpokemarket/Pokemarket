import { createClient } from "@/lib/supabase/server";
import type { Listing, Profile } from "@/lib/supabase/types";

type ListingRow = Pick<Listing, "id" | "seller_id" | "card_name" | "set_name" | "price" | "category" | "images"> & {
  promotion_badge?: string | null;
  promotion_tier?: string | null;
  promoted_until?: string | null;
};
type SellerRow = Pick<Profile, "id" | "full_name" | "username" | "avatar_url" | "seller_rating" | "total_sales"> & {
  display_name: string;
  storefront_slug: string;
  verified: boolean;
  rating: number;
  sales_count: number;
  promotion_badge?: string | null;
  promoted_until?: string | null;
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
  return {
    id: listing.id,
    seller_id: listing.seller_id,
    card_name: listing.card_name,
    set_name: listing.set_name,
    price: listing.price,
    category: listing.category,
    images: listing.images ?? [],
    promotion_badge: listing.promotion_badge ?? null,
    promotion_tier: listing.promotion_tier ?? null,
    promoted_until: listing.promoted_until ?? null,
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
    promotion_badge: seller.promotion_badge ?? null,
    promoted_until: seller.promoted_until ?? null,
  };
}

function emptyHomeData(): HomepageData {
  return emptyHome();
}

export async function getHomepageData(): Promise<HomepageData> {
  try {
    const supabase = await createClient();
    const [listingsResult, sellersResult] = await Promise.all([
      supabase.from("listings").select("id, seller_id, card_name, set_name, price, category, images, created_at, promotion_badge, promotion_tier, promoted_until").eq("status", "active").order("created_at", { ascending: false }).limit(12),
      supabase.from("seller_stores").select("seller_id, name, slug, description, banner_url, logo_url, verified, featured, theme, promoted_until, promotion_badge").order("created_at", { ascending: false }).limit(8),
    ]);

    const sellerRows = await Promise.all(((sellersResult.data ?? []) as Array<{ seller_id: string; name: string; slug: string; logo_url: string | null; verified: boolean }>)
      .map(async (seller) => {
        const { count: salesCount } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", seller.seller_id)
          .eq("status", "sold");

        return mapSeller({
          id: seller.seller_id,
          full_name: seller.name,
          username: seller.slug,
          avatar_url: seller.logo_url,
          seller_rating: seller.verified ? 5 : 0,
          total_sales: salesCount ?? 0,
          display_name: seller.name,
          storefront_slug: seller.slug,
          verified: seller.verified,
          rating: seller.verified ? 5 : 0,
          sales_count: salesCount ?? 0,
        } as SellerRow);
      }));

    const trendingMarketplace = (listingsResult.data ?? [])
      .map(mapListing)
      .sort((a, b) => Number(Boolean(b.promotion_badge)) - Number(Boolean(a.promotion_badge)));
    const featuredSellers = sellerRows
      .filter(Boolean)
      .sort((a, b) => Number(Boolean(b.promotion_badge)) - Number(Boolean(a.promotion_badge))) as HomepageSeller[];

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
