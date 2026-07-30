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
  Mint: "text-emerald-300",
  "Near Mint": "text-green-300",
  "Lightly Played": "text-yellow-300",
  "Moderately Played": "text-orange-300",
  "Heavily Played": "text-red-300",
  Damaged: "text-gray-300",
};

const ACTIONS = ["Buy now", "Add to cart", "Make offer", "Share listing", "Message seller"];

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
  }, [id, initialListing, supabase]);

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
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-center text-gray-400">
        Loading listing...
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-center text-white">
        <div className="mx-auto max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-6xl">🃏</div>
          <h2 className="mt-4 text-2xl font-black">Listing not found</h2>
          <a href="/listings" className="mt-4 inline-flex rounded-full bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black">
            Back to listings
          </a>
        </div>
      </div>
    );
  }

  const conditionColor = CONDITION_COLORS[listing.condition] ?? "text-gray-300";
  const priceDiff = marketPrice ? ((listing.price - marketPrice) / marketPrice) * 100 : null;
  const images = listing.images ?? [];
  const sellerName = listing.profiles?.username ?? "Seller";

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
          <a href="/listings" className="text-sm font-semibold text-gray-300 hover:text-white">← Back to listings</a>
          <div className="flex flex-wrap gap-2">
            <a href={`/messages?shop=${encodeURIComponent(sellerName)}`} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">Message seller</a>
            <a href="/auth" className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">Sign in</a>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <section className="space-y-3">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#101724] shadow-2xl shadow-black/20">
              <div className="aspect-[4/5] bg-[#0b0b12] sm:aspect-[3/4]">
                {images.length ? (
                  <img src={images[selectedImage]} alt={listing.card_name} className="h-full w-full object-contain p-4" />
                ) : (
                  <div className="flex h-full items-center justify-center text-7xl">🃏</div>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-2xl border transition ${i === selectedImage ? "border-yellow-400" : "border-white/10"}`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-5 rounded-[2rem] border border-white/10 bg-[#101724] p-5 shadow-2xl shadow-black/20 sm:p-6 lg:sticky lg:top-24">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]">
              <span className={conditionColor}>{listing.condition}</span>
              {listing.grade_company && <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black text-black">{listing.grade_company} {listing.grade_score}</span>}
              <span className="rounded-full border border-white/10 px-2 py-1 text-gray-400">{listing.quantity} available</span>
            </div>

            <div>
              <h1 className="text-3xl font-black leading-tight sm:text-4xl">{listing.card_name}</h1>
              <p className="mt-2 text-sm text-gray-400">{listing.set_name}{listing.card_number ? ` · #${listing.card_number}` : ""}{listing.rarity ? ` · ${listing.rarity}` : ""}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black">${listing.price.toFixed(2)}</span>
                {priceDiff !== null && (
                  <span className={`pb-1 text-xs font-semibold ${priceDiff > 5 ? "text-red-300" : priceDiff < -5 ? "text-green-300" : "text-gray-400"}`}>
                    {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}% vs market
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-300">Market average {marketPrice ? `$${marketPrice.toFixed(2)}` : "not available"}</div>
            </div>

            {listing.description && <p className="text-sm leading-6 text-gray-400">{listing.description}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={handleBuy} disabled={buying || listing.status !== "active" || listing.seller_id === user?.id} className="rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
                {buying ? "Redirecting..." : listing.seller_id === user?.id ? "Your listing" : listing.status !== "active" ? "Sold" : "Buy now"}
              </button>
              {ACTIONS.slice(1).map((action) => (
                <button key={action} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  {action}
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Seller</p>
                  <p className="text-sm text-gray-400">{sellerName}</p>
                </div>
                <div className="text-right text-sm text-gray-400">
                  {listing.profiles?.seller_rating ? <div className="text-yellow-300">★ {listing.profiles.seller_rating.toFixed(1)}</div> : null}
                  {listing.profiles?.total_sales ? <div>{listing.profiles.total_sales.toLocaleString()} sales</div> : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
