"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toCartItem } from "@/lib/cart";
import { addToCart } from "@/components/cart/CartClient";
import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/supabase/types";

type ListingWithSeller = Listing & {
  promotion_badge?: string | null;
  promotion_tier?: string | null;
  promoted_until?: string | null;
  profiles?: {
    id: string;
    username: string | null;
    seller_rating: number;
    total_sales: number;
    avatar_url: string | null;
  } | null;
};

const CONDITION_COLORS: Record<string, string> = {
  Mint: "text-emerald-400",
  "Near Mint": "text-green-400",
  "Lightly Played": "text-yellow-400",
  "Moderately Played": "text-orange-400",
  "Heavily Played": "text-red-400",
  Damaged: "text-gray-400",
};

export default function ListingDetailClient({ id, initialListing }: { id: string; initialListing: ListingWithSeller | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [listing, setListing] = useState<ListingWithSeller | null>(initialListing);
  const [loading, setLoading] = useState(!initialListing);
  const [buying, setBuying] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [offering, setOffering] = useState(false);
  const [contactingSeller, setContactingSeller] = useState(false);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [shared, setShared] = useState(false);
  const [offerStatus, setOfferStatus] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    if (initialListing) {
      import("@/lib/prices")
        .then(({ fetchCardPrice }) => fetchCardPrice(initialListing.card_name, initialListing.set_name))
        .then((price) => setMarketPrice(price.marketPrice));
    }

    // Shipping pricing is handled at checkout.
  }, [id, initialListing]);

  const listingUrl = typeof window !== "undefined" ? window.location.href : `/listings/${id}`;

  const handleBuy = async () => {
    if (!user) {
      router.push(`/auth?redirectTo=/listings/${id}`);
      return;
    }
    if (!supabase) return;
    setBuying(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id, quantity: 1 }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else {
      alert(data.error ?? "Checkout failed. Please try again.");
      setBuying(false);
    }
  };

  const handleAddToCart = () => {
    addToCart(toCartItem(activeListing, 1));
    router.push("/cart");
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: activeListing.card_name, text: `${activeListing.card_name} on TcgPoké Market`, url: listingUrl });
        setShared(true);
      } else {
        await navigator.clipboard.writeText(listingUrl);
        setShared(true);
        window.alert("Listing link copied to clipboard.");
      }
    } catch {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(listingUrl);
        setShared(true);
        window.alert("Listing link copied to clipboard.");
      }
    } finally {
      setSharing(false);
    }
  };

  const openContact = () => {
    setShowContactForm((current) => !current);
    setShowOfferForm(false);
    setShowReportForm(false);
  };

  const openOffer = () => {
    setShowOfferForm((current) => !current);
    setShowContactForm(false);
    setShowReportForm(false);
  };

  const openReport = () => {
    setShowReportForm((current) => !current);
    setShowOfferForm(false);
  };

  const handleContactSeller = async () => {
    if (!activeListing.profiles?.id) {
      setContactStatus("Seller contact is unavailable right now.");
      return;
    }
    if (!messageText.trim()) {
      setContactStatus("Add a message first.");
      return;
    }
    if (!user) {
      router.push(`/auth?redirectTo=/listings/${id}`);
      return;
    }

    setContactingSeller(true);
    setContactStatus("Sending message…");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: messageText.trim(),
        recipientId: activeListing.profiles.id,
        contextType: "listing",
        contextId: activeListing.id,
      }),
    });
    const data = await res.json();
    if (data.ok && data.conversationId) {
      setContactStatus("Message sent to the seller.");
      setShowContactForm(false);
      setMessageText("");
      router.push(`/messages/${data.conversationId}`);
      return;
    }
    setContactStatus(data.error ?? "Unable to contact seller right now.");
    setContactingSeller(false);
  };

  const handleMakeOffer = async () => {
    if (!activeListing.profiles?.id) {
      setOfferStatus("Seller contact is unavailable right now.");
      return;
    }
    if (!offerAmount.trim()) {
      setOfferStatus("Enter an offer amount.");
      return;
    }
    if (!user) {
      router.push(`/auth?redirectTo=/listings/${id}`);
      return;
    }

    const amount = Number.parseFloat(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setOfferStatus("Enter a valid dollar amount.");
      return;
    }

    setOffering(true);
    setOfferStatus("Sending offer…");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Offer $${amount.toFixed(2)}${offerNote.trim() ? ` — ${offerNote.trim()}` : ""}`,
        recipientId: activeListing.profiles.id,
        contextType: "listing_offer",
        contextId: activeListing.id,
      }),
    });
    const data = await res.json();
    if (data.ok && data.conversationId) {
      setOfferStatus("Offer sent to the seller.");
      setShowOfferForm(false);
      setOfferAmount("");
      setOfferNote("");
      router.push(`/messages/${data.conversationId}`);
      return;
    }
    setOfferStatus(data.error ?? "Unable to send offer right now.");
    setOffering(false);
  };

  const handleReportListing = async () => {
    if (!reportReason.trim()) {
      setReportStatus("Choose a reason first.");
      return;
    }
    if (!user) {
      router.push(`/auth?redirectTo=/listings/${id}`);
      return;
    }

    setReporting(true);
    setReportStatus("Submitting report…");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "support",
        category: "listing_issue",
        issueSummary: `Reported listing ${activeListing.card_name}`,
        priority: "normal",
        listingId: activeListing.id,
        sellerId: activeListing.seller_id,
        message: reportReason.trim(),
        details: reportDetails.trim(),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setReportStatus("Thanks — support has the report.");
      setShowReportForm(false);
      setReportReason("");
      setReportDetails("");
      return;
    }
    setReportStatus(data.error ?? "Unable to submit report right now.");
    setReporting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a]">
        <div className="text-lg text-gray-400 animate-pulse">Loading listing...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] text-center">
        <div>
          <div className="mb-4 text-6xl">🃏</div>
          <h2 className="mb-2 text-2xl font-bold">Listing not found</h2>
          <a href="/listings" className="text-yellow-400 hover:underline">Back to listings</a>
        </div>
      </div>
    );
  }

  const activeListing = listing;
  const conditionColor = CONDITION_COLORS[activeListing.condition] ?? "text-gray-400";
  const priceDiff = marketPrice ? ((activeListing.price - marketPrice) / marketPrice) * 100 : null;

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/listings" className="text-sm text-gray-300 hover:text-white">← Back to listings</a>
            <a href="/auth" className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">Sign In</a>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
          <div className="space-y-3">
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {activeListing.images?.length ? (
                <img src={activeListing.images[selectedImage]} alt={activeListing.card_name} className="h-full w-full object-contain p-3 sm:p-4" />
              ) : (
                <span className="text-7xl sm:text-8xl">🃏</span>
              )}
            </div>
            {activeListing.images && activeListing.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activeListing.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border transition-colors ${i === selectedImage ? "border-yellow-400" : "border-white/10"}`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]">
              <span className={conditionColor}>{activeListing.condition}</span>
              {activeListing.grade_company && <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black text-black">{activeListing.grade_company} {activeListing.grade_score}</span>}
              {activeListing.promotion_badge && <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black text-black">{activeListing.promotion_badge}</span>}
            </div>
            {activeListing.promoted_until && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-400">Promoted until {new Date(activeListing.promoted_until).toLocaleString()}</p>}
            {activeListing.promotion_tier && <p className="text-xs text-gray-500">Promotion tier: {activeListing.promotion_tier}</p>}
            <div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">{activeListing.card_name}</h1>
              <p className="mt-1 text-sm text-gray-400">{activeListing.set_name}{activeListing.card_number ? ` · #${activeListing.card_number}` : ""}{activeListing.rarity ? ` · ${activeListing.rarity}` : ""}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="flex items-end gap-3">
                <span className="text-3xl font-black sm:text-4xl">${activeListing.price.toFixed(2)}</span>
                {priceDiff !== null && <span className={`pb-1 text-xs font-semibold ${priceDiff > 5 ? "text-red-400" : priceDiff < -5 ? "text-green-400" : "text-gray-400"}`}>{priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}% vs market</span>}
              </div>
              <div className="mt-2 text-sm text-gray-300">{activeListing.quantity} available{marketPrice ? ` · Market avg $${marketPrice.toFixed(2)}` : ""}</div>
            </div>

            {activeListing.description && <p className="text-sm leading-6 text-gray-400">{activeListing.description}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button onClick={handleBuy} disabled={buying || activeListing.status !== "active" || activeListing.seller_id === user?.id} className="rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">{buying ? "Redirecting..." : activeListing.seller_id === user?.id ? "Your listing" : activeListing.status !== "active" ? "Sold" : "Buy Now"}</button>
              <button onClick={handleAddToCart} disabled={activeListing.status !== "active" || activeListing.seller_id === user?.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">Add to Cart</button>
              <button onClick={openOffer} disabled={activeListing.status !== "active" || activeListing.seller_id === user?.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">Make Offer</button>
              <button onClick={handleShare} disabled={sharing} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">{sharing ? "Sharing..." : shared ? "Link Copied" : "Share Listing"}</button>
              <button onClick={openReport} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Report Listing</button>
            </div>

            {showOfferForm ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#13131f] p-4 sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-white">Make an offer</p>
                  <p className="mt-1 text-sm text-gray-400">Send the seller a direct offer from this listing.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="number" step="0.01" min="0" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Offer amount" className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600" />
                  <input value={offerNote} onChange={(event) => setOfferNote(event.target.value)} placeholder="Optional note" className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleMakeOffer} disabled={offering} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">{offering ? "Sending..." : "Send Offer"}</button>
                  <button onClick={() => setShowOfferForm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white">Cancel</button>
                </div>
                {offerStatus ? <p className="text-sm text-gray-400">{offerStatus}</p> : null}
              </div>
            ) : null}

            {showContactForm ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#13131f] p-4 sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-white">Message the seller</p>
                  <p className="mt-1 text-sm text-gray-400">Ask a question about the card, shipping, or bundle options.</p>
                </div>
                <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} rows={4} placeholder="Hi, is this still available?" className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600" />
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleContactSeller} disabled={contactingSeller} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">{contactingSeller ? "Sending..." : "Send Message"}</button>
                  <button onClick={() => setShowContactForm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white">Cancel</button>
                </div>
                {contactStatus ? <p className="text-sm text-gray-400">{contactStatus}</p> : null}
              </div>
            ) : null}

            {showReportForm ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#13131f] p-4 sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-white">Report this listing</p>
                  <p className="mt-1 text-sm text-gray-400">Send this to support for review if something looks off.</p>
                </div>
                <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none">
                  <option value="">Select a reason</option>
                  <option value="Misleading listing">Misleading listing</option>
                  <option value="Prohibited item">Prohibited item</option>
                  <option value="Counterfeit concern">Counterfeit concern</option>
                  <option value="Spam or scam">Spam or scam</option>
                  <option value="Other issue">Other issue</option>
                </select>
                <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={4} placeholder="Add any extra details for support." className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600" />
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleReportListing} disabled={reporting} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">{reporting ? "Submitting..." : "Submit Report"}</button>
                  <button onClick={() => setShowReportForm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white">Cancel</button>
                </div>
                {reportStatus ? <p className="text-sm text-gray-400">{reportStatus}</p> : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div>
                <p className="text-sm font-semibold text-white">Seller</p>
                <p className="text-sm text-gray-400">{activeListing.profiles?.username ?? "Seller"}</p>
              </div>
              <div className="text-right text-sm text-gray-400">
                {activeListing.profiles?.seller_rating ? <div className="text-yellow-400">★ {activeListing.profiles.seller_rating.toFixed(1)}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
