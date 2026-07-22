import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ReferralDashboardClient from "./ReferralDashboardClient";
import type {
  ReferralDashboardStats,
  ReferralAttributionWithRewards,
} from "@/lib/referral-types";

export const dynamic = "force-dynamic";

export default async function ReferralDashboardPage() {
  // ── Auth ─────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/referrals");
  }

  const adminClient = createAdminClient();

  // ── Fetch profile for referral code ──────────────────────────
  const { data: profile } = await (adminClient as any)
    .from("profiles")
    .select("id, username, full_name, referral_code")
    .eq("id", user.id)
    .single();

  const code = profile?.referral_code ?? "";
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tcgpoke.app";
  const link = code
    ? `${baseUrl}/signup?ref=${encodeURIComponent(code)}`
    : `${baseUrl}/signup`;

  // ── Fetch dashboard stats from view ──────────────────────────
  const { data: statsRow } = await (adminClient as any)
    .from("referral_dashboard_stats")
    .select("*")
    .eq("referrer_id", user.id)
    .single();

  const stats: ReferralDashboardStats | null = statsRow
    ? {
        referrer_id: statsRow.referrer_id as string,
        total_referrals: Number(statsRow.total_referrals ?? 0),
        qualified_referrals: Number(statsRow.qualified_referrals ?? 0),
        pending_rewards: Number(statsRow.pending_rewards ?? 0),
        paid_rewards: Number(statsRow.paid_rewards ?? 0),
        approved_rewards: Number(statsRow.approved_rewards ?? 0),
        lifetime_earnings: Number(statsRow.lifetime_earnings ?? 0),
      }
    : null;

  // ── Fetch referral history ────────────────────────────────────
  const { data: referralsRaw } = await (adminClient as any)
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

  const referrals = (referralsRaw ?? []) as ReferralAttributionWithRewards[];

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">
            Referral program
          </p>
          <h1 className="mt-3 text-3xl font-black">Invite friends, earn rewards</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Share your unique referral link or code. When someone you refer
            makes their first purchase, you earn a cash reward — automatically.
          </p>
        </div>

        {code ? (
          <ReferralDashboardClient
            code={code}
            link={link}
            stats={stats}
            referrals={referrals}
          />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-gray-400">
              Your referral code is being generated. Please check back shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
