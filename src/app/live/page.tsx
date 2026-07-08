import Link from "next/link";
import SupportInlineCard from "@/components/support/support-inline-card";
import { listActiveLiveShows, listFeaturedLiveShows, listUpcomingLiveShows } from "@/lib/live-shows";
import type { LiveShowDirectoryItem } from "@/lib/live-shows";

export const dynamic = "force-dynamic";

const SUPPORT_PROMPT = <SupportInlineCard title="Need live auction help?" description="Ask about bidding rules, giveaways, or live show issues anytime." href="/support" />;

function formatState(state?: string | null) {
  return (state ?? "upcoming").replaceAll("_", " ");
}

function matchesSearch(show: { title: string; description: string | null }, search: string) {
  if (!search) return true;
  const haystack = `${show.title} ${show.description ?? ""}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function getPriceBand(show: LiveShowDirectoryItem) {
  const settings = (show.auction_settings as { min_price?: number; max_price?: number } | undefined) ?? {};
  return {
    min: Number(settings.min_price ?? 0),
    max: Number(settings.max_price ?? Number.MAX_SAFE_INTEGER),
  };
}

const SUPPORT_PROMPT = <SupportInlineCard title="Need live auction help?" description="Ask about bidding rules, giveaways, or live show issues anytime." href="/support" />;

function formatState(state?: string | null) {
  return (state ?? "upcoming").replaceAll("_", " ");
}

function matchesSearch(show: { title: string; description: string | null }, search: string) {
  if (!search) return true;
  const haystack = `${show.title} ${show.description ?? ""}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export default async function LivePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const search = typeof params.search === "string" ? params.search : "";
  const seller = typeof params.seller === "string" ? params.seller : "";
  const productType = typeof params.productType === "string" ? params.productType : "";
  const sort = typeof params.sort === "string" ? params.sort : "viewers";
  const priceMin = Number(typeof params.priceMin === "string" ? params.priceMin : 0);
  const priceMax = Number(typeof params.priceMax === "string" ? params.priceMax : Number.MAX_SAFE_INTEGER);

  let activeShows: LiveShowDirectoryItem[] = [];
  let featuredShows: LiveShowDirectoryItem[] = [];
  let upcomingShows: LiveShowDirectoryItem[] = [];

  try {
    [activeShows, featuredShows, upcomingShows] = await Promise.all([
      listActiveLiveShows(),
      listFeaturedLiveShows(),
      listUpcomingLiveShows(),
    ]);
  } catch {
    activeShows = [];
    featuredShows = [];
    upcomingShows = [];
  }

  const shows = [...activeShows, ...featuredShows, ...upcomingShows];

  const filtered = shows.filter((show) => {
    const band = getPriceBand(show);
    const matchesSeller = !seller || show.seller_id === seller;
    const matchesProductType = !productType || String((show.auction_settings as any)?.product_type ?? "").toLowerCase() === productType.toLowerCase();
    const matchesBand = band.min <= priceMax && band.max >= priceMin;
    return matchesSearch(show, search) && matchesSeller && matchesProductType && matchesBand;
  });

  const sortedShows = [...filtered].sort((a, b) => {
    if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "live") return (b.viewer_count ?? 0) - (a.viewer_count ?? 0);
    return (b.viewer_count ?? 0) - (a.viewer_count ?? 0);
  });
  const categories = ["Pokémon", "Sealed", "Singles", "Graded", "Accessories"];
