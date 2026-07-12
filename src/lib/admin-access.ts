import type { User } from "@supabase/supabase-js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "tcgpokemarketadmin@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getEmailCandidates(user: User | null | undefined) {
  return [
    normalizeEmail(user?.email),
    normalizeEmail(user?.app_metadata?.email),
    normalizeEmail(user?.user_metadata?.email),
    normalizeEmail(user?.user_metadata?.full_name),
  ].filter(Boolean);
}

export function isAdminUser(user: User | null | undefined) {
  const candidates = getEmailCandidates(user);
  return candidates.some((email) => ADMIN_EMAILS.includes(email)) || Boolean(user?.app_metadata?.role === "admin" || user?.app_metadata?.role === "super_admin");
}

export function getAdminEmailList() {
  return ADMIN_EMAILS;
}

export function assertSingleAdmin(user: User | null | undefined) {
  return isAdminUser(user) && getAdminEmailList().length === 1;
}
