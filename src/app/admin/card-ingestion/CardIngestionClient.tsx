"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Batch = {
  id: string;
  created_at: string;
  status: string;
  original_file_count: number;
  processed_count: number;
  draft_count: number;
  published_count: number;
  duplicate_count: number;
  error_count: number;
  notes: string | null;
};

type ItemImage = {
  public_url: string;
  sort_order: number;
};

type Item = {
  id: string;
  batch_id: string;
  created_at: string;
  status: string;
  source_image_url: string;
  card_name: string | null;
  set_name: string | null;
  card_number: string | null;
  rarity: string | null;
  language: string | null;
  variant: string | null;
  category: string;
  title: string | null;
  description: string | null;
  likely_condition: string | null;
  condition_confidence: number | null;
  condition_notes: string | null;
  estimated_price: number | null;
  low_price: number | null;
  high_price: number | null;
  pricing_source: string | null;
  confidence_score: number | null;
  duplicate_listing_ids: string[];
  duplicate_summary: string[];
  review_notes: string | null;
  published_listing_id: string | null;
  error_message: string | null;
  ai_payload: unknown;
  card_ingestion_item_images?: ItemImage[];
};

type Props = {
  batches: Batch[];
  items: Item[];
};

type ItemDraft = {
  card_name: string;
  set_name: string;
  card_number: string;
  rarity: string;
  language: string;
  variant: string;
  title: string;
  description: string;
  likely_condition: string;
  condition_confidence: string;
  estimated_price: string;
  low_price: string;
  high_price: string;
  confidence_score: string;
  review_notes: string;
  status: string;
};

function statusTone(status: string) {
  switch (status) {
    case "published":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "ready_to_publish":
    case "ready":
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
    case "duplicate":
      return "border-orange-400/30 bg-orange-400/10 text-orange-200";
    case "failed":
    case "rejected":
      return "border-red-400/30 bg-red-400/10 text-red-200";
    case "processing":
      return "border-blue-400/30 bg-blue-400/10 text-blue-200";
    default:
      return "border-white/10 bg-white/5 text-gray-300";
  }
}

function toDraft(item: Item): ItemDraft {
  return {
    card_name: item.card_name ?? "",
    set_name: item.set_name ?? "",
    card_number: item.card_number ?? "",
    rarity: item.rarity ?? "",
    language: item.language ?? "",
    variant: item.variant ?? "",
    title: item.title ?? "",
    description: item.description ?? "",
    likely_condition: item.likely_condition ?? "Near Mint",
    condition_confidence: item.condition_confidence?.toString() ?? "",
    estimated_price: item.estimated_price?.toString() ?? "",
    low_price: item.low_price?.toString() ?? "",
    high_price: item.high_price?.toString() ?? "",
    confidence_score: item.confidence_score?.toString() ?? "",
    review_notes: item.review_notes ?? "",
    status: item.status,
  };
}

