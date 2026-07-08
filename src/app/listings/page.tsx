"use client";

import { useEffect, useMemo, useState } from "react";
import ListingCard from "@/components/listings/ListingCard";
import type { Listing } from "@/lib/supabase/types";

type ListingPageResponse = {
  listings: Listing[];
  count: number;
  page: number;
  pageSize: number;
};

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [condition, setCondition] = useState("all");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("query", query.trim());
    if (category !== "all") params.set("category", category);
    if (condition !== "all") params.set("condition", condition);

    setLoading(true);
    fetch(`/api/listings?${params.toString()}`)
      .then((response) => response.json())
      .then((data: ListingPageResponse) => {
        setListings(data.listings ?? []);
        setCount(data.count ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, query, category, condition]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / 24)), [count]);

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
            <a href="/sell" className="text-sm font-medium text-gray-300 hover:text-white">Sell on TcgPoké Market</a>
            <a href="/dashboard" className="text-sm font-medium text-gray-300 hover:text-white">Dashboard</a>
            <a href="/auth" className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-yellow-300">Sign In</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-black">Browse Pokémon TCG Listings</h1>
          <p className="max-w-2xl text-gray-400">Search Pokémon singles, sealed products, graded cards, and accessories from trusted sellers.</p>
          <p className="mt-2 text-sm text-gray-500">{count.toLocaleString()} listings found</p>
        </div>

        <form
          className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
        >
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
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-center text-sm font-semibold text-yellow-400 hover:bg-yellow-400/20">Apply filters</button>
            <a href="/listings/create" className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-center text-sm font-semibold text-white hover:border-yellow-400/30">List</a>
          </div>
        </form>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">Loading listings...</div>
        ) : listings.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing as Listing & {
                    profiles?: { username: string | null; seller_rating: number } | null;
                    sellers?: { display_name: string; storefront_slug: string; rating: number; verified: boolean; avatar_url: string | null } | null;
                  }}
                />
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-white/10 px-3 py-2 disabled:opacity-40">Prev</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-xl border border-white/10 px-3 py-2 disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
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
