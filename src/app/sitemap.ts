import type { MetadataRoute } from "next";

const BASE_URL = "https://tcg-poke-market.sintra.site";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type SitemapRow = { id?: string; slug?: string | null };
type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

function makeRoute(url: string, changeFrequency: ChangeFrequency, priority: number): MetadataRoute.Sitemap[number] {
  return { url, changeFrequency, priority };
}

function buildRestUrl(table: string, select: string, filters: Array<[string, string]> = [], limit = 1000) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  url.searchParams.set("limit", String(limit));
  for (const [key, value] of filters) url.searchParams.set(key, value);
  return url;
}

async function fetchRows(table: string, select: string, filters: Array<[string, string]> = [], limit = 1000) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [] as SitemapRow[];

  const response = await fetch(buildRestUrl(table, select, filters, limit).toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    cache: "force-cache",
  });

  if (!response.ok) return [] as SitemapRow[];
  return (await response.json()) as SitemapRow[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, sellers, liveShows] = await Promise.all([
    fetchRows("listings", "id", [["status", "eq.active"]], 2000),
    fetchRows("seller_stores", "slug", [["slug", "not.is.null"]], 2000),
    fetchRows("live_shows", "id", [["status", "neq.ended"]], 2000),
  ]);

  const staticRoutes = [
    makeRoute(`${BASE_URL}/`, "daily", 1),
    makeRoute(`${BASE_URL}/listings`, "hourly", 0.9),
    makeRoute(`${BASE_URL}/live`, "hourly", 0.9),
    makeRoute(`${BASE_URL}/sell`, "weekly", 0.7),
    makeRoute(`${BASE_URL}/about`, "monthly", 0.4),
    makeRoute(`${BASE_URL}/help`, "monthly", 0.4),
    makeRoute(`${BASE_URL}/policies`, "monthly", 0.3),
    makeRoute(`${BASE_URL}/privacy`, "yearly", 0.2),
    makeRoute(`${BASE_URL}/terms`, "yearly", 0.2),
    makeRoute(`${BASE_URL}/refund-policy`, "yearly", 0.2),
    makeRoute(`${BASE_URL}/shipping-policy`, "yearly", 0.2),
    makeRoute(`${BASE_URL}/seller-agreement`, "yearly", 0.2),
    makeRoute(`${BASE_URL}/marketplace-rules`, "yearly", 0.2),
    makeRoute(`${BASE_URL}/dmca`, "yearly", 0.2),
    makeRoute(`${BASE_URL}/cards`, "weekly", 0.5),
    makeRoute(`${BASE_URL}/collection`, "weekly", 0.5),
    makeRoute(`${BASE_URL}/support`, "monthly", 0.3),
    makeRoute(`${BASE_URL}/social`, "weekly", 0.3),
  ];

  const dynamicRoutes: MetadataRoute.Sitemap = [
    ...listings.filter((row): row is Required<Pick<SitemapRow, "id">> => Boolean(row.id)).map((row) => makeRoute(`${BASE_URL}/listings/${row.id}`, "daily", 0.8)),
    ...sellers.filter((row): row is Required<Pick<SitemapRow, "slug">> => Boolean(row.slug)).map((row) => makeRoute(`${BASE_URL}/sellers/${row.slug}`, "daily", 0.6)),
    ...liveShows.filter((row): row is Required<Pick<SitemapRow, "id">> => Boolean(row.id)).map((row) => makeRoute(`${BASE_URL}/live/${row.id}`, "hourly", 0.7)),
  ];

  return [...staticRoutes, ...dynamicRoutes];
}
