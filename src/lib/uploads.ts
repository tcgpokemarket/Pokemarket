import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_VERIFICATION_DOCUMENT_SIZE_BYTES = 12 * 1024 * 1024;

function bucketForTarget(target: string) {
  if (target === "seller-store") return "store-images";
  if (target === "live-show") return "live-show-images";
  if (target === "verification") return "verification-documents";
  return "listing-images";
}

function buildStoragePath(target: string, ownerId: string, prefix: string, fileName: string) {
  const ext = fileName.split(".").pop() ?? "jpg";
  const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  return `${target}/${ownerId}/${safePrefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
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
  const bucket = bucketForTarget(target);
  const path = buildStoragePath(target, ownerId, prefix, file.name);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
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
  const bucket = bucketForTarget("verification");
  const path = buildStoragePath("verification", ownerId, prefix, file.name);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return { path, bucket, mimeType: file.type || null, fileName: file.name };
}
