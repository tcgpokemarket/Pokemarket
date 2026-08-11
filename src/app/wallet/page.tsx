"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Wallet = { balance: number; stripe_customer_id: string | null };
type Entry = { id: string; entry_type: string; amount: number; balance_after: number; description: string | null; created_at: string };
type Card = { id: string; brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null };

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, stripe_customer_id: null });
  const [ledger, setLedger] = useState<Entry[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [amount, setAmount] = useState("25");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const [walletRes, cardsRes] = await Promise.all([fetch("/api/wallet", { cache: "no-store" }), fetch("/api/wallet/payment-methods", { cache: "no-store" })]);
    if (walletRes.ok) { const data = await walletRes.json(); setWallet({ balance: Number(data.wallet?.balance ?? 0), stripe_customer_id: data.wallet?.stripe_customer_id ?? null }); setLedger(data.ledger ?? []); }
    if (cardsRes.ok) setCards((await cardsRes.json()).payment_methods ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function topUp() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1 || value > 1000) { setMessage("Enter an amount from $1 to $1,000."); return; }
    setBusy(true); setMessage("");
    const res = await fetch("/api/wallet/topup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: value }) });
    const data = await res.json();
    if (res.ok && data.url) window.location.assign(data.url); else setMessage(data.error ?? "Unable to start wallet top-up.");
    setBusy(false);
  }

  async function connectCard() {
    setBusy(true); setMessage("");
    const res = await fetch("/api/wallet/connect-card", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.url) window.location.assign(data.url); else setMessage(data.error ?? "Unable to connect card.");
    setBusy(false);
  }

  return <main className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white"><div className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-center justify-between"><div><p className="text-sm uppercase tracking-widest text-yellow-400">Wallet</p><h1 className="mt-2 text-4xl font-black">Your balance</h1></div><Link href="/profile" className="rounded-xl border border-white/10 px-4 py-2">Profile</Link></div>
    {message && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm">{message}</div>}
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-white/50">Available balance</p><p className="mt-2 text-5xl font-black text-yellow-400">${wallet.balance.toFixed(2)}</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3" aria-label="Wallet top-up amount"/><button disabled={busy} onClick={topUp} className="rounded-xl bg-yellow-400 px-5 py-3 font-black text-black">Add money</button></div><p className="mt-2 text-xs text-white/40">Money is added only after Stripe confirms the payment.</p></section>
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Saved cards</h2><p className="mt-1 text-sm text-white/50">Cards are stored by Stripe; TCG Poke Market never receives full card numbers.</p></div><button disabled={busy} onClick={connectCard} className="rounded-xl border border-white/10 px-4 py-2 font-semibold">Connect card</button></div><div className="mt-5 space-y-3">{cards.length ? cards.map((card) => <div key={card.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-semibold">{card.brand ? card.brand.toUpperCase() : "CARD"} •••• {card.last4}</span><span className="text-sm text-white/50">{card.exp_month}/{card.exp_year}</span></div>) : <p className="text-sm text-white/50">No saved cards yet.</p>}</div></section>
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-black">Wallet activity</h2><div className="mt-5 space-y-3">{loading ? <p className="text-sm text-white/50">Loading...</p> : ledger.length ? ledger.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4"><div><p className="font-semibold">{entry.description ?? entry.entry_type}</p><p className="text-xs text-white/40">{new Date(entry.created_at).toLocaleString()}</p></div><div className="text-right"><p className="font-bold">{entry.entry_type === "purchase" || entry.entry_type === "hold" ? "-" : "+"}${Number(entry.amount).toFixed(2)}</p><p className="text-xs text-white/40">Balance ${Number(entry.balance_after).toFixed(2)}</p></div></div>) : <p className="text-sm text-white/50">No wallet activity yet.</p>}</div></section>
  </div></main>;
}
