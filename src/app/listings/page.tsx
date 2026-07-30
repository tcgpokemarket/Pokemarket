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
  const supabase = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);
  const searchParams = useSearchParams();
  const sellerFilter = searchParams.get("seller") ?? "";

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    const loadListings = async () => {
      try {
        let request = supabase
          .from("listings")
          .select("*, profiles:seller_id(username, seller_rating)")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (sellerFilter) {
          request = request.eq("seller_id", sellerFilter);
        }

        const { data, error } = await request.limit(48);
        if (!active) return;
        if (error) {
          console.error("[listings] Failed to load listings", error);
          setListings([]);
          return;
        }

        setListings((data ?? []) as Listing[]);
      } catch (error) {
        if (!active) return;
        console.error("[listings] Failed to load listings", error);
        setListings([]);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void loadListings();

    return () => {
      active = false;
    };
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.12),_transparent_28%),linear-gradient(180deg,#0f0f1a_0%,#090b14_100%)] text-white">
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
          <div className="grid gap-8 px-5 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-yellow-300">
                <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">Marketplace</span>
                {sellerLabel ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300">{sellerLabel}</span> : null}
              </div>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">Browse Pokémon listings with a collector-first layout.</h1>
                <p className="max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">Search singles, sealed product, graded cards, and accessories from trusted sellers. Use filters to narrow fast and jump straight into the items that matter.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Listings</div>
                  <div className="mt-2 text-2xl font-black text-white">{filtered.length.toLocaleString()}</div>
                  <div className="mt-1 text-sm text-gray-400">Shown right now</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Mode</div>
                  <div className="mt-2 text-2xl font-black text-white">Mobile</div>
                  <div className="mt-1 text-sm text-gray-400">Fast browse flow</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Filter</div>
                  <div className="mt-2 text-2xl font-black text-white">Live</div>
                  <div className="mt-1 text-sm text-gray-400">Update instantly</div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-[#13131f]/80 p-4 shadow-lg shadow-black/20">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search card, set, rarity, or number"
                  className="rounded-2xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-yellow-400"
                />
                <a href="/sell" className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-center text-sm font-semibold text-yellow-300 transition hover:bg-yellow-400/20">List your cards</a>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400">
                  <option value="all">All categories</option>
                  <option value="single">Singles</option>
                  <option value="sealed">Sealed</option>
                  <option value="graded">Graded</option>
                  <option value="accessory">Accessories</option>
                </select>
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className="rounded-2xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none focus:border-yellow-400">
                  <option value="all">All conditions</option>
                  <option value="Mint">Mint</option>
                  <option value="Near Mint">Near Mint</option>
                  <option value="Lightly Played">Lightly Played</option>
                  <option value="Moderately Played">Moderately Played</option>
                  <option value="Heavily Played">Heavily Played</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          {loading ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-8 text-center text-gray-400">Loading listings...</div>
          ) : filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing as Listing & { profiles?: { username: string | null; seller_rating: number } | null }} />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-8 text-center text-gray-400">
              <p className="text-base font-semibold text-white">No listings match your filters yet.</p>
              <p className="mt-2 text-sm">Try a different search or create the first listing.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