export default function CardIngestionClient({ batches, items }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>(() => Object.fromEntries(items.map((item) => [item.id, toDraft(item)])));
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selected.length;

  const refreshData = () => startTransition(() => router.refresh());

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = Array.from((form.getAll("files") as File[]).filter((file) => file && file.size > 0));
    if (!files.length) {
      setError("Choose one or more card images first.");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const uploadForm = new FormData();
      uploadForm.set("action", "upload");
      files.forEach((file) => uploadForm.append("files", file));
      const response = await fetch("/api/admin/card-ingestion", { method: "POST", body: uploadForm });
      const data = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setMessage(`Uploaded ${files.length} file(s) for analysis.`);
      (event.currentTarget as HTMLFormElement).reset();
      refreshData();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const updateDraft = (itemId: string, key: keyof ItemDraft, value: string) => {
    setDrafts((current) => {
      const fallback = items.find((item) => item.id === itemId);
      return {
        ...current,
        [itemId]: {
          ...(current[itemId] ?? (fallback ? toDraft(fallback) : {})),
          [key]: value,
        },
      };
    });
  };

  const saveItem = async (itemId: string) => {
    setBusyItemId(itemId);
    setError(null);
    setMessage(null);
    try {
      const draft = drafts[itemId];
      const response = await fetch(`/api/admin/card-ingestion/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_name: draft.card_name,
          set_name: draft.set_name,
          card_number: draft.card_number || null,
          rarity: draft.rarity || null,
          language: draft.language || null,
          variant: draft.variant || null,
          title: draft.title || null,
          description: draft.description || null,
          likely_condition: draft.likely_condition,
          condition_confidence: draft.condition_confidence ? Number(draft.condition_confidence) : null,
          estimated_price: draft.estimated_price ? Number(draft.estimated_price) : null,
          low_price: draft.low_price ? Number(draft.low_price) : null,
          high_price: draft.high_price ? Number(draft.high_price) : null,
          confidence_score: draft.confidence_score ? Number(draft.confidence_score) : null,
          review_notes: draft.review_notes || null,
          status: draft.status,
        }),
      });
      const data = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) throw new Error(data.error ?? "Save failed.");
      setMessage("Item saved.");
      refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setBusyItemId(null);
    }
  };

  const publishItems = async (itemIds: string[]) => {
    if (!itemIds.length) return;
    setError(null);
    setMessage(null);
    setBusyItemId("publish");
    try {
      const batchId = items.find((item) => itemIds.includes(item.id))?.batch_id ?? batches[0]?.id;
      if (!batchId) throw new Error("No batch available to publish.");
      const response = await fetch(`/api/admin/card-ingestion/batches/${batchId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds }),
      });
      const data = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) throw new Error(data.error ?? "Publish failed.");
      setMessage(`Published ${data.publishedListings?.length ?? 0} listing(s).`);
      setSelected([]);
      refreshData();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Publish failed.");
    } finally {
      setBusyItemId(null);
    }
  };

  const overrideDuplicate = async (itemId: string) => {
    const draft = drafts[itemId];
    if (!draft) return;
    setBusyItemId(itemId);
    setError(null);
    setMessage(null);
    try {
      await fetch(`/api/admin/card-ingestion/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready_to_publish", review_notes: draft.review_notes || null }),
      });
      setDrafts((current) => ({ ...current, [itemId]: { ...draft, status: "ready_to_publish" } }));
      setMessage("Duplicate override saved.");
      refreshData();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to override duplicate.");
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-widest text-yellow-400">AI card ingestion</p>
        <h1 className="mt-3 text-3xl font-black">Upload cards, review drafts, publish listings</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">Upload card photos, inspect AI results, fix any fields, and bulk publish approved listings from the admin queue.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#upload" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Upload images</a>
          <a href="#queue" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-gray-200">Review queue</a>
          <button type="button" onClick={refreshData} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-gray-200">Refresh</button>
        </div>
        {message ? <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
      </div>

      <div id="upload" className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">New batch</h2>
            <p className="mt-1 text-sm text-gray-400">Upload one or more card photos and the system will create an analyzed review queue automatically.</p>
          </div>
          <div className="text-xs text-gray-500">Uploads analyze immediately after ingestion.</div>
        </div>

        <form onSubmit={handleUpload} className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-[#13131f] p-4">
          <input
            type="file"
            name="files"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300"
          />
          <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>Accepted: JPEG, PNG, WebP, GIF</span>
            <span>{uploading ? "Uploading..." : "Ready"}</span>
          </div>
          <button type="submit" disabled={uploading} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black disabled:opacity-50">{uploading ? "Uploading..." : "Upload & analyze"}</button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold">Batches</h2>
          <div className="mt-4 space-y-3">
            {batches.length ? batches.map((batch) => (
              <div key={batch.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">Batch {batch.id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-400">{new Date(batch.created_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(batch.status)}`}>{batch.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-300 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">Files {batch.original_file_count}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">Processed {batch.processed_count}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">Drafts {batch.draft_count}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">Published {batch.published_count}</div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <span>Duplicates {batch.duplicate_count}</span>
                  <span>Errors {batch.error_count}</span>
                </div>
                {batch.notes ? <p className="mt-3 text-xs text-gray-400">{batch.notes}</p> : null}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => publishItems(items.filter((item) => item.batch_id === batch.id && ["ready_to_publish", "needs_review"].includes(item.status)).map((item) => item.id))}
                    className="rounded-xl border border-white/15 px-3 py-2 text-xs text-gray-200 hover:bg-white/5"
                  >
                    Publish batch
                  </button>
                  <a href={`#batch-${batch.id}`} className="rounded-xl border border-white/15 px-3 py-2 text-xs text-gray-200 hover:bg-white/5">Open items</a>
                </div>
              </div>
            )) : <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No batches yet.</div>}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Review queue</h2>
              <p className="mt-1 text-sm text-gray-400">Edit AI output, resolve duplicates, and publish only the items you approve.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => publishItems(selected)} disabled={!selectedCount || busyItemId === "publish"} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Publish selected ({selectedCount})</button>
              <button type="button" onClick={() => setSelected([])} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-gray-200">Clear</button>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {items.length ? items.map((item) => {
              const image = item.card_ingestion_item_images?.[0]?.public_url ?? item.source_image_url;
              const draft = drafts[item.id] ?? toDraft(item);
              const selectedItem = selected.includes(item.id);
              return (
                <article key={item.id} id={`batch-${item.batch_id}`} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row">
                    <div className="w-full max-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <img src={image} alt={item.card_name ?? "Card image"} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={selectedItem} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="h-4 w-4 rounded border-white/30 bg-transparent" />
                            <h3 className="text-lg font-bold text-white">{draft.title || item.card_name || "Untitled card"}</h3>
                          </div>
                          <p className="text-sm text-gray-400">{draft.set_name || item.set_name || "Unknown set"} {draft.card_number || item.card_number ? `· #${draft.card_number || item.card_number}` : ""}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>
                          {item.duplicate_summary?.length ? <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs text-orange-200">Duplicate candidate</span> : null}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["card_name", "Card name"],
                          ["set_name", "Set"],
                          ["card_number", "Number"],
                          ["rarity", "Rarity"],
                          ["language", "Language"],
                          ["variant", "Variant"],
                          ["title", "Draft title"],
                          ["likely_condition", "Condition"],
                          ["estimated_price", "Estimated price"],
                          ["low_price", "Low price"],
                          ["high_price", "High price"],
                          ["confidence_score", "Confidence"],
                        ].map(([key, label]) => (
                          <label key={key} className="space-y-1 text-xs text-gray-400">
                            <span>{label}</span>
                            <input
                              value={draft[key as keyof ItemDraft]}
                              onChange={(event) => updateDraft(item.id, key as keyof ItemDraft, event.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                            />
                          </label>
                        ))}
                      </div>

                      <label className="block space-y-1 text-xs text-gray-400">
                        <span>Description</span>
                        <textarea
                          value={draft.description}
                          onChange={(event) => updateDraft(item.id, "description", event.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                        />
                      </label>

                      <label className="block space-y-1 text-xs text-gray-400">
                        <span>Review notes</span>
                        <textarea
                          value={draft.review_notes}
                          onChange={(event) => updateDraft(item.id, "review_notes", event.target.value)}
                          rows={2}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                        />
                      </label>

                      {item.duplicate_summary?.length ? (
                        <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3 text-sm text-orange-100">
                          <div className="font-semibold">Potential duplicates</div>
                          <div className="mt-1 text-xs text-orange-100/80">{item.duplicate_summary.join(" | ")}</div>
                        </div>
                      ) : null}

                      {(() => {
                        const manualMatches = (item.ai_payload as { manual_matches?: Array<{ id: string; name: string; setName?: string; number?: string; image?: string; rarity?: string; source: string }> } | null)?.manual_matches ?? [];
                        if (!manualMatches.length) return null;
                        return (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">
                            <div className="font-semibold text-white">Manual search matches</div>
                            <div className="mt-2 grid gap-2">
                              {manualMatches.map((match) => (
                                <div key={match.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                                  <div className="font-semibold text-white">{match.name}</div>
                                  <div className="mt-1 text-gray-400">{match.setName ?? "Unknown set"}{match.number ? ` · #${match.number}` : ""}{match.rarity ? ` · ${match.rarity}` : ""}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {item.error_message ? <p className="text-sm text-red-300">{item.error_message}</p> : null}

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => saveItem(item.id)} disabled={busyItemId === item.id} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Save item</button>
                        <button type="button" onClick={() => publishItems([item.id])} disabled={busyItemId === item.id || busyItemId === "publish"} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">Publish now</button>
                        <button type="button" onClick={() => updateDraft(item.id, "status", "needs_review")} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-gray-200">Needs review</button>
                        <button type="button" onClick={() => updateDraft(item.id, "status", "rejected")} className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-200">Reject</button>
                        {item.duplicate_summary?.length ? (
                          <button type="button" onClick={() => overrideDuplicate(item.id)} className="rounded-xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-orange-200">Override duplicate</button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            }) : <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No card items yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
