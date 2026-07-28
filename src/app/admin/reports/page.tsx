import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { getSupportStats } from "@/lib/support";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports & System Health",
  description: "Marketplace reporting, support load, email operations, referrals, and system health.",
};

function StatCard({ label, value, tone = "white" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
      <p className="text-xs uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString();
}

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    notFound();
  }

  const admin = createAdminClient();
  const [supportStats, queueResult, logsResult, referralStatsResult, activeBatchResult, failedBatchResult, duplicateResult, unresolvedReportsResult] = await Promise.all([
    getSupportStats(),
    admin.from("email_queue").select("id", { count: "exact", head: true }),
    admin.from("email_logs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("referral_dashboard_stats").select("total_referrals, qualified_referrals, pending_rewards, paid_rewards"),
    admin.from("card_ingestion_batches").select("id", { count: "exact", head: true }).in("status", ["uploaded", "processing", "in_review", "ready", "partial"]),
    admin.from("card_ingestion_batches").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "duplicate"),
    admin.from("message_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const referralRows = (referralStatsResult.data ?? []) as Array<{ total_referrals: number | null; qualified_referrals: number | null; pending_rewards: number | null; paid_rewards: number | null }>;
  const referralTotals = referralRows.reduce(
    (acc, row) => ({
      total: acc.total + Number(row.total_referrals ?? 0),
      qualified: acc.qualified + Number(row.qualified_referrals ?? 0),
      pending: acc.pending + Number(row.pending_rewards ?? 0),
      paid: acc.paid + Number(row.paid_rewards ?? 0),
    }),
    { total: 0, qualified: 0, pending: 0, paid: 0 },
  );

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-7xl space-y-8 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-yellow-400">Admin</p>
            <h1 className="text-3xl font-black">Reports & system health</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">Live operational signals from support, email, referrals, card ingestion, and moderation.</p>
          </div>
          <Link href="/admin" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Back to admin</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open support tickets" value={supportStats.open} tone="text-yellow-400" />
          <StatCard label="Escalated support" value={supportStats.escalated} tone="text-red-400" />
          <StatCard label="Queued emails" value={(queueResult.count ?? 0).toLocaleString()} tone="text-blue-400" />
          <StatCard label="Failed emails" value={(logsResult.count ?? 0).toLocaleString()} tone="text-red-400" />
          <StatCard label="Pending referrals" value={`$${referralTotals.pending.toFixed(2)}`} tone="text-yellow-400" />
          <StatCard label="Paid referrals" value={`$${referralTotals.paid.toFixed(2)}`} tone="text-green-400" />
          <StatCard label="Active ingestion batches" value={formatCount(activeBatchResult.count)} tone="text-blue-400" />
          <StatCard label="Failed ingestion batches" value={formatCount(failedBatchResult.count)} tone="text-red-400" />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <h2 className="text-lg font-bold">Operational risks</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-300">
              <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4">Open support reports: {supportStats.open}</div>
              <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4">Unresolved moderation reports: {(unresolvedReportsResult.count ?? 0).toLocaleString()}</div>
              <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4">Duplicate listing signals: {(duplicateResult.count ?? 0).toLocaleString()}</div>
              <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4">Failed email jobs: {(logsResult.count ?? 0).toLocaleString()}</div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <h2 className="text-lg font-bold">Referral health</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-300">
              <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4">Total referrals: {referralTotals.total.toLocaleString()}</div>
              <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4">Qualified referrals: {referralTotals.qualified.toLocaleString()}</div>
              <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4">Pending rewards: ${referralTotals.pending.toFixed(2)}</div>
              <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4">Paid rewards: ${referralTotals.paid.toFixed(2)}</div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <h2 className="text-lg font-bold">Health links</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-300">
              <Link href="/admin/support" className="block rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 hover:border-yellow-400/40">Open support tickets</Link>
              <Link href="/admin/email" className="block rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 hover:border-yellow-400/40">Review email queue</Link>
              <Link href="/admin/referrals" className="block rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 hover:border-yellow-400/40">Review referrals</Link>
              <Link href="/admin/card-ingestion" className="block rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 hover:border-yellow-400/40">Check ingestion</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
