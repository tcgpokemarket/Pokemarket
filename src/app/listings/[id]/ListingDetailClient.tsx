"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/supabase/types";

type ListingWithSeller = Listing & {
  profiles?: {
    id: string;
    username: string | null;
    seller_rating: number;
    total_sales: number;
    avatar_url: string | null;
  } | null;
};

const CONDITION_COLORS: Record<string, string> = {
  Mint: "text-emerald-400",
  "Near Mint": "text-green-400",
  "Lightly Played": "text-yellow-400",
  "Moderately Played": "text-orange-400",
  "Heavily Played": "text-red-400",
  Damaged: "text-gray-400",
};

export default function ListingDetailClient({ id, initialListing }: { id: string; initialListing: ListingWithSeller | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [listing, setListing] = useState<ListingWithSeller | null>(initialListing);
  const [loading, setLoading] = useState(!initialListing);
  const [buying, setBuying] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    if (initialListing) {
      import("@/lib/prices")
        .then(({ fetchCardPrice }) => fetchCardPrice(initialListing.card_name, initialListing.set_name))
        .then((price) => setMarketPrice(price.marketPrice));
    }

    // Shipping pricing is handled at checkout.
  }, [id, initialListing]);

  const handleBuy = async () => {
    if (!user) {
      router.push(`/auth?redirectTo=/listings/${id}`);
      return;
    }
    if (!supabase) return;
    setBuying(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id, quantity: 1 }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else {
      alert(data.error ?? "Checkout failed. Please try again.");
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a]">
        <div className="text-lg text-gray-400 animate-pulse">Loading listing...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] text-center">
        <div>
          <div className="mb-4 text-6xl">🃏</div>
          <h2 className="mb-2 text-2xl font-bold">Listing not found</h2>
          <a href="/listings" className="text-yellow-400 hover:underline">Back to listings</a>
        </div>
      </div>
    );
  }

  const conditionColor = CONDITION_COLORS[listing.condition] ?? "text-gray-400";
  const priceDiff = marketPrice ? ((listing.price - marketPrice) / marketPrice) * 100 : null;

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/listings" className="text-sm text-gray-300 hover:text-white">← Back to listings</a>
            <a href="/auth" className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">Sign In</a>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
          <div className="space-y-3">
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {listing.images?.length ? (
                <img src={listing.images[selectedImage]} alt={listing.card_name} className="h-full w-full object-contain p-3 sm:p-4" />
              ) : (
                <span className="text-7xl sm:text-8xl">🃏</span>
              )}
            </div>
            {listing.images && listing.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {listing.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border transition-colors ${i === selectedImage ? "border-yellow-400" : "border-white/10"}`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]">
              <span className={conditionColor}>{listing.condition}</span>
              {listing.grade_company && <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black text-black">{listing.grade_company} {listing.grade_score}</span>}
            </div>
            <div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">{listing.card_name}</h1>
              <p className="mt-1 text-sm text-gray-400">{listing.set_name}{listing.card_number ? ` · #${listing.card_number}` : ""}{listing.rarity ? ` · ${listing.rarity}` : ""}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="flex items-end gap-3">
                <span className="text-3xl font-black sm:text-4xl">${listing.price.toFixed(2)}</span>
                {priceDiff !== null && <span className={`pb-1 text-xs font-semibold ${priceDiff > 5 ? "text-red-400" : priceDiff < -5 ? "text-green-400" : "text-gray-400"}`}>{priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}% vs market</span>}
              </div>
              <div className="mt-2 text-sm text-gray-300">{listing.quantity} available{marketPrice ? ` · Market avg $${marketPrice.toFixed(2)}` : ""}</div>
            </div>

            {listing.description && <p className="text-sm leading-6 text-gray-400">{listing.description}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button onClick={handleBuy} disabled={buying || listing.status !== "active" || listing.seller_id === user?.id} className="rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">{buying ? "Redirecting..." : listing.seller_id === user?.id ? "Your listing" : listing.status !== "active" ? "Sold" : "Buy Now"}</button>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Add to Cart</button>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Make Offer</button>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Share Listing</button>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Report Listing</button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div>
                <p className="text-sm font-semibold text-white">Seller</p>
                <p className="text-sm text-gray-400">{listing.profiles?.username ?? "Seller"}</p>
              </div>
              <div className="text-right text-sm text-gray-400">
                {listing.profiles?.seller_rating ? <div className="text-yellow-400">★ {listing.profiles.seller_rating.toFixed(1)}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
