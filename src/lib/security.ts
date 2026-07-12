import type { User } from "@supabase/supabase-js";

export type AppRole = "buyer" | "seller" | "moderator" | "support" | "admin" | "super_admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "tcgpokemarketadmin@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeRole(value: unknown): AppRole | null {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "buyer" || role === "seller" || role === "moderator" || role === "support" || role === "admin" || role === "super_admin") {
    return role;
  }
  return null;
}

export function getAppRole(user: User | null | undefined): AppRole {
  const metadataRole = normalizeRole(user?.app_metadata?.role) ?? normalizeRole(user?.user_metadata?.role);
  if (metadataRole) return metadataRole;

  const email = user?.email?.toLowerCase() ?? "";
  if (ADMIN_EMAILS.includes(email)) return "admin";
  return "buyer";
}

export function isAdmin(user: User | null | undefined) {
  return getAppRole(user) === "admin" || getAppRole(user) === "super_admin";
}

export function bypassVerificationFor(user: User | null | undefined) {
  return isAdmin(user);
}

export function requireAuthenticated(user: User | null | undefined) {
  return Boolean(user);
}

export function sanitizeString(value: unknown, maxLength = 256) {
  const text = String(value ?? "").trim();
  return text.slice(0, maxLength);
}

export function sanitizeNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function sanitizeStringArray(value: unknown, maxItems = 12, maxLength = 2048) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sanitizeString(entry, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function isValidHttpUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
