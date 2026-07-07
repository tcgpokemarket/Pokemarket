"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDiscoveryFeed, buildPostShowReplay, buildSellerCoPilotSuggestions, createMarketplaceSimulationSummary, getLiveShow, saveLiveShow, updateLiveShow, type LiveShowState } from "@/lib/live-commerce";
import type { LiveShow, LiveShowBid, LiveShowItem, LiveShowMessage } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import LiveKitStage from "@/components/LiveKitStage";

async function fetchLiveKitToken(roomName: string, identity: string) {
  const response = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data?.token === "string" ? data.token : null;
}

const QUICK_BIDS = [5, 10, 25, 50];
const QUICK_REACTIONS = ["🔥", "❤️", "⭐", "🚀"];
const AUCTION_STATES = ["upcoming", "live", "bidding_active", "locked", "sold"] as const;

type ShowStats = {
  activeBidders: number;
  totalSalesAmount: number;
  averageBidValue: number;
  viewerRetention: number;
};

function getCurrentItem(items: LiveShowState["items"]) {
  return items.find((item) => item.pinned && !item.sold) ?? items.find((item) => !item.sold) ?? items[0] ?? null;
}

function computeStats(show: LiveShowState): ShowStats {
  const soldItems = show.items.filter((item) => item.sold);
  const totalSalesAmount = soldItems.reduce((sum, item) => sum + item.currentBid, 0);
  const totalBids = show.items.reduce((sum, item) => sum + item.bidCount, 0);
  return {
    activeBidders: Math.max(1, new Set(show.chat.map((message) => message.user)).size),
    totalSalesAmount,
    averageBidValue: totalBids > 0 ? totalSalesAmount / totalBids : 0,
    viewerRetention: Math.min(100, 60 + soldItems.length * 5),
  };
}

function canSendChat(show: LiveShowState, message: string) {
  const blockedWords = show.hostSettings?.blockedWords ?? [];
  const lowered = message.toLowerCase();
  return !blockedWords.some((word) => lowered.includes(word.toLowerCase()));
}

function formatAuctionState(state?: string | null) {
  if (!state) return "upcoming";
  return state.replaceAll("_", " ");
}

