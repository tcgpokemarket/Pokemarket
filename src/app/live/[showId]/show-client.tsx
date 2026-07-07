"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LiveShowBid, LiveShowItem, LiveShowMessage, LiveShow } from "@/lib/supabase/types";
import LiveKitStage from "@/components/LiveKitStage";

const QUICK_BIDS = [1, 5, 10, 25];

function formatClock(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getActiveItem(items: LiveShowItem[]) {
  return items.find((item) => item.pinned && !item.sold) ?? items.find((item) => !item.sold) ?? items[0] ?? null;
}

export default function LiveShowClient({ initialData }: { initialData: { show: LiveShow; products: LiveShowItem[]; bids: LiveShowBid[]; chat: LiveShowMessage[] } }) {
  const supabase = useMemo(() => createClient(), []);
  const [show, setShow] = useState(initialData.show);
  const [products, setProducts] = useState<LiveShowItem[]>(initialData.products);
  const [bids, setBids] = useState<LiveShowBid[]>(initialData.bids);
  const [chat, setChat] = useState<LiveShowMessage[]>(initialData.chat);
  const [message, setMessage] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [statusText, setStatusText] = useState("");

  const activeItem = useMemo(() => getActiveItem(products), [products]);
  const roomName = `tcg-poke-market-${show.id}`;

  useEffect(() => {
    const showChannel = supabase
      .channel(`live-show:${show.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_shows", filter: `id=eq.${show.id}` }, (payload) => {
        if (payload.new) setShow(payload.new as LiveShow);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "show_products", filter: `show_id=eq.${show.id}` }, (payload) => {
        const product = payload.new as LiveShowItem;
        setProducts((current) => {
          const next = current.filter((item) => item.id !== product.id);
          next.push(product);
          return next.sort((a, b) => (a.id === activeItem?.id ? -1 : 0) - (b.id === activeItem?.id ? -1 : 0));
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_bids", filter: `show_id=eq.${show.id}` }, (payload) => {
        setBids((current) => [payload.new as LiveShowBid, ...current].slice(0, 100));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat", filter: `show_id=eq.${show.id}` }, (payload) => {
        setChat((current) => [...current, payload.new as LiveShowMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(showChannel);
    };
  }, [activeItem?.id, show.id, supabase]);

  useEffect(() => {
    const viewerId = setInterval(() => {
      void fetch(`/api/live/shows/${show.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "viewer_ping", payload: { lastSeenAt: new Date().toISOString() } }),
      });
    }, 30000);

    return () => clearInterval(viewerId);
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

  const sendBid = async (amount: number) => {
    if (!activeItem) return;
    const response = await fetch(`/api/live/shows/${show.id}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: activeItem.id, amount: Number(activeItem.current_bid ?? 0) + amount }),
    });

    if (response.ok) {
      setStatusText(`Bid placed on ${activeItem.title}`);
    } else {
      const data = await response.json().catch(() => ({}));
      setStatusText(data.error ?? "Bid failed");
    }
  };

  const startShow = async (nextStatus: string) => {
    await fetch(`/api/live/shows/${show.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, auction_state: nextStatus === "live" ? "live" : nextStatus }),
    });
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
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

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
              <LiveKitStage token={null} roomName={roomName} />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                <div className="rounded-2xl bg-black/70 p-3 text-sm">
                  <div className="text-gray-400">Current item</div>
                  <div className="font-bold">{activeItem?.title ?? "Waiting for auction"}</div>
                  <div className="text-gray-400">${Number(activeItem?.current_bid ?? 0).toFixed(2)}</div>
                </div>
                <div className="rounded-2xl bg-black/70 p-3 text-right text-sm">
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
                <button onClick={() => startShow("live")} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">Start show</button>
                <button onClick={() => startShow("ended")} className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white">End show</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {QUICK_BIDS.map((amount) => (
                  <button key={amount} onClick={() => sendBid(amount)} className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white hover:bg-white/5">+${amount}</button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Custom bid" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none" />
                <button onClick={() => sendBid(Number(bidAmount || 0))} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Bid</button>
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
          <div>
            <h2 className="font-bold">Live chat</h2>
            <p className="text-sm text-gray-400">Real buyers, real moderation, real-time updates.</p>
          </div>
          <div className="flex gap-2">
            <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Send a message" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
            <button onClick={sendChat} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Send</button>
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
    </div>
  );
}
