import type { User } from "@supabase/supabase-js";

const OWNER_ADMIN_EMAIL = (process.env.ADMIN_EMAILS ?? "tcgpokemarketadmin@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .find(Boolean) ?? "tcgpokemarketadmin@gmail.com";

export function isAdminUser(user: User | null | undefined) {
  return Boolean(user?.email && user.email.toLowerCase() === OWNER_ADMIN_EMAIL);
}

export function getAdminEmailList() {
  return [OWNER_ADMIN_EMAIL];
}
