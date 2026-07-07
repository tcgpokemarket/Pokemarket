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

export const dynamic = "force-static";
export const dynamicParams = false;

const STATIC_LISTING_PARAMS = [{ id: "sample" }];

type StaticListing = Pick<Listing, "id">;

async function fetchPublicRows<T>(table: string, select: string, filters: Array<[string, string]> = []) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  for (const [key, value] of filters) url.searchParams.set(key, value);

  const response = await fetch(url.toString(), {
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
  const rows = await fetchPublicRows<ListingWithSeller>(
    "listings",
    "*,profiles:profiles!seller_id(id,username,seller_rating,total_sales,avatar_url)",
    [["id", `eq.${id}`]],
  );
  return rows[0] ?? null;
}

export function generateStaticParams(): Array<{ id: string }> {
  return STATIC_LISTING_PARAMS;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
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
  const listing = await getListing(id);

  if (!listing) {
    notFound();
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
