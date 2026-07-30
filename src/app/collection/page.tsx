"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSavedCards, removeSavedCard, type SavedCardRecord } from "@/lib/card-storage";

type ViewKey = "collection" | "wishlist" | "deck";

const LABELS: Record<ViewKey, { title: string; hint: string }> = {
  collection: { title: "My collection", hint: "Cards I own or track in one place." },
  wishlist: { title: "Wishlist", hint: "Cards I want to buy later." },
  deck: { title: "Deck", hint: "Cards I want to test or build around." },
};

export default function CollectionPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewKey>("collection");
  const [cards, setCards] = useState<SavedCardRecord[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const client = createClient();

    const init = async () => {
      try {
        const { data: { user }, error } = await client.auth.getUser();
        if (!alive) return;

        if (error) throw error;

        if (!user) {
          router.replace("/auth?redirectTo=/collection");
          return;
        }

        setIsSignedIn(true);
        setReady(true);
      } catch (error) {
        if (!alive) return;
        console.error("[collection] Failed to load session", error);
        setLoadError(error instanceof Error ? error.message : "Unable to load your collection.");
        setReady(true);
      }
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setIsSignedIn(false);
        setReady(false);
        setLoadError(null);
        router.replace("/auth?redirectTo=/collection");
        return;
      }

      setIsSignedIn(true);
      setReady(true);
      setLoadError(null);
    });

    void init();

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!isSignedIn) return;
    getSavedCards(view).then(setCards);
  }, [view, isSignedIn]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] text-gray-400">Loading collection…</div>;
  }

  if (loadError) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-4 text-red-200"><div className="max-w-xl rounded-3xl border border-red-400/20 bg-red-400/10 p-6">{loadError}</div></div>;
  }

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

        {cards.length ? (
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
