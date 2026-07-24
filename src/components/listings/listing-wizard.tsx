"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import SellerVerificationStatusCard from "@/components/seller/verification-status-card";
import { getAppRole } from "@/lib/security";
import { getEffectiveSellerVerificationStatus, type SellerVerificationStatus } from "@/lib/seller-verification";
import { MAX_IMAGE_SIZE_BYTES, MAX_LISTING_IMAGE_COUNT, uploadImageFile } from "@/lib/uploads";

const CONDITIONS = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"] as const;
const CATEGORIES = [
  { value: "single", label: "Single Card" },
  { value: "sealed", label: "Sealed Product" },
  { value: "graded", label: "Graded Card" },
  { value: "accessory", label: "Accessory / Supply" },
] as const;
const GRADE_COMPANIES = ["", "PSA", "BGS", "CGC"] as const;
const STORAGE_KEY_PREFIX = "tcgpm:listings:draft";

export type ListingWizardCopy = {
  title: string;
  eyebrow: string;
  description: string;
  backHref: string;
  backLabel: string;
  actionLabel: string;
  actionHint: string;
};

type VerificationRow = {
  status?: SellerVerificationStatus | null;
  rejection_reason?: string | null;
  more_information_request?: string | null;
  verified_at?: string | null;
};

type ListingWizardProps = {
  copy: ListingWizardCopy;
  redirectTo: string;
};

type FormState = {
  card_name: string;
  set_name: string;
  card_number: string;
  rarity: string;
  condition: (typeof CONDITIONS)[number];
  category: (typeof CATEGORIES)[number]["value"];
  grade_company: "" | "PSA" | "BGS" | "CGC";
  grade_score: string;
  price: string;
  quantity: string;
  description: string;
  shipping_paid_by: "seller" | "buyer";
  weight_oz: string;
  package_type: string;
  status: "active" | "draft";
};

type DraftState = {
  form: FormState;
  imageUrls: string[];
  coverImageIndex: number;
};

