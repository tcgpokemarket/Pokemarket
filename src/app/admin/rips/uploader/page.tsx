import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RipsUploaderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin/rips/uploader");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) redirect("/dashboard");

  const { default: InventoryDashboard } = await import("../inventory/InventoryDashboard");

  return <InventoryDashboard />;
}
