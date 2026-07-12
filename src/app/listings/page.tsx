"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ListingCard from "@/components/listings/ListingCard";
import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/supabase/types";

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [condition, setCondition] = useState("all");
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const sellerFilter = searchParams.get("seller") ?? "";

  useEffect(() => {
    const request = supabase
      .from("listings")
      .select("*, profiles:seller_id(username, seller_rating)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (sellerFilter) {
      request.eq("seller_id", sellerFilter);
    }

    request.then(({ data }) => {
      setListings((data ?? []) as Listing[]);
      setLoading(false);
    });
  }, [sellerFilter, supabase]);

  const sellerLabel = sellerFilter ? `Seller shop filter active` : null;

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesText = !text || [listing.card_name, listing.set_name, listing.card_number, listing.rarity, listing.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
      const matchesCategory = category === "all" || listing.category === category;
      const matchesCondition = condition === "all" || listing.condition === condition;
      return matchesText && matchesCategory && matchesCondition;
    });
  }, [listings, query, category, condition]);

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/listings" className="text-sm font-semibold text-yellow-400">Browse</a>
            <a href="/sell" className="text-sm font-medium text-gray-300 hover:text-white">Sell</a>
            <a href="/dashboard" className="text-sm font-medium text-gray-300 hover:text-white">Dashboard</a>
            <a href="/auth" className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-yellow-300">Sign In</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-black">Browse Pokémon TCG Listings</h1>
          <p className="max-w-2xl text-gray-400">Search Pokémon singles, sealed products, graded cards, and accessories from trusted sellers.</p>
          <p className="mt-2 text-sm text-gray-500">{filtered.length.toLocaleString()} listings shown</p>
          {sellerLabel && <p className="mt-2 text-sm font-medium text-yellow-400">{sellerLabel}</p>}
        </div>

        <div className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search card, set, rarity, or number"
            className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-yellow-400"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400">
            <option value="all">All categories</option>
            <option value="single">Singles</option>
            <option value="sealed">Sealed</option>
            <option value="graded">Graded</option>
            <option value="accessory">Accessories</option>
          </select>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400">
            <option value="all">All conditions</option>
            <option value="Mint">Mint</option>
            <option value="Near Mint">Near Mint</option>
            <option value="Lightly Played">Lightly Played</option>
            <option value="Moderately Played">Moderately Played</option>
            <option value="Heavily Played">Heavily Played</option>
            <option value="Damaged">Damaged</option>
          </select>
          <a href="/sell" className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-center text-sm font-semibold text-yellow-400 hover:bg-yellow-400/20">List your cards</a>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">Loading listings...</div>
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing as Listing & { profiles?: { username: string | null; seller_rating: number } | null }} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">
            <p>No listings match your filters yet.</p>
            <p className="mt-2 text-sm">Try a different search or create the first listing.</p>
          </div>
        )}
      </main>
    </div>
  );
}
