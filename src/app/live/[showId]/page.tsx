import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiveShowDetails } from "@/lib/live-shows";
import LiveShowClient from "./show-client";
import type { LiveShowDirectoryItem } from "@/lib/live-shows-client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const dynamicParams = false;

function buildRestUrl(table: string, select: string, filters: Array<[string, string]> = [], limit = 1) {
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

export async function generateStaticParams(): Promise<Array<{ showId: string }>> {
  const rows = await fetchPublicRows<LiveShowDirectoryItem>("live_shows", "id", [["status", "neq.ended"]], 2000);
  return rows.map((row) => ({ showId: row.id }));
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
      robots: { index: false, follow: false },
    };
  }
}

export default async function LiveShowPage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;

  const data = await getLiveShowDetails(showId).catch(() => null);
  if (!data) notFound();

  return <LiveShowClient initialData={data} />;
}
