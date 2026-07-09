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

const DEFAULT_LISTINGS: HomepageListing[] = [
  { id: "demo-listing-1", card_name: "Charizard ex", set_name: "Obsidian Flames", price: 219.99, category: "graded", images: ["https://images.unsplash.com/photo-1603863846951-5a1c0b9b3f6b?auto=format&fit=crop&w=1200&q=80"] },
  { id: "demo-listing-2", card_name: "151 Booster Bundle", set_name: "Scarlet & Violet", price: 54.99, category: "sealed", images: ["https://images.unsplash.com/photo-1584646095723-3a0d5b6f9b44?auto=format&fit=crop&w=1200&q=80"] },
  { id: "demo-listing-3", card_name: "Mew ex", set_name: "Paldean Fates", price: 74.5, category: "single", images: ["https://images.unsplash.com/photo-1627856017788-2b6b4f7f8ed2?auto=format&fit=crop&w=1200&q=80"] },
  { id: "demo-listing-4", card_name: "Pikachu Illustration Rare", set_name: "SV 151", price: 139.95, category: "single", images: ["https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1200&q=80"] },
];

const DEFAULT_SELLERS: HomepageSeller[] = [
  { id: "demo-seller-1", display_name: "Collector Vault", storefront_slug: "collector-vault", full_name: "Collector Vault", username: "collectorvault", avatar_url: null, verified: true, rating: 4.9, sales_count: 1240, seller_rating: 4.9, total_sales: 1240 },
  { id: "demo-seller-2", display_name: "Break Night", storefront_slug: "break-night", full_name: "Break Night", username: "breaknight", avatar_url: null, verified: true, rating: 4.8, sales_count: 860, seller_rating: 4.8, total_sales: 860 },
  { id: "demo-seller-3", display_name: "Slab Society", storefront_slug: "slab-society", full_name: "Slab Society", username: "slabsociety", avatar_url: null, verified: false, rating: 4.7, sales_count: 640, seller_rating: 4.7, total_sales: 640 },
  { id: "demo-seller-4", display_name: "Poke Pulse", storefront_slug: "poke-pulse", full_name: "Poke Pulse", username: "pokepulse", avatar_url: null, verified: true, rating: 4.9, sales_count: 1530, seller_rating: 4.9, total_sales: 1530 },
];

const DEFAULT_LIVE_SHOWS: HomepageLiveShow[] = [
  { id: "demo-live-1", title: "Charizard Chase Room", description: "Big hits, fast bids, and a packed live room.", thumbnail: "https://images.unsplash.com/photo-1593698054589-7f0b0d7f7f2c?auto=format&fit=crop&w=1200&q=80", viewer_count: 182, status: "live", seller_id: "demo-seller-1", scheduled_start: new Date(Date.now() + 1000 * 60 * 20).toISOString(), scheduled_end: new Date(Date.now() + 1000 * 60 * 80).toISOString(), auction_settings: { current_bid: 145, current_item: "Charizard ex · Obsidian Flames" } },
  { id: "demo-live-2", title: "Slab Showcase", description: "Fresh PSA and BGS slabs in the spotlight.", thumbnail: "https://images.unsplash.com/photo-1513188732907-5f14a0c4d15f?auto=format&fit=crop&w=1200&q=80", viewer_count: 116, status: "scheduled", seller_id: "demo-seller-3", scheduled_start: new Date(Date.now() + 1000 * 60 * 45).toISOString(), scheduled_end: new Date(Date.now() + 1000 * 60 * 120).toISOString(), auction_settings: { current_bid: 88, current_item: "PSA 10 Umbreon V" } },
  { id: "demo-live-3", title: "Sealed Saturday", description: "Booster boxes, bundles, and quick drops.", thumbnail: "https://images.unsplash.com/photo-1604079628042-a6b8f4b77f7d?auto=format&fit=crop&w=1200&q=80", viewer_count: 91, status: "live", seller_id: "demo-seller-2", scheduled_start: new Date(Date.now() + 1000 * 60 * 10).toISOString(), scheduled_end: new Date(Date.now() + 1000 * 60 * 70).toISOString(), auction_settings: { current_bid: 62, current_item: "151 Booster Bundle" } },
  { id: "demo-live-4", title: "Vintage Hits", description: "Old-school favorites and collector grabs.", thumbnail: "https://images.unsplash.com/photo-1611672585731-fa10603fb9e0?auto=format&fit=crop&w=1200&q=80", viewer_count: 74, status: "scheduled", seller_id: "demo-seller-4", scheduled_start: new Date(Date.now() + 1000 * 60 * 95).toISOString(), scheduled_end: new Date(Date.now() + 1000 * 60 * 150).toISOString(), auction_settings: { current_bid: 34, current_item: "Base Set Hit" } },
];

const DEFAULT_ACTIVITY: HomepageActivity[] = [
  { type: "purchase", title: "New buyer checked out", subtitle: "Mew ex from the live feed" },
  { type: "auction", title: "Bids climbing fast", subtitle: "Charizard ex just got another jump" },
  { type: "follow", title: "A collector followed a seller", subtitle: "Break Night gained a new fan" },
  { type: "listing", title: "Fresh sealed product added", subtitle: "151 booster bundle just dropped" },
];

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

function fallbackLiveShows(): HomepageLiveShow[] {
  return DEFAULT_LIVE_SHOWS;
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
    const liveShows = fallbackLiveShows();

    return {
      liveNow: liveShows.filter((show) => show.status === "live"),
      featuredLiveShows: liveShows.filter((show) => show.status === "scheduled"),
      endingSoonAuctions: [],
      trendingMarketplace: trendingMarketplace.length ? trendingMarketplace : DEFAULT_LISTINGS,
      recentlyAdded: trendingMarketplace.slice(0, 4),
      popularCategories: [
        { label: "Singles", count: 120 },
        { label: "Sealed", count: 44 },
        { label: "Slabs", count: 21 },
        { label: "Accessories", count: 18 },
      ],
      featuredSellers: featuredSellers.length ? featuredSellers : DEFAULT_SELLERS,
      activity: DEFAULT_ACTIVITY,
      upcomingLiveShows: liveShows.filter((show) => show.status === "scheduled"),
    };
  } catch {
    const liveShows = fallbackLiveShows();
    return {
      liveNow: liveShows.filter((show) => show.status === "live"),
      featuredLiveShows: liveShows.filter((show) => show.status === "scheduled"),
      endingSoonAuctions: [],
      trendingMarketplace: DEFAULT_LISTINGS,
      recentlyAdded: DEFAULT_LISTINGS.slice(0, 4),
      popularCategories: [
        { label: "Singles", count: 120 },
        { label: "Sealed", count: 44 },
        { label: "Slabs", count: 21 },
        { label: "Accessories", count: 18 },
      ],
      featuredSellers: DEFAULT_SELLERS,
      activity: DEFAULT_ACTIVITY,
      upcomingLiveShows: liveShows.filter((show) => show.status === "scheduled"),
    };
  }
}
