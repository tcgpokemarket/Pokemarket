import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppRole } from "@/lib/security";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?redirectTo=/admin");
  if (getAppRole(user) !== "admin" && getAppRole(user) !== "super_admin") redirect("/dashboard");

  return <>{children}</>;
}
