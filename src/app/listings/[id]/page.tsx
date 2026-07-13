import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListingDetailClient from "./ListingDetailClient";
import type { Listing, Profile } from "@/lib/supabase/types";

const BASE_URL = "https://tcg-poke-market.sintra.site";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type ListingWithSeller = Listing & {
  profiles?: Pick<Profile, "id" | "username" | "seller_rating" | "total_sales" | "avatar_url"> | null;
};


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

async function fetchListingIds() {
  const rows = await fetchPublicRows<{ id: string }>("listings", "id", [["status", "eq.active"]], 2000);
  return rows.map((row) => ({ id: row.id }));
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  const rows = await fetchListingIds();
  return rows.length ? rows : [{ id: "preview" }];
}

function formatListingTitle(listing: ListingWithSeller) {
  const parts = [listing.card_name, listing.set_name];
  if (listing.card_number) parts.push(`#${listing.card_number}`);
  if (listing.grade_company && listing.grade_score) parts.push(`${listing.grade_company} ${listing.grade_score}`);
  return parts.join(" · ");
}

function buildDescription(listing: ListingWithSeller) {
  const descriptors = [listing.condition, listing.category === "graded" ? "graded" : null, listing.rarity].filter(Boolean);
  return `Shop ${listing.card_name} from ${listing.set_name}${listing.card_number ? ` (${listing.card_number})` : ""}. ${descriptors.join(", ")} Pokémon TCG listing on TCG Poke Market.`;
}

async function getListing(id: string) {
  if (id === "preview") return null;

  const rows = await fetchPublicRows<ListingWithSeller>(
    "listings",
    "*,profiles:profiles!seller_id(id,username,seller_rating,total_sales,avatar_url)",
    [["id", `eq.${id}`]],
  );
  return rows[0] ?? null;
}

function getPreviewListing(): ListingWithSeller {
  return {
    id: "preview",
    seller_id: "preview-seller",
    card_name: "Sample Pokémon Card",
    set_name: "Preview Set",
    card_number: "001",
    rarity: "Rare",
    condition: "Near Mint",
    grade_company: null,
    grade_score: null,
    price: 0,
    quantity: 1,
    images: [],
    description: "This preview page keeps the route exportable while the real marketplace listings load from Supabase.",
    shipping_profile_id: null,
    shipping_paid_by: null,
    weight_oz: null,
    package_type: null,
    category: "single",
    status: "active",
    views: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profiles: null,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = (await getListing(id)) ?? getPreviewListing();

  if (id === "preview") {
    return {
      title: "Preview listing",
      description: "Sample listing data used to keep the export route available.",
    };
  }

  if (listing.id === "preview") {
    return {
      title: "Listing not found",
      description: "This Pokémon card listing is no longer available.",
    };
  }

  const title = formatListingTitle(listing);
  const description = buildDescription(listing);
  const canonical = `${BASE_URL}/listings/${listing.id}`;
  const image = listing.images?.[0] ?? `${BASE_URL}/og/listing-default.png`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: image, width: 1200, height: 1200, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = (await getListing(id)) ?? getPreviewListing();

  if (listing.id === "preview") {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 text-6xl">🃏</div>
          <h1 className="text-3xl font-black">Listing not found</h1>
          <p className="mt-3 text-gray-400">The live listing feed is currently empty, so this route uses a safe placeholder until real marketplace records are available.</p>
          <a href="/listings" className="mt-6 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">Back to listings</a>
        </div>
      </div>
    );
  }



  const title = formatListingTitle(listing);
  const description = buildDescription(listing);
  const canonical = `${BASE_URL}/listings/${listing.id}`;
  const image = listing.images?.[0] ?? `${BASE_URL}/og/listing-default.png`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description,
    image: listing.images?.length ? listing.images : [image],
    sku: listing.card_number ?? listing.id,
    brand: {
      "@type": "Brand",
      name: "Pokémon TCG",
    },
    category: listing.category,
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "USD",
      price: listing.price.toFixed(2),
      availability: listing.status === "active" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/UsedCondition",
    },
    seller: listing.profiles?.username
      ? {
          "@type": "Person",
          name: listing.profiles.username,
        }
      : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ListingDetailClient id={listing.id} initialListing={listing} />
    </>
  );
}
