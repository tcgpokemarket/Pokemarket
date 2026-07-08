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
  const [auctionOrders, setAuctionOrders] = useState<Array<{ id: string; payment_status: string; payment_deadline: string; winning_bid: number; buyer_id: string; show_products?: { title?: string } | null }>>([]);
  const [showMode, setShowMode] = useState<"viewer" | "host">("viewer");
  const [moderatorLog, setModeratorLog] = useState<Array<{ id: string; event_type: string; payload: unknown; created_at: string }>>([]);
  const [monitorLayout, setMonitorLayout] = useState<"single" | "dual" | "video-only" | "controls-only">("single");
  const [streamHealth, setStreamHealth] = useState({ connection: "strong", cpu: "stable", network: "stable" });
  const activeAuctionOrder = auctionOrders[0] ?? null;
  const livePaymentStatus = activeAuctionOrder?.payment_status === "paid"
    ? "🟢 Paid — Ready to Ship"
    : activeAuctionOrder?.payment_status === "expired" || activeAuctionOrder?.payment_status === "failed"
      ? "🔴 Payment Failed"
      : "🟡 Awaiting Payment";
  const buyerTimer = activeAuctionOrder ? Math.max(0, new Date(activeAuctionOrder.payment_deadline).getTime() - Date.now()) : 0;
  const buyerTimerText = activeAuctionOrder ? `${String(Math.floor(buyerTimer / 60000)).padStart(2, "0")}:${String(Math.floor((buyerTimer % 60000) / 1000)).padStart(2, "0")}` : "15:00";
  const hostPermissions = Array.isArray((show as any).host_permissions) ? (show as any).host_permissions as string[] : [];
  const isHost = showMode === "host" && (show.seller_id === initialData.show.seller_id || hostPermissions.length > 0);
  const activeItem = useMemo(() => getActiveItem(products), [products]);
  const connectedViewers = Math.max(show.viewer_count, show.peak_viewers);
  const canShowHostControls = isHost;
  const showHostPanel = canShowHostControls && monitorLayout !== "video-only";
  const showViewerPanel = monitorLayout !== "controls-only";

  useEffect(() => {
    let mounted = true;
    const loadAuctionOrders = async () => {
      const response = await fetch(`/api/live/shows/${show.id}/auction-orders`);
      const data = await response.json().catch(() => ({}));
      if (mounted && response.ok) {
        setAuctionOrders((data.orders ?? []) as any);
      }
    };
    void loadAuctionOrders();
    const interval = setInterval(() => void loadAuctionOrders(), 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [show.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAuctionOrders((current) => [...current]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadModeratorLog = async () => {
      const response = await fetch(`/api/live/shows/${show.id}/events`);
      const data = await response.json().catch(() => ({}));
      if (mounted && response.ok) {
        setModeratorLog((data.events ?? []) as any);
      }
    };
    void loadModeratorLog();
    const interval = setInterval(() => void loadModeratorLog(), 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [show.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const connection = navigator.onLine ? "strong" : "offline";
      setStreamHealth((current) => ({
        connection,
        cpu: current.cpu,
        network: navigator.onLine ? "stable" : "degraded",
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);
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
  const activeGiveaway = useMemo(() => getActiveGiveaway(giveaways), [giveaways]);
  const roomName = `tcg-poke-market-${show.id}`;
  const swipeHint = activeItem ? `Swipe to bid $${getNextSwipeBid(Number(activeItem.current_bid ?? 0)).toFixed(2)}` : "Swipe to bid";
  const currentBid = Number(activeItem?.current_bid ?? 0);
  const nextBid = getNextSwipeBid(currentBid);
  const maxBidPreview = Number(maxBidAmount || 0);
  const isSwipeLocked = swipeState === "submitting" || Date.now() < swipeLockUntil.current;
  const auctionQueue = useMemo(() => [...products].sort((a, b) => Number(a.seconds_left ?? 0) - Number(b.seconds_left ?? 0)), [products]);
  const bidHistory = useMemo(() => bids.slice(0, 15), [bids]);
  const recentBidCount = bids.length;
  const bidderCount = useMemo(() => new Set(bids.map((bid) => bid.username)).size, [bids]);
  const pendingPayments = auctionOrders.filter((order) => order.payment_status === "payment_pending");
  const paidOrders = auctionOrders.filter((order) => order.payment_status === "paid");
  const paymentAlerts = pendingPayments.length;
  const streamWarnings = useMemo(() => [
    streamHealth.connection !== "strong" ? "Connection quality degraded" : null,
    streamHealth.cpu !== "stable" ? "CPU warning" : null,
    streamHealth.network !== "stable" ? "Network warning" : null,
  ].filter(Boolean) as string[], [streamHealth]);

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

  const updateShow = async (payload: Record<string, unknown>) => {
    const response = await fetch(`/api/live/shows/${show.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatusText(data.error ?? "Show update failed");
      return;
    }

    setStatusText("Show updated");
  };

  const fetchLiveEvent = async (eventType: string, payload: Record<string, unknown>) => {
    await fetch(`/api/live/shows/${show.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, payload }),
    });
  };

  const hostAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!canShowHostControls) return;
    await fetchLiveEvent(`host_${action}`, payload);
    setStatusText(`${action.replaceAll("_", " ")} saved`);
  };

  const removeBidder = async (bidderId: string) => {
    await hostAction("remove_bidder", { bidderId });
  };

  const muteUser = async (userId: string) => {
    await hostAction("mute_user", { userId });
  };

  const banUser = async (userId: string) => {
    await hostAction("ban_user", { userId });
  };

  const confirmWinner = async () => {
    await hostAction("confirm_winner", { itemId: activeItem?.id ?? null, orderId: activeAuctionOrder?.id ?? null });
  };

  const requestPayment = async () => {
    await hostAction("request_payment", { orderId: activeAuctionOrder?.id ?? null });
  };

  const moveNextItem = async () => {
    await hostAction("next_item", { itemId: auctionQueue[0]?.id ?? null });
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
    <div className="min-h-screen bg-[#0b0b12] text-white">
      <div className="border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-yellow-400">Dual-screen live auction</div>
            <div className="font-semibold text-white">{show.title}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowMode("viewer")} className={`rounded-full px-4 py-2 font-semibold ${showMode === "viewer" ? "bg-yellow-400 text-black" : "border border-white/10 bg-white/5"}`}>Viewer mode</button>
            <button onClick={() => setShowMode("host")} className={`rounded-full px-4 py-2 font-semibold ${showMode === "host" ? "bg-yellow-400 text-black" : "border border-white/10 bg-white/5"}`}>Host mode</button>
            <button onClick={() => setMonitorLayout("single")} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold">Single</button>
            <button onClick={() => setMonitorLayout("dual")} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold">Dual</button>
            <button onClick={() => setMonitorLayout("video-only")} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold">Video only</button>
            <button onClick={() => setMonitorLayout("controls-only")} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold">Controls only</button>
          </div>
        </div>
      </div>

      <div className={`mx-auto max-w-7xl gap-6 px-4 py-6 ${monitorLayout === "dual" ? "grid lg:grid-cols-[1.25fr_0.95fr]" : "grid lg:grid-cols-1"}`}>
        {showViewerPanel && (
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-widest text-yellow-400">Live show</p>
                  <h1 className="text-3xl font-black">{show.title}</h1>
                  <p className="mt-1 text-sm text-gray-400">{show.description ?? "Live auction show"}</p>
                </div>
                <div className="text-right text-sm text-gray-300">
                  <div>Status</div>
                  <div className="text-2xl font-black text-yellow-400">{show.status}</div>
                  <div className="mt-1 text-xs text-gray-500">Viewer count {connectedViewers}</div>
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                <div className="text-xs uppercase tracking-[0.3em] text-yellow-200">Payment status</div>
                <div className="mt-1 font-black text-white">{livePaymentStatus}</div>
                <div className="mt-1 text-yellow-100">Buyer payment window: {buyerTimerText}</div>
              </div>

              {activeGiveaway && (
                <div className="mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-yellow-200">Follow to Enter Giveaway</p>
                      <h2 className="text-xl font-black text-white">{activeGiveaway.prize_name}</h2>
                      <p className="text-sm text-yellow-100">{activeGiveaway.follow_required ? "Follow the seller to enter." : "Enter now while the giveaway is live."}</p>
                      <p className="text-xs text-yellow-200/80">Ends {formatClock(activeGiveaway.end_at)}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <button onClick={() => enterGiveaway(activeGiveaway.id, true)} disabled={giveawayBusy || Boolean(currentGiveawayState?.entered)} className="rounded-xl bg-yellow-400 px-4 py-3 font-black text-black disabled:opacity-60">{currentGiveawayState?.entered ? "Entered" : activeGiveaway.follow_required ? "Follow & Enter" : "Enter Giveaway"}</button>
                      <button onClick={() => enterGiveaway(activeGiveaway.id, false)} disabled={giveawayBusy || currentGiveawayState?.entered === true} className="text-xs font-semibold text-yellow-100 underline decoration-yellow-200/40 underline-offset-4 disabled:opacity-60">{showFollowPrompt ? "Follow first to enter" : "I already follow this seller"}</button>
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

              <div className="mt-4 rounded-2xl border border-white/10 bg-[#13131f] p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-xs uppercase tracking-widest text-gray-500">Card condition</div><div className="mt-1 text-sm font-semibold">{activeItem?.subtitle ?? "Not set"}</div></div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-xs uppercase tracking-widest text-gray-500">Highest bid</div><div className="mt-1 text-sm font-semibold text-yellow-400">${currentBid.toFixed(2)}</div></div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-xs uppercase tracking-widest text-gray-500">Countdown</div><div className="mt-1 text-sm font-semibold">{activeItem ? `${String(Math.floor(Number(activeItem.seconds_left ?? 0) / 60)).padStart(2, "0")}:${String(Math.floor(Number(activeItem.seconds_left ?? 0) % 60)).padStart(2, "0")}` : "00:00"}</div></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold">Watchlist</button>
                  <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold">Share</button>
                  <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold">View recent bids</button>
                  <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold">Payment confirmation</button>
                </div>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                <h2 className="font-bold">Buyer bids</h2>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  {bidHistory.map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                      <span>{bid.username}</span>
                      <span className="font-semibold text-yellow-400">${Number(bid.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  {!bidHistory.length && <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-gray-500">No bids yet.</div>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                <h2 className="font-bold">Viewer chat</h2>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  {chat.slice(-5).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3 text-xs text-gray-400"><span className="font-semibold text-white">{entry.username}</span><span>{formatClock(entry.created_at)}</span></div>
                      <p className="mt-1">{entry.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {showHostPanel && (
          <aside className="space-y-4 rounded-3xl border border-white/10 bg-[#13131f] p-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">Host control panel</div>
                  <div className="font-semibold text-white">Authorized controls only</div>
                </div>
                <div className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-100">{showMode}</div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button onClick={() => void updateShow({ status: "live", auction_state: "live" })} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">Start auction</button>
                <button onClick={() => void updateShow({ status: "live", auction_state: "locked" })} className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white">Pause auction</button>
                <button onClick={() => void updateShow({ status: "ended", auction_state: "sold" })} className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white">End auction</button>
                <button onClick={() => void moveNextItem()} className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white">Next item</button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-widest text-gray-500">Current highest bid</div>
                <div className="mt-2 text-2xl font-black text-yellow-400">${currentBid.toFixed(2)}</div>
                <div className="mt-1 text-sm text-gray-400">{bidderCount} bidders · {recentBidCount} bids</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-widest text-gray-500">Pending payment alerts</div>
                <div className="mt-2 text-2xl font-black text-yellow-400">{paymentAlerts}</div>
                <div className="mt-1 text-sm text-gray-400">{paidOrders.length} paid</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-widest text-gray-500">Connected viewers</div>
                <div className="mt-2 text-2xl font-black text-yellow-400">{connectedViewers}</div>
                <div className="mt-1 text-sm text-gray-400">Peak {show.peak_viewers}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-widest text-gray-500">Bidder count</div>
                <div className="mt-2 text-2xl font-black text-yellow-400">{bidderCount}</div>
                <div className="mt-1 text-sm text-gray-400">Unique bidders</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 font-bold">Auction queue</div>
              <div className="space-y-2">
                {auctionQueue.slice(0, 5).map((item, index) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{index + 1}. {item.title}</span>
                      <span className="text-gray-400">{item.seconds_left}s</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{item.subtitle}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 font-bold">Stream health</div>
              <div className="grid gap-2 text-sm text-gray-300">
                <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3">Connection quality: {streamHealth.connection}</div>
                <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3">CPU status: {streamHealth.cpu}</div>
                <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3">Network status: {streamHealth.network}</div>
                {streamWarnings.length > 0 && streamWarnings.map((warning) => <div key={warning} className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-yellow-100">{warning}</div>)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 font-bold">Moderator actions</div>
              <div className="space-y-3">
                {bidHistory.slice(0, 4).map((bid) => (
                  <div key={bid.id} className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>{bid.username}</span>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void removeBidder(bid.username)} className="rounded-full border border-white/10 px-3 py-1 text-xs">Remove bidder</button>
                        <button onClick={() => void muteUser(bid.username)} className="rounded-full border border-white/10 px-3 py-1 text-xs">Mute</button>
                        <button onClick={() => void banUser(bid.username)} className="rounded-full border border-red-400/20 px-3 py-1 text-xs text-red-200">Ban</button>
                      </div>
                    </div>
                  </div>
                ))}
                {!bidHistory.length && <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-gray-500">No bidders to moderate yet.</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 font-bold">Reserve and winner controls</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm">Reserve price indicator: {activeItem?.buy_now_price ? `Enabled at $${Number(activeItem.buy_now_price).toFixed(2)}` : "Not enabled"}</div>
                <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm">Payment status: {livePaymentStatus}</div>
                <button onClick={() => void confirmWinner()} className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white">Confirm winner</button>
                <button onClick={() => void requestPayment()} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">Request payment</button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 font-bold">Sound effects</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <button onClick={() => void hostAction("sound_effect", { effect: "bid" })} className="rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3">Bid ding</button>
                <button onClick={() => void hostAction("sound_effect", { effect: "win" })} className="rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3">Win sting</button>
                <button onClick={() => void hostAction("sound_effect", { effect: "giveaway" })} className="rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3">Giveaway</button>
                <button onClick={() => void hostAction("sound_effect", { effect: "alert" })} className="rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3">Alert</button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 font-bold">Moderator activity log</div>
              <div className="max-h-72 space-y-2 overflow-auto">
                {moderatorLog.map((event) => (
                  <div key={event.id} className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-white">{event.event_type}</span>
                      <span className="text-xs text-gray-500">{formatClock(event.created_at)}</span>
                    </div>
                    <pre className="mt-2 overflow-x-auto text-xs text-gray-400">{JSON.stringify(event.payload, null, 2)}</pre>
                  </div>
                ))}
                {!moderatorLog.length && <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-gray-500">No moderator actions yet.</div>}
              </div>
            </div>
          </aside>
        )}
      </div>

      {!showViewerPanel && !showHostPanel && (
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-gray-300">
          Select a screen layout to begin.
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0b0b12]/95 px-4 py-4 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto">
          <button onClick={() => setShowMode("viewer")} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold">Stream</button>
          <button onClick={() => setShowMode("host")} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold">Controls</button>
        </div>
      </div>
    </div>
  );
}
