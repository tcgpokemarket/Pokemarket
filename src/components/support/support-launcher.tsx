"use client";

import { useMemo, useState } from "react";

const PRESETS = [
  { label: "Order issue", category: "order_issue", summary: "I need help with my order status or shipping." },
  { label: "Seller help", category: "seller_question", summary: "I need help listing, fees, payouts, or seller tools." },
  { label: "Live auction", category: "live_auction_question", summary: "I need help with bidding or a live show." },
  { label: "Marketplace safety", category: "fraud_report", summary: "I want to report suspicious behavior or a scam concern." },
];

export default function SupportLauncher({ contextLabel }: { contextLabel: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("buyer_question");
  const [summary, setSummary] = useState("");

  const selectedPreset = useMemo(() => PRESETS.find((item) => item.category === category), [category]);

  async function submit() {
    const trimmed = summary.trim();
    if (!trimmed) return;

    setStatus("Creating support ticket…");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "support", category, issueSummary: trimmed }),
    });

    const payload = await response.json().catch(() => ({} as { error?: string; message?: string; ticketNumber?: string }));
    if (!response.ok) {
      setStatus(payload.error ?? "Unable to open support ticket");
      return;
    }

    setStatus(`${payload.ticketNumber ?? "Support"} created. ${payload.message ?? "AI support is reviewing it."}`);
    setSummary("");
    setOpen(false);
  }

  return (
    <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-gray-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-yellow-400">AI support for {contextLabel}</div>
          <div className="text-gray-300">Open a ticket from anywhere and keep human escalation available.</div>
        </div>
        <button onClick={() => setOpen((value) => !value)} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">
          {open ? "Close" : "Get help"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-[#13131f] p-4">
          <label className="block text-xs uppercase tracking-[0.2em] text-gray-500">Category</label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-white outline-none">
            <option value="buyer_question">Buyer question</option>
            <option value="seller_question">Seller question</option>
            <option value="order_issue">Order issue</option>
            <option value="shipping_issue">Shipping issue</option>
            <option value="refund_request">Refund request</option>
            <option value="live_auction_question">Live auction question</option>
            <option value="giveaway_question">Giveaway question</option>
            <option value="fraud_report">Safety report</option>
            <option value="payment_dispute">Payment dispute</option>
            <option value="legal_complaint">Legal complaint</option>
            <option value="general_question">General question</option>
          </select>

          {selectedPreset ? <div className="text-xs text-gray-400">Suggested prompt: {selectedPreset.summary}</div> : null}

          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            placeholder="Describe what you need help with"
            className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
          />

          <div className="flex items-center justify-between gap-3">
            <a href="/messages" className="text-xs font-semibold text-yellow-400 hover:underline">Open inbox</a>
            <button onClick={submit} disabled={!summary.trim()} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black disabled:opacity-50">
              Submit ticket
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 text-xs text-gray-400">{status ?? "AI replies follow marketplace policy and escalate sensitive issues to humans."}</div>
    </div>
  );
}
