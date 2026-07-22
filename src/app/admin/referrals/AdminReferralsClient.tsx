"use client";

import { useState, useTransition } from "react";
import type { PendingRewardRow, ReferralFraudFlag } from "@/lib/referral-types";

interface Props {
  pendingRewards: PendingRewardRow[];
  fraudFlags: ReferralFraudFlag[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-300",
    approved: "bg-green-500/20 text-green-300",
    paid: "bg-green-600/20 text-green-400",
    denied: "bg-red-500/20 text-red-300",
    revoked: "bg-red-600/20 text-red-400",
    expired: "bg-gray-600/20 text-gray-400",
  };
  const cls = map[status] ?? "bg-gray-500/20 text-gray-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

function RewardRow({
  reward,
  onAction,
}: {
  reward: PendingRewardRow;
  onAction: (rewardId: string, action: "approve" | "deny" | "revoke") => void;
}) {
  return (
    <tr className="border-b border-white/5">
      <td className="py-3 pr-4 text-xs text-gray-400 font-mono">
        {reward.id.slice(0, 8)}…
      </td>
      <td className="py-3 pr-4 text-sm text-white">
        {reward.referrer_username ?? reward.referrer_full_name ?? "—"}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-300">
        {reward.referred_username ?? reward.referred_full_name ?? "—"}
      </td>
      <td className="py-3 pr-4 font-mono text-yellow-400 text-sm">
        ${Number(reward.reward_amount).toFixed(2)}
      </td>
      <td className="py-3 pr-4">
        <StatusBadge status={reward.status} />
      </td>
      <td className="py-3 text-xs text-gray-500">
        {new Date(reward.created_at).toLocaleDateString()}
      </td>
      <td className="py-3 pl-4">
        <div className="flex gap-2">
          <button
            onClick={() => onAction(reward.id, "approve")}
            className="rounded-lg bg-green-600/20 px-3 py-1 text-xs font-semibold text-green-400 hover:bg-green-600/40"
          >
            Approve
          </button>
          <button
            onClick={() => onAction(reward.id, "deny")}
            className="rounded-lg bg-red-600/20 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-600/40"
          >
            Deny
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminReferralsClient({ pendingRewards, fraudFlags }: Props) {
  const [rewards, setRewards] = useState<PendingRewardRow[]>(pendingRewards);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleAction(
    rewardId: string,
    action: "approve" | "deny" | "revoke",
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/referral", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reward_id: rewardId, action }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Action failed");
        }
        // Optimistically remove from list
        setRewards((prev) => prev.filter((r) => r.id !== rewardId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Pending rewards */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Pending rewards</h2>
          <span className="rounded-full bg-yellow-400/20 px-3 py-1 text-xs font-bold text-yellow-400">
            {rewards.length}
          </span>
        </div>

        {rewards.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No pending rewards.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-gray-500">
                  <th className="pb-3 pr-4">ID</th>
                  <th className="pb-3 pr-4">Referrer</th>
                  <th className="pb-3 pr-4">Referred</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pl-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => (
                  <RewardRow key={r.id} reward={r} onAction={handleAction} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fraud flags */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Fraud flags</h2>
          <span className="rounded-full bg-red-400/20 px-3 py-1 text-xs font-bold text-red-400">
            {fraudFlags.length}
          </span>
        </div>

        {fraudFlags.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No open fraud flags.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {fraudFlags.map((flag) => (
              <div
                key={flag.id}
                className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-red-400 capitalize">
                      {flag.flag_type.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Flagged user:{" "}
                      <span className="font-mono">{flag.flagged_user_id ?? "—"}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Referrer:{" "}
                      <span className="font-mono">{flag.referrer_id ?? "—"}</span>
                    </p>
                    {flag.details && (
                      <p className="mt-1 text-xs text-gray-600">
                        {JSON.stringify(flag.details)}
                      </p>
                    )}
                  </div>
                  <span className="flex-none text-xs text-gray-500">
                    {new Date(flag.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
