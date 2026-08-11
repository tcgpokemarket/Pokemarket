"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PaymentPage() {
  const params = useSearchParams();
  const listingId = params.get("listingId") ?? "";
  const quantity = Number(params.get("quantity") ?? "1");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function payWithWallet() {
    if (!listingId) return setMessage("Missing listing. Return to the listing and try again.");
    setLoading(true); setMessage("");
    try {
      const res = await fetch("/api/wallet/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId, quantity, idempotencyKey: `wallet-${listingId}-${quantity}` }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Wallet payment failed.");
      window.location.href = `/orders/${data.orderId}/thank-you`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet payment failed.");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-black">Payment</h1>
        <p className="mt-3 text-gray-400">Choose how you want to pay.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={payWithWallet} disabled={loading || !listingId} className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-5 text-left transition hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-50">
            <div className="text-lg font-black">Pay with Wallet</div>
            <div className="mt-1 text-sm text-white/60">Use your available TCG Poké Market balance.</div>
            <div className="mt-4 text-sm font-bold text-yellow-300">{loading ? "Processing…" : "Pay from balance"}</div>
          </button>
          <Link href={`/wallet${listingId ? `?returnTo=/checkout/payment?listingId=${encodeURIComponent(listingId)}&quantity=${quantity}` : ""}`} className="rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:bg-white/10">
            <div className="text-lg font-black">Add Money</div>
            <div className="mt-1 text-sm text-white/60">Top up your wallet with your connected Stripe payment method.</div>
            <div className="mt-4 text-sm font-bold">Open Wallet</div>
          </Link>
        </div>
        {message && <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{message}</div>}
        <Link href="/cart" className="mt-6 inline-block rounded-xl border border-white/10 px-4 py-2">Return to cart</Link>
      </div>
    </main>
  );
}
