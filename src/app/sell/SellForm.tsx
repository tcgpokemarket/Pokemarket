"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CONDITIONS = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"] as const;
const CATEGORIES = [
  { value: "single", label: "Single Card" },
  { value: "sealed", label: "Sealed Product" },
  { value: "graded", label: "Graded Card" },
  { value: "accessory", label: "Accessory / Supply" },
] as const;

export default function SellForm() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

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
    status: "active",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage({ type: "error", text: "Please sign in to create a listing." });
      setLoading(false);
      return;
    }

    const price = parseFloat(form.price);
    const quantity = parseInt(form.quantity, 10);

    if (!form.card_name.trim() || !form.set_name.trim()) {
      setMessage({ type: "error", text: "Card name and set name are required." });
      setLoading(false);
      return;
    }
    if (!isFinite(price) || price <= 0) {
      setMessage({ type: "error", text: "Please enter a valid price greater than $0." });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_name: form.card_name.trim(),
          set_name: form.set_name.trim(),
          card_number: form.card_number.trim() || null,
          rarity: form.rarity.trim() || null,
          condition: form.condition,
          category: form.category,
          price,
          quantity: isFinite(quantity) ? Math.max(1, quantity) : 1,
          description: form.description.trim() || null,
          images: [],
          status: form.status,
        }),
      });

      const data = await response.json().catch(() => ({})) as { listing?: { id: string }; error?: string };

      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to create listing. Please try again." });
        return;
      }

      if (data.listing?.id) {
        router.push(`/listings/${data.listing.id}`);
      } else {
        setMessage({ type: "success", text: "Listing created!" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Card / Product Name *</label>
        <input
          name="card_name"
          value={form.card_name}
          onChange={handleChange}
          required
          placeholder="e.g. Charizard ex"
          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Set Name *</label>
          <input
            name="set_name"
            value={form.set_name}
            onChange={handleChange}
            required
            placeholder="e.g. Obsidian Flames"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Card Number</label>
          <input
            name="card_number"
            value={form.card_number}
            onChange={handleChange}
            placeholder="e.g. 125/197"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Category *</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/20 bg-[#13131f] px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Condition *</label>
          <select
            name="condition"
            value={form.condition}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/20 bg-[#13131f] px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Price ($) *</label>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0.01"
            value={form.price}
            onChange={handleChange}
            required
            placeholder="0.00"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Quantity *</label>
          <input
            name="quantity"
            type="number"
            min="1"
            value={form.quantity}
            onChange={handleChange}
            required
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          placeholder="Condition notes, centering, surface wear, etc."
          className="w-full resize-none rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
        />
      </div>

      {message && (
        <div className={`rounded-xl border p-3 text-sm ${message.type === "error" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-green-500/20 bg-green-500/10 text-green-400"}`}>
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-50"
      >
        {loading ? "Publishing…" : "Publish Listing"}
      </button>
    </form>
  );
}
