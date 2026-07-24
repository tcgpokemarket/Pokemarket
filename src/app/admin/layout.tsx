import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppRole } from "@/lib/security";

const HAS_SUPABASE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!HAS_SUPABASE) return <>{children}</>;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?redirectTo=/admin");
  if (getAppRole(user) !== "admin" && getAppRole(user) !== "super_admin") redirect("/dashboard");

  return <>{children}</>;
}