import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/security";

export function isAdminUser(user: User | null | undefined) {
  return isAdmin(user);
}

export function getAdminEmailList() {
  const primary = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const list = (process.env.ADMIN_EMAILS ?? "tcgpokemarketadmin@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return primary ? Array.from(new Set([primary, ...list])) : list;
}
