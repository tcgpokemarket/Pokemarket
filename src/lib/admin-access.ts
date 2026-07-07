import type { User } from "@supabase/supabase-js";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "tcgpokemarketadmin@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: User | null | undefined) {
  return Boolean(user?.email && getAdminEmails().includes(user.email.toLowerCase()));
}

export function getAdminEmailList() {
  return getAdminEmails();
}
