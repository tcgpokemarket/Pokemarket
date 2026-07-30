"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing, LiveShow } from "@/lib/supabase/types";

type QueueItem = {
  id: string;
  listingId: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  startPrice: number;
  buyNowPrice: number;
  auctionSeconds: number;
  pinned: boolean;
};

type GiveawayItem = {
  id: string;
  title: string;
  prizeType: string;
  prizeName: string;
  prizeImage: string | null;
  startAt: string;
  endAt: string;
  followRequired: boolean;
  status: string;
};

function buildQueueItem(listing: Listing): QueueItem {
  return {
    id: listing.id,
    listingId: listing.id,
    title: listing.card_name,
    subtitle: `${listing.set_name}${listing.card_number ? ` · ${listing.card_number}` : ""}`,
    imageUrl: listing.images?.[0] ?? null,
    startPrice: Number(listing.price),
    buyNowPrice: Number(listing.price),
    auctionSeconds: listing.category === "sealed" ? 60 : 45,
    pinned: false,
  };
}

export default function AuctionSetupClient({ sellerName, sellerUsername, listings, existingShows }: { sellerName: string; sellerUsername: string | null; listings: Listing[]; existingShows: LiveShow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(`${sellerName}'s Live Auction`);
  const [description, setDescription] = useState("Build your show, queue items, and launch when you are ready.");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [scheduledStart, setScheduledStart] = useState(() => new Date(Date.now() + 1000 * 60 * 60).toISOString().slice(0, 16));
  const [format, setFormat] = useState("auction");
  const [featured, setFeatured] = useState(false);
  const [autoModeration, setAutoModeration] = useState(true);
  const [queueMode, setQueueMode] = useState("manual");
  const [minIncrement, setMinIncrement] = useState(1);
  const [antiSnipeSeconds, setAntiSnipeSeconds] = useState(15);
  const [chatSlowModeSeconds, setChatSlowModeSeconds] = useState(0);
  const [launchNow, setLaunchNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>(() => listings.slice(0, 8).map(buildQueueItem));
  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);

  const primaryActionLabel = launchNow ? "Save & launch" : "Save draft";
  const secondaryActionLabel = launchNow ? "Save draft instead" : "Launch immediately";

  const canLaunch = queue.length > 0;

  const addListingToQueue = (listing: Listing) => {
    setQueue((current) => current.some((item) => item.listingId === listing.id) ? current : [...current, buildQueueItem(listing)]);
  };

  const moveQueueItem = (index: number, direction: -1 | 1) => {
    setQueue((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeQueueItem = (id: string) => setQueue((current) => current.filter((item) => item.id !== id));

  const addGiveaway = () => {
    const now = new Date();
    setGiveaways((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: `Giveaway ${current.length + 1}`,
        prizeType: "card",
        prizeName: "Mystery prize",
        prizeImage: null,
        startAt: now.toISOString(),
        endAt: new Date(now.getTime() + 1000 * 60 * 30).toISOString(),
        followRequired: true,
        status: "draft",
      },
    ]);
  };

  const persistSetup = async (launch = false) => {
    if (!canLaunch && launch) {
      setStatusMessage("Add at least one queue item before launching.");
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      const createResponse = await fetch("/api/live/shows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          thumbnail: thumbnail || null,
          scheduled_start: new Date(scheduledStart).toISOString(),
          status: launch ? "live" : "scheduled",
          auction_state: launch ? "live" : "upcoming",
          auction_settings: {
            format,
            featured,
            auto_moderation: autoModeration,
            queue_mode: queueMode,
            min_increment: minIncrement,
            anti_snipe_seconds: antiSnipeSeconds,
            chat_slow_mode_seconds: chatSlowModeSeconds,
            seller_username: sellerUsername,
          },
        }),
      });

      const created = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) throw new Error(created.error ?? "Unable to create auction.");

      const showId = created.show?.id as string | undefined;
      if (!showId) throw new Error("The auction was created without an ID.");

      const setupResponse = await fetch(`/api/live/shows/${showId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          thumbnail: thumbnail || null,
          scheduled_start: new Date(scheduledStart).toISOString(),
          status: launch ? "live" : "scheduled",
          auction_state: launch ? "live" : "upcoming",
          auction_settings: {
            format,
            featured,
            auto_moderation: autoModeration,
            queue_mode: queueMode,
            min_increment: minIncrement,
            anti_snipe_seconds: antiSnipeSeconds,
            chat_slow_mode_seconds: chatSlowModeSeconds,
            seller_username: sellerUsername,
          },
        }),
      });

      const setupData = await setupResponse.json().catch(() => ({}));
      if (!setupResponse.ok) throw new Error(setupData.error ?? "Unable to save auction setup.");

      setStatusMessage(launch ? `Auction launched from ${queue.length} queued items.` : `Auction draft saved with ${queue.length} queue items.`);
      if (launch) {
        router.push(`/live/${showId}`);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save auction setup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-yellow-400">Seller live rooms</p>
            <h1 className="mt-2 text-4xl font-black sm:text-5xl">Create auction</h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-400">Set up the room, connect your listings, organize the queue, and launch the live auction when you are ready.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setLaunchNow((current) => !current)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-white/5">
              {secondaryActionLabel}
            </button>
            <button type="button" disabled={saving || (launchNow && !canLaunch)} onClick={() => void persistSetup(launchNow)} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black disabled:opacity-50">
              {saving ? "Saving..." : primaryActionLabel}
            </button>
          </div>
        </div>

        {statusMessage && <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">{statusMessage}</div>}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
              <h2 className="text-lg font-bold">Show setup</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm text-gray-300">Title</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm text-gray-300">Description</span>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-gray-300">Start time</span>
                  <input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-gray-300">Thumbnail URL</span>
                  <input value={thumbnail ?? ""} onChange={(e) => setThumbnail(e.target.value)} placeholder="Optional image URL" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Queue builder</h2>
                <span className="text-sm text-gray-400">{queue.length} items</span>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {listings.map((listing) => (
                    <button key={listing.id} type="button" onClick={() => addListingToQueue(listing)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left hover:border-yellow-400/30">
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/5">
                        {listing.images?.[0] ? <img src={listing.images[0]} alt={listing.card_name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-gray-500">No image</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{listing.card_name}</div>
                        <div className="text-xs text-gray-400">{listing.set_name}{listing.card_number ? ` · ${listing.card_number}` : ""}</div>
                      </div>
                      <span className="text-xs text-yellow-400">Add</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {queue.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-gray-500">Select listings to build your auction queue.</div>
                  ) : (
                    queue.map((item, index) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/5">
                            {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{item.title}</div>
                            <div className="text-xs text-gray-400">{item.subtitle}</div>
                            <div className="mt-2 text-xs text-gray-400">Start ${item.startPrice.toFixed(2)} · Buy now ${item.buyNowPrice.toFixed(2)} · {item.auctionSeconds}s</div>
                          </div>
                          <button type="button" onClick={() => removeQueueItem(item.id)} className="text-xs text-red-300">Remove</button>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => moveQueueItem(index, -1)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300">Up</button>
                          <button type="button" onClick={() => moveQueueItem(index, 1)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300">Down</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Giveaways</h2>
                <button type="button" onClick={addGiveaway} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/15">Add giveaway</button>
              </div>
              <div className="mt-4 space-y-3">
                {giveaways.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-gray-500">Add a giveaway to engage viewers during the show.</div>
                ) : (
                  giveaways.map((giveaway) => (
                    <div key={giveaway.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                      <div className="font-semibold text-white">{giveaway.title}</div>
                      <div className="mt-1 text-xs text-gray-400">{giveaway.prizeName} · {giveaway.followRequired ? "Follow required" : "Open entry"}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
              <h2 className="text-lg font-bold">Settings</h2>
              <div className="mt-4 space-y-4 text-sm text-gray-300">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Feature room</label>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><input type="checkbox" checked={autoModeration} onChange={(e) => setAutoModeration(e.target.checked)} /> Auto moderation</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2"><span className="text-xs uppercase tracking-widest text-gray-500">Format</span><input value={format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-xs uppercase tracking-widest text-gray-500">Queue mode</span><input value={queueMode} onChange={(e) => setQueueMode(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" /></label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-widest text-gray-500">Min increment</span>
                    <input type="number" min="1" value={minIncrement} onChange={(e) => setMinIncrement(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-widest text-gray-500">Anti-snipe seconds</span>
                    <input type="number" min="0" value={antiSnipeSeconds} onChange={(e) => setAntiSnipeSeconds(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </label>
                  <label className="space-y-2 sm:col-span-2">
                    <span className="text-xs uppercase tracking-widest text-gray-500">Chat slow mode seconds</span>
                    <input type="number" min="0" value={chatSlowModeSeconds} onChange={(e) => setChatSlowModeSeconds(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
              <h2 className="text-lg font-bold">Existing rooms</h2>
              <div className="mt-4 space-y-3">
                {existingShows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-gray-500">No live shows yet.</div>
                ) : (
                  existingShows.map((show) => (
                    <a key={show.id} href={`/live/${show.id}`} className="block rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-yellow-400/30">
                      <div className="font-semibold">{show.title}</div>
                      <div className="text-xs text-gray-400">{show.status}</div>
                    </a>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
