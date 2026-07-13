"use client";

import { useMemo, useState } from "react";
import type { Listing, LiveShow } from "@/lib/supabase/types";

type QueueItem = {
  id: string;
  listingId: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  startPrice: number;
  buyNowPrice: number | null;
  auctionSeconds: number;
  pinned: boolean;
};

type GiveawayDraft = {
  id: string;
  title: string;
  prizeName: string;
  prizeType: string;
  prizeImage: string;
  startAt: string;
  endAt: string;
  followRequired: boolean;
  status: string;
};

interface AuctionSetupClientProps {
  sellerName: string;
  sellerUsername: string | null;
  listings: Listing[];
  existingShows: LiveShow[];
}

function toLocalInputValue(date = new Date(Date.now() + 1000 * 60 * 45)) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
}

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

export default function AuctionSetupClient({ sellerName, sellerUsername, listings, existingShows }: AuctionSetupClientProps) {
  const [title, setTitle] = useState(`${sellerName}'s Live Auction`);
  const [description, setDescription] = useState("Collector-first live auction with clear bidding, giveaways, and a premium queue.");
  const [thumbnail, setThumbnail] = useState(listings[0]?.images?.[0] ?? "");
  const [scheduledStart, setScheduledStart] = useState(toLocalInputValue());
  const [queue, setQueue] = useState<QueueItem[]>(listings.slice(0, 3).map((listing, index) => ({ ...buildQueueItem(listing), startPrice: index === 0 ? 1 : Number(listing.price), pinned: index === 0 })));
  const [giveaways, setGiveaways] = useState<GiveawayDraft[]>([]);
  const [format, setFormat] = useState("fixed_price_drop");
  const [featured, setFeatured] = useState(true);
  const [autoModeration, setAutoModeration] = useState(true);
  const [queueMode, setQueueMode] = useState("manual");
  const [minIncrement, setMinIncrement] = useState(1);
  const [antiSnipeSeconds, setAntiSnipeSeconds] = useState(10);
  const [chatSlowModeSeconds, setChatSlowModeSeconds] = useState(0);
  const [launchNow, setLaunchNow] = useState(false);
  const primaryActionLabel = launchNow ? "Save & launch" : "Save draft";
  const secondaryActionLabel = launchNow ? "Save draft instead" : "Launch immediately";
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedListingIds = useMemo(() => new Set(queue.map((item) => item.listingId).filter(Boolean)), [queue]);
  const upcomingShows = useMemo(() => existingShows.filter((show) => show.status !== "ended").slice(0, 4), [existingShows]);

  const addListingToQueue = (listing: Listing) => {
    setQueue((current) => {
      if (current.some((item) => item.listingId === listing.id)) return current;
      const next = [...current, buildQueueItem(listing)];
      if (next.length === 1) next[0] = { ...next[0], pinned: true, startPrice: 1 };
      return next;
    });
  };

  const removeQueueItem = (index: number) => {
    setQueue((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      if (next[0]) next[0] = { ...next[0], pinned: true };
      return next;
    });
  };

  const moveQueueItem = (index: number, direction: -1 | 1) => {
    setQueue((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next.map((item, itemIndex) => ({ ...item, pinned: itemIndex === 0 }));
    });
  };

  const addGiveaway = () => {
    const now = new Date();
    const later = new Date(now.getTime() + 1000 * 60 * 30);
    setGiveaways((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: "Collector giveaway",
        prizeName: "Mystery prize",
        prizeType: "card",
        prizeImage: "",
        startAt: now.toISOString().slice(0, 16),
        endAt: later.toISOString().slice(0, 16),
        followRequired: true,
        status: "draft",
      },
    ]);
  };

  const updateGiveaway = (id: string, patch: Partial<GiveawayDraft>) => {
    setGiveaways((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeGiveaway = (id: string) => {
    setGiveaways((current) => current.filter((item) => item.id !== id));
  };

  const persistSetup = async (launch = false) => {
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

      if (!createResponse.ok) {
        throw new Error(created.error ?? "Unable to create auction.");
      }

      const showId = created.show?.id as string | undefined;
      if (!showId) {
        throw new Error("The auction was created without an ID.");
      }

      const setupResponse = await fetch(`/api/live/shows/${showId}/setup`, {
        method: "PUT",
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
          items: queue,
          giveaways: giveaways.map((giveaway) => ({
            ...giveaway,
            status: launch ? "scheduled" : giveaway.status,
          })),
        }),
      });
      const setupData = await setupResponse.json().catch(() => ({}));

      if (!setupResponse.ok) {
        throw new Error(setupData.error ?? "Unable to save auction setup.");
      }

      setStatusMessage(launch ? `Auction launched from ${queue.length} queued items.` : `Auction draft saved with ${queue.length} queue items.`);
      if (setupData.show?.id && launch) {
        window.location.href = `/live/${setupData.show.id}`;
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save auction setup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-yellow-400">Seller dashboard · Live Auctions</p>
              <h1 className="mt-2 text-3xl font-black">Create auction</h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-400">Build the live room, choose the queue, set your rules, and launch from the same flow.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a href="/dashboard" className="rounded-xl border border-white/15 px-4 py-2 text-gray-300 hover:bg-white/5">Back to dashboard</a>
              <a href="/live" className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 font-semibold text-yellow-400 hover:bg-yellow-400/20">Browse live rooms</a>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6">
              <h2 className="text-xl font-black">Show details</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm text-gray-300">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm text-gray-300">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Scheduled start</label>
                  <input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Thumbnail URL</label>
                  <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Queue</h2>
                <span className="text-xs uppercase tracking-widest text-gray-500">{queue.length} items</span>
              </div>

              <div className="mt-5 space-y-3">
                {queue.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-gray-400">Add listings from the right-hand panel to build your queue.</div>
                ) : (
                  queue.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-xl">
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" /> : "🃏"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{index + 1}. {item.title}</div>
                        <div className="text-xs text-gray-400">{item.subtitle ?? "No subtitle"}</div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1">
                            Start
                            <input
                              type="number"
                              min="0"
                              value={item.startPrice}
                              onChange={(e) => setQueue((current) => current.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, startPrice: Number(e.target.value) } : currentItem))}
                              className="w-20 bg-transparent text-right text-white outline-none"
                            />
                          </label>
                          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1">
                            Buy now
                            <input
                              type="number"
                              min="0"
                              value={item.buyNowPrice ?? 0}
                              onChange={(e) => setQueue((current) => current.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, buyNowPrice: Number(e.target.value) } : currentItem))}
                              className="w-20 bg-transparent text-right text-white outline-none"
                            />
                          </label>
                          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1">
                            Seconds
                            <input
                              type="number"
                              min="5"
                              value={item.auctionSeconds}
                              onChange={(e) => setQueue((current) => current.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, auctionSeconds: Number(e.target.value) } : currentItem))}
                              className="w-16 bg-transparent text-right text-white outline-none"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={() => moveQueueItem(index, -1)} className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/5">Up</button>
                        <button type="button" onClick={() => moveQueueItem(index, 1)} className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/5">Down</button>
                        <button type="button" onClick={() => removeQueueItem(index)} className="rounded-lg border border-red-400/30 px-2 py-1 text-xs text-red-200 hover:bg-red-400/10">Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Giveaways</h2>
                <button type="button" onClick={addGiveaway} className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-400/20">Add giveaway</button>
              </div>

              <div className="mt-5 space-y-4">
                {giveaways.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-gray-400">Add a giveaway to keep the room active and drive follows.</div>
                ) : (
                  giveaways.map((giveaway) => (
                    <div key={giveaway.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={giveaway.title} onChange={(e) => updateGiveaway(giveaway.id, { title: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" placeholder="Giveaway title" />
                        <input value={giveaway.prizeName} onChange={(e) => updateGiveaway(giveaway.id, { prizeName: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" placeholder="Prize name" />
                        <input value={giveaway.prizeType} onChange={(e) => updateGiveaway(giveaway.id, { prizeType: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" placeholder="Prize type" />
                        <input value={giveaway.prizeImage} onChange={(e) => updateGiveaway(giveaway.id, { prizeImage: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" placeholder="Prize image URL" />
                        <input type="datetime-local" value={giveaway.startAt} onChange={(e) => updateGiveaway(giveaway.id, { startAt: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                        <input type="datetime-local" value={giveaway.endAt} onChange={(e) => updateGiveaway(giveaway.id, { endAt: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300">
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                          <input type="checkbox" checked={giveaway.followRequired} onChange={(e) => updateGiveaway(giveaway.id, { followRequired: e.target.checked })} />
                          Follow required
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                          Status
                          <select value={giveaway.status} onChange={(e) => updateGiveaway(giveaway.id, { status: e.target.value })} className="bg-transparent outline-none">
                            <option value="draft">Draft</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="live">Live</option>
                          </select>
                        </label>
                        <button type="button" onClick={() => removeGiveaway(giveaway.id)} className="rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-400/10">Remove giveaway</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#13131f] p-6">
              <h2 className="text-xl font-black">Settings</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                  <div className="mb-2 font-semibold text-white">Template</div>
                  <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none">
                    <option value="fixed_price_drop">Fixed price drop</option>
                    <option value="mystery_break">Mystery break</option>
                    <option value="one_dollar_start">$1 start</option>
                    <option value="pack_opening">Pack opening</option>
                    <option value="slab_showcase">Slab showcase</option>
                    <option value="hit_draft">Hit draft</option>
                    <option value="random_slot_break">Random slot break</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                  <div className="mb-2 font-semibold text-white">Queue mode</div>
                  <select value={queueMode} onChange={(e) => setQueueMode(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none">
                    <option value="manual">Manual</option>
                    <option value="auto">Auto</option>
                    <option value="featured">Featured</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                  <div className="mb-2 font-semibold text-white">Minimum increment</div>
                  <input type="number" min="1" value={minIncrement} onChange={(e) => setMinIncrement(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                  <div className="mb-2 font-semibold text-white">Anti-snipe seconds</div>
                  <input type="number" min="0" value={antiSnipeSeconds} onChange={(e) => setAntiSnipeSeconds(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                  <div className="mb-2 font-semibold text-white">Chat slow mode</div>
                  <input type="number" min="0" value={chatSlowModeSeconds} onChange={(e) => setChatSlowModeSeconds(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" />
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                  Feature this room
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
                  <input type="checkbox" checked={autoModeration} onChange={(e) => setAutoModeration(e.target.checked)} />
                  Auto moderation
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300 sm:col-span-2">
                  <input type="checkbox" checked={launchNow} onChange={(e) => setLaunchNow(e.target.checked)} />
                  Launch immediately after saving
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-black">Existing rooms</h2>
              <div className="mt-4 space-y-3">
                {upcomingShows.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No saved rooms yet.</div>
                ) : (
                  upcomingShows.map((show) => (
                    <a key={show.id} href={`/live/${show.id}`} className="block rounded-2xl border border-white/10 bg-[#13131f] p-4 hover:border-yellow-400/40">
                      <div className="font-semibold text-white">{show.title}</div>
                      <div className="mt-1 text-xs text-gray-400">{show.status} · {show.viewer_count ?? 0} viewers</div>
                    </a>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
              <h2 className="text-lg font-black text-yellow-400">Ready to go live?</h2>
              <p className="mt-2 text-sm text-gray-200">Save a draft first or launch the room once the queue and giveaways are set.</p>
              <div className="mt-4 flex flex-col gap-3">
                <button type="button" onClick={() => void persistSetup(launchNow)} disabled={saving} className="rounded-xl border border-white/15 px-4 py-3 font-semibold text-white hover:bg-white/5 disabled:opacity-50">
                  {saving ? (launchNow ? "Launching..." : "Saving...") : primaryActionLabel}
                </button>
                <button type="button" onClick={() => setLaunchNow((current) => !current)} disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-50">
                  {saving ? "Updating..." : secondaryActionLabel}
                </button>
              </div>
              {statusMessage && <div className="mt-4 rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-gray-200">{statusMessage}</div>}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => {
            const isSelected = selectedListingIds.has(listing.id);
            return (
              <div key={listing.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-2xl">
                    {listing.images?.[0] ? <img src={listing.images[0]} alt={listing.card_name} className="h-full w-full object-cover" /> : "🃏"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{listing.card_name}</div>
                    <div className="text-xs text-gray-400">{listing.set_name} · {listing.condition}</div>
                    <div className="mt-1 text-sm font-black text-yellow-400">${Number(listing.price).toFixed(2)}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className={`rounded-full border px-3 py-1 ${isSelected ? "border-green-400/30 bg-green-400/10 text-green-300" : "border-white/10 bg-[#13131f] text-gray-400"}`}>{isSelected ? "In queue" : "Available"}</span>
                  <button type="button" onClick={() => addListingToQueue(listing)} disabled={isSelected} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black disabled:opacity-40">
                    {isSelected ? "Added" : "Add to queue"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
