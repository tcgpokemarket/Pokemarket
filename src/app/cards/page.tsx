"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchCardPrice } from "@/lib/prices";
import { searchPokemonCards, type PokemonSearchResult } from "@/lib/pokemon";
import { saveCard } from "@/lib/card-storage";
import type { PriceHistory } from "@/lib/supabase/types";

const supabase = createClient();

const SAVE_TARGETS = [
  { key: "collection", label: "Collection" },
  { key: "wishlist", label: "Wishlist" },
  { key: "deck", label: "Deck" },
] as const;

type SaveTarget = (typeof SAVE_TARGETS)[number]["key"];

export default function CardsPage() {
  const [cardName, setCardName] = useState("");
  const [setName, setSetName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<Awaited<ReturnType<typeof fetchCardPrice>> | null>(null);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [suggestions, setSuggestions] = useState<PokemonSearchResult[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PokemonSearchResult | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>("collection");
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setIsSignedIn(Boolean(user)));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setIsSignedIn(Boolean(session?.user)));

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = cardName.trim();
      if (!query) {
        setSuggestions([]);
        setSelectedCard(null);
        return;
      }

      setSuggestionsLoading(true);
      searchPokemonCards(query)
        .then((cards) => {
          const next = cards.slice(0, 6);
          setSuggestions(next);
          setSelectedCard((current) => current && next.some((card) => card.id === current.id) ? current : next[0] ?? null);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestionsLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [cardName]);

  useEffect(() => {
    if (!cardName.trim()) {
      setHistory([]);
      return;
    }

    supabase
      .from("price_history")
      .select("*")
      .eq("card_name", cardName.trim())
      .order("recorded_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setHistory((data ?? []) as PriceHistory[]));
  }, [cardName]);

  const hasHistory = history.length > 0;
  const chartPoints = useMemo(() => {
    if (!history.length) return [];
    const prices = history.map((entry) => entry.price).reverse();
    const max = Math.max(...prices);
    return prices.map((value) => ({ value, height: max ? Math.max(12, (value / max) * 100) : 12 }));
  }, [history]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) return;
    setLoading(true);
    setError(null);
    setSavedMessage(null);
    try {
      const result = await fetchCardPrice(cardName, setName);
      setPrice(result);
      setCardName(result.cardName);
      setSetName(result.setName);
      const { data } = await supabase
        .from("price_history")
        .select("*")
        .eq("card_name", result.cardName)
        .order("recorded_at", { ascending: false })
        .limit(5);
      setHistory((data ?? []) as PriceHistory[]);
    } catch {
      setError("Unable to load card pricing right now.");
    } finally {
      setLoading(false);
    }
  };

  const activeSuggestion = useMemo(
    () => suggestions.find((item) => item.name.toLowerCase() === cardName.trim().toLowerCase()) ?? selectedCard,
    [cardName, suggestions, selectedCard],
  );

  const handleSaveCard = async () => {
    if (!isSignedIn || (!activeSuggestion && !price)) return;
    const next = await saveCard(saveTarget, {
      id: activeSuggestion?.id ?? `${price?.cardName ?? cardName}-${price?.setName ?? setName}`,
      name: activeSuggestion?.name ?? price?.cardName ?? cardName,
      setName: activeSuggestion?.setName ?? price?.setName ?? setName,
      number: activeSuggestion?.number ?? null,
      rarity: activeSuggestion?.rarity ?? null,
      image: activeSuggestion?.image ?? null,
      price: price?.marketPrice ?? null,
      source: price?.source ?? "Pokémon TCG API",
    });
    setSavedMessage(`Saved ${next[0]?.name ?? "card"} to ${SAVE_TARGETS.find((item) => item.key === saveTarget)?.label.toLowerCase()}.`);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Card lookup</h1>
            <p className="mt-2 text-gray-400">Search a Pokémon card to see live pricing, official artwork, and recent market samples.</p>
          </div>
          <div className="flex gap-3">
            <a href="/collection" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-300 hover:border-yellow-400/40 hover:text-yellow-400">My library</a>
            <a href="/listings" className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-400/20">Browse listings</a>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-5">
          <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Card name" className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400 md:col-span-2" />
          <input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Set name" className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400 md:col-span-1" />
          <select value={saveTarget} onChange={(e) => setSaveTarget(e.target.value as SaveTarget)} className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400 md:col-span-1">
            {SAVE_TARGETS.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}
          </select>
          <button type="submit" disabled={loading} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-50 md:col-span-1">{loading ? "Searching..." : "Search"}</button>
        </form>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {cardName.trim() && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Suggestions</h2>
                  <span className="text-xs text-gray-500">{suggestionsLoading ? "Loading..." : `${suggestions.length} results`}</span>
                </div>
                {suggestionsLoading ? (
                  <p className="mt-3 text-sm text-gray-400">Checking the Pokémon database...</p>
                ) : suggestions.length ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {suggestions.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setCardName(card.name);
                          setSetName(card.setName);
                          setSelectedCard(card);
                        }}
                        className={`rounded-xl border px-4 py-3 text-left transition-colors ${activeSuggestion?.id === card.id ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-[#13131f] hover:border-white/20"}`}
                      >
                        <div className="text-sm font-semibold text-white">{card.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{card.setName}{card.number ? ` · #${card.number}` : ""}</div>
                        {card.rarity && <div className="mt-1 text-[11px] text-gray-600">{card.rarity}</div>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">No matching cards yet.</p>
                )}
              </div>
            )}

            {price && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm uppercase tracking-widest text-yellow-400">{price.source}</div>
                <h2 className="mt-2 text-2xl font-black">{price.cardName}</h2>
                <p className="text-gray-400">{price.setName || "Set not specified"}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-[#13131f] p-4">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Market</div>
                    <div className="mt-2 text-2xl font-black">{price.marketPrice !== null ? `$${price.marketPrice.toFixed(2)}` : "—"}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#13131f] p-4">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Low</div>
                    <div className="mt-2 text-2xl font-black">{price.lowPrice !== null ? `$${price.lowPrice.toFixed(2)}` : "—"}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#13131f] p-4">
                    <div className="text-xs uppercase tracking-widest text-gray-500">High</div>
                    <div className="mt-2 text-2xl font-black">{price.highPrice !== null ? `$${price.highPrice.toFixed(2)}` : "—"}</div>
                  </div>
                </div>
                {!isSignedIn && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
                    <div className="font-semibold text-white">Sign in to save cards</div>
                    <p className="mt-1 text-gray-400">Create a free account to keep this card in your collection, wishlist, or deck.</p>
                    <a href="/auth" className="mt-3 inline-flex rounded-lg bg-yellow-400 px-3 py-2 text-sm font-semibold text-black hover:bg-yellow-300">
                      Sign in now
                    </a>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void handleSaveCard()}
                  disabled={!isSignedIn}
                  className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save to {SAVE_TARGETS.find((item) => item.key === saveTarget)?.label}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Official artwork</h2>
              </div>
              <div className="flex min-h-[360px] items-center justify-center bg-[#13131f] p-4">
                {activeSuggestion?.image ? (
                  <img src={activeSuggestion.image} alt={activeSuggestion.name} className="max-h-[320px] w-full object-contain" />
                ) : (
                  <div className="text-center text-gray-500">
                    <div className="text-5xl">🃏</div>
                    <p className="mt-3 text-sm">Select a card suggestion to preview artwork.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Recent price history</h2>
                <span className="text-xs text-gray-500">{hasHistory ? `${history.length} saved samples` : "No samples yet"}</span>
              </div>
              {history.length ? (
                <>
                  <div className="mt-4 flex h-28 items-end gap-2 rounded-xl border border-white/10 bg-[#13131f] p-3">
                    {chartPoints.map((point, index) => (
                      <div key={`${point.value}-${index}`} className="flex flex-1 flex-col items-center justify-end">
                        <div className="w-full rounded-t-md bg-yellow-400/80" style={{ height: `${point.height}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-3">
                    {history.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-gray-300">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-white">${entry.price.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">{entry.source}</div>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{new Date(entry.recorded_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-gray-400">Search a card to start building a local market history.</p>
              )}
            </div>
          </div>
        </div>

        {error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      </div>
    </div>
  );
}
