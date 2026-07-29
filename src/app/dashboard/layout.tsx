import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth-bootstrap";
import { getAppRole } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { ensureAdminAccount } from "@/lib/auth-bootstrap";

const HAS_SUPABASE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const metadata: Metadata = {
  title: "Seller Dashboard",
  description: "Manage your Pokémon TCG listings, track sales, and view payouts on TCG Poke Market.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!HAS_SUPABASE) return <>{children}</>;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  if (!session || !user) redirect("/auth?reason=session_expired&redirectTo=/dashboard");

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("id, username, full_name, avatar_url, seller_state, shipping_address, is_seller, seller_rating, total_sales").eq("id", user.id).maybeSingle();

  if (profileError) {
    redirect(`/auth?redirectTo=/dashboard&reason=${encodeURIComponent(profileError.message)}`);
  }

  if (!profile) {
    const bootstrap = await ensureProfileForUser({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      sellerState: user.user_metadata?.seller_state ?? null,
      shippingAddress: null,
      accountType: (getAppRole(user) === "seller" ? "seller" : "buyer"),
    }).catch((error) => ({ error }));

    if ("error" in bootstrap) {
      const message = bootstrap.error instanceof Error ? bootstrap.error.message : String(bootstrap.error);
      redirect(`/auth?redirectTo=/dashboard&reason=${encodeURIComponent(message)}`);
    }
  }

  if (getAppRole(user) === "admin" || getAppRole(user) === "super_admin") {
    await ensureAdminAccount().catch(() => null);
  }

  return <>{children}</>;
}
