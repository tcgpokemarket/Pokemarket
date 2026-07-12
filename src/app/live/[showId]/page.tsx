import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiveShowDetails } from "@/lib/live-shows";
import LiveShowClient from "./show-client";
import type { LiveShowDirectoryItem } from "@/lib/live-shows-client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function buildRestUrl(table: string, select: string, filters: Array<[string, string]> = [], limit = 1000) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  url.searchParams.set("limit", String(limit));
  for (const [key, value] of filters) url.searchParams.set(key, value);
  return url;
}

async function fetchPublicRows<T>(table: string, select: string, filters: Array<[string, string]> = [], limit = 1000) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [] as T[];

  const response = await fetch(buildRestUrl(table, select, filters, limit).toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    cache: "force-cache",
  });

  if (!response.ok) return [] as T[];
  return (await response.json()) as T[];
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ showId: string }>> {
  const shows = await fetchPublicRows<Pick<LiveShowDirectoryItem, "id">>("live_shows", "id", [["order", "created_at.desc"]], 2000);
  return shows.length ? shows.map((show) => ({ showId: show.id })) : [{ showId: "preview" }];
}

function getPreviewShow() {
  return {
    show: {
      id: "preview",
      seller_id: "preview-seller",
      title: "Live Auction Preview",
      description: "The live auction feed is empty right now, so this placeholder keeps the route exportable.",
      thumbnail: null,
      status: "scheduled",
      auction_state: "upcoming",
      viewer_count: 0,
      peak_viewers: 0,
      total_sales_amount: 0,
      total_bidders: 0,
      average_bid_value: 0,
      engagement_score: 0,
      scheduled_start: null,
      scheduled_end: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      auction_settings: null,
    },
    products: [],
    bids: [],
    chat: [],
    giveaways: [],
  } as any;
}

export async function generateMetadata({ params }: { params: Promise<{ showId: string }> }): Promise<Metadata> {
  const { showId } = await params;
  try {
    const { show } = await getLiveShowDetails(showId);
    return {
      title: `${show.title} | Live Auction`,
      description: show.description ?? "Live auction show on TcgPoké Market.",
    };
  } catch {
    return {
      title: "Live Auction",
      description: "Live auction show on TcgPoké Market.",
    };
  }
}

export default async function LiveShowPage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;

  if (showId === "preview") {
    return <LiveShowClient initialData={getPreviewShow()} />;
  }

  let data;
  try {
    data = await getLiveShowDetails(showId);
  } catch {
    notFound();
  }

  return <LiveShowClient initialData={data} />;
}
