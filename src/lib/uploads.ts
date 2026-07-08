import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const UPLOAD_BUCKET = "marketplace-media";
export const LISTING_IMAGE_BUCKET = "listing-images";
export const LIVE_SHOW_BUCKET = "live-show-media";
export const SELLER_ASSET_BUCKET = "seller-assets";
export const PROFILE_ASSET_BUCKET = "profile-assets";
export const CATEGORY_ASSET_BUCKET = "category-assets";
export const COMMUNITY_ASSET_BUCKET = "community-assets";
export const GIVEAWAY_ASSET_BUCKET = "giveaway-assets";
export const ADMIN_ASSET_BUCKET = "admin-assets";
export const HELP_ASSET_BUCKET = "help-assets";
export const EMAIL_ASSET_BUCKET = "email-assets";

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_DIMENSION = 4096;

export type UploadTarget =
  | "listing"
  | "seller-store"
  | "profile"
  | "live-show"
  | "category"
  | "community"
  | "giveaway"
  | "admin"
  | "help"
  | "email";

const BUCKET_BY_TARGET: Record<UploadTarget, string> = {
  listing: LISTING_IMAGE_BUCKET,
  "seller-store": SELLER_ASSET_BUCKET,
  profile: PROFILE_ASSET_BUCKET,
  "live-show": LIVE_SHOW_BUCKET,
  category: CATEGORY_ASSET_BUCKET,
  community: COMMUNITY_ASSET_BUCKET,
  giveaway: GIVEAWAY_ASSET_BUCKET,
  admin: ADMIN_ASSET_BUCKET,
  help: HELP_ASSET_BUCKET,
  email: EMAIL_ASSET_BUCKET,
};

export function isSupportedImageType(type: string) {
  return SUPPORTED_IMAGE_TYPES.includes(type as (typeof SUPPORTED_IMAGE_TYPES)[number]);
}

export function sanitizeUploadFilename(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeImagePath(path: string) {
  return path.replace(/^\/+/, "");
}

export function getUploadBucket(target: UploadTarget) {
  return BUCKET_BY_TARGET[target];
}

export function buildUploadPath(args: { target: UploadTarget; ownerId: string; fileName: string; prefix?: string }) {
  const safeName = sanitizeUploadFilename(args.fileName) || "upload";
  const stamp = crypto.randomUUID();
  const prefix = args.prefix ? `${sanitizeUploadFilename(args.prefix)}/` : "";
  return normalizeImagePath(`${prefix}${args.target}/${args.ownerId}/${stamp}-${safeName}`);
}

export async function uploadImageFile(args: { supabase: SupabaseClient<Database>; target: UploadTarget; ownerId: string; file: File; prefix?: string }) {
  if (!isSupportedImageType(args.file.type)) {
    throw new Error("Unsupported image type. Use JPG, PNG, WebP, or GIF.");
  }

  if (args.file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image is too large.");
  }

  const bucket = getUploadBucket(args.target);
  const path = buildUploadPath({ target: args.target, ownerId: args.ownerId, fileName: args.file.name, prefix: args.prefix });
  const { error } = await args.supabase.storage.from(bucket).upload(path, args.file, {
    upsert: false,
    contentType: args.file.type,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = args.supabase.storage.from(bucket).getPublicUrl(path);
  return { bucket, path, publicUrl: data.publicUrl };
}

export async function deleteUploadedFile(args: { supabase: SupabaseClient<Database>; target: UploadTarget; path: string }) {
  const bucket = getUploadBucket(args.target);
  const { error } = await args.supabase.storage.from(bucket).remove([normalizeImagePath(args.path)]);
  if (error) {
    throw new Error(error.message);
  }
}
