"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MAX_IMAGE_SIZE_BYTES, uploadImageFile } from "@/lib/uploads";

const CONDITIONS = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"];
const CATEGORIES = [
  { value: "single", label: "Single Card" },
  { value: "sealed", label: "Sealed Product" },
  { value: "graded", label: "Graded Card" },
  { value: "accessory", label: "Accessory / Supply" },
];
const GRADE_COMPANIES = ["", "PSA", "BGS", "CGC"];

export default function CreateListingPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
    shipping_paid_by: "buyer",
  });

  const shippingOptions = [
    { value: "buyer", label: "Buyer pays shipping", description: "Adds shipping at checkout." },
    { value: "seller", label: "Seller pays shipping", description: "Shipping is covered by the seller." },
  ] as const;

  useEffect(() => {
    const client = createClient();
    setSupabase(client);
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/auth?redirectTo=/listings/create");
      else setUserId(user.id);
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
    setMessage(null);

    const nextUrls: string[] = [];
    const nextErrors: string[] = [];

    for (const file of Array.from(files)) {
      try {
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          throw new Error(`${file.name} is too large.`);
        }

        const uploaded = await uploadImageFile({
          supabase,
          target: "listing",
          ownerId: userId,
          file,
        });

        nextUrls.push(uploaded.publicUrl);
      } catch (error) {
        nextErrors.push(error instanceof Error ? error.message : `Failed to upload ${file.name}.`);
      }
    }

    setImageUrls((prev) => [...prev, ...nextUrls]);
    if (nextErrors.length) {
      setMessage({ type: "error", text: nextErrors.join(" ") });
    }

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
      shipping_paid_by: form.shipping_paid_by,
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

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Seller onboarding
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">Create a listing that feels premium.</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-gray-300">List your cards and sealed products for collectors who want clear details, fair pricing, and fast checkout.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Competitive seller fees",
                "Price guidance before you publish",
                "Collector-first listing flow",
                "Fast path to onboarding",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                  {item}
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5">
              <div className="text-sm font-semibold text-yellow-400">Competitive seller fees</div>
              <p className="text-sm text-gray-300">First 100 completed sales are fee-free for the marketplace fee. After that, fees start at 5%, with lower power seller tiers available.</p>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
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
              <a href="/sell/onboarding" className="inline-block text-sm font-semibold text-yellow-400 hover:underline">Seller onboarding guide →</a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="mb-6">
              <p className="text-sm uppercase tracking-widest text-yellow-400">Listing form</p>
              <h2 className="mt-2 text-2xl font-black">Publish your inventory</h2>
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
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${form.category === c.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-white/20 text-gray-400 hover:border-white/40"}`}
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
                  <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Describe condition, pulls, shipping notes..." className="w-full resize-none rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                <h2 className="font-bold text-lg">Pricing</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5 font-medium">Price ($) *</label>
                    <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required placeholder="0.00" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5 font-medium">Quantity *</label>
                    <input name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange} required className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400" />
                  </div>
                </div>

                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                  <div className="text-sm font-semibold text-yellow-400">Shipping payer</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {shippingOptions.map((option) => (
                      <button key={option.value} type="button" onClick={() => setForm((current) => ({ ...current, shipping_paid_by: option.value }))} className={`rounded-xl border px-4 py-3 text-left transition-colors ${form.shipping_paid_by === option.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-white/10 bg-[#13131f] text-gray-300 hover:border-white/20"}`}>
                        <div className="font-semibold">{option.label}</div>
                        <div className="mt-1 text-xs text-gray-500">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {message && (
                <div className={`rounded-xl border p-4 text-sm ${message.type === "error" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-green-500/20 bg-green-500/10 text-green-400"}`}>
                  {message.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-4">
                <button type="button" onClick={() => router.back()} className="rounded-xl border border-white/20 px-6 py-3 text-gray-300 hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-50">{loading ? "Publishing..." : "Publish Listing"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
