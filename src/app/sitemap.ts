import type { MetadataRoute } from "next";

const BASE_URL = "https://tcg-poke-market.sintra.site";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type ListingRow = { id: string; updated_at?: string | null; status?: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/listings`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
  ];

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return urls;

  try {
    const endpoint = new URL(`${SUPABASE_URL}/rest/v1/listings`);
    endpoint.searchParams.set("select", "id,updated_at,status");
    endpoint.searchParams.set("status", "eq.active");
    endpoint.searchParams.set("order", "updated_at.desc");
    endpoint.searchParams.set("limit", "50000");

    const response = await fetch(endpoint.toString(), {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return urls;

    const listings = (await response.json()) as ListingRow[];
    for (const listing of listings) {
      urls.push({
        url: `${BASE_URL}/listings/${encodeURIComponent(listing.id)}`,
        lastModified: listing.updated_at ? new Date(listing.updated_at) : now,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch {
    // Keep the base sitemap available if the listing API is temporarily unavailable.
  }

  return urls;
}
