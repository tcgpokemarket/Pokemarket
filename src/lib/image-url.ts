/**
 * Normalizes listing/live-show image values coming from Supabase.
 * Uploads may store either a full public URL or a storage path.
 */
export function normalizePublicImageUrl(value: string | null | undefined, bucket: string): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;

  let path = raw.replace(/^\/+/, "");
  if (path.startsWith(`${bucket}/`)) path = path.slice(bucket.length + 1);
  if (path.startsWith("storage/v1/object/public/")) {
    return `${base}/${path}`;
  }

  return `${base}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}