type ImageSlot = {
  id: string;
  url: string;
  name: string;
  status: "uploading" | "ready" | "error";
  progress: number;
  error?: string;
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const initialForm = (): FormState => ({
  card_name: "",
  set_name: "",
  card_number: "",
  rarity: "",
  condition: "Near Mint",
  category: "single",
  grade_company: "",
  grade_score: "",
  price: "",
  quantity: "1",
  description: "",
  shipping_paid_by: "seller",
  weight_oz: "1",
  package_type: "card envelope",
  status: "active",
});

function draftKey(userId: string, redirectTo: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}:${redirectTo}`;
}

function buildPreviewState(form: FormState, imageUrls: string[], coverImageIndex: number) {
  const heroImage = imageUrls[coverImageIndex] ?? imageUrls[0] ?? null;
  return {
    heroImage,
    title: form.card_name || "Your listing preview",
    subtitle: [form.set_name, form.card_number].filter(Boolean).join(" · ") || "Set details appear here",
    price: form.price ? `$${Number(form.price).toFixed(2)}` : "$0.00",
    category: CATEGORIES.find((item) => item.value === form.category)?.label ?? "Single Card",
    condition: form.condition,
    description: form.description || "Add a short note about condition, packaging, and what makes this item stand out.",
  };
}

function compressListingImage(file: File) {
  if (!file.type.startsWith("image/")) return Promise.resolve(file);
  if (file.size <= MAX_IMAGE_SIZE_BYTES / 2) return Promise.resolve(file);

  return new Promise<File>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error(`Unable to load ${file.name}.`));
      image.onload = () => {
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / image.width);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to prepare image upload."));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error(`Unable to compress ${file.name}.`));
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
        }, "image/webp", 0.84);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ListingWizard({ copy, redirectTo }: ListingWizardProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<SellerVerificationStatus | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationRow | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([]);
  const [coverImageIndex, setCoverImageIndex] = useState(0);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [uploadErrorLabel, setUploadErrorLabel] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [fileLimitReached, setFileLimitReached] = useState(false);
  const [recentUploadErrors, setRecentUploadErrors] = useState<string[]>([]);

  const isAdmin = getAppRole(currentUser) === "admin" || getAppRole(currentUser) === "super_admin";
  const effectiveVerificationStatus = getEffectiveSellerVerificationStatus(currentUser, verificationStatus);
  const canSell = isAdmin || effectiveVerificationStatus === "approved";
  const hideVerificationUi = isAdmin;
  const blockSelling = !canSell;
  const preview = buildPreviewState(form, imageUrls, coverImageIndex);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
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
  }, [redirectTo, router, supabase]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(draftKey(userId, redirectTo));
    if (!raw) {
      queueMicrotask(() => setDraftLoaded(true));
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DraftState>;
      queueMicrotask(() => {
        if (parsed.form) setForm((current) => ({ ...current, ...parsed.form }));
        if (Array.isArray(parsed.imageUrls)) setImageUrls(parsed.imageUrls.filter((value): value is string => typeof value === "string"));
        if (typeof parsed.coverImageIndex === "number") setCoverImageIndex(parsed.coverImageIndex);
        setDraftSavedAt(new Date().toLocaleString());
        setAutosaveStatus("Draft restored.");
      });
    } catch {
      window.localStorage.removeItem(draftKey(userId, redirectTo));
    } finally {
      setDraftLoaded(true);
    }
  }, [redirectTo, userId]);

  useEffect(() => {
    if (!userId || typeof window === "undefined" || !draftLoaded) return;
    const draft: DraftState = { form, imageUrls, coverImageIndex };
    window.localStorage.setItem(draftKey(userId, redirectTo), JSON.stringify(draft));
    queueMicrotask(() => {
      setDraftSavedAt(new Date().toLocaleString());
      setAutosaveStatus("Draft saved.");
      const timer = window.setTimeout(() => setAutosaveStatus(null), 1600);
      return () => window.clearTimeout(timer);
    });
  }, [coverImageIndex, draftLoaded, form, imageUrls, redirectTo, userId]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!form.card_name.trim()) errors.push("Card or product name is required.");
    if (!form.set_name.trim()) errors.push("Set name is required.");
    if (!form.condition) errors.push("Condition is required.");
    if (!form.category) errors.push("Category is required.");
    const price = Number(form.price);
    const quantity = Number(form.quantity);
    if (!Number.isFinite(price) || price <= 0) errors.push("Price must be greater than 0.");
    if (!Number.isFinite(quantity) || quantity < 1) errors.push("Quantity must be at least 1.");
    if (form.category === "graded" && !form.grade_company) errors.push("Choose a grading company for graded listings.");
    return errors;
  }, [form]);

  const validationHint = validationErrors[0] ?? null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const applyImages = (updater: (current: string[]) => string[]) => {
    setImageUrls((current) => {
      const next = updater(current);
      setCoverImageIndex((cover) => {
        if (next.length === 0) return 0;
        return Math.min(cover, next.length - 1);
      });
      return next;
    });
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (files: File[]) => {
    if (!userId) {
      setMessage({ type: "error", text: "Please wait for your account to finish loading." });
      return;
    }

    const currentCount = imageUrls.length;
    const acceptedFiles = files.slice(0, Math.max(0, MAX_LISTING_IMAGE_COUNT - currentCount));
    const rejectedCount = files.length - acceptedFiles.length;

    if (rejectedCount > 0) {
      setFileLimitReached(true);
      setUploadErrorLabel(`You can upload up to ${MAX_LISTING_IMAGE_COUNT} listing photos.`);
    } else {
      setFileLimitReached(false);
    }

    if (!acceptedFiles.length) return;

    setUploading(true);
    setMessage(null);
    setUploadErrorLabel(null);
    setUploadProgress(0);
    setUploadingCount(acceptedFiles.length);
    setRecentUploadErrors([]);

    const initialSlots = acceptedFiles.map((file) => ({
      id: `${file.name}-${crypto.randomUUID().slice(0, 8)}`,
      url: "",
      name: file.name,
      status: "uploading" as const,
      progress: 5,
    }));

    setImageSlots((current) => [...current, ...initialSlots]);

    const nextErrors: string[] = [];
    const uploadedUrls: string[] = [];
    let completed = 0;

    for (let index = 0; index < acceptedFiles.length; index += 1) {
      const file = acceptedFiles[index];
      const slotId = initialSlots[index].id;
      try {
        if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
          throw new Error(`${file.name} must be a JPEG, PNG, WebP, or GIF file.`);
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          throw new Error(`${file.name} is too large. Please use an image under ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB.`);
        }

        const optimized = await compressListingImage(file);
        const uploaded = await uploadImageFile({
          supabase,
          target: "listing",
          ownerId: userId,
          file: optimized,
          prefix: "listing-image",
        });

        uploadedUrls.push(uploaded.publicUrl);
        completed += 1;
        setUploadProgress(Math.round((completed / acceptedFiles.length) * 100));
        setImageSlots((current) => current.map((slot) => (slot.id === slotId ? { ...slot, url: uploaded.publicUrl, status: "ready", progress: 100 } : slot)));
      } catch (error) {
        completed += 1;
        setUploadProgress(Math.round((completed / acceptedFiles.length) * 100));
        const errorMessage = error instanceof Error ? error.message : `Failed to upload ${file.name}.`;
        nextErrors.push(errorMessage);
        setImageSlots((current) => current.map((slot) => (slot.id === slotId ? { ...slot, status: "error", progress: 100, error: errorMessage } : slot)));
      }
    }

    if (uploadedUrls.length) {
      applyImages((current) => [...current, ...uploadedUrls]);
      setImageSlots((current) => current.filter((slot) => slot.status !== "error"));
    }

    setUploadingCount(0);
    setUploading(false);
    setRecentUploadErrors(nextErrors);
    if (nextErrors.length) {
      setUploadErrorLabel(nextErrors.join(" "));
      setMessage({ type: "error", text: nextErrors.join(" ") });
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    void handleImageUpload(files);
    event.target.value = "";
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setDropActive(false);
    void handleImageUpload(Array.from(event.dataTransfer.files ?? []));
  };

  const removeImage = (index: number) => {
    applyImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setImageSlots((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const retryUpload = (index: number) => {
    setImageSlots((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setUploadErrorLabel(null);
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    applyImages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveDraft = () => {
    if (!userId || typeof window === "undefined") return;
    window.localStorage.setItem(draftKey(userId, redirectTo), JSON.stringify({ form, imageUrls, coverImageIndex }));
    setDraftSavedAt(new Date().toLocaleString());
    setAutosaveStatus("Draft saved.");
  };

  const publishListing = async () => {
    if (!userId || !canSell) {
      setMessage({ type: "error", text: "Verification is required before publishing listings." });
      return;
    }
    if (uploading || imageSlots.some((slot) => slot.status === "uploading")) {
      setMessage({ type: "error", text: "Wait for all uploads to finish before publishing." });
      return;
    }
    if (validationErrors.length) {
      setMessage({ type: "error", text: validationErrors[0] });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const readyImages = imageSlots.filter((slot) => slot.status === "ready").map((slot) => slot.url).filter(Boolean);
      const payload = {
        card_name: form.card_name.trim(),
        set_name: form.set_name.trim(),
        card_number: form.card_number.trim() || null,
        rarity: form.rarity.trim() || null,
        condition: form.condition,
        category: form.category,
        grade_company: form.grade_company || null,
        grade_score: form.grade_score ? Number(form.grade_score) : null,
        price: Number(form.price),
        quantity: Math.max(1, Number(form.quantity)),
        description: form.description.trim() || null,
        shipping_profile_id: null,
        shipping_paid_by: form.shipping_paid_by,
        weight_oz: Number(form.weight_oz) || null,
        package_type: form.package_type.trim() || null,
        images: readyImages,
        status: form.status,
      };

      console.info("[listings.publish] submit", {
        userId,
        category: payload.category,
        imageCount: payload.images.length,
        status: payload.status,
      });

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      const data = await response.json().catch(() => ({} as { error?: string; details?: string | null; listing?: { id: string } }));
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ? `${data.error}${data.details ? ` (${data.details})` : ""}` : "Failed to create listing." });
        return;
      }

      if (data.listing?.id) {
        window.localStorage.removeItem(draftKey(userId, redirectTo));
        router.push(`/listings/${data.listing.id}?published=1`);
        router.refresh();
        return;
      }

      setMessage({ type: "error", text: "Publish failed. Please try again." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Publish failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
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

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-start sm:px-6">
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
            {copy.eyebrow}
          </div>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{copy.title}</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-gray-300">{copy.description}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Autosaved drafts",
              "Drag-and-drop image upload",
              "Cover image selection",
              "Publish-time validation",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                {item}
              </div>
            ))}
          </div>

          {preview.heroImage ? (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="aspect-[4/3] bg-black/20 sm:aspect-[16/9]">
                <img src={preview.heroImage} alt={preview.title} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-widest text-yellow-400">Live preview</div>
                    <h2 className="mt-1 text-2xl font-black">{preview.title}</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">{preview.price}</div>
                </div>
                <p className="text-sm text-gray-400">{preview.subtitle}</p>
                <p className="text-sm text-gray-300">{preview.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                  <span className="rounded-full border border-white/10 px-3 py-1">{preview.category}</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">{preview.condition}</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">{form.shipping_paid_by === "seller" ? "Seller pays shipping" : "Buyer pays shipping"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm uppercase tracking-widest text-yellow-400">Live preview</div>
              <h2 className="mt-2 text-2xl font-black">{preview.title}</h2>
              <p className="mt-2 text-sm text-gray-400">{preview.description}</p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-yellow-400">Listing form</p>
              <h2 className="mt-2 text-2xl font-black">Publish your inventory</h2>
              <p className="mt-2 text-sm text-gray-400">{copy.actionHint}</p>
            </div>
            <a href={copy.backHref} className="rounded-xl border border-white/20 px-3 py-2 text-sm text-gray-300 hover:bg-white/5">{copy.backLabel}</a>
          </div>

          <div className="space-y-4">
            {!hideVerificationUi && (
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                <SellerVerificationStatusCard
                  status={verificationStatus}
                  rejectionReason={verificationData?.rejection_reason}
                  moreInfo={verificationData?.more_information_request}
                  verifiedAt={verificationData?.verified_at}
                />
                {verificationStatus !== "approved" && <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">Verification is required to publish listings.</div>}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
              <div className="flex items-center justify-between gap-3">
                <span>{draftLoaded ? "Draft ready" : "Loading draft..."}</span>
                <span className="text-gray-500">{draftSavedAt ? `Saved ${draftSavedAt}` : "Unsaved"}</span>
              </div>
              {autosaveStatus && <div className="mt-2 text-xs text-yellow-400">{autosaveStatus}</div>}
              {validationHint && <div className="mt-2 text-xs text-red-300">{validationHint}</div>}
            </div>

            <form onSubmit={(event) => { event.preventDefault(); void publishListing(); }} className="space-y-5">
              <div className="space-y-5 rounded-2xl border border-white/10 bg-[#13131f] p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Card / Product Name *</label>
                    <input name="card_name" value={form.card_name} onChange={handleChange} required placeholder="Card or product name" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
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
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Rarity / Language</label>
                    <input name="rarity" value={form.rarity} onChange={handleChange} placeholder="e.g. English" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Condition *</label>
                    <select name="condition" value={form.condition} onChange={handleChange} className="w-full rounded-xl border border-white/20 bg-[#0f0f1a] px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none">
                      {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Category *</label>
                    <select name="category" value={form.category} onChange={handleChange} className="w-full rounded-xl border border-white/20 bg-[#0f0f1a] px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none">
                      {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-300">Grading Company</label>
                      <select name="grade_company" value={form.grade_company} onChange={handleChange} className="w-full rounded-xl border border-white/20 bg-[#0f0f1a] px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none">
                        {GRADE_COMPANIES.map((item) => <option key={item || "none"} value={item}>{item || "Select..."}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-300">Grade Score</label>
                      <input name="grade_score" type="number" step="0.5" min="1" max="10" value={form.grade_score} onChange={handleChange} placeholder="e.g. 9.5" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 rounded-2xl border border-white/10 bg-[#13131f] p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Price ($) *</label>
                    <input name="price" type="number" step="0.01" min="0.01" value={form.price} onChange={handleChange} required placeholder="0.00" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Quantity *</label>
                    <input name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange} required className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Shipping Paid By</label>
                    <select name="shipping_paid_by" value={form.shipping_paid_by} onChange={handleChange} className="w-full rounded-xl border border-white/20 bg-[#0f0f1a] px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none">
                      <option value="seller">Seller</option>
                      <option value="buyer">Buyer</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Weight (oz)</label>
                    <input name="weight_oz" type="number" min="0" step="0.1" value={form.weight_oz} onChange={handleChange} className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-yellow-400 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">Package Type</label>
                  <input name="package_type" value={form.package_type} onChange={handleChange} placeholder="card envelope" className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Describe condition, pulls, shipping notes..." className="w-full resize-none rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none" />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-[#13131f] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Upload Images</label>
                    <div className="text-xs text-gray-500">Drag files here or use the picker</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {imageUrls.length}/{MAX_LISTING_IMAGE_COUNT} photos
                  </div>
                </div>

                <div
                  onDragEnter={(event) => { event.preventDefault(); setDropActive(true); }}
                  onDragOver={(event) => { event.preventDefault(); setDropActive(true); }}
                  onDragLeave={(event) => { event.preventDefault(); setDropActive(false); }}
                  onDrop={handleDrop}
                  className={`rounded-2xl border-2 border-dashed p-5 transition ${dropActive ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5"}`}
                >
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileInput} className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300" />
                  <p className="mt-3 text-xs text-gray-500">Accepted: JPEG, PNG, WebP, GIF. Max {Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB each.</p>
                  {uploading && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Uploading {uploadingCount} file(s)</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                  {fileLimitReached && <p className="mt-3 text-xs text-red-300">{`You can upload up to ${MAX_LISTING_IMAGE_COUNT} listing photos.`}</p>}
                  {uploadErrorLabel && <p className="mt-3 text-xs text-red-300">{uploadErrorLabel}</p>}
                </div>

                {imageSlots.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs text-gray-500">{imageUrls.length} image(s) ready</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {imageSlots.map((slot, index) => (
                        <div key={slot.id} className={`rounded-2xl border p-3 ${coverImageIndex === index ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-white/5"}`}>
                          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/20">
                            {slot.status === "ready" && slot.url ? (
                              <img src={slot.url} alt={`Uploaded listing image ${index + 1}`} className="h-full w-full object-cover" />
                            ) : slot.status === "error" ? (
                              <div className="flex h-full w-full items-center justify-center bg-red-500/10 text-center text-xs text-red-200">Upload failed</div>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">Uploading… {slot.progress}%</div>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => setCoverImageIndex(index)} disabled={slot.status !== "ready"} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40">Set cover</button>
                            <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0 || slot.status !== "ready"} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40">Up</button>
                            <button type="button" onClick={() => moveImage(index, 1)} disabled={index === imageSlots.length - 1 || slot.status !== "ready"} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40">Down</button>
                            <button type="button" onClick={() => removeImage(index)} className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10">Remove</button>
                            {slot.status === "error" && (
                              <button type="button" onClick={() => retryUpload(index)} className="rounded-lg border border-yellow-400/30 px-3 py-1.5 text-xs text-yellow-300 hover:bg-yellow-400/10">Retry</button>
                            )}
                          </div>
                          {slot.error && <p className="mt-2 text-xs text-red-300">{slot.error}</p>}
                        </div>
                      ))}
                    </div>
                    {recentUploadErrors.length > 0 && <div className="text-xs text-red-300">{recentUploadErrors.join(" ")}</div>}
                  </div>
                )}
              </div>

              {message && (
                <div className={`rounded-xl border p-4 text-sm ${message.type === "error" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-green-500/20 bg-green-500/10 text-green-400"}`}>
                  {message.text}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={() => router.back()} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-gray-300 hover:bg-white/5">Cancel</button>
                <button type="button" onClick={saveDraft} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-gray-300 hover:bg-white/5">Save draft</button>
                <button type="submit" disabled={loading || blockSelling} className="flex-1 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">{loading ? "Publishing..." : canSell ? copy.actionLabel : "Verification Required"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
