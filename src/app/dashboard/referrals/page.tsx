import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ReferralDashboardClient from "./ReferralDashboardClient";
import type { ReferralAttributionWithRewards, ReferralDashboardStats } from "@/lib/referral-types";

export const dynamic = "force-dynamic";

export default async function ReferralDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const adminClient = createAdminClient();
  const { data: profile } = await (adminClient as any).from("profiles").select("username, referral_code").eq("id", user.id).maybeSingle();
  const code = profile?.referral_code ?? "";
  const link = code ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/signup?ref=${encodeURIComponent(code)}` : "";

  const { data: statsRow } = await (adminClient as any).from("referral_dashboard_stats").select("*").eq("referrer_id", user.id).maybeSingle();
  const stats = (statsRow ?? null) as ReferralDashboardStats | null;

  const { data: referralsRaw } = await (adminClient as any)
    .from("referral_attributions")
    .select(`*, referred_profile:profiles!referral_attributions_referred_user_id_fkey(username, full_name, avatar_url), rewards:referral_rewards(*)`)
    .eq("referrer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const referrals = (referralsRaw ?? []) as ReferralAttributionWithRewards[];

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Referral program</p>
          <h1 className="mt-3 text-3xl font-black">Invite friends, earn rewards</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">Share your unique referral link or code. You earn a reward only after a verified account places a successful qualifying order, clears the dispute window, and stays under the lifetime commission cap.</p>
        </div>

        {code ? <ReferralDashboardClient code={code} link={link} stats={stats} referrals={referrals} /> : <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><p className="text-gray-400">Your referral code is being generated. Please check back shortly.</p></div>}
      </div>
    </div>
  );
}
