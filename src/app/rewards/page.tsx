"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type RewardsAccount = {
  available_points: number;
  pending_points: number;
  redeemed_points: number;
  lifetime_points: number;
  last_login_bonus_at: string | null;
  points_expire_at: string | null;
};

type RewardsLedgerRow = {
  id: string;
  entry_type: string;
  points: number;
  balance_after: number;
  created_at: string;
};

type RewardsOption = {
  id: string;
  option_key: string;
  display_name: string;
  redemption_type: string;
  points_cost: number;
  credit_amount: number | null;
};

type RewardsRedemptionRow = {
  id: string;
  status: string;
  points_spent: number;
  created_at: string;
  fulfilled_at: string | null;
  rewards_redemption_options?: { display_name?: string } | null;
};

type RewardsSnapshot = {
  account: RewardsAccount | null;
  ledger: RewardsLedgerRow[];
  options: RewardsOption[];
  redemptions: RewardsRedemptionRow[];
};

const DEFAULT_REWARDS_ACCOUNT: RewardsAccount = {
  available_points: 0,
  pending_points: 0,
  redeemed_points: 0,
  lifetime_points: 0,
  last_login_bonus_at: null,
  points_expire_at: null,
};

function formatPoints(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function RewardsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<RewardsSnapshot>({ account: null, ledger: [], options: [], redemptions: [] });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/auth?redirectTo=/rewards";
        return;
      }

      const [accountResult, ledgerResult, optionsResult, redemptionsResult] = await Promise.all([
        supabase.from("rewards_accounts").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("rewards_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(25),
        supabase.from("rewards_redemption_options").select("*").eq("active", true).order("points_cost", { ascending: true }),
        supabase.from("rewards_redemptions").select("*, rewards_redemption_options(*)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);

      setSnapshot({
        account: (accountResult.data as RewardsAccount | null) ?? null,
        ledger: (ledgerResult.data ?? []) as RewardsLedgerRow[],
        options: (optionsResult.data ?? []) as RewardsOption[],
        redemptions: (redemptionsResult.data ?? []) as RewardsRedemptionRow[],
      });
      setLoading(false);
    };

    void load();
  }, [supabase]);

  const account = snapshot.account ?? DEFAULT_REWARDS_ACCOUNT;

  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Rewards center
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight">Your points, redemptions, and reward history</h1>
            <p className="mt-3 max-w-2xl text-gray-300">Track bonuses from signups, purchases, live bids, referrals, and admin rewards in one place.</p>
          </div>
          <Link href="/dashboard" className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-yellow-400/40 hover:text-white">Back to dashboard</Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            { label: "Available points", value: formatPoints(account.available_points) },
            { label: "Pending points", value: formatPoints(account.pending_points) },
            { label: "Redeemed points", value: formatPoints(account.redeemed_points) },
            { label: "Lifetime points", value: formatPoints(account.lifetime_points) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-widest text-gray-500">{stat.label}</div>
              <div className="mt-2 text-2xl font-black">{stat.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-gray-300">Loading rewards...</div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Redeem points</h2>
                  <p className="mt-1 text-sm text-gray-400">Choose a wallet credit, coupon, or discount reward.</p>
                </div>
                <div className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
                  Expire {formatDate(account.points_expire_at)}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {snapshot.options.map((option) => (
                  <div key={option.id} className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4">
                    <div className="text-sm font-semibold text-white">{option.display_name}</div>
                    <div className="mt-1 text-xs uppercase tracking-widest text-yellow-400">{option.redemption_type.replaceAll("_", " ")}</div>
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-300">
                      <span>Cost</span>
                      <span>{formatPoints(option.points_cost)} pts</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm text-gray-300">
                      <span>Value</span>
                      <span>{option.credit_amount ? `$${option.credit_amount.toFixed(2)}` : "Coupon/discount"}</span>
                    </div>
                    <button className="mt-4 w-full rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300" disabled={account.available_points < option.points_cost}>
                      {account.available_points < option.points_cost ? "Not enough points" : "Redeem"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black">Recent activity</h2>
              <div className="mt-6 space-y-3">
                {snapshot.ledger.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4 text-sm text-gray-400">No rewards activity yet.</div>
                ) : snapshot.ledger.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">{entry.entry_type.replaceAll("_", " ")}</div>
                        <div className="text-xs text-gray-500">{formatDate(entry.created_at)}</div>
                      </div>
                      <div className={`text-sm font-black ${entry.points >= 0 ? "text-green-400" : "text-red-400"}`}>{entry.points >= 0 ? "+" : ""}{entry.points}</div>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">Balance after: {formatPoints(entry.balance_after)} pts</div>
                  </div>
                ))}
              </div>

              <h3 className="mt-8 text-xl font-black">Redemptions</h3>
              <div className="mt-4 space-y-3">
                {snapshot.redemptions.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4 text-sm text-gray-400">No redemptions yet.</div>
                ) : snapshot.redemptions.map((redemption) => (
                  <div key={redemption.id} className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4 text-sm text-gray-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{redemption.rewards_redemption_options?.display_name ?? "Reward"}</span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-gray-400">{redemption.status}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{redemption.points_spent} points</span>
                      <span>{formatDate(redemption.fulfilled_at ?? redemption.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
