import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReferralStatsResponse } from "@/lib/referral-types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ReferralStatsResponse | { error: string }>> {
  // ── Auth ─────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // ── Fetch stats from view ────────────────────────────────────
  const { data: statsRow } = await (adminClient as any)
    .from("referral_dashboard_stats")
    .select("*")
    .eq("referrer_id", user.id)
    .single();

  // ── Fetch referral history ────────────────────────────────────
  const { data: referrals } = await (adminClient as any)
    .from("referral_attributions")
    .select(
      `
      *,
      referred_profile:profiles!referral_attributions_referred_user_id_fkey(
        username,
        full_name,
        avatar_url
      ),
      rewards:referral_rewards(*)
    `,
    )
    .eq("referrer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    stats: statsRow ?? null,
    referrals: referrals ?? [],
  });
}
