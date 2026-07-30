"use client";

import { useMemo, useState } from "react";
import type { Listing } from "@/lib/supabase/types";
import {
  applyLiveShowTemplate,
  createDefaultQueue,
  createLiveShowSnapshot,
  getLiveShow,
  reorderLiveShowQueue,
  saveLiveShow,
  type LiveShowState,
  type LiveShowTemplate,
} from "@/lib/live-commerce";
import { choosePrimaryImage, evaluateImageMatch } from "@/lib/image-verification";
import { VerifiedImage } from "@/components/listings/VerifiedImage";

interface LiveShowStudioProps {
  listings: Listing[];
}

const SHOW_FORMATS: { value: LiveShowTemplate; label: string }[] = [
  { value: "mystery_break", label: "Mystery Break" },
  { value: "one_dollar_start", label: "$1 Start" },
  { value: "pack_opening", label: "Pack Opening" },
  { value: "slab_showcase", label: "Slab Showcase" },
  { value: "hit_draft", label: "Hit Draft" },
  { value: "random_slot_break", label: "Random Slot Break" },
  { value: "fixed_price_drop", label: "Fixed Price Drop" },
];

function seedFromListings(listings: Listing[]): LiveShowState {
  const items = listings.slice(0, 5).map((listing, index) => {
    const primaryImage = choosePrimaryImage((listing.images ?? []).map((imageUrl) => evaluateImageMatch({ name: listing.card_name, setName: listing.set_name, cardNumber: listing.card_number }, { imageUrl, source: "seller_unverified", setName: listing.set_name, cardNumber: listing.card_number })));
    return {
      id: `listing-${listing.id}`,
      listingId: listing.id,
      title: listing.card_name,
      subtitle: `${listing.set_name}${listing.card_number ? ` · ${listing.card_number}` : ""}`,
      imageUrl: primaryImage?.imageUrl ?? "",
      startPrice: index === 0 ? 1 : listing.price,
      buyNowPrice: listing.price,
      currentBid: index === 0 ? 1 : Math.max(1, Math.floor(listing.price * 0.35)),
      bidCount: 0,
      auctionSeconds: index === 0 ? 30 : 45,
      secondsLeft: index === 0 ? 30 : 45,
      pinned: index === 0,
      sold: false,
      nextBidIncrement: index === 0 ? 1 : 5,
    };
  });

  return {
    id: "",
    title: "",
    format: "fixed_price_drop",
    status: "scheduled",
    scheduledStart: new Date().toISOString(),
    viewerCount: 0,
    peakViewers: 0,
    engagementScore: 0,
    items,
    queue: createDefaultQueue(items),
    chat: [],
    topBidder: "",
    lastWinner: "",
    hostSettings: {
      mutedChat: false,
      slowModeSeconds: 0,
      bannedUsers: [],
      blockedWords: [],
      autoReconnect: true,
      aiHostEnabled: false,
    },
  };
}

export default function LiveShowStudio({ listings }: LiveShowStudioProps) {
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<LiveShowTemplate>("fixed_price_drop");
  const [scheduledStart, setScheduledStart] = useState(() => new Date(Date.now() + 1000 * 60 * 30).toISOString().slice(0, 16));
  const [mutedChat, setMutedChat] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [aiHostEnabled, setAiHostEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState(() => createDefaultQueue(listings.slice(0, 5).map((listing, index) => ({
    id: `listing-${listing.id}`,
    listingId: listing.id,
    title: listing.card_name,
    subtitle: `${listing.set_name}${listing.card_number ? ` · ${listing.card_number}` : ""}`,
    imageUrl: listing.images?.[0] ?? "",
    startPrice: index === 0 ? 1 : listing.price,
    buyNowPrice: listing.price,
    currentBid: index === 0 ? 1 : Math.max(1, Math.floor(listing.price * 0.35)),
    bidCount: 0,
    auctionSeconds: index === 0 ? 30 : 45,
    secondsLeft: index === 0 ? 30 : 45,
    pinned: index === 0,
    sold: false,
    nextBidIncrement: index === 0 ? 1 : 5,
  }))));

  const queuePreview = useMemo(() => queue, [queue]);

  const handleMoveQueue = (fromIndex: number, toIndex: number) => {
    setQueue((current) => reorderLiveShowQueue(current, fromIndex, toIndex));
  };

  const handleSave = () => {
    const base = seedFromListings(listings);
    const show = createLiveShowSnapshot(
      applyLiveShowTemplate(
        {
          ...base,
          title,
          format: template,
          scheduledStart: new Date(scheduledStart).toISOString(),
          queue,
          hostSettings: {
            ...(base.hostSettings ?? { mutedChat: false, slowModeSeconds: 0, bannedUsers: [], blockedWords: [], autoReconnect: true }),
            mutedChat,
            slowModeSeconds,
            aiHostEnabled,
          },
        },
        template
      )
    );

    saveLiveShow(show);
    setMessage("Live show saved and ready to launch.");
  };

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-[#13131f] p-5">
      <div>
        <p className="text-sm uppercase tracking-widest text-yellow-400">Seller live studio</p>
        <h2 className="mt-1 text-2xl font-black">Build a show from your live inventory</h2>
        <p className="mt-2 text-sm text-gray-400">Templates, queue order, and host settings all extend the current live-commerce flow.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">Show title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">Scheduled start</label>
          <input
            type="datetime-local"
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">Show template</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {SHOW_FORMATS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTemplate(option.value)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${template === option.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-white/10 bg-white/5 text-gray-300 hover:border-white/20"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
          <input type="checkbox" checked={mutedChat} onChange={(e) => setMutedChat(e.target.checked)} />
          Mute chat
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
          <span>Slow mode</span>
          <input
            type="number"
            min="0"
            value={slowModeSeconds}
            onChange={(e) => setSlowModeSeconds(Number(e.target.value))}
            className="ml-auto w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-right text-white"
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
          <input type="checkbox" checked={aiHostEnabled} onChange={(e) => setAiHostEnabled(e.target.checked)} />
          AI host
        </label>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Item queue</h3>
          <span className="text-xs text-gray-500">Drag controls can be added next; for now, use the move buttons.</span>
        </div>
        <div className="space-y-3">
          {queuePreview.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-2xl">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" /> : "🃏"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{index + 1}. {item.title}</div>
                <div className="text-xs text-gray-400">{item.subtitle}</div>
              </div>
              <div className="text-right text-sm text-gray-300">
                <div>${item.buyNowPrice?.toFixed(2) ?? item.startPrice.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{item.auctionSeconds}s</div>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => handleMoveQueue(index, Math.max(0, index - 1))} className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/5">
                  Up
                </button>
                <button type="button" onClick={() => handleMoveQueue(index, Math.min(queuePreview.length - 1, index + 1))} className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/5">
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button onClick={handleSave} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300">
          Save show
        </button>
        <a href="/live" className="rounded-xl border border-white/20 px-5 py-3 text-center font-semibold text-white hover:bg-white/5">
          Preview live room
        </a>
      </div>

      {message && <div className="rounded-xl border border-green-400/30 bg-green-400/10 px-4 py-3 text-sm text-green-300">{message}</div>}
    </div>
  );
}
