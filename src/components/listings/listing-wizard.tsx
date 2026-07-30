"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { MAX_IMAGE_SIZE_BYTES, uploadImageFile } from "@/lib/uploads";
import SellerVerificationStatusCard from "@/components/seller/verification-status-card";
import { getAppRole } from "@/lib/security";
import { getEffectiveSellerVerificationStatus, type SellerVerificationStatus } from "@/lib/seller-verification";
import { fetchCardPrice } from "@/lib/prices";
import { identifyPokemonCard } from "@/lib/pokemon";
import type { Database } from "@/lib/supabase/types";

function buildListingPayload(input: {
  sellerId: string;
  form: ListingFormState;
  imageUrls: string[];
  status: Database["public"]["Tables"]["listings"]["Row"]["status"];
}) {
  const isGradedListing = input.form.category === "graded";

  return {
    seller_id: input.sellerId,
    card_name: input.form.card_name.trim(),
    set_name: input.form.set_name.trim(),
    card_number: input.form.card_number.trim() || null,
    rarity: input.form.rarity.trim() || null,
    condition: input.form.condition,
    category: input.form.category,
    price: Number(input.form.price),
    quantity: Number(input.form.quantity),
    description: input.form.description.trim() || null,
    grade_company: isGradedListing ? (input.form.grade_company || null) : null,
    grade_score: isGradedListing && input.form.grade_score ? Number(input.form.grade_score) : null,
    shipping_profile_id: null,
    images: input.imageUrls,
    status: input.status,
  };
}

const CONDITIONS = ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"] as const;
const CATEGORIES = [
  { value: "single", label: "Single Card", hint: "Singles, promos, hits" },
  { value: "sealed", label: "Sealed Product", hint: "Booster boxes, ETBs" },
  { value: "graded", label: "Graded Card", hint: "Slabs and certified cards" },
  { value: "accessory", label: "Accessory / Supply", hint: "Binders, sleeves, supplies" },
] as const;
const GRADE_COMPANIES = ["", "PSA", "BGS", "CGC"] as const;
const STORAGE_PREFIX = "tcgpokemarket:listings:draft";
const MAX_DIMENSION = 1600;

const initialForm = () => ({
  card_name: "",
  set_name: "",
  card_number: "",
  rarity: "",
  category: "single" as (typeof CATEGORIES)[number]["value"],
  condition: "Near Mint" as (typeof CONDITIONS)[number],
  grade_company: "" as "" | "PSA" | "BGS" | "CGC",
  grade_score: "",
  weight_oz: "",
  price: "",
  quantity: "1",
  description: "",
});

type ListingFormState = ReturnType<typeof initialForm>;
type VerificationRow = {
  status?: SellerVerificationStatus | null;
  rejection_reason?: string | null;
  more_information_request?: string | null;
  verified_at?: string | null;
};

type DraftState = {
  form: ListingFormState;
  imageUrls: string[];
  activeStep: number;
  coverImageIndex: number;
  updatedAt: string;
};

type WizardCopy = {
  title: string;
  eyebrow: string;
  description: string;
  backHref: string;
  backLabel: string;
  actionLabel: string;
  actionHint: string;
};

type ScannerMatch = {
  id: string;
  name: string;
  setName: string;
  number: string | null;
  rarity: string | null;
  image: string | null;
  price: {
    marketPrice: number | null;
    lowPrice: number | null;
    highPrice: number | null;
    source: string;
  };
  releaseDate: string | null;
  illustrator: string | null;
  hp: string | null;
  stage: string | null;
  types: string[];
  language: string | null;
  variants: string[];
  suggestedCategory: "single" | "sealed" | "graded" | "accessory";
  suggestedTitle: string;
  suggestedSellPrice: number | null;
  suggestedAuctionStartPrice: number | null;
  suggestedBuyItNowPrice: number | null;
  confidence: number;
};

type CameraCapture = {
  file: File;
  previewUrl: string;
};

function estimateCondition(text: string, variants: string[]) {
  const haystack = `${text} ${variants.join(" ")}`.toLowerCase();
  if (haystack.includes("damaged") || haystack.includes("crease") || haystack.includes("tear")) return "Damaged";
  if (haystack.includes("heavily played") || haystack.includes("heavy wear")) return "Heavily Played";
  if (haystack.includes("moderately played") || haystack.includes("edge wear")) return "Moderately Played";
  if (haystack.includes("lightly played") || haystack.includes("surface wear")) return "Lightly Played";
  return "Near Mint";
}

function applyScannerMatch(match: ScannerMatch, setForm: (updater: (current: ListingFormState) => ListingFormState) => void) {
  setForm((current) => ({
    ...current,
    card_name: match.name || current.card_name,
    set_name: match.setName || current.set_name,
    card_number: match.number ?? current.card_number,
    rarity: match.rarity ?? current.rarity,
    category: match.suggestedCategory,
    price: match.suggestedSellPrice ? String(match.suggestedSellPrice) : current.price,
    description: current.description || `Scanned match: ${match.suggestedTitle}`,
  }));
}

