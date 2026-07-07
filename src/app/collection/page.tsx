"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSavedCards, removeSavedCard, type SavedCardRecord } from "@/lib/card-storage";

type ViewKey = "collection" | "wishlist" | "deck";

const LABELS: Record<ViewKey, { title: string; hint: string }> = {
  collection: { title: "My collection", hint: "Cards I own or track in one place." },
  wishlist: { title: "Wishlist", hint: "Cards I want to buy later." },
  deck: { title: "Deck", hint: "Cards I want to test or build around." },
};

export default function CollectionPage() {
  const [view, setView] = useState<ViewKey>("collection");
  const [cards, setCards] = useState<SavedCardRecord[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    const client = createClient();
    setSupabase(client);
    client.auth.getUser().then(({ data: { user } }) => setIsSignedIn(Boolean(user)));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => setIsSignedIn(Boolean(session?.user)));

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSignedIn || !supabase) {
      setCards([]);
      return;
    }
    getSavedCards(view).then(setCards);
  }, [view, isSignedIn, supabase]);

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Card library</h1>
            <p className="mt-2 text-gray-400">Keep personal lists for cards you own, want, or are testing in a deck.</p>
          </div>
          <a href="/cards" className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-400/20">Open lookup</a>
        </div>

        <div className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
          {(Object.keys(LABELS) as ViewKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${view === key ? "bg-yellow-400 text-black" : "text-gray-300 hover:text-white"}`}
            >
              {LABELS[key].title}
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-400">{LABELS[view].hint}</div>

        {!isSignedIn ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <div className="text-lg font-bold text-white">Sign in to see your saved cards</div>
            <p className="mt-2 text-sm text-gray-400">Your collection, wishlist, and deck are tied to your account so they follow you across devices.</p>
            <a href="/auth" className="mt-4 inline-flex rounded-xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-300">Sign in now</a>
          </div>
        ) : cards.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <div key={card.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="flex h-56 items-center justify-center bg-[#13131f] p-4">
                  {card.image ? <img src={card.image} alt={card.name} className="max-h-full w-full object-contain" /> : <div className="text-5xl">🃏</div>}
                </div>
                <div className="p-4">
                  <div className="text-lg font-bold">{card.name}</div>
                  <div className="mt-1 text-sm text-gray-400">{card.setName}{card.number ? ` · #${card.number}` : ""}</div>
                  <div className="mt-1 text-xs text-gray-500">{card.rarity ?? "Rarity not listed"}</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-gray-500">Market</div>
                      <div className="text-lg font-black text-yellow-400">{card.price !== null ? `$${card.price.toFixed(2)}` : "—"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeSavedCard(view, card.id).then(setCards)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-red-400/40 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">
            No cards saved in this list yet. Use the lookup page to add your first card.
          </div>
        )}
      </div>
    </div>
  );
}