function mapShowPayload(payload: { show: LiveShow; items?: LiveShowItem[]; chat?: LiveShowMessage[]; bids?: LiveShowBid[] }): LiveShowState {
  const items = (payload.items ?? []).map((item) => ({
    id: item.id,
    listingId: item.listing_id ?? undefined,
    title: item.title,
    subtitle: item.subtitle ?? undefined,
    imageUrl: item.image_url ?? undefined,
    startPrice: item.start_price,
    buyNowPrice: item.buy_now_price,
    currentBid: item.current_bid,
    bidCount: item.bid_count,
    auctionSeconds: item.auction_seconds,
    secondsLeft: item.seconds_left,
    pinned: item.pinned,
    sold: item.sold,
    auctionState: (item.sold ? "sold" : item.seconds_left > 0 ? "bidding_active" : "locked") as LiveShowState["items"][number]["auctionState"],
    winnerId: item.winner_id ?? null,
  })) as LiveShowState["items"];
  const chat = (payload.chat ?? []).map((message) => ({
    id: message.id,
    user: message.username,
    message: message.message,
    role: message.role as "viewer" | "seller" | "moderator" | undefined,
    highlighted: message.highlighted,
    createdAt: message.created_at,
    pinned: message.highlighted,
  }));
  const baseShowState = {
    id: payload.show.id,
    title: payload.show.title,
    format: "fixed_price_drop" as const,
    status: (payload.show.status === "live" ? "live" : "scheduled") as "scheduled" | "live",
    scheduledStart: payload.show.created_at,
    viewerCount: payload.show.viewer_count,
    peakViewers: payload.show.peak_viewers,
    engagementScore: payload.show.engagement_score,
    items,
    chat,
    topBidder: "",
    lastWinner: "",
    reactions: [],
    hostSettings: { mutedChat: false, slowModeSeconds: 0, bannedUsers: [], blockedWords: [], autoReconnect: true },
    auctionState: (payload.show.status === "live" ? "live" : "upcoming") as "upcoming" | "live",
    activeItemId: (payload.items ?? []).find((item) => item.pinned)?.id ?? null,
  };
  const showState = { ...baseShowState, stats: computeStats(baseShowState as LiveShowState) } satisfies LiveShowState;
  return showState;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.max(0, seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function LiveStage({ showId }: { showId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchLiveKitToken(`tcg-poke-market-${showId}`, `host-${showId}`)
      .then((nextToken) => {
        if (!alive) return;
        setToken(nextToken);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [showId]);

  if (loading) {
    return <div className="aspect-video rounded-2xl border border-white/10 bg-black/70 p-4 text-sm text-gray-300">Connecting to live room…</div>;
  }

  if (!token) {
    return <div className="aspect-video rounded-2xl border border-white/10 bg-black/70 p-4 text-sm text-gray-300">LiveKit room is not ready yet.</div>;
  }

  return <LiveKitStage token={token} roomName={`tcg-poke-market-${showId}`} />;
}

export default function LiveRoomPage() {
  const [show, setShow] = useState<LiveShowState | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [bidName, setBidName] = useState("CollectorKid");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    const initial = getLiveShow();
    setShow(initial);
    setSelectedItemId(initial.items[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser();
  }, []);

  useEffect(() => {
    if (!show) return;
    saveLiveShow(show);
  }, [show]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setShow((current) => {
        if (!current) return current;
        const next = updateLiveShow((state) => ({
          ...state,
          viewerCount: state.viewerCount + (Math.random() > 0.5 ? 1 : 0),
          peakViewers: Math.max(state.peakViewers, state.viewerCount),
          items: state.items.map((item) =>
            item.sold || item.secondsLeft <= 0
              ? item
              : { ...item, secondsLeft: Math.max(0, item.secondsLeft - 1) }
          ),
        }));
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const selectedItem = useMemo(
    () => show?.items.find((item) => item.id === selectedItemId) ?? show?.items[0] ?? null,
    [show, selectedItemId]
  );
  const rankedShows = useMemo(() => buildDiscoveryFeed(show ? [show] : []), [show]);
  const sellerCopilot = useMemo(() => (show ? buildSellerCoPilotSuggestions(show) : []), [show]);
  const replaySummary = useMemo(() => (show ? buildPostShowReplay(show) : null), [show]);
  const simulationSummary = useMemo(() => (show ? createMarketplaceSimulationSummary(show) : null), [show]);

  const placeBid = async (amount: number) => {
    if (!show || !selectedItem) return;
    const nextBid = Math.max(selectedItem.currentBid + amount, selectedItem.startPrice + amount);
    const nextShow = {
      ...show,
      topBidder: bidName,
      engagementScore: Math.min(100, show.engagementScore + 1),
      items: show.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              currentBid: nextBid,
              bidCount: item.bidCount + 1,
              secondsLeft: item.secondsLeft < 10 ? 10 : item.secondsLeft,
            }
          : item
      ),
      chat: [
        {
          id: crypto.randomUUID(),
          user: bidName,
          message: `Placed a bid of $${nextBid.toFixed(2)}`,
          role: "viewer" as const,
          highlighted: true,
          createdAt: new Date().toISOString(),
        },
        ...show.chat,
      ],
    } satisfies LiveShowState;
    setShow(nextShow);
  };

  const buyNow = async () => {
    if (!show || !selectedItem || !selectedItem.buyNowPrice) return;
    setShow({
      ...show,
      lastWinner: bidName,
      items: show.items.map((item) =>
        item.id === selectedItem.id ? { ...item, sold: true, secondsLeft: 0 } : item
      ),
      chat: [
        {
          id: crypto.randomUUID(),
          user: "TcgPoké Market",
          message: `${bidName} hit Buy Now on ${selectedItem.title}!`,
          role: "seller" as const,
          highlighted: true,
          createdAt: new Date().toISOString(),
        },
        ...show.chat,
      ],
    } satisfies LiveShowState);
  };

  const sendChat = async () => {
    if (!show || !chatInput.trim() || !canSendChat(show, chatInput.trim())) return;
    setShow({
      ...show,
      chat: [
        {
          id: crypto.randomUUID(),
          user: bidName,
          message: chatInput.trim(),
          role: "viewer" as const,
          createdAt: new Date().toISOString(),
        },
        ...show.chat,
      ],
    } satisfies LiveShowState);
    setChatInput("");
  };

  const toggleMuteChat = () => {
    if (!show) return;
    setShow({
      ...show,
      hostSettings: {
        ...(show.hostSettings ?? { mutedChat: false, slowModeSeconds: 0, bannedUsers: [], blockedWords: [], autoReconnect: true }),
        mutedChat: !(show.hostSettings?.mutedChat ?? false),
      },
    });
  };

  const toggleSlowMode = () => {
    if (!show) return;
    const current = show.hostSettings?.slowModeSeconds ?? 0;
    setShow({
      ...show,
      hostSettings: {
        ...(show.hostSettings ?? { mutedChat: false, slowModeSeconds: 0, bannedUsers: [], blockedWords: [], autoReconnect: true }),
        slowModeSeconds: current > 0 ? 0 : 10,
      },
    });
  };

  const pinNextItem = () => {
    if (!show || !selectedItem) return;
    setShow({
      ...show,
      activeItemId: selectedItem.id,
      items: show.items.map((item) => ({ ...item, pinned: item.id === selectedItem.id })),
      chat: [
        {
          id: crypto.randomUUID(),
          user: "TcgPoké Market",
          message: `Pinned ${selectedItem.title}.`,
          role: "seller" as const,
          highlighted: true,
          createdAt: new Date().toISOString(),
        },
        ...show.chat,
      ],
    });
  };

  const endCurrentItem = () => {
    if (!show || !selectedItem) return;
    setShow({
      ...show,
      items: show.items.map((item) => item.id === selectedItem.id ? { ...item, secondsLeft: 0, sold: item.sold || item.currentBid > 0 } : item),
      chat: [
        {
          id: crypto.randomUUID(),
          user: "TcgPoké Market",
          message: `${selectedItem.title} is now closed.`,
          role: "seller" as const,
          highlighted: true,
          createdAt: new Date().toISOString(),
        },
        ...show.chat,
      ],
    });
  };

  const sendReaction = (emoji: string) => {
    if (!show) return;
    setShow({
      ...show,
      reactions: [
        { id: crypto.randomUUID(), type: emoji === "🔥" ? "fire" : emoji === "❤️" ? "heart" : emoji === "⭐" ? "star" : "hype", createdAt: new Date().toISOString() },
        ...(show.reactions ?? []),
      ],
      engagementScore: Math.min(100, show.engagementScore + 1),
    });
  };


  if (!show) {
    return <div className="min-h-screen bg-[#0f0f1a] text-white" />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#0f0f1a]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span>TCG</span>
            <span className="text-yellow-400">Poke</span>
            <span>Market</span>
          </a>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 font-semibold text-red-300">LIVE</span>
            <span>{show.viewerCount} viewers</span>
            <span>• Peak {show.peakViewers}</span>
          </div>
        </div>
      </nav>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.5fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-yellow-400">Live show</p>
                <h1 className="text-3xl font-black">{show.title}</h1>
                <p className="mt-1 text-sm text-gray-400">{show.format.replaceAll("_", " ")}</p>
              </div>
              <div className="text-right text-sm text-gray-300">
                <div>Engagement</div>
                <div className="text-2xl font-black text-yellow-400">{show.engagementScore}</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                <LiveStage showId={show.id} />
                <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold">
                  Stream latency target: <span className="text-yellow-400">sub-3s</span>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                  <div className="rounded-2xl bg-black/70 p-3 text-sm">
                    <div className="text-gray-400">Current item</div>
                    <div className="font-bold">{selectedItem?.title}</div>
                    <div className="text-gray-400">Timer: {formatTime(selectedItem?.secondsLeft ?? 0)}</div>
                  </div>
                  <div className="rounded-2xl bg-black/70 p-3 text-right text-sm">
                    <div className="text-gray-400">Top bidder</div>
                    <div className="font-bold text-yellow-400">{show.topBidder || "—"}</div>
                    <div className="text-gray-400">Bid history updating live</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
                <div className="font-bold text-white">Live video stage</div>
                <p className="mt-1">The stage is ready for a real room when you connect a video provider, and the auction flow stays active below.</p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Pinned items</h2>
                <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 text-xs text-yellow-400">Seller control</span>
              </div>
              {show.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition-colors ${selectedItem?.id === item.id ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-xs text-gray-400">{item.subtitle}</div>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      <div>${item.currentBid.toFixed(2)}</div>
                      <div>{item.bidCount} bids</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <h2 className="mb-4 font-bold">Auction controls</h2>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_BIDS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => placeBid(amount)}
                    className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black transition-colors hover:bg-yellow-300"
                  >
                    +${amount}
                  </button>
                ))}
                <button onClick={buyNow} className="col-span-2 rounded-xl border border-white/20 px-4 py-3 font-semibold text-white hover:bg-white/5">
                  Buy Now
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
                <input
                  value={bidName}
                  onChange={(e) => setBidName(e.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
                  placeholder="Your bidder name"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <h2 className="mb-4 font-bold">Live show actions</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <button onClick={toggleMuteChat} className="rounded-xl border border-white/20 px-4 py-3 hover:bg-white/5">{show.hostSettings?.mutedChat ? "Unmute chat" : "Mute chat"}</button>
                <button onClick={toggleSlowMode} className="rounded-xl border border-white/20 px-4 py-3 hover:bg-white/5">{(show.hostSettings?.slowModeSeconds ?? 0) > 0 ? "Disable slow mode" : "Enable slow mode"}</button>
                <button onClick={pinNextItem} className="rounded-xl border border-white/20 px-4 py-3 hover:bg-white/5">Pin next item</button>
                <button onClick={endCurrentItem} className="rounded-xl border border-white/20 px-4 py-3 hover:bg-white/5">End item</button>
              </div>
              <p className="mt-3 text-xs text-gray-500">Live controls update the show state immediately in the browser.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <h2 className="font-bold">AI seller co-pilot</h2>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                {sellerCopilot.map((line) => (
                  <div key={line} className="rounded-xl border border-white/10 bg-white/5 p-3">{line}</div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <h2 className="font-bold">Discovery feed rank</h2>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                {rankedShows.map(({ show: rankedShow, score }) => (
                  <div key={rankedShow.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{rankedShow.title}</div>
                      <div className="text-xs text-gray-400">{rankedShow.viewerCount} viewers · {rankedShow.items.length} items</div>
                    </div>
                    <div className="text-sm font-bold text-yellow-400">{score}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <h2 className="font-bold">Post-show replay</h2>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">Replay available: {replaySummary?.replayAvailable ? "Yes" : "No"}</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">Unsold items: {replaySummary?.unsoldItems ?? 0}</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">Highlights saved: {replaySummary?.highlights.length ?? 0}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <h2 className="font-bold">Marketplace simulation</h2>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                {simulationSummary?.steps.map((step) => (
                  <div key={step.name} className={`rounded-xl border p-3 ${step.pass ? "border-green-400/30 bg-green-400/10" : "border-red-400/30 bg-red-400/10"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{step.name}</span>
                      <span>{step.pass ? "PASS" : "FAIL"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 rounded-3xl border border-white/10 bg-[#13131f] p-4">
          <div>
            <h2 className="font-bold">Live chat</h2>
            <p className="text-sm text-gray-400">Real-time overlay, reactions, and bidder highlights.</p>
          </div>

          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Send a message"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
            <button onClick={sendChat} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">
              Send
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {['🔥', '💎', '🙌', '⚡', '❤️'].map((emoji) => (
              <button key={emoji} onClick={() => sendReaction(emoji)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {emoji}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-white">Live reactions</span>
              <span>{show.reactions?.length ?? 0} total</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-lg">
              {(show.reactions ?? []).slice(0, 12).map((reaction) => (
                <span key={reaction.id} className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1">{reaction.type === 'fire' ? '🔥' : reaction.type === 'heart' ? '❤️' : reaction.type === 'star' ? '⭐' : '🚀'}</span>
              ))}
            </div>
          </div>

          <div className="max-h-[560px] space-y-3 overflow-auto pr-1">
            {show.chat.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl border p-3 ${message.highlighted ? "border-yellow-400/30 bg-yellow-400/10" : "border-white/10 bg-white/5"}`}
              >
                <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
                  <span className="font-semibold text-white">{message.user}</span>
                  <span>{message.createdAt}</span>
                </div>
                <p className="mt-1 text-sm text-gray-200">{message.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

