import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth-bootstrap";

const HAS_SUPABASE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your TCG Poké Market account, wallet, listings, and seller tools.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!HAS_SUPABASE) return <>{children}</>;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!session || !user) {
    redirect("/auth?reason=session_expired&redirectTo=/dashboard");
  }

  const { data: profile } = await supabase.from("profiles").select("id, is_seller").eq("id", user.id).maybeSingle();

  if (!profile) {
    await ensureProfileForUser({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      sellerState: user.user_metadata?.seller_state ?? null,
      shippingAddress: null,
      accountType: user.user_metadata?.role === "seller" ? "seller" : "buyer",
    });
  }

  return <>{children}</>;
}
