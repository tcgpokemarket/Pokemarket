"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SellerVerificationStatusCard from "@/components/seller/verification-status-card";
import type { SellerVerificationStatus } from "@/lib/seller-verification";
type VerificationRow = {
  status?: SellerVerificationStatus | null;
  rejection_reason?: string | null;
  more_information_request?: string | null;
  verified_at?: string | null;
};

const CONDITIONS = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"];
const CATEGORIES = [
  { value: "single", label: "Single Card" },
  { value: "sealed", label: "Sealed Product" },
  { value: "graded", label: "Graded Card" },
  { value: "accessory", label: "Accessory / Supply" },
];
const GRADE_COMPANIES = ["", "PSA", "BGS", "CGC"];

export default function SellPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<SellerVerificationStatus | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationRow | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [priceGuideLoading, setPriceGuideLoading] = useState(false);
  const [priceGuideError, setPriceGuideError] = useState<string | null>(null);

  const [form, setForm] = useState({
    card_name: "",
    set_name: "",
    card_number: "",
    rarity: "",
    condition: "Near Mint",
    category: "single",
    price: "",
    quantity: "1",
    description: "",
    grade_company: "",
    grade_score: "",
    status: "active",
    weight_oz: "1",
    package_type: "card envelope",
  });

  const shippingTypes = [
    { value: "card envelope", label: "Card envelope", helper: "Best for singles and PWE-eligible mail." },
    { value: "bubble mailer", label: "Bubble mailer", helper: "Best for small protected shipments." },
    { value: "box", label: "Box", helper: "Best for larger or multi-item packages." },
  ] as const;

  useEffect(() => {
    const client = createClient();
    setSupabase(client);
    client.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/auth?redirectTo=/sell");
        return;
      }

      setUserId(user.id);
      const { data } = await client.from("seller_verifications").select("status, rejection_reason, more_information_request, verified_at").eq("user_id", user.id).maybeSingle();
      const verification = data as VerificationRow | null;
      setVerificationStatus(verification?.status ?? "not_started");
      setVerificationData(verification ? {
        rejection_reason: verification.rejection_reason,
        more_information_request: verification.more_information_request,
        verified_at: verification.verified_at,
      } : null);
    });
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const fetchPriceGuide = async () => {
    if (!form.card_name || !form.set_name) return;
    setPriceGuideLoading(true);
    setPriceGuideError(null);
    try {
      const { fetchCardPrice } = await import("@/lib/prices");
      const price = await fetchCardPrice(form.card_name, form.set_name);
      setMarketPrice(price.marketPrice);
    } catch {
      setPriceGuideError("Unable to load price guidance right now.");
    } finally {
      setPriceGuideLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !userId || !supabase) return;
    setUploading(true);

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `listings/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setImageUrls((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !supabase) return;
    setLoading(true);
    setMessage(null);

    const payload = {
      card_name: form.card_name,
      set_name: form.set_name,
      card_number: form.card_number || null,
      rarity: form.rarity || null,
      condition: form.condition,
      category: form.category,
      price: parseFloat(form.price),
      quantity: parseInt(form.quantity),
      description: form.description || null,
      grade_company: form.grade_company || null,
      grade_score: form.grade_score ? parseFloat(form.grade_score) : null,
      images: imageUrls,
      status: form.status,
      weight_oz: Number(form.weight_oz || 0),
      package_type: form.package_type,
    };

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Failed to create listing." });
    } else {
      router.push(`/listings/${data.listing.id}`);
    }
    setLoading(false);
  };

  const isGraded = form.category === "graded";

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f1a]/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2 font-black text-xl">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/listings" className="text-gray-300 hover:text-white text-sm">Browse</a>
            <a href="/dashboard" className="text-gray-300 hover:text-white text-sm">Dashboard</a>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 max-w-2xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">Create a Listing</h1>
          <p className="text-gray-400">List your cards and sealed products for collectors who want clear details, fair pricing, and fast checkout.</p>
          <div className="mt-4 space-y-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
            <SellerVerificationStatusCard
              status={verificationStatus}
              rejectionReason={verificationData?.rejection_reason}
              moreInfo={verificationData?.more_information_request}
              verifiedAt={verificationData?.verified_at}
            />
            {verificationStatus !== "approved" && (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
                Selling is locked until identity verification is approved. You can still prepare your listing here, but publishing will stay disabled.
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-yellow-400">Competitive seller fees</div>
              <p className="mt-1 text-sm text-gray-300">
                Escrow stays in place until a seller reaches 1,000 successful completed sales. After that, instant payout can unlock if the account is not flagged.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">Price guidance</div>
                  <p className="mt-1 text-xs text-gray-500">Compare against market data before you publish.</p>
                </div>
                <button
                  type="button"
                  onClick={fetchPriceGuide}
                  disabled={priceGuideLoading || !form.card_name || !form.set_name}
                  className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-400/20 disabled:opacity-50"
                >
                  {priceGuideLoading ? "Loading..." : "Get price guide"}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-[#0f0f1a] px-3 py-2">
                <span className="text-gray-400">Suggested market price</span>
                <span className="font-semibold">{marketPrice !== null ? `$${marketPrice.toFixed(2)}` : "Enter item details"}</span>
              </div>
              {priceGuideError && <p className="mt-2 text-xs text-red-400">{priceGuideError}</p>}
            </div>
            <a href="/sell/onboarding" className="inline-block text-sm font-semibold text-yellow-400 hover:underline">
              New seller onboarding guide →
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="font-bold text-lg">Card Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Card / Product Name *</label>
                <input name="card_name" value={form.card_name} onChange={handleChange} required placeholder="e.g. Charizard ex" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Set Name *</label>
                <input name="set_name" value={form.set_name} onChange={handleChange} required placeholder="e.g. Obsidian Flames" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Card Number</label>
                <input name="card_number" value={form.card_number} onChange={handleChange} placeholder="e.g. 125/197" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Rarity</label>
                <input name="rarity" value={form.rarity} onChange={handleChange} placeholder="e.g. Special Illustration Rare" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5 font-medium">Category *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${form.category === c.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-white/20 text-gray-400 hover:border-white/40"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {isGraded && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Grading Company</label>
                  <select name="grade_company" value={form.grade_company} onChange={handleChange} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-400">
                    {GRADE_COMPANIES.map((g) => <option key={g} value={g} className="bg-gray-900">{g || "Select..."}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Grade Score</label>
                  <input name="grade_score" type="number" step="0.5" min="1" max="10" value={form.grade_score} onChange={handleChange} placeholder="e.g. 9.5" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-300 mb-1.5 font-medium">Images</label>
              <input type="file" multiple onChange={handleImageUpload} className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300" />
              {uploading && <p className="mt-2 text-xs text-gray-500">Uploading images...</p>}
              {imageUrls.length > 0 && <p className="mt-2 text-xs text-gray-500">{imageUrls.length} image(s) ready</p>}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="font-bold text-lg">Listing Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Condition *</label>
                <select name="condition" value={form.condition} onChange={handleChange} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-400">
                  {CONDITIONS.map((condition) => <option key={condition} value={condition} className="bg-gray-900">{condition}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Status *</label>
                <select name="status" value={form.status} onChange={handleChange} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-400">
                  <option value="active" className="bg-gray-900">Active</option>
                  <option value="draft" className="bg-gray-900">Draft</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5 font-medium">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Describe condition, pulls, shipping notes..." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400 resize-none" />
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold text-yellow-400">Shipping setup</div>
              <p className="mt-1 text-xs text-gray-500">Pick the product weight and package type. We’ll recommend USPS options automatically.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-gray-300">
                Product weight (oz)
                <input name="weight_oz" type="number" min="0" step="0.1" value={form.weight_oz} onChange={handleChange} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
              </label>
              <label className="block text-sm text-gray-300">
                Package type
                <select name="package_type" value={form.package_type} onChange={handleChange} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none">
                  {shippingTypes.map((type) => <option key={type.value} value={type.value} className="bg-gray-900">{type.label}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {shippingTypes.map((type) => (
                <div key={type.value} className={`rounded-xl border px-4 py-3 text-xs ${form.package_type === type.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-white/10 bg-[#13131f] text-gray-400"}`}>
                  <div className="font-semibold">{type.label}</div>
                  <div className="mt-1">{type.helper}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="font-bold text-lg">Pricing</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Price ($) *</label>
                <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required placeholder="0.00" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Quantity *</label>
                <input name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange} required className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-400" />
              </div>
            </div>

          </div>

          {message && (
            <div className={`rounded-xl p-4 text-sm ${message.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
              {message.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-4">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={loading || verificationStatus !== "approved"} className="px-6 py-3 rounded-xl bg-yellow-400 text-black font-bold hover:bg-yellow-300 disabled:opacity-50">{loading ? "Publishing..." : verificationStatus === "approved" ? "Publish Listing" : "Verification Required"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