function formatAgo(iso: string | null) {
  if (!iso) return "not yet saved";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 30_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

async function compressListingImage(file: File) {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= MAX_IMAGE_SIZE_BYTES / 2) return file;

  const loaded = await new Promise<{ width: number; height: number; dataUrl: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, dataUrl: String(reader.result) });
      };
      image.onerror = () => reject(new Error("Unable to process image."));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(loaded.width, loaded.height));
  const targetWidth = Math.max(1, Math.round(loaded.width * scale));
  const targetHeight = Math.max(1, Math.round(loaded.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const image = new Image();
  image.src = loaded.dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to compress image."));
  });

  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("Unable to compress image."));
        return;
      }
      resolve(result);
    }, "image/webp", 0.84);
  });

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`, { type: "image/webp" });
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function buildPreviewState(form: ListingFormState, imageUrls: string[], coverImageIndex: number) {
  return {
    heroImage: imageUrls[coverImageIndex] ?? imageUrls[0] ?? null,
    title: form.card_name || "Your listing preview",
    subtitle: [form.set_name, form.card_number].filter(Boolean).join(" · "),
    rarity: form.rarity || null,
    category: form.category,
    condition: form.condition,
    price: form.price ? Number(form.price) : null,
    quantity: Number(form.quantity) || 1,
    description: form.description || null,
    grade: form.category === "graded" ? [form.grade_company, form.grade_score].filter(Boolean).join(" ") : null,
    shipping: null,
  };
}

export default function ListingWizard({ copy, redirectTo }: { copy: WizardCopy; redirectTo: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerFileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerImageRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerWorkerRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<SellerVerificationStatus | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationRow | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [priceGuideLoading, setPriceGuideLoading] = useState(false);
  const [priceGuideError, setPriceGuideError] = useState<string | null>(null);
  const [savedListingId, setSavedListingId] = useState<string | null>(null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [coverImageIndex, setCoverImageIndex] = useState(0);
  const [form, setForm] = useState<ListingFormState>(initialForm);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerText, setScannerText] = useState<string>("");
  const [scannerMatches, setScannerMatches] = useState<ScannerMatch[]>([]);
  const [scannerCapture, setScannerCapture] = useState<CameraCapture | null>(null);
  const [scannerConfidence, setScannerConfidence] = useState<number | null>(null);
  const [scannerCondition, setScannerCondition] = useState<string>("Near Mint");
  const [scannerSearchLoading, setScannerSearchLoading] = useState(false);
  const [scannerSearchResults, setScannerSearchResults] = useState<ScannerMatch[]>([]);
  const [scannerActiveTab, setScannerActiveTab] = useState<"scan" | "results">("scan");
  const [scannerLastSuccess, setScannerLastSuccess] = useState<string | null>(null);
  const [scannerManualSearch, setScannerManualSearch] = useState("");
  const [scannerManualNote, setScannerManualNote] = useState("");
  const [scannerCameraAvailable, setScannerCameraAvailable] = useState(false);
  const [scannerScanErrorCount, setScannerScanErrorCount] = useState(0);
  const [scannerScanSource, setScannerScanSource] = useState<"camera" | "upload" | "manual">("camera");
  const [scannerScanTime, setScannerScanTime] = useState<number | null>(null);
  const [scannerSavedUrl, setScannerSavedUrl] = useState<string | null>(null);
  const [scannerPreviewUrl, setScannerPreviewUrl] = useState<string | null>(null);
  const [scannerProcessing, setScannerProcessing] = useState(false);
  const [scannerScanMessage, setScannerScanMessage] = useState<string | null>(null);
  const [scannerHasResults, setScannerHasResults] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerLastError, setScannerLastError] = useState<string | null>(null);
  const [scannerSuggestionIndex, setScannerSuggestionIndex] = useState(0);
  const [scannerScanCount, setScannerScanCount] = useState(0);
  const [scannerHints, setScannerHints] = useState<string[]>([]);
  const [scannerMatchUrl, setScannerMatchUrl] = useState<string | null>(null);
  const [scannerUseCamera, setScannerUseCamera] = useState(true);
  const [scannerUseOcr, setScannerUseOcr] = useState(true);
  const [scannerUseAiMatch, setScannerUseAiMatch] = useState(true);
  const [scannerUseFallbackSearch, setScannerUseFallbackSearch] = useState(true);
  const [scannerLastQuery, setScannerLastQuery] = useState("");
  const [scannerMetadata, setScannerMetadata] = useState<Record<string, string>>({});
  const [scannerPreviewMessage, setScannerPreviewMessage] = useState<string | null>(null);
  const [scannerSuggestionOpen, setScannerSuggestionOpen] = useState(false);
  const [scannerSuggestionCount, setScannerSuggestionCount] = useState(0);
  const [scannerLastScanAt, setScannerLastScanAt] = useState<string | null>(null);
  const [scannerQuickNote, setScannerQuickNote] = useState("");
  const [scannerSessionId, setScannerSessionId] = useState<string | null>(null);
  const [scannerManualPrice, setScannerManualPrice] = useState("");
  const [scannerManualSet, setScannerManualSet] = useState("");
  const [scannerManualName, setScannerManualName] = useState("");
  const [scannerManualNumber, setScannerManualNumber] = useState("");
  const [scannerManualRarity, setScannerManualRarity] = useState("");
  const [scannerManualCondition, setScannerManualCondition] = useState("Near Mint");
  const [scannerManualCategory, setScannerManualCategory] = useState<"single" | "sealed" | "graded" | "accessory">("single");
  const [scannerManualConfidence, setScannerManualConfidence] = useState<number | null>(null);
  const [scannerManualMatches, setScannerManualMatches] = useState<ScannerMatch[]>([]);
  const [scannerManualReleaseDate, setScannerManualReleaseDate] = useState("");
  const [scannerManualIllustrator, setScannerManualIllustrator] = useState("");
  const [scannerManualHp, setScannerManualHp] = useState("");
  const [scannerManualStage, setScannerManualStage] = useState("");
  const [scannerManualTypes, setScannerManualTypes] = useState("");
  const [scannerManualLanguage, setScannerManualLanguage] = useState("");
  const [scannerManualVariants, setScannerManualVariants] = useState("");
  const [scannerManualSuggestedTitle, setScannerManualSuggestedTitle] = useState("");
  const [scannerManualSuggestedSellPrice, setScannerManualSuggestedSellPrice] = useState("");
  const [scannerManualSuggestedAuctionStartPrice, setScannerManualSuggestedAuctionStartPrice] = useState("");
  const [scannerManualSuggestedBuyItNowPrice, setScannerManualSuggestedBuyItNowPrice] = useState("");
  const [scannerManualImage, setScannerManualImage] = useState("");
  const [scannerManualId, setScannerManualId] = useState("");
  const [scannerManualSource, setScannerManualSource] = useState("");
  const [scannerManualPriceSource, setScannerManualPriceSource] = useState("");
  const [scannerManualMore, setScannerManualMore] = useState("");
  const [scannerManualReady, setScannerManualReady] = useState(false);
  const [scannerManualStatus, setScannerManualStatus] = useState<string | null>(null);
  const [scannerManualErrors, setScannerManualErrors] = useState<string[]>([]);
  const [scannerManualWarnings, setScannerManualWarnings] = useState<string[]>([]);
  const [scannerManualTags, setScannerManualTags] = useState<string[]>([]);
  const [scannerManualNotes, setScannerManualNotes] = useState<string>("");
  const [scannerManualConditionHint, setScannerManualConditionHint] = useState("Near Mint");
  const [scannerManualConfidenceHint, setScannerManualConfidenceHint] = useState<number | null>(null);
  const [scannerManualPreviewUrl, setScannerManualPreviewUrl] = useState<string | null>(null);
  const [scannerManualConfirmed, setScannerManualConfirmed] = useState(false);
  const [scannerManualFailed, setScannerManualFailed] = useState(false);
  const [scannerManualInProgress, setScannerManualInProgress] = useState(false);
  const [scannerManualOutput, setScannerManualOutput] = useState<ScannerMatch[]>([]);
  const [scannerManualScannerText, setScannerManualScannerText] = useState("");
  const [scannerManualScannerError, setScannerManualScannerError] = useState<string | null>(null);
  const [scannerManualScannerBusy, setScannerManualScannerBusy] = useState(false);
  const [scannerManualScannerOpen, setScannerManualScannerOpen] = useState(false);
  const [scannerManualScannerReady, setScannerManualScannerReady] = useState(false);
  const [scannerManualScannerSource, setScannerManualScannerSource] = useState<"camera" | "upload" | "manual">("camera");
  const [scannerManualScannerCount, setScannerManualScannerCount] = useState(0);
  const [scannerManualScannerTime, setScannerManualScannerTime] = useState<number | null>(null);
  const [scannerManualScannerLast, setScannerManualScannerLast] = useState<string | null>(null);
  const [scannerManualScannerLastError, setScannerManualScannerLastError] = useState<string | null>(null);
  const [scannerManualScannerCameraAvailable, setScannerManualScannerCameraAvailable] = useState(false);
  const [scannerManualScannerSearchLoading, setScannerManualScannerSearchLoading] = useState(false);
  const [scannerManualScannerSearchResults, setScannerManualScannerSearchResults] = useState<ScannerMatch[]>([]);
  const [scannerManualScannerMatchUrl, setScannerManualScannerMatchUrl] = useState<string | null>(null);
  const [scannerManualScannerSavedUrl, setScannerManualScannerSavedUrl] = useState<string | null>(null);
  const [scannerManualScannerLastSuccess, setScannerManualScannerLastSuccess] = useState<string | null>(null);
  const [scannerManualScannerLastQuery, setScannerManualScannerLastQuery] = useState("");
  const [scannerManualScannerPreviewMessage, setScannerManualScannerPreviewMessage] = useState<string | null>(null);
  const [scannerManualScannerUseCamera, setScannerManualScannerUseCamera] = useState(true);
  const [scannerManualScannerUseOcr, setScannerManualScannerUseOcr] = useState(true);
  const [scannerManualScannerUseAiMatch, setScannerManualScannerUseAiMatch] = useState(true);
  const [scannerManualScannerUseFallbackSearch, setScannerManualScannerUseFallbackSearch] = useState(true);
  const [scannerManualScannerMetadata, setScannerManualScannerMetadata] = useState<Record<string, string>>({});
  const [scannerManualScannerQuickNote, setScannerManualScannerQuickNote] = useState("");
  const [scannerManualScannerHint, setScannerManualScannerHint] = useState<string[]>([]);
  const [scannerManualScannerFocus, setScannerManualScannerFocus] = useState(false);
  const [scannerManualScannerUploadCount, setScannerManualScannerUploadCount] = useState(0);
  const [scannerManualScannerUploadError, setScannerManualScannerUploadError] = useState<string | null>(null);
  const [scannerManualScannerUploadPreviewUrl, setScannerManualScannerUploadPreviewUrl] = useState<string | null>(null);
  const [scannerManualScannerUploadReady, setScannerManualScannerUploadReady] = useState(false);
  const [scannerManualScannerUploadState, setScannerManualScannerUploadState] = useState<"idle" | "ready" | "running" | "done" | "failed">("idle");
  const [scannerManualScannerUploadText, setScannerManualScannerUploadText] = useState("");
  const [scannerManualScannerUploadMatches, setScannerManualScannerUploadMatches] = useState<ScannerMatch[]>([]);
  const [scannerManualScannerUploadConfidence, setScannerManualScannerUploadConfidence] = useState<number | null>(null);
  const [scannerManualScannerUploadCondition, setScannerManualScannerUploadCondition] = useState("Near Mint");
  const [scannerManualScannerUploadPrice, setScannerManualScannerUploadPrice] = useState("");
  const [scannerManualScannerUploadTitle, setScannerManualScannerUploadTitle] = useState("");
  const [scannerManualScannerUploadSet, setScannerManualScannerUploadSet] = useState("");
  const [scannerManualScannerUploadNumber, setScannerManualScannerUploadNumber] = useState("");
  const [scannerManualScannerUploadRarity, setScannerManualScannerUploadRarity] = useState("");
  const [scannerManualScannerUploadResult, setScannerManualScannerUploadResult] = useState<ScannerMatch | null>(null);
  const [scannerManualScannerUploadManual, setScannerManualScannerUploadManual] = useState(false);
  const [scannerManualScannerUploadManualNote, setScannerManualScannerUploadManualNote] = useState("");
  const [scannerManualScannerUploadManualConfidence, setScannerManualScannerUploadManualConfidence] = useState<number | null>(null);
  const [scannerManualScannerUploadManualCondition, setScannerManualScannerUploadManualCondition] = useState("Near Mint");
  const [scannerManualScannerUploadManualTitle, setScannerManualScannerUploadManualTitle] = useState("");
  const [scannerManualScannerUploadManualSet, setScannerManualScannerUploadManualSet] = useState("");
  const [scannerManualScannerUploadManualNumber, setScannerManualScannerUploadManualNumber] = useState("");
  const [scannerManualScannerUploadManualRarity, setScannerManualScannerUploadManualRarity] = useState("");
  const [scannerManualScannerUploadManualImage, setScannerManualScannerUploadManualImage] = useState("");
  const [scannerManualScannerUploadManualPrice, setScannerManualScannerUploadManualPrice] = useState("");
  const [scannerManualScannerUploadManualNotes, setScannerManualScannerUploadManualNotes] = useState("");
  const [scannerManualScannerUploadManualErrors, setScannerManualScannerUploadManualErrors] = useState<string[]>([]);
  const [scannerManualScannerUploadManualWarnings, setScannerManualScannerUploadManualWarnings] = useState<string[]>([]);
  const isAdmin = getAppRole(currentUser) === "admin" || getAppRole(currentUser) === "super_admin";
  const effectiveVerificationStatus = getEffectiveSellerVerificationStatus(currentUser, verificationStatus);
  const canPublish = isAdmin || effectiveVerificationStatus === "approved";
  const isGraded = form.category === "graded";
  const preview = useMemo(() => buildPreviewState(form, imageUrls, coverImageIndex), [coverImageIndex, form, imageUrls]);


  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
        return;
      }

      try {
        const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Seller";
        const username = fullName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 20) || `user-${user.id.slice(0, 8)}`;

        const writes = [
          (supabase.from("profiles") as any).upsert({
            id: user.id,
            username,
            full_name: fullName,
            avatar_url: user.user_metadata?.avatar_url ?? null,
            seller_state: null,
            is_seller: true,
            seller_rating: 0,
            total_sales: 0,
          }, { onConflict: "id" }),
          (supabase.from("profile_privacy_settings") as any).upsert({
            user_id: user.id,
            who_can_follow: "everyone",
            who_can_friend_request: "everyone",
            profile_visibility: "public",
            collection_visibility: "public",
            activity_visibility: "public",
            message_visibility: "everyone",
          }, { onConflict: "user_id" }),
          (supabase.from("seller_wallets") as any).upsert({
            seller_id: user.id,
            available_balance: 0,
            pending_balance: 0,
            frozen_balance: 0,
            lifetime_earnings: 0,
            completed_orders_count: 0,
            instant_payout_enabled: false,
            fraud_flag: false,
            fraud_risk_score: 0,
            manual_review_required: false,
          }, { onConflict: "seller_id" }),
        ];

        const results = await Promise.all(writes);
        const firstError = results.find((entry) => entry.error);
        if (firstError?.error) throw firstError.error;
      } catch {
        if (!active) return;
        setMessage({ type: "error", text: "We couldn’t finish setting up your seller account yet. Please refresh and try again." });
        return;
      }

      if (!active) return;
      setUserId(user.id);
      setCurrentUser(user);
      const { data } = await supabase.from("seller_verifications").select("status, rejection_reason, more_information_request, verified_at").eq("user_id", user.id).maybeSingle();
      const verification = data as VerificationRow | null;
      setVerificationStatus(getEffectiveSellerVerificationStatus(user, verification?.status ?? "not_started"));
      setVerificationData(
        verification
          ? {
              rejection_reason: verification.rejection_reason,
              more_information_request: verification.more_information_request,
              verified_at: verification.verified_at,
            }
          : null,
      );
    });

    return () => {
      active = false;
    };
  }, [redirectTo, router, supabase]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = window.localStorage.getItem(getStorageKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DraftState>;
      queueMicrotask(() => {
        if (parsed.form) setForm((current) => ({ ...current, ...parsed.form }));
        if (Array.isArray(parsed.imageUrls)) setImageUrls(parsed.imageUrls.filter(Boolean));
        if (typeof parsed.activeStep === "number") setActiveStep(Math.min(3, Math.max(1, parsed.activeStep)));
        if (typeof parsed.coverImageIndex === "number") setCoverImageIndex(Math.max(0, parsed.coverImageIndex));
        if (parsed.updatedAt) setDraftUpdatedAt(parsed.updatedAt);
        setMessage({ type: "success", text: "Draft restored." });
      });
    } catch {
      window.localStorage.removeItem(getStorageKey(userId));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const payload: DraftState = {
      form,
      imageUrls,
      activeStep,
      coverImageIndex,
      updatedAt: new Date().toISOString(),
    };
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(getStorageKey(userId), JSON.stringify(payload));
        setDraftUpdatedAt(payload.updatedAt);
      } catch {
        // Keep the draft in memory if storage is unavailable.
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [activeStep, coverImageIndex, form, imageUrls, userId]);

  useEffect(() => {
    if (!scannerOpen) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setScannerError("Camera access is not available in this browser."));
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch(() => {
        setScannerError("Camera permission was blocked. You can upload a card photo instead.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [scannerOpen]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const runScanner = async (file: File) => {
    setScannerBusy(true);
    setScannerError(null);
    setScannerText("");
    try {
      const inferredText = file.name.replace(/\.[^.]+$/, "").replace(/[._-]/g, " ");
      setScannerText(inferredText);
      const matches = await identifyPokemonCard(inferredText || "Pokémon card").catch(() => [] as ScannerMatch[]);
      setScannerMatches(matches);
      setScannerConfidence(matches[0]?.confidence ?? null);
      if (matches.length) {
        applyScannerMatch(matches[0], setForm);
        setMessage({ type: "success", text: `Scanner matched ${matches[0].name} in ${matches[0].setName}.` });
        setActiveStep((current) => Math.max(current, 1));
      } else {
        setMessage({ type: "error", text: "No confident match yet. You can keep editing manually." });
      }
    } catch (error) {
      setScannerError(error instanceof Error ? error.message : "Scanning failed.");
      try {
        const fallbackMatches = await identifyPokemonCard(file.name.replace(/\.[^.]+$/, "")).catch(() => [] as ScannerMatch[]);
        setScannerMatches(fallbackMatches);
      } catch {
        setScannerMatches([]);
      }
    } finally {
      setScannerBusy(false);
    }
  };

  const captureCameraFrame = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setScannerError("Camera is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setScannerError("Could not capture the camera frame.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setScannerError("Could not capture the camera frame.");
      return;
    }

    const file = new File([blob], `scanner-${Date.now()}.jpg`, { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(blob);
    setScannerCapture((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl };
    });
    await runScanner(file);
  };

  const importScannerPhoto = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const previewUrl = URL.createObjectURL(file);
    setScannerCapture((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl };
    });
    await runScanner(file);
  };

  const chooseScannerMatch = (match: ScannerMatch) => {
    applyScannerMatch(match, setForm);
    setScannerConfidence(match.confidence);
    setMessage({ type: "success", text: `Applied ${match.name} from the scanner suggestions.` });
  };

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!form.card_name.trim()) errors.push("Add a card or product name.");
    if (!form.set_name.trim()) errors.push("Add a set name.");
    if (!form.condition) errors.push("Choose a condition.");
    if (!form.category) errors.push("Choose a category.");

    const price = Number(form.price);
    const quantity = Number(form.quantity);
    if (!Number.isFinite(price) || price <= 0) errors.push("Set a valid price.");
    if (!Number.isFinite(quantity) || quantity < 1) errors.push("Set a valid quantity.");
    if (imageUrls.length === 0) errors.push("Upload at least one image.");
    if (isGraded && !form.grade_company) errors.push("Pick a grading company for graded listings.");
    if (isGraded && (!form.grade_score || Number(form.grade_score) <= 0)) errors.push("Add a grade score for graded listings.");
    if (!canPublish) warnings.push("Publishing is locked until seller verification is approved.");

    return {
      errors,
      warnings,
      ready: errors.length === 0 && canPublish,
      draftReady: errors.filter((error) => error !== "Upload at least one image.").length === 0,
    };
  }, [canPublish, form, imageUrls.length, isGraded]);

  const updateField = (field: keyof ListingFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const fetchPriceGuide = async () => {
    if (!form.card_name.trim() || !form.set_name.trim()) return;
    setPriceGuideLoading(true);
    setPriceGuideError(null);
    try {
      const price = await fetchCardPrice(form.card_name.trim(), form.set_name.trim());
      setMarketPrice(price.marketPrice);
    } catch {
      setPriceGuideError("Unable to load price guidance right now.");
    } finally {
      setPriceGuideLoading(false);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    if (!userId) {
      setMessage({ type: "error", text: "Please wait for your account to finish loading." });
      return;
    }

    setUploading(true);
    setMessage(null);

    const nextUrls: string[] = [];
    const nextErrors: string[] = [];

    for (const file of files) {
      try {
        if (file.size > MAX_IMAGE_SIZE_BYTES * 1.5) {
          throw new Error(`${file.name} is too large.`);
        }
        const optimized = await compressListingImage(file);
        const uploaded = await uploadImageFile({
          supabase,
          target: "listing",
          ownerId: userId,
          file: optimized,
          prefix: form.card_name.trim() || "listing",
        });
        nextUrls.push(uploaded.publicUrl);
      } catch (error) {
        nextErrors.push(error instanceof Error ? error.message : `Failed to upload ${file.name}.`);
      }
    }

    if (nextUrls.length) {
      setImageUrls((current) => {
        const merged = [...current, ...nextUrls];
        setCoverImageIndex((cover) => (cover === 0 && current.length === 0 ? 0 : Math.min(cover, merged.length - 1)));
        return merged;
      });
      setActiveStep((current) => Math.max(current, 2));
    }

    if (nextErrors.length) {
      setMessage({ type: "error", text: nextErrors.join(" ") });
    }

    setUploading(false);
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    await uploadFiles(files);
    event.target.value = "";
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropActive(false);
    await uploadFiles(Array.from(event.dataTransfer.files ?? []).filter((file) => file.type.startsWith("image/")));
  };

  const removeImage = (index: number) => {
    setImageUrls((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setCoverImageIndex((current) => {
      if (index < current) return current - 1;
      if (index === current) return 0;
      return current;
    });
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImageUrls((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = moveItem(current, index, nextIndex);
      setCoverImageIndex((currentCover) => {
        if (currentCover === index) return nextIndex;
        if (currentCover === nextIndex) return index;
        return currentCover;
      });
      return next;
    });
  };

  const makeCover = (index: number) => {
    if (index === 0) {
      setCoverImageIndex(0);
      return;
    }
    setImageUrls((current) => moveItem(current, index, 0));
    setCoverImageIndex(0);
  };

  const saveDraftToDatabase = async () => {
    if (!userId) {
      setMessage({ type: "error", text: "Please wait for your account to finish loading." });
      return null;
    }
    setSavingDraft(true);
    setMessage(null);

    const payload = buildListingPayload({
      sellerId: userId,
      form: {
        ...form,
        card_name: form.card_name.trim() || "Draft listing",
        set_name: form.set_name.trim() || "Draft set",
        price: Number(form.price) > 0 ? form.price : "0",
        quantity: Number(form.quantity) > 0 ? form.quantity : "1",
      },
      imageUrls,
      status: "draft",
    });

    const { data, error } = await (supabase.from("listings") as any).insert([payload]).select("id").single();
    if (error) {
      setSavingDraft(false);
      setMessage({ type: "error", text: error.message ?? "Failed to save draft." });
      return null;
    }

    const listingId = data?.id ?? null;
    setSavedListingId(listingId);
    setSavingDraft(false);
    setMessage({ type: "success", text: "Draft saved." });
    if (userId) window.localStorage.removeItem(getStorageKey(userId));
    return listingId;
  };

  const publishListing = async () => {
    if (!userId) {
      setMessage({ type: "error", text: "Please wait for your account to finish loading." });
      return;
    }
    if (!canPublish) {
      setMessage({ type: "error", text: "Verification is required before publishing listings." });
      return;
    }
    if (validation.errors.length > 0) {
      setMessage({ type: "error", text: validation.errors[0] });
      return;
    }

    setLoading(true);
    setMessage(null);

    const payload = {
      seller_id: userId,
      card_name: form.card_name.trim(),
      set_name: form.set_name.trim(),
      card_number: form.card_number.trim() || null,
      rarity: form.rarity.trim() || null,
      condition: form.condition,
      category: form.category,
      price: Number(form.price),
      quantity: Number(form.quantity),
      description: form.description.trim() || null,
      grade_company: isGraded ? (form.grade_company || null) : null,
      grade_score: isGraded && form.grade_score ? Number(form.grade_score) : null,
      shipping_profile_id: null,
      images: imageUrls,
      status: "active" as const,
    };

    const { data, error } = await (supabase.from("listings") as any).insert([payload]).select("id").single();
    if (error) {
      setMessage({ type: "error", text: error.message ?? "Failed to publish listing." });
      setLoading(false);
      return;
    }

    if (userId) window.localStorage.removeItem(getStorageKey(userId));
    const listingId = data?.id;
    setLoading(false);
    if (listingId) {
      router.push(`/listings?seller=${userId}`);
      return;
      return;
    }
    setMessage({ type: "success", text: "Listing published." });
  };

  const sections = [
    { id: 1, title: "Basics", description: "Card, set, condition, and category" },
    { id: 2, title: "Photos", description: "Drag, drop, reorder, and pick the cover" },
    { id: 3, title: "Pricing", description: "Price, quantity, shipping, and review" },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0f1a]/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:justify-between lg:px-8 lg:py-0 lg:h-16">
          <a href="/" className="flex items-center gap-2 text-lg font-black sm:text-xl">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex flex-1 items-center justify-end gap-2 overflow-x-auto whitespace-nowrap text-sm sm:gap-4 lg:flex-none lg:overflow-visible">
            <a href="/listings" className="text-gray-300 hover:text-white">Browse</a>
            <a href="/dashboard" className="text-gray-300 hover:text-white">Dashboard</a>
            <a href={copy.backHref} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 sm:px-4">{copy.backLabel}</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-yellow-400/10 p-5 shadow-2xl shadow-black/20 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-yellow-400 sm:px-4 sm:text-xs sm:tracking-[0.35em]">
                    <span>{copy.eyebrow}</span>
                    <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black tracking-normal text-black">Autosave on</span>
                  </div>
                  <div className="max-w-3xl space-y-3">
                    <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{copy.title}</h1>
                    <p className="max-w-2xl text-sm leading-6 text-gray-300 sm:text-base sm:leading-7">{copy.description}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {sections.map((section) => (
                      <div key={section.id} className={`rounded-2xl border p-4 ${activeStep === section.id ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-white/5"}`}>
                        <div className="text-xs font-semibold uppercase tracking-widest text-yellow-400">Step {section.id}</div>
                        <div className="mt-1 font-bold text-white">{section.title}</div>
                        <div className="mt-1 text-xs leading-5 text-gray-400">{section.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13131f] p-4 sm:p-5">
                  <div className="text-sm font-semibold text-white">Draft status</div>
                  <div className="mt-1 text-xs text-gray-500">Saved {formatAgo(draftUpdatedAt)}</div>
                  <div className="mt-4 space-y-3 text-sm text-gray-300">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"><span>Photos</span><span>{imageUrls.length}</span></div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"><span>Category</span><span className="capitalize">{form.category}</span></div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"><span>Ready to publish</span><span>{validation.ready ? "Yes" : "Not yet"}</span></div>
                  </div>
                  <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-xs leading-5 text-yellow-100">
                    {copy.actionHint}
                  </div>
                </div>
              </div>
            </section>

            {!isAdmin && (
              <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                <SellerVerificationStatusCard
                  status={verificationStatus}
                  rejectionReason={verificationData?.rejection_reason}
                  moreInfo={verificationData?.more_information_request}
                  verifiedAt={verificationData?.verified_at}
                />
                {!canPublish && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">Publishing is locked until verification is approved. You can still save a draft.</div>}
              </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/10 sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-yellow-400">Step {activeStep} of 3</div>
                  <h2 className="mt-2 text-2xl font-black">{activeStep === 1 ? "Details" : activeStep === 2 ? "Photos" : "Review"}</h2>
                </div>
                <div className="text-sm text-gray-400">{validation.errors.length} issue{validation.errors.length === 1 ? "" : "s"} to clear before publish</div>
              </div>

              <div className="mb-6 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${(activeStep / 3) * 100}%` }} />
              </div>

              <div className={activeStep === 1 ? "block" : "hidden"}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Card / Product Name *</label>
                    <input value={form.card_name} onChange={(e) => updateField("card_name", e.target.value)} placeholder="" className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-400" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Set *</label>
                    <input value={form.set_name} onChange={(e) => updateField("set_name", e.target.value)} placeholder="" className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-400" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Card Number</label>
                    <input value={form.card_number} onChange={(e) => updateField("card_number", e.target.value)} placeholder="" className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-400" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Rarity</label>
                    <input value={form.rarity} onChange={(e) => updateField("rarity", e.target.value)} placeholder="" className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-400" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Condition *</label>
                    <select value={form.condition} onChange={(e) => updateField("condition", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400">
                      {CONDITIONS.map((condition) => <option key={condition} value={condition} className="bg-gray-900">{condition}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">Category *</label>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {CATEGORIES.map((category) => (
                        <button key={category.value} type="button" onClick={() => updateField("category", category.value)} className={`rounded-xl border px-4 py-3 text-left transition ${form.category === category.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-white/10 bg-[#13131f] text-gray-300 hover:border-white/25"}`}>
                          <div className="text-sm font-semibold">{category.label}</div>
                          <div className="mt-1 text-xs text-gray-500">{category.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {isGraded && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">Grading Company *</label>
                        <select value={form.grade_company} onChange={(e) => updateField("grade_company", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400">
                          {GRADE_COMPANIES.map((company) => <option key={company || "none"} value={company} className="bg-gray-900">{company || "Select..."}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">Grade Score *</label>
                        <input value={form.grade_score} onChange={(e) => updateField("grade_score", e.target.value)} type="number" step="0.5" min="1" max="10" placeholder="" className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-400" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={activeStep === 2 ? "block" : "hidden"}>
                <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropActive(true);
                    }}
                    onDragLeave={() => setDropActive(false)}
                    onDrop={handleDrop}
                    className={`rounded-3xl border border-dashed p-5 transition ${dropActive ? "border-yellow-400 bg-yellow-400/10" : "border-white/15 bg-[#13131f]"}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-bold">Photos</h3>
                        <p className="mt-1 text-sm leading-6 text-gray-400">Add images and reorder them before publish.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setScannerOpen(true)} className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-bold text-yellow-300 hover:bg-yellow-400/20">Scan Card</button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300">Upload Images</button>
                      </div>
                    </div>

                    <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileInput} className="hidden" />
                    <input ref={scannerFileInputRef} type="file" accept="image/*" capture="environment" onChange={(event) => {
                      void importScannerPhoto(event.target.files);
                      event.target.value = "";
                    }} className="hidden" />
                    {scannerOpen && (
                      <div className="mt-4 rounded-3xl border border-yellow-400/20 bg-black/30 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-400">Scanner</div>
                                <h4 className="mt-1 text-lg font-bold">Scanner</h4>
                              </div>
                              <button type="button" onClick={() => setScannerOpen(false)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/5">Close</button>
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12]">
                              <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => void captureCameraFrame()} disabled={scannerBusy} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">Capture & Scan</button>
                              <button type="button" onClick={() => scannerFileInputRef.current?.click()} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-white/5">Upload scan photo</button>
                              <button type="button" onClick={() => setScannerMatches([])} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-white/5">Clear results</button>
                            </div>
                            {scannerBusy && <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">Scanning card…</div>}
                            {scannerError && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{scannerError}</div>}
                            {scannerText && <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-gray-300"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">Detected text</div><pre className="whitespace-pre-wrap">{scannerText}</pre></div>}
                          </div>
                          <div className="w-full max-w-sm space-y-3 lg:w-80">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                              <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Confidence</div>
                              <div className="mt-1 text-2xl font-black text-white">{scannerConfidence !== null ? `${scannerConfidence}%` : "—"}</div>
                              <div className="mt-2 text-xs leading-5 text-gray-500">Suggestions appear here.</div>
                            </div>
                            {scannerMatches.length > 0 ? scannerMatches.map((match, index) => (
                              <button key={match.id} type="button" onClick={() => chooseScannerMatch(match)} className={`w-full rounded-2xl border p-4 text-left transition ${index === 0 ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-[#13131f] hover:border-white/20"}`}>
                                <div className="flex items-start gap-3">
                                  {match.image ? <img src={match.image} alt="" className="h-16 w-12 rounded-lg object-cover" /> : <div className="h-16 w-12 rounded-lg bg-white/10" />}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="truncate font-semibold text-white">{match.name}</div>
                                      <div className="text-xs text-gray-400">{match.confidence}%</div>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-400">{match.setName}{match.number ? ` · #${match.number}` : ""}</div>
                                    <div className="mt-2 text-xs leading-5 text-gray-500">{match.suggestedTitle}</div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-300">
                                      <span className="rounded-full border border-white/10 px-2 py-1">${match.suggestedSellPrice?.toFixed(2) ?? "—"}</span>
                                      <span className="rounded-full border border-white/10 px-2 py-1">{match.variants[0] ?? "Card"}</span>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )) : (
                              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No match.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <input ref={scannerFileInputRef} type="file" accept="image/*" capture="environment" onChange={(event) => { void importScannerPhoto(event.target.files); event.target.value = ""; }} className="hidden" />

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {imageUrls.map((url, index) => (
                        <div key={`${url}-${index}`} className={`overflow-hidden rounded-2xl border ${coverImageIndex === index ? "border-yellow-400" : "border-white/10"} bg-black/20`}>
                          <div className="aspect-[4/3] bg-[#0b0b12]">
                            <img src={url} alt={`Listing image ${index + 1}`} className="h-full w-full object-cover" />
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="flex items-center justify-between text-xs text-gray-400">
                              <span>{coverImageIndex === index ? "Primary image" : `Image ${index + 1}`}</span>
                              <span>{index + 1} of {imageUrls.length}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <button type="button" onClick={() => makeCover(index)} className="rounded-lg border border-white/10 px-3 py-2 text-white hover:bg-white/5">Cover</button>
                              <button type="button" onClick={() => removeImage(index)} className="rounded-lg border border-red-400/30 px-3 py-2 text-red-300 hover:bg-red-400/10">Delete</button>
                              <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} className="rounded-lg border border-white/10 px-3 py-2 text-gray-300 hover:bg-white/5 disabled:opacity-40">Move up</button>
                              <button type="button" onClick={() => moveImage(index, 1)} disabled={index === imageUrls.length - 1} className="rounded-lg border border-white/10 px-3 py-2 text-gray-300 hover:bg-white/5 disabled:opacity-40">Move down</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!imageUrls.length && (
                      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-400">
                        Upload at least one photo.
                      </div>
                    )}

                    {uploading && <div className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">Optimizing and uploading photos…</div>}
                  </div>

                  <div className="space-y-4 rounded-3xl border border-white/10 bg-[#13131f] p-4 sm:p-5">
                    <h3 className="text-lg font-bold">Photo</h3>
                    <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                      {imageUrls.length === 0 ? "No photos yet." : `${imageUrls.length} photo${imageUrls.length === 1 ? "" : "s"} ready.`}
                    </div>
                  </div>
                </div>
              </div>

              <div className={activeStep === 3 ? "block" : "hidden"}>
                <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">Price ($) *</label>
                        <input value={form.price} onChange={(e) => updateField("price", e.target.value)} type="number" step="0.01" min="0" placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-400" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">Quantity *</label>
                        <input value={form.quantity} onChange={(e) => updateField("quantity", e.target.value)} type="number" min="1" className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400" />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label className="block text-sm font-medium text-gray-300">Description</label>
                        <button type="button" onClick={fetchPriceGuide} disabled={priceGuideLoading || !form.card_name.trim() || !form.set_name.trim()} className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-400/20 disabled:opacity-50">
                          {priceGuideLoading ? "Loading…" : "Get price guide"}
                        </button>
                      </div>
                      <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={8} placeholder="" className="w-full resize-none rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-400" />
                      {priceGuideError && <div className="mt-2 text-xs text-red-400">{priceGuideError}</div>}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                      <div className="flex items-center justify-between"><span>Suggested market price</span><span className="font-semibold text-white">{marketPrice !== null ? `$${marketPrice.toFixed(2)}` : "Add card details"}</span></div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-3xl border border-white/10 bg-[#13131f] p-4 sm:p-5">
                    <h3 className="text-lg font-bold">Checklist</h3>
                    <div className="space-y-2 text-sm">
                      {[
                        validation.errors.length === 0 || validation.errors.every((error) => error !== "Add a card or product name.") ? "Card details complete" : "Complete card details",
                        imageUrls.length > 0 ? "Photos uploaded" : "Upload a photo",
                        validation.ready ? "Ready" : "Fix remaining checks",
                      ].map((item, index) => (
                        <div key={item} className={`rounded-xl border px-4 py-3 ${index === 2 && validation.ready ? "border-green-400/20 bg-green-400/10 text-green-100" : "border-white/10 bg-white/5 text-gray-300"}`}>
                          {item}
                        </div>
                      ))}
                    </div>

                    {validation.errors.length > 0 && (
                      <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
                        <div className="font-semibold">Fix before publishing</div>
                        <ul className="mt-2 space-y-1 text-xs leading-5">
                          {validation.errors.map((error) => <li key={error}>• {error}</li>)}
                        </ul>
                      </div>
                    )}

                    {validation.warnings.length > 0 && (
                      <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                        <div className="font-semibold">Note</div>
                        <ul className="mt-2 space-y-1 text-xs leading-5">
                          {validation.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                        </ul>
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm font-semibold text-white">Preview summary</div>
                      <div className="mt-3 space-y-2 text-sm text-gray-300">
                        <div className="flex items-center justify-between"><span>Title</span><span className="max-w-[12rem] truncate text-right">{preview.title}</span></div>
                        <div className="flex items-center justify-between"><span>Set</span><span className="max-w-[12rem] truncate text-right">{preview.subtitle || "—"}</span></div>
                        <div className="flex items-center justify-between"><span>Category</span><span className="capitalize">{preview.category}</span></div>
                        <div className="flex items-center justify-between"><span>Condition</span><span>{preview.condition}</span></div>
                        <div className="flex items-center justify-between"><span>Shipping</span><span className="text-right">{preview.shipping}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {message && (
                <div className={`mt-5 rounded-2xl border p-4 text-sm ${message.type === "error" ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-green-500/20 bg-green-500/10 text-green-200"}`}>
                  {message.text}
                  {savedListingId && (
                    <a href={`/listings/${savedListingId}`} className="mt-2 block text-xs font-semibold text-white underline underline-offset-4">Open saved draft</a>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setActiveStep((step) => Math.max(1, step - 1))} disabled={activeStep === 1} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-40">
                    Back
                  </button>
                  <button type="button" onClick={() => setActiveStep((step) => Math.min(3, step + 1))} disabled={activeStep === 3} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-40">
                    Next
                  </button>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={async () => {
                    if (validation.draftReady || imageUrls.length) {
                      await saveDraftToDatabase();
                      return;
                    }
                    setMessage({ type: "error", text: "Add the core listing details before saving a draft." });
                  }} disabled={savingDraft || loading} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-200 hover:bg-white/5 disabled:opacity-50">
                    {savingDraft ? "Saving draft..." : "Save draft"}
                  </button>
                  <button type="button" onClick={() => void publishListing()} disabled={loading || !canPublish} className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50">
                    {loading ? "Publishing..." : copy.actionLabel}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#13131f] shadow-2xl shadow-black/20">
              <div className="aspect-[4/3] bg-[#0b0b12] sm:aspect-[16/10]">
                {preview.heroImage ? (
                  <img src={preview.heroImage} alt="Listing preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500">Your main image will appear here after upload.</div>
                )}
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.25em] text-yellow-400">Preview</div>
                    <h2 className="mt-2 text-xl font-black leading-tight">{preview.title}</h2>
                    <p className="mt-1 text-sm text-gray-400">{preview.subtitle || "Set details will appear here."}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold capitalize text-gray-200">{preview.category}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Condition</div>
                    <div className="mt-1 font-semibold text-white">{preview.condition}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Price</div>
                    <div className="mt-1 font-semibold text-white">{preview.price !== null ? `$${preview.price.toFixed(2)}` : "—"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Quantity</div>
                    <div className="mt-1 font-semibold text-white">{preview.quantity}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Photos</div>
                    <div className="mt-1 font-semibold text-white">{imageUrls.length}</div>
                  </div>
                </div>

                {preview.rarity && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Rarity</div>
                    <div className="mt-1 font-semibold text-white">{preview.rarity}</div>
                  </div>
                )}

                {preview.grade && (
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                    <div className="text-xs uppercase tracking-widest text-yellow-400">Grading</div>
                    <div className="mt-1 font-semibold">{preview.grade}</div>
                  </div>
                )}

                {preview.description && <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-gray-300">{preview.description}</p>}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">Publish readiness</div>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                {validation.errors.length === 0 ? (
                  <div className="rounded-xl border border-green-400/20 bg-green-400/10 px-4 py-3 text-green-100">All required fields are ready.</div>
                ) : (
                  validation.errors.slice(0, 4).map((error) => (
                    <div key={error} className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3">{error}</div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
