"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database, LiveShowBid, LiveShowItem, LiveShowMessage, LiveShow } from "@/lib/supabase/types";
import LiveKitStage from "@/components/LiveKitStage";
import SupportInlineCard from "@/components/support/support-inline-card";

const LIVE_SUPPORT_CARD = (
  <SupportInlineCard title="Need live show help?" description="Ask about bidding, giveaways, payouts, or stream issues while you watch." href="/support" />
);

type LiveShowGiveaway = Database["public"]["Tables"]["giveaways"]["Row"];

type GiveawayEntryState = {
  entered: boolean;
  following: boolean;
  requiresFollow: boolean;
};

function getNextSwipeBid(currentBid: number) {
  return Number(currentBid) + 1;
}

const SWIPE_THRESHOLD = 90;
const SWIPE_LOCK_MS = 1200;
const HAPTIC_PATTERN = [25, 20, 35];

function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function formatClock(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getActiveItem(items: LiveShowItem[]) {
  return items.find((item) => item.pinned && !item.sold) ?? items.find((item) => !item.sold) ?? items[0] ?? null;
}

function getActiveGiveaway(giveaways: LiveShowGiveaway[]) {
  const now = Date.now();
  return giveaways.find((giveaway) => giveaway.status === "live" && now >= new Date(giveaway.start_at).getTime() && now <= new Date(giveaway.end_at).getTime()) ?? null;
}

export default function LiveShowClient({ initialData }: { initialData: { show: LiveShow; products: LiveShowItem[]; bids: LiveShowBid[]; chat: LiveShowMessage[]; giveaways?: LiveShowGiveaway[] } }) {
  const supabase = useMemo(() => createClient(), []);
  const [show, setShow] = useState(initialData.show);
  const [products, setProducts] = useState<LiveShowItem[]>(initialData.products);
  const [bids, setBids] = useState<LiveShowBid[]>(initialData.bids);
  const [chat, setChat] = useState<LiveShowMessage[]>(initialData.chat);
  const [giveaways, setGiveaways] = useState<LiveShowGiveaway[]>(initialData.giveaways ?? []);
  const [message, setMessage] = useState("");
  const [statusText, setStatusText] = useState("");
  const [giveawayStatus, setGiveawayStatus] = useState<string | null>(null);
  const [giveawayBusy, setGiveawayBusy] = useState(false);
  const [entryStatuses, setEntryStatuses] = useState<Record<string, GiveawayEntryState>>({});
  const [showFollowPrompt, setShowFollowPrompt] = useState(false);
  const [activeGiveawayId, setActiveGiveawayId] = useState<string | null>(null);
  const [maxBidEnabled, setMaxBidEnabled] = useState(false);
  const [maxBidAmount, setMaxBidAmount] = useState("");
  const [swipeState, setSwipeState] = useState<"idle" | "swiping" | "submitting" | "success">("idle");
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartX = useRef<number | null>(null);
  const swipeLockUntil = useRef(0);
  const swipeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeTrackRef = useRef<HTMLDivElement | null>(null);
  const activeItem = useMemo(() => getActiveItem(products), [products]);
  const activeGiveaway = useMemo(() => getActiveGiveaway(giveaways), [giveaways]);
  const roomName = `tcg-poke-market-${show.id}`;
  const swipeHint = activeItem ? `Swipe to bid $${getNextSwipeBid(Number(activeItem.current_bid ?? 0)).toFixed(2)}` : "Swipe to bid";
  const currentBid = Number(activeItem?.current_bid ?? 0);
  const nextBid = getNextSwipeBid(currentBid);
  const maxBidPreview = Number(maxBidAmount || 0);
  const isSwipeLocked = swipeState === "submitting" || Date.now() < swipeLockUntil.current;

  useEffect(() => {
    const showChannel = supabase
      .channel(`live-show:${show.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_shows", filter: `id=eq.${show.id}` }, (payload) => {
        if (payload.new) setShow(payload.new as LiveShow);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "show_products", filter: `show_id=eq.${show.id}` }, (payload) => {
        const product = payload.new as LiveShowItem;
        setProducts((current) => current.map((item) => (item.id === product.id ? product : item)));
      })
      .subscribe();

    const bidsChannel = supabase
      .channel(`live-bids:${show.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_bids", filter: `show_id=eq.${show.id}` }, (payload) => {
        setBids((current) => [payload.new as LiveShowBid, ...current].slice(0, 100));
      })
      .subscribe();

    const chatChannel = supabase
      .channel(`live-chat:${show.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat", filter: `show_id=eq.${show.id}` }, (payload) => {
        setChat((current) => [...current, payload.new as LiveShowMessage]);
      })
      .subscribe();

    const giveawayChannel = supabase
      .channel(`live-giveaways:${show.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "giveaway_entries", filter: `show_id=eq.${show.id}` }, (payload) => {
        const entry = payload.new as { giveaway_id?: string; user_id?: string; following_seller?: boolean };
        if (entry.giveaway_id) {
          setEntryStatuses((current) => ({
            ...current,
            [entry.giveaway_id as string]: {
              entered: true,
              following: Boolean(entry.following_seller),
              requiresFollow: Boolean(activeGiveaway?.follow_required),
            },
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(showChannel);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(giveawayChannel);
    };
  }, [activeGiveaway?.follow_required, show.id, supabase]);

  useEffect(() => {
    setSwipeOffset(0);
  }, [activeItem?.id]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void fetch(`/api/live/shows/${show.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "viewer_ping", payload: { lastSeenAt: new Date().toISOString() } }),
      });
    }, 30000);

    return () => clearInterval(intervalId);
  }, [show.id]);

  const sendChat = async () => {
    if (!message.trim()) return;
    const response = await fetch(`/api/live/shows/${show.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (response.ok) {
      setMessage("");
      setStatusText("Message sent");
    } else {
      const data = await response.json().catch(() => ({}));
      setStatusText(data.error ?? "Chat failed");
    }
  };

  const triggerSwipeBid = async () => {
    if (!activeItem || isSwipeLocked) return;

    setSwipeState("submitting");
    swipeLockUntil.current = Date.now() + SWIPE_LOCK_MS;
    if (canVibrate()) navigator.vibrate(HAPTIC_PATTERN);

    const response = await fetch(`/api/live/shows/${show.id}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: activeItem.id,
        nonce: crypto.randomUUID(),
        maxBid: maxBidEnabled ? Number(maxBidAmount || 0) : null,
      }),
    });

    if (response.ok) {
      setStatusText(`Bid placed on ${activeItem.title}`);
      setSwipeState("success");
      if (canVibrate()) navigator.vibrate([40, 30, 40]);
    } else {
      const data = await response.json().catch(() => ({}));
      setStatusText(data.error ?? "Bid failed");
      setSwipeState("idle");
    }

    if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current);
    swipeResetTimer.current = setTimeout(() => setSwipeState("idle"), 900);
    setSwipeOffset(0);
  };

  const handleSwipeStart = (clientX: number) => {
    if (isSwipeLocked) return;
    swipeStartX.current = clientX;
    setSwipeState("swiping");
  };

  const handleSwipeMove = (clientX: number) => {
    if (swipeStartX.current === null || isSwipeLocked) return;
    const distance = Math.max(0, clientX - swipeStartX.current);
    setSwipeOffset(Math.min(distance, 140));
  };

  const handleSwipeEnd = async () => {
    if (swipeStartX.current === null) return;
    const shouldBid = swipeOffset >= SWIPE_THRESHOLD;
    swipeStartX.current = null;
    if (!shouldBid) {
      setSwipeState("idle");
      setSwipeOffset(0);
      return;
    }
    setSwipeOffset(140);
    await triggerSwipeBid();
  };

  useEffect(() => {
    return () => {
      if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current);
    };
  }, []);

  useEffect(() => {
    if (swipeState !== "swiping") return;
    const reset = () => {
      setSwipeState("idle");
      setSwipeOffset(0);
    };

    window.addEventListener("pointerup", reset, { once: true });
    window.addEventListener("pointercancel", reset, { once: true });
    return () => {
      window.removeEventListener("pointerup", reset);
      window.removeEventListener("pointercancel", reset);
    };
  }, [swipeState]);

  const enterGiveaway = async (giveawayId: string, followSeller: boolean) => {
    setGiveawayBusy(true);
    setActiveGiveawayId(giveawayId);
    setGiveawayStatus(null);
    const response = await fetch(`/api/giveaways/${giveawayId}/entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followSeller }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setEntryStatuses((current) => ({
        ...current,
        [giveawayId]: { entered: true, following: Boolean(followSeller), requiresFollow: Boolean(activeGiveaway?.follow_required) },
      }));
      setGiveawayStatus("You’re entered.");
      setShowFollowPrompt(false);
    } else if (response.status === 403 && data.requiresFollow) {
      setShowFollowPrompt(true);
      setGiveawayStatus(data.error ?? "Follow this seller to enter.");
    } else {
      setGiveawayStatus(data.error ?? "Unable to enter giveaway.");
    }
    setGiveawayBusy(false);
  };

  const currentGiveawayState = activeGiveaway ? entryStatuses[activeGiveaway.id] : null;

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white pb-32">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.5fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-yellow-400">Live show</p>
                <h1 className="text-3xl font-black">{show.title}</h1>
                <p className="mt-1 text-sm text-gray-400">{show.description ?? "Live auction show"}</p>
              </div>
              <div className="text-right text-sm text-gray-300">
                <div>Status</div>
                <div className="text-2xl font-black text-yellow-400">{show.status}</div>
              </div>
            </div>

            {activeGiveaway && (
              <div className="mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-yellow-200">Follow to Enter Giveaway</p>
                    <h2 className="text-xl font-black text-white">{activeGiveaway.prize_name}</h2>
                    <p className="text-sm text-yellow-100">
                      {activeGiveaway.follow_required ? "Follow the seller to enter." : "Enter now while the giveaway is live."}
                    </p>
                    <p className="text-xs text-yellow-200/80">Ends {formatClock(activeGiveaway.end_at)}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <button
                      onClick={() => enterGiveaway(activeGiveaway.id, true)}
                      disabled={giveawayBusy || Boolean(currentGiveawayState?.entered)}
                      className="rounded-xl bg-yellow-400 px-4 py-3 font-black text-black disabled:opacity-60"
                    >
                      {currentGiveawayState?.entered ? "Entered" : activeGiveaway.follow_required ? "Follow & Enter" : "Enter Giveaway"}
                    </button>
                    <button
                      onClick={() => enterGiveaway(activeGiveaway.id, false)}
                      disabled={giveawayBusy || currentGiveawayState?.entered === true}
                      className="text-xs font-semibold text-yellow-100 underline decoration-yellow-200/40 underline-offset-4 disabled:opacity-60"
                    >
                      {showFollowPrompt ? "Follow first to enter" : "I already follow this seller"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-xs text-yellow-50 sm:grid-cols-3">
                  <div className="rounded-xl bg-black/20 p-3">Entries are recorded server-side.</div>
                  <div className="rounded-xl bg-black/20 p-3">Duplicate entries are blocked.</div>
                  <div className="rounded-xl bg-black/20 p-3">Winner selection stays auditable.</div>
                </div>
                {giveawayStatus && <div className="mt-3 rounded-xl border border-yellow-400/20 bg-black/20 px-4 py-3 text-sm text-yellow-100">{giveawayStatus}</div>}
                {currentGiveawayState?.entered && <div className="mt-2 text-xs text-green-300">You’re in the giveaway.</div>}
              </div>
            )}

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
              <LiveKitStage token={null} roomName={roomName} />
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4">
                <div className="rounded-2xl bg-black/70 p-3 text-sm backdrop-blur">
                  <div className="text-gray-400">Current item</div>
                  <div className="font-bold">{activeItem?.title ?? "Waiting for auction"}</div>
                  <div className="text-gray-400">${currentBid.toFixed(2)}</div>
                </div>
                <div className="rounded-2xl bg-black/70 p-3 text-right text-sm backdrop-blur">
                  <div className="text-gray-400">Viewers</div>
                  <div className="font-bold text-yellow-400">{show.viewer_count}</div>
                  <div className="text-gray-400">Peak {show.peak_viewers}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <h2 className="font-bold">Auction controls</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <button onClick={() => void fetch(`/api/live/shows/${show.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "live", auction_state: "live" }) })} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">Start show</button>
                <button onClick={() => void fetch(`/api/live/shows/${show.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ended", auction_state: "ended" }) })} className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white">End show</button>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Current bid</span>
                  <span className="font-semibold text-white">${currentBid.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-300">
                  <span>Next swipe bid</span>
                  <span className="font-semibold text-yellow-400">${nextBid.toFixed(2)}</span>
                </div>
                <label className="mt-4 flex items-center gap-3 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={maxBidEnabled}
                    onChange={(event) => setMaxBidEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent text-yellow-400"
                  />
                  Max bid active
                </label>
                {maxBidEnabled && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      value={maxBidAmount}
                      onChange={(event) => setMaxBidAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="Private max bid"
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none"
                    />
                    <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-100">
                      {maxBidPreview > 0 ? `Private max: $${maxBidPreview.toFixed(2)}` : "Set your private max"}
                    </div>
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-400">{swipeHint}</div>
                <div className="mt-2 text-xs text-gray-500">{maxBidEnabled ? "Only you can see this maximum bid." : "Swipe places a normal $1 increment bid."}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <h2 className="font-bold">Live products</h2>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                {products.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{item.title}</div>
                        <div className="text-xs text-gray-400">{item.subtitle}</div>
                      </div>
                      <div className="text-right text-xs text-gray-400">
                        <div>${Number(item.current_bid).toFixed(2)}</div>
                        <div>{item.seconds_left}s</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 rounded-3xl border border-white/10 bg-[#13131f] p-4">
          {LIVE_SUPPORT_CARD}
          <div>
            <h2 className="font-bold">Live chat</h2>
            <p className="text-sm text-gray-400">Real buyers, real moderation, real-time updates.</p>
          </div>
          <div className="flex gap-2">
            <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void sendChat()} placeholder="Send a message" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
            <button onClick={() => void sendChat()} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Send</button>
          </div>
          {statusText && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">{statusText}</div>}
          <div className="max-h-[560px] space-y-3 overflow-auto pr-1">
            {chat.map((entry) => (
              <div key={entry.id} className={`rounded-2xl border p-3 ${entry.highlighted ? "border-yellow-400/30 bg-yellow-400/10" : "border-white/10 bg-white/5"}`}>
                <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
                  <span className="font-semibold text-white">{entry.username}</span>
                  <span>{formatClock(entry.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-200">{entry.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0b0b12]/95 px-4 py-4 backdrop-blur">
        <div
          ref={swipeTrackRef}
          className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] border border-yellow-400/30 bg-gradient-to-r from-yellow-400/20 via-white/10 to-white/5 p-2 shadow-2xl shadow-black/40"
          onPointerDown={(event) => handleSwipeStart(event.clientX)}
          onPointerMove={(event) => handleSwipeMove(event.clientX)}
          onPointerUp={handleSwipeEnd}
          onPointerCancel={handleSwipeEnd}
          onPointerLeave={handleSwipeEnd}
        >
          <div className="relative flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-[#141420] px-3 py-3">
            <div
              className={`absolute left-2 top-1/2 flex h-[calc(100%-8px)] w-24 -translate-y-1/2 items-center justify-center rounded-[1.15rem] bg-yellow-400 text-sm font-black text-black transition-all duration-200 ${swipeState === "success" ? "scale-105" : ""}`}
              style={{ transform: `translateX(${swipeOffset}px) translateY(-50%)` }}
            >
              {swipeState === "submitting" ? "Bidding..." : swipeState === "success" ? "Placed" : "Swipe"}
            </div>
            <div className="flex-1 pl-28 pr-2 text-center">
              <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Swipe to bid</div>
              <div className="text-lg font-black text-white">{swipeHint}</div>
              <div className="text-xs text-gray-500">Drag the handle all the way right to place the next $1 bid.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
