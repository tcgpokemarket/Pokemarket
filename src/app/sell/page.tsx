"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SellerVerificationStatusCard from "@/components/seller/verification-status-card";
import { getAppRole } from "@/lib/security";
import { getEffectiveSellerVerificationStatus, type SellerVerificationStatus } from "@/lib/seller-verification";
import type { User } from "@supabase/supabase-js";

type VerificationRow = {
  status?: SellerVerificationStatus | null;
  rejection_reason?: string | null;
  more_information_request?: string | null;
  verified_at?: string | null;
};

const CONDITIONS = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"];

export default function SellPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<SellerVerificationStatus | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationRow | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isAdmin = getAppRole(currentUser) === "admin" || getAppRole(currentUser) === "super_admin";
  const effectiveVerificationStatus = getEffectiveSellerVerificationStatus(currentUser, verificationStatus);
  const canSell = isAdmin || effectiveVerificationStatus === "approved";
  const hideVerificationUi = isAdmin;
  const blockSelling = !canSell;

  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [form, setForm] = useState({
    card_name: "",
    set_name: "",
    card_number: "",
    rarity: "",
    condition: "Near Mint",
    price: "",
    quantity: "1",
    description: "",
    status: "active",
  });

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/auth?redirectTo=/sell");
        return;
      }

      if (!active) return;

      setUserId(user.id);
      setCurrentUser(user);
      const { data } = await supabase.from("seller_verifications").select("status, rejection_reason, more_information_request, verified_at").eq("user_id", user.id).maybeSingle();
      const verification = data as VerificationRow | null;
      setVerificationStatus(getEffectiveSellerVerificationStatus(user, verification?.status ?? "not_started"));
      setVerificationData(verification ? {
        rejection_reason: verification.rejection_reason,
        more_information_request: verification.more_information_request,
        verified_at: verification.verified_at,
      } : null);
    });

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !userId || !supabase) {
      setMessage({ type: "error", text: "Please wait for your account to finish loading." });
      return;
    }
    setUploading(true);

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const { uploadImageFile } = await import("@/lib/uploads");
      const uploaded = await uploadImageFile({ supabase, target: "listing", ownerId: userId, file });
      urls.push(uploaded.publicUrl);
    }
    setImageUrls((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !supabase) {
      setMessage({ type: "error", text: "Please wait for your account to finish loading." });
      return;
    }
    setLoading(true);
    setMessage(null);

    const payload = {
      card_name: form.card_name,
      set_name: form.set_name,
      card_number: form.card_number || null,
      rarity: form.rarity || null,
      condition: form.condition,
      price: parseFloat(form.price),
      quantity: parseInt(form.quantity),
      description: form.description || null,
      shipping_profile_id: null,
      shipping_paid_by: "seller",
      weight_oz: 1,
      package_type: "card envelope",
      images: imageUrls,
      status: form.status,
    };

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to create listing." });
      } else if (data.listing?.id) {
        router.push(`/listings/${data.listing.id}`);
      } else {
        setMessage({ type: "error", text: "Publish failed. Please try again." });
      }
    } catch {
      setMessage({ type: "error", text: "Publish failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/listings" className="text-sm text-gray-300 hover:text-white">Browse</a>
            <a href="/dashboard" className="text-sm text-gray-300 hover:text-white">Dashboard</a>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 pb-14 pt-20 sm:px-6 sm:pt-24">
        <div className="mb-5 space-y-3">
          <h1 className="text-2xl font-black sm:text-3xl">Create a Listing</h1>
          <p className="max-w-xl text-sm leading-6 text-gray-400">A tighter form keeps the important fields above the fold and leaves the marketplace logic untouched.</p>
          {!hideVerificationUi && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <SellerVerificationStatusCard
                status={verificationStatus}
                rejectionReason={verificationData?.rejection_reason}
                moreInfo={verificationData?.more_information_request}
                verifiedAt={verificationData?.verified_at}
              />
              {verificationStatus !== "approved" && <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">Verification is required to publish listings.</div>}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Card / Product Name *</label>
                <input name="card_name" value={form.card_name} onChange={handleChange} required placeholder="e.g. Charizard ex" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Set *</label>
                <input name="set_name" value={form.set_name} onChange={handleChange} required placeholder="e.g. Obsidian Flames" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Card Number</label>
                <input name="card_number" value={form.card_number} onChange={handleChange} placeholder="e.g. 125/197" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Language</label>
                <input name="rarity" value={form.rarity} onChange={handleChange} placeholder="e.g. English" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Condition *</label>
                <select name="condition" value={form.condition} onChange={handleChange} className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none">
                  {CONDITIONS.map((condition) => <option key={condition} value={condition} className="bg-gray-900">{condition}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Quantity *</label>
                <input name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange} required className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Price ($) *</label>
                <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required placeholder="0.00" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Shipping Options</label>
                <input value="Standard shipping handled at checkout" readOnly className="w-full rounded-xl border border-white/20 bg-[#101522] px-4 py-3 text-sm text-gray-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Describe condition, pulls, shipping notes..." className="w-full resize-none rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Upload Images</label>
            <input type="file" multiple onChange={handleImageUpload} className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300" />
            {uploading && <p className="mt-2 text-xs text-gray-500">Uploading images...</p>}
            {imageUrls.length > 0 && <p className="mt-2 text-xs text-gray-500">{imageUrls.length} image(s) ready</p>}
          </div>

          {message && (
            <div className={`rounded-xl border p-4 text-sm ${message.type === "error" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-green-500/20 bg-green-500/10 text-green-400"}`}>
              {message.text}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={() => router.back()} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-gray-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={loading || blockSelling} className="flex-1 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">{loading ? "Publishing..." : canSell ? "Publish Listing" : "Verification Required"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
