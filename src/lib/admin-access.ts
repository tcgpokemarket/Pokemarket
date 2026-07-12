import type { User } from "@supabase/supabase-js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "tcgpokemarketadmin@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminUser(user: User | null | undefined) {
  return Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
}

export function getAdminEmailList() {
  return ADMIN_EMAILS;
}

export function assertSingleAdmin(user: User | null | undefined) {
  return isAdminUser(user) && getAdminEmailList().length === 1;
}
