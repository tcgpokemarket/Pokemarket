"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/uploads";

type ScanResult = {
  card_name: string;
  set_name: string;
  card_number: string | null;
  rarity: string | null;
  language: string | null;
  variant: string | null;
  category: string;
  title: string;
  description: string;
  confidence: number;
  estimated_price: number | null;
  low_price: number | null;
  high_price: number | null;
  source: string;
  source_image_url: string;
  draft?: {
    card_name: string;
    set_name: string;
    card_number: string | null;
    rarity: string | null;
    condition: string;
    category: string;
    price: number;
    quantity: number;
    description: string | null;
    images: string[];
    status: "active";
  };
};

function formatPrice(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : "Unavailable";
}

export default function ScanCardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/auth?redirectTo=/sell/scan");
    });
  }, [router, supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      setError("Choose a card photo first.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(`Please keep the file under ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB.`);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    setResult(null);
    setFileName(file.name);

    try {
      const payload = new FormData();
      payload.append("file", file);

      const response = await fetch("/api/sell/scan", {
        method: "POST",
        body: payload,
      });
      const data = await response.json().catch(() => ({} as { error?: string; result?: ScanResult }));

      if (!response.ok) {
        throw new Error(data.error ?? "Scan failed.");
      }

      setResult(data.result ?? null);
      setMessage("Scan complete. Review the draft and publish when ready.");
      event.currentTarget.reset();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  };

  const saveDraftToListingBuilder = () => {
    if (!result) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem("tcgpm:scan-card:draft", JSON.stringify({
      form: {
        card_name: result.card_name,
        set_name: result.set_name,
        card_number: result.card_number ?? "",
        rarity: result.rarity ?? "",
        condition: "Near Mint",
        category: result.category === "single" ? "single" : result.category === "sealed" ? "sealed" : result.category === "graded" ? "graded" : "accessory",
        grade_company: "",
        grade_score: "",
        price: (result.estimated_price ?? result.low_price ?? result.high_price ?? 0).toFixed(2),
        quantity: "1",
        description: result.description,
        status: "active",
      },
      imageUrls: [result.source_image_url],
      coverImageIndex: 0,
    }));
    router.push("/listings/create");
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 sm:px-6 lg:py-16">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-black/20">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">Seller scanner</div>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Scan a Pokémon card</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">Capture a card photo, identify the details, and turn it into a listing draft with one tap.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/5">Dashboard</Link>
            <Link href="/listings/create" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">Create listing</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-[#13131f] p-6 shadow-2xl shadow-black/20">
            <div className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Upload card image</div>
              <p className="text-sm text-gray-400">Use a clear photo of the front of the card for best recognition.</p>
            </div>
            <div className="mt-5 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-5">
              <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif" className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300" />
              <p className="mt-3 text-xs text-gray-500">Accepted: JPEG, PNG, WebP, GIF. Max {Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB.</p>
            </div>
            {message && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</div>}
            {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" disabled={loading} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">{loading ? "Scanning..." : "Scan Card"}</button>
              <button type="button" onClick={saveDraftToListingBuilder} disabled={!result} className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-bold text-yellow-300 hover:bg-yellow-400/20 disabled:opacity-50">Send to listing draft</button>
            </div>
            {fileName && <p className="mt-4 text-xs text-gray-500">Last file selected: {fileName}</p>}
          </form>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
            <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Scan results</div>
            {!result ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">Your scan results will appear here after upload.</div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#13131f]">
                  <div className="aspect-[4/3] bg-black/20">
                    <img src={result.source_image_url} alt={result.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-5">
                    <h2 className="text-2xl font-black">{result.title}</h2>
                    <p className="text-sm text-gray-400">{result.description}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Card name", result.card_name],
                    ["Set", result.set_name],
                    ["Card number", result.card_number ?? "—"],
                    ["Rarity", result.rarity ?? "—"],
                    ["Language", result.language ?? "—"],
                    ["Variant", result.variant ?? "—"],
                    ["Confidence", `${result.confidence}%`],
                    ["Price", formatPrice(result.estimated_price)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                      <div className="text-xs uppercase tracking-widest text-gray-500">{label}</div>
                      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5 text-sm text-gray-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Market source</span>
                    <span className="font-semibold text-white">{result.source}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span>Low / high</span>
                    <span className="font-semibold text-white">{formatPrice(result.low_price)} · {formatPrice(result.high_price)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={saveDraftToListingBuilder} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300">Send to listing draft</button>
                  <Link href="/sell" className="rounded-xl border border-white/20 px-4 py-3 text-sm text-gray-300 hover:bg-white/5">Back to listing builder</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
