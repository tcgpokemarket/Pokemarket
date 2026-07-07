"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/supabase/types";
import type { EasyshipRatesResponse } from "@/lib/easyship";

type ListingWithSeller = Listing & {
  profiles?: {
    id: string;
    username: string | null;
    seller_rating: number;
    total_sales: number;
    avatar_url: string | null;
  } | null;
  sellers?: {
    id: string;
    display_name: string;
    storefront_slug: string;
    rating: number;
    verified: boolean;
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
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  const [listing, setListing] = useState<ListingWithSeller | null>(initialListing);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [shippingRates, setShippingRates] = useState<EasyshipRatesResponse | null>(null);
  const [shippingLoading, setShippingLoading] = useState(true);
  const [selectedShippingIndex, setSelectedShippingIndex] = useState(0);
  const [shippingPaidBy, setShippingPaidBy] = useState<"buyer" | "seller">(initialListing?.shipping_paid_by ?? "buyer");
  const [shippingChoiceApplied, setShippingChoiceApplied] = useState(false);

  useEffect(() => {
    const client = createClient();
    setSupabase(client);
    client.auth.getUser().then(({ data: { user } }) => setUser(user));

    if (initialListing) {
      setLoading(false);
      import("@/lib/prices")
        .then(({ fetchCardPrice }) => fetchCardPrice(initialListing.card_name, initialListing.set_name))
        .then((price) => setMarketPrice(price.marketPrice));
    } else {
      setLoading(false);
    }

    fetch(`/api/shipping/rates?country=US`)
      .then((r) => r.json())
      .then((data) => setShippingRates(data))
      .catch(() => setShippingRates(null))
      .finally(() => setShippingLoading(false));
  }, [id, initialListing]);

  useEffect(() => {
    if (!shippingRates?.rates?.length) return;
    const selectedIndex = Math.min(selectedShippingIndex, shippingRates.rates.length - 1);
    if (selectedIndex !== selectedShippingIndex) {
      setSelectedShippingIndex(selectedIndex);
    }
  }, [selectedShippingIndex, shippingRates]);

  useEffect(() => {
    if (!shippingChoiceApplied && initialListing) {
      setShippingPaidBy(initialListing.shipping_paid_by ?? "buyer");
      setShippingChoiceApplied(true);
    }
  }, [initialListing, shippingChoiceApplied]);

  const handleBuy = async () => {
    if (!user) { router.push(`/auth?redirectTo=/listings/${id}`); return; }
    if (!supabase) return;
    setBuying(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: id,
        quantity: 1,
        shippingPaidBy,
        shippingRateIndex: selectedShippingIndex,
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { alert(data.error ?? "Checkout failed. Please try again."); setBuying(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">Loading listing...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-center">
        <div>
          <div className="text-6xl mb-4">🃏</div>
          <h2 className="text-2xl font-bold mb-2">Listing not found</h2>
          <a href="/listings" className="text-yellow-400 hover:underline">Back to listings</a>
        </div>
      </div>
    );
  }

  const conditionColor = CONDITION_COLORS[listing.condition] ?? "text-gray-400";
  const priceDiff = marketPrice ? ((listing.price - marketPrice) / marketPrice) * 100 : null;
  const cheapestShipping = shippingRates?.cheapestRate;

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f1a]/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2 font-black text-xl">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/listings" className="text-gray-300 hover:text-white text-sm">← Back to listings</a>
            <a href="/auth" className="bg-yellow-400 text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-yellow-300">Sign In</a>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 max-w-5xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-3 aspect-[3/4] flex items-center justify-center">
              {listing.images?.length ? (
                <img src={listing.images[selectedImage]} alt={listing.card_name} className="w-full h-full object-contain p-4" />
              ) : (
                <span className="text-8xl">🃏</span>
              )}
            </div>
            {listing.images && listing.images.length > 1 && (
              <div className="flex gap-2">
                {listing.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${i === selectedImage ? "border-yellow-400" : "border-white/10"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2">
              <span className={`text-xs font-semibold ${conditionColor}`}>{listing.condition}</span>
              {listing.grade_company && (
                <span className="ml-2 bg-yellow-400 text-black text-xs font-black px-2 py-0.5 rounded">
                  {listing.grade_company} {listing.grade_score}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-black mb-1">{listing.card_name}</h1>
            <p className="text-gray-400 mb-1">{listing.set_name}{listing.card_number ? ` · #${listing.card_number}` : ""}</p>
            {listing.rarity && <p className="text-gray-500 text-sm mb-6">{listing.rarity}</p>}

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
              <div className="flex items-end gap-3 mb-2">
                <span className="text-4xl font-black">${listing.price.toFixed(2)}</span>
                {priceDiff !== null && (
                  <span className={`text-sm font-semibold mb-1 ${priceDiff > 5 ? "text-red-400" : priceDiff < -5 ? "text-green-400" : "text-gray-400"}`}>
                    {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}% vs market
                  </span>
                )}
              </div>
              {marketPrice && (
                <p className="text-gray-500 text-xs">Market avg: ${marketPrice.toFixed(2)}</p>
              )}
              <p className="text-gray-400 text-sm mt-1">{listing.quantity} available</p>
            </div>

            {listing.description && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{listing.description}</p>
              </div>
            )}

            <div className="mb-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-gray-300">
              <div className="font-semibold text-yellow-400">Transparent seller pricing</div>
              <p className="mt-1">
                Buyers see a clear breakdown at checkout, including item subtotal, shipping, sales tax, payment processing fee, marketplace fee, and seller payout.
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Shipping estimate</div>
              <p className="mt-1 text-xs text-gray-500">
                Shipping is set by the seller for this listing and shown at checkout.
              </p>
              {shippingLoading ? (
                <p className="mt-3 text-sm text-gray-400">Loading live rates...</p>
              ) : shippingRates?.rates?.length ? (
                <div className="mt-3 space-y-3 text-sm text-gray-300">
                  {shippingRates.rates.slice(0, 3).map((rate, index) => (
                    <button
                      key={`${rate.courier_name}-${rate.courier_service_name}-${index}`}
                      type="button"
                      onClick={() => setSelectedShippingIndex(index)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${selectedShippingIndex === index ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-[#13131f] hover:border-white/20"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{rate.courier_name} · {rate.courier_service_name}</span>
                        <span className="font-semibold">${rate.total_charge.toFixed(2)} {rate.currency}</span>
                      </div>
                    </button>
                  ))}
                  <p className="text-xs text-gray-500">Live Easyship rates for U.S. shipping estimates. Final shipping can vary by destination and parcel details.</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-400">Shipping rates will be shown at checkout.</p>
              )}
            </div>

            <button
              onClick={handleBuy}
              disabled={buying || listing.status !== "active" || listing.seller_id === user?.id}
              className="w-full bg-yellow-400 text-black font-bold py-4 rounded-xl text-lg hover:bg-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {buying ? "Redirecting to checkout..." : listing.seller_id === user?.id ? "Your listing" : listing.status !== "active" ? "Sold" : "Buy Now"}
            </button>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Payout summary</div>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                <div className="flex items-center justify-between"><span>Seller payout</span><span>Generated after order completion</span></div>
              </div>
            </div>

            {!user && (
              <p className="text-center text-gray-500 text-sm">
                <a href={`/auth?redirectTo=/listings/${id}`} className="text-yellow-400 hover:underline">Sign in</a> to purchase
              </p>
            )}

            {(listing.sellers || listing.profiles) && (
              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-yellow-400/20 text-lg font-black text-yellow-400">
                  {listing.sellers?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.sellers.avatar_url} alt={listing.sellers.display_name} className="h-full w-full object-cover" />
                  ) : (
                    (listing.sellers?.display_name ?? listing.profiles?.username ?? "?")[0]?.toUpperCase() ?? "?"
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{listing.sellers?.display_name ?? listing.profiles?.username ?? "Seller"}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                    {listing.sellers?.verified ? <span className="text-yellow-400">Verified seller</span> : listing.profiles && listing.profiles.seller_rating > 0 && <span className="text-yellow-400">★ {listing.profiles.seller_rating.toFixed(1)}</span>}
                    <a href={listing.sellers?.storefront_slug ? `/sellers/${listing.sellers.storefront_slug}` : `/profile/${listing.profiles?.username ?? ""}`} className="hover:text-yellow-400">
                      View storefront
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
