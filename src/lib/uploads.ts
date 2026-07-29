import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_LISTING_IMAGE_COUNT = 12;
export const MAX_VERIFICATION_DOCUMENT_SIZE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VERIFICATION_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function ensureUploadAllowed(file: File, allowedTypes: Set<string>, maxBytes: number) {
  if (!allowedTypes.has(file.type)) {
    throw new Error("Unsupported file type.");
  }
  if (file.size > maxBytes) {
    throw new Error("File is too large.");
  }
}

export function parsePublicStorageUrl(url: string) {
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/";
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    const objectPath = parsed.pathname.slice(index + marker.length);
    const firstSlash = objectPath.indexOf("/");
    if (firstSlash === -1) return null;
    const bucket = objectPath.slice(0, firstSlash);
    const path = objectPath.slice(firstSlash + 1);
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export function isListingImageUrl(url: string) {
  const parsed = parsePublicStorageUrl(url);
  return parsed?.bucket === "listing-images" ? parsed : null;
}

function bucketForTarget(target: string) {
  if (target === "seller-store") return "seller-assets";
  if (target === "live-show") return "live-show-media";
  if (target === "verification") return "verification-documents";
  return "listing-images";
}

function buildStoragePath(target: string, ownerId: string, prefix: string, fileName: string) {
  const ext = fileName.split(".").pop() ?? "jpg";
  const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  return `${target}/${ownerId}/${safePrefix}-${crypto.randomUUID().slice(0, 12)}.${ext}`;
}

export function normalizeListingImageUrls(images: unknown[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of images) {
    const rawUrl =
      typeof value === "string"
        ? value
        : value && typeof value === "object"
          ? typeof (value as { public_url?: unknown }).public_url === "string"
            ? (value as { public_url: string }).public_url
            : typeof (value as { publicUrl?: unknown }).publicUrl === "string"
              ? (value as { publicUrl: string }).publicUrl
              : typeof (value as { url?: unknown }).url === "string"
                ? (value as { url: string }).url
                : null
          : null;
    if (!rawUrl) continue;
    const trimmed = rawUrl.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function normalizeListingImageRecords(images: unknown[]) {
  return normalizeListingImageUrls(images).map((publicUrl, index) => toListingImageRecord(publicUrl, index, "listing"));
}

export function getListingImagesInDisplayOrder(images: unknown[]) {
  return normalizeListingImageUrls(images);
}

export function getListingPrimaryImage(images: unknown[]) {
  return getListingImagesInDisplayOrder(images)[0] ?? null;
}

export function getProfessionalFallbackImage() {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="1500" gradientUnits="userSpaceOnUse">
          <stop stop-color="#111827"/>
          <stop offset="1" stop-color="#1F2937"/>
        </linearGradient>
        <linearGradient id="accent" x1="180" y1="180" x2="1020" y2="1320" gradientUnits="userSpaceOnUse">
          <stop stop-color="#E22400"/>
          <stop offset="0.52" stop-color="#FFAB01"/>
          <stop offset="1" stop-color="#FEFB41"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1500" rx="72" fill="url(#bg)"/>
      <rect x="72" y="72" width="1056" height="1356" rx="56" stroke="rgba(255,255,255,0.12)" stroke-width="8"/>
      <rect x="180" y="220" width="840" height="840" rx="56" fill="rgba(255,255,255,0.04)" stroke="url(#accent)" stroke-width="10"/>
      <path d="M380 606c0-121 98-219 220-219s220 98 220 219-98 219-220 219-220-98-220-219Zm220-138c-76 0-138 62-138 138s62 138 138 138 138-62 138-138-62-138-138-138Z" fill="url(#accent)"/>
      <circle cx="600" cy="607" r="58" fill="#0F172A" stroke="#FFFFFF" stroke-opacity="0.9" stroke-width="12"/>
      <circle cx="600" cy="607" r="18" fill="#FFFFFF"/>
      <text x="600" y="1200" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700" fill="#E5E7EB">Image unavailable</text>
      <text x="600" y="1272" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#9CA3AF">TcgPoké Market</text>
    </svg>`,
  )}`;
}

export function toListingImageRecord(publicUrl: string, sortOrder: number, source: string) {
  const parsed = parsePublicStorageUrl(publicUrl);
  return {
    bucket: parsed?.bucket ?? "listing-images",
    storage_path: parsed?.path ?? publicUrl,
    public_url: publicUrl,
    sort_order: sortOrder,
    source,
  };
}

export async function uploadImageFile({
  supabase,
  target,
  ownerId,
  file,
  prefix = "image",
}: {
  supabase: SupabaseClient<Database>;
  target: string;
  ownerId: string;
  file: File;
  prefix?: string;
}) {
  ensureUploadAllowed(file, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES);
  const bucket = bucketForTarget(target);
  const path = buildStoragePath(target, ownerId, prefix, file.name);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
    bucket,
  };
}

export async function uploadVerificationDocumentFile({
  supabase,
  ownerId,
  file,
  prefix,
}: {
  supabase: SupabaseClient<Database>;
  ownerId: string;
  file: File;
  prefix: "id-front" | "id-back" | "selfie" | "address-proof";
}) {
  ensureUploadAllowed(file, ALLOWED_VERIFICATION_MIME_TYPES, MAX_VERIFICATION_DOCUMENT_SIZE_BYTES);
  const bucket = bucketForTarget("verification");
  const path = buildStoragePath("verification", ownerId, prefix, file.name);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return { path, bucket, mimeType: file.type || null, fileName: file.name };
}

export async function deleteUploadedFile({
  supabase,
  target,
  path,
}: {
  supabase: SupabaseClient<Database>;
  target: string;
  path: string;
}) {
  const bucket = bucketForTarget(target);
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
