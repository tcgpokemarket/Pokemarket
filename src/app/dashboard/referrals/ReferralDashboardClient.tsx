"use client";

import { useState } from "react";
import type { ReferralDashboardStats, ReferralAttributionWithRewards, ReferralReward } from "@/lib/referral-types";

interface Props {
  code: string;
  link: string;
  stats: ReferralDashboardStats | null;
  referrals: ReferralAttributionWithRewards[];
}

function StatCard({ label, value, prefix, accent }: { label: string; value: number; prefix?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${accent ?? "text-white"}`}>
        {prefix}
        {typeof value === "number" && prefix === "$" ? value.toFixed(2) : value.toString()}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-300",
    held: "bg-yellow-500/20 text-yellow-300",
    qualified: "bg-blue-500/20 text-blue-300",
    approved: "bg-green-500/20 text-green-300",
    paid: "bg-green-600/20 text-green-400",
    rejected: "bg-red-500/20 text-red-300",
    adjusted: "bg-gray-500/20 text-gray-300",
    revoked: "bg-red-600/20 text-red-400",
    expired: "bg-gray-600/20 text-gray-400",
    available: "bg-green-400/20 text-green-300",
    denied: "bg-red-500/20 text-red-400",
  };
  const cls = map[status] ?? "bg-gray-500/20 text-gray-300";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>{status}</span>;
}

function PayoutHistorySection({ referrals }: { referrals: ReferralAttributionWithRewards[] }) {
  const payouts: Array<ReferralReward & { referred_name: string }> = [];

  for (const attribution of referrals) {
    for (const reward of attribution.rewards ?? []) {
      if (reward.status === "paid" || reward.status === "approved" || reward.status === "available") {
        payouts.push({
          ...reward,
          referred_name: attribution.referred_profile?.username ?? attribution.referred_profile?.full_name ?? "User",
        });
      }
    }
  }

  payouts.sort((a, b) => new Date(b.paid_at ?? b.approved_at ?? b.available_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.approved_at ?? a.available_at ?? a.created_at).getTime());

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-bold text-white">Payout history</h2>
      <p className="mt-1 text-sm text-gray-400">Rewards that cleared qualification, hold, and commission-cap checks.</p>

      {payouts.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No payouts yet — rewards appear here once the referred account qualifies.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-gray-500">
                <th className="pb-3 pr-4">Referred user</th>
                <th className="pb-3 pr-4">Amount</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Held until</th>
                <th className="pb-3">Paid out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="py-3 pr-4 font-medium text-white">{payout.referred_name}</td>
                  <td className="py-3 pr-4 font-mono text-yellow-400">${Number(payout.reward_amount).toFixed(2)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={payout.status} /></td>
                  <td className="py-3 pr-4 text-gray-400">{payout.held_until ? new Date(payout.held_until).toLocaleDateString() : "—"}</td>
                  <td className="py-3 text-gray-400">{payout.paid_at ? new Date(payout.paid_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReferralDashboardClient({ code, link, stats, referrals }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  function copyLink() {
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyCode() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  }

  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join me on TCG Poke Market — the best place to buy and sell Pokémon cards! Use my referral link to get started: ${link}`)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;

  const earned = Number(stats?.approved_rewards ?? 0) + Number(stats?.paid_rewards ?? 0);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/5 p-6">
        <h2 className="text-lg font-bold text-yellow-400">Your referral link</h2>
        <p className="mt-1 text-sm text-gray-400">Share this link with friends. Rewards unlock only after they verify, complete their first successful order, and clear the commission-backed threshold.</p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 truncate rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-sm text-gray-300">{link}</div>
          <button onClick={copyLink} className="flex-none rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-300 active:scale-95">
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex flex-none items-center gap-2 rounded-2xl border border-white/10 bg-[#111827] px-4 py-2.5">
            <span className="text-xs text-gray-500">Code:</span>
            <span className="font-mono text-sm font-bold tracking-widest text-white">{code}</span>
          </div>
          <button onClick={copyCode} className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition hover:border-white/30">
            {copiedCode ? "Copied!" : "Copy code"}
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-[#1d9bf0]/20 px-4 py-2.5 text-sm font-semibold text-[#1d9bf0] transition hover:bg-[#1d9bf0]/30">Share on X</a>
          <a href={facebookShareUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-[#1877f2]/20 px-4 py-2.5 text-sm font-semibold text-[#1877f2] transition hover:bg-[#1877f2]/30">Share on Facebook</a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total referrals" value={Number(stats?.total_referrals ?? 0)} />
        <StatCard label="Qualified referrals" value={Number(stats?.qualified_referrals ?? 0)} accent="text-blue-400" />
        <StatCard label="Pending rewards" value={Number(stats?.pending_rewards ?? 0)} prefix="$" accent="text-yellow-400" />
        <StatCard label="Earned (approved)" value={earned} prefix="$" accent="text-green-400" />
        <StatCard label="Paid out" value={Number(stats?.paid_rewards ?? 0)} prefix="$" accent="text-green-400" />
        <StatCard label="Lifetime earnings" value={Number(stats?.lifetime_earnings ?? 0)} prefix="$" accent="text-white" />
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-sm text-gray-400">
        <p className="font-semibold text-gray-300">How rewards work</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>You earn a <strong className="text-white">$5 bonus</strong> after a referred account completes <strong className="text-white">$200</strong> in successful marketplace activity.</li>
          <li>The account must be verified, complete its first successful order, and pass fraud checks before becoming eligible.</li>
          <li>Rewards stay on hold until the qualifying activity clears the dispute, refund, and chargeback window.</li>
          <li>Total lifetime rewards for a referred account can never exceed <strong className="text-white">20%</strong> of commission earned from that account.</li>
          <li>Rewards are reversed automatically if the qualifying activity is refunded, disputed, or charged back before finalization.</li>
        </ul>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-bold text-white">Referral history</h2>
        {referrals.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No referrals yet. Share your link to get started!</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-gray-500">
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Reward</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {referrals.map((referral) => {
                  const rewardAmount = (referral.rewards ?? []).reduce((sum, r) => sum + Number(r.reward_amount ?? 0), 0);
                  const referredName = referral.referred_profile?.username ?? referral.referred_profile?.full_name ?? "User";
                  return (
                    <tr key={referral.id}>
                      <td className="py-3 pr-4 font-medium text-white">{referredName}</td>
                      <td className="py-3 pr-4"><StatusBadge status={referral.status} /></td>
                      <td className="py-3 pr-4 font-mono text-yellow-400">{rewardAmount > 0 ? `$${rewardAmount.toFixed(2)}` : "—"}</td>
                      <td className="py-3 text-gray-400">{new Date(referral.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PayoutHistorySection referrals={referrals} />
    </div>
  );
}
