import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import AdminReferralsClient from "./AdminReferralsClient";
import type { TopReferrer, PendingRewardRow, ReferralFraudFlag } from "@/lib/referral-types";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  prefix,
  accent,
}: {
  label: string;
  value: number;
  prefix?: string;
  accent?: "yellow" | "green" | "red" | "blue";
}) {
  const accentMap: Record<string, string> = {
    yellow: "text-yellow-400",
    green: "text-green-400",
    red: "text-red-400",
    blue: "text-blue-400",
  };
  const cls = accentMap[accent ?? ""] ?? "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${cls}`}>
        {prefix}
        {prefix === "$" ? Number(value).toFixed(2) : value}
      </p>
    </div>
  );
}

export default async function AdminReferralsPage() {
  // ── Auth ─────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    redirect("/dashboard");
  }

  const adminClient = createAdminClient();

  // ── Aggregate stats via view ─────────────────────────────────
  const { data: statsRows } = await (adminClient as any)
    .from("referral_dashboard_stats")
    .select("total_referrals, qualified_referrals, pending_rewards, paid_rewards");

  const totalReferrals = (statsRows ?? []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r.total_referrals ?? 0),
    0,
  );
  const qualifiedReferrals = (statsRows ?? []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r.qualified_referrals ?? 0),
    0,
  );
  const pendingDollars = (statsRows ?? []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r.pending_rewards ?? 0),
    0,
  );
  const paidDollars = (statsRows ?? []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r.paid_rewards ?? 0),
    0,
  );

  // ── Fraud flags count ─────────────────────────────────────────
  const { count: fraudCount } = await (adminClient as any)
    .from("referral_fraud_flags")
    .select("id", { count: "exact", head: true })
    .eq("resolved", false);

  // ── Top referrers ─────────────────────────────────────────────
  const { data: topRaw } = await (adminClient as any)
    .from("referral_dashboard_stats")
    .select("referrer_id, total_referrals, qualified_referrals, paid_rewards")
    .order("paid_rewards", { ascending: false })
    .limit(10);

  const referrerIds = (topRaw ?? []).map((r: Record<string, unknown>) => r.referrer_id as string).filter(Boolean);

  const { data: referrerProfiles } = referrerIds.length
    ? await (adminClient as any)
        .from("profiles")
        .select("id, username, full_name")
        .in("id", referrerIds)
    : { data: [] };

  const profileMap = new Map(
    (referrerProfiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
  );

  const topReferrers: TopReferrer[] = (topRaw ?? []).map((r: Record<string, unknown>) => {
    const profile = profileMap.get(r.referrer_id as string);
    return {
      referrer_id: r.referrer_id as string,
      referrer_username: (profile as any)?.username ?? null,
      referrer_full_name: (profile as any)?.full_name ?? null,
      total_referrals: Number(r.total_referrals ?? 0),
      qualified_referrals: Number(r.qualified_referrals ?? 0),
      paid_rewards: Number(r.paid_rewards ?? 0),
    };
  });

  // ── Pending rewards ───────────────────────────────────────────
  const { data: rewardsRaw } = await (adminClient as any)
    .from("referral_rewards")
    .select(
      `id, order_id, referrer_id, referred_id, reward_amount, status, created_at, updated_at`,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  const rewardUserIds = new Set<string>();
  (rewardsRaw ?? []).forEach((r: Record<string, unknown>) => {
    if (r.referrer_id) rewardUserIds.add(r.referrer_id as string);
    if (r.referred_id) rewardUserIds.add(r.referred_id as string);
  });

  const { data: rewardProfiles } = rewardUserIds.size
    ? await (adminClient as any)
        .from("profiles")
        .select("id, username, full_name")
        .in("id", Array.from(rewardUserIds))
    : { data: [] };

  const rewardProfileMap = new Map(
    (rewardProfiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
  );

  const pendingRewards: PendingRewardRow[] = (rewardsRaw ?? []).map((r: Record<string, unknown>) => {
    const referrer = rewardProfileMap.get(r.referrer_id as string);
    const referred = rewardProfileMap.get(r.referred_id as string);
    return {
      id: r.id as string,
      order_id: r.order_id as string,
      referrer_id: r.referrer_id as string,
      referred_id: r.referred_id as string,
      reward_amount: Number(r.reward_amount ?? 0),
      status: r.status as string,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      referrer_username: (referrer as any)?.username ?? null,
      referrer_full_name: (referrer as any)?.full_name ?? null,
      referred_username: (referred as any)?.username ?? null,
      referred_full_name: (referred as any)?.full_name ?? null,
    };
  });

  // ── Open fraud flags ──────────────────────────────────────────
  const { data: flagsRaw } = await (adminClient as any)
    .from("referral_fraud_flags")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(20);

  const fraudFlags = (flagsRaw ?? []) as ReferralFraudFlag[];

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-yellow-400">Admin</p>
            <h1 className="mt-2 text-3xl font-black">Referral program</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Review pending rewards, approve or deny payouts, monitor fraud flags, and manage top referrers.
            </p>
          </div>
          <div className="flex flex-none gap-3">
            <Link
              href="/api/admin/referral/export"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 transition hover:border-white/30"
            >
              Export CSV
            </Link>
            <Link
              href="/admin/referrals/settings"
              className="inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300"
            >
              Settings
            </Link>
          </div>
        </div>

        {/* Summary stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total referrals" value={totalReferrals} />
          <StatCard label="Qualified" value={qualifiedReferrals} accent="blue" />
          <StatCard label="Pending $" value={pendingDollars} prefix="$" accent="yellow" />
          <StatCard label="Paid $" value={paidDollars} prefix="$" accent="green" />
          <StatCard label="Fraud flags" value={fraudCount ?? 0} accent="red" />
        </div>

        {/* Top referrers */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-bold text-white">Top referrers</h2>
          {topReferrers.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">No referrers yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-gray-500">
                    <th className="pb-3 pr-4">User</th>
                    <th className="pb-3 pr-4">Total refs</th>
                    <th className="pb-3 pr-4">Qualified</th>
                    <th className="pb-3">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topReferrers.map((ref) => (
                    <tr key={ref.referrer_id}>
                      <td className="py-3 pr-4 font-medium text-white">
                        {ref.referrer_username ?? ref.referrer_full_name ?? ref.referrer_id.slice(0, 8) + "…"}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{ref.total_referrals}</td>
                      <td className="py-3 pr-4 text-blue-400">{ref.qualified_referrals}</td>
                      <td className="py-3 font-mono text-green-400">${ref.paid_rewards.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending rewards + fraud flags (client) */}
        <AdminReferralsClient pendingRewards={pendingRewards} fraudFlags={fraudFlags} />
      </div>
    </div>
  );
}
