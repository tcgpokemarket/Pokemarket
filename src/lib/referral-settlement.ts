import type { Order, SellerWallet } from "@/lib/supabase/types";

export type ReferralSettlementSettings = {
  id: string;
  enabled: boolean;
  paused: boolean;
  reward_amount: number;
  required_successful_volume: number;
  max_lifetime_commission_share_percent: number;
  payout_delay_days: number;
  campaign_starts_at: string | null;
  campaign_ends_at: string | null;
  requires_verified_account: boolean;
  requires_first_successful_order: boolean;
  requires_no_open_disputes: boolean;
  requires_no_chargebacks: boolean;
  fraud_score_block_threshold: number;
  fraud_score_review_threshold: number;
  updated_at: string | null;
  created_at: string;
};

export type ReferralSettlementDecision = {
  rewardAmount: number;
  commissionCapAmount: number;
  remainingCommissionCap: number;
  eligible: boolean;
  reason: string | null;
};

export type ReferralSettlementTotals = {
  totalVolume: number;
  totalCommission: number;
  paidRewards: number;
  pendingRewards: number;
};

const DEFAULT_SETTINGS: ReferralSettlementSettings = {
  id: "default",
  enabled: true,
  paused: false,
  reward_amount: 5,
  required_successful_volume: 200,
  max_lifetime_commission_share_percent: 20,
  payout_delay_days: 14,
  campaign_starts_at: null,
  campaign_ends_at: null,
  requires_verified_account: true,
  requires_first_successful_order: true,
  requires_no_open_disputes: true,
  requires_no_chargebacks: true,
  fraud_score_block_threshold: 70,
  fraud_score_review_threshold: 40,
  updated_at: null,
  created_at: new Date(0).toISOString(),
};

export function getDefaultReferralSettlementSettings(): ReferralSettlementSettings {
  return { ...DEFAULT_SETTINGS };
}

export function normalizeReferralSettlementSettings(row?: Partial<ReferralSettlementSettings> | null): ReferralSettlementSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    enabled: row.enabled ?? DEFAULT_SETTINGS.enabled,
    paused: row.paused ?? DEFAULT_SETTINGS.paused,
    reward_amount: Number(row.reward_amount ?? DEFAULT_SETTINGS.reward_amount),
    required_successful_volume: Number(row.required_successful_volume ?? DEFAULT_SETTINGS.required_successful_volume),
    max_lifetime_commission_share_percent: Number(row.max_lifetime_commission_share_percent ?? DEFAULT_SETTINGS.max_lifetime_commission_share_percent),
    payout_delay_days: Number(row.payout_delay_days ?? DEFAULT_SETTINGS.payout_delay_days),
    requires_verified_account: row.requires_verified_account ?? DEFAULT_SETTINGS.requires_verified_account,
    requires_first_successful_order: row.requires_first_successful_order ?? DEFAULT_SETTINGS.requires_first_successful_order,
    requires_no_open_disputes: row.requires_no_open_disputes ?? DEFAULT_SETTINGS.requires_no_open_disputes,
    requires_no_chargebacks: row.requires_no_chargebacks ?? DEFAULT_SETTINGS.requires_no_chargebacks,
    fraud_score_block_threshold: Number(row.fraud_score_block_threshold ?? DEFAULT_SETTINGS.fraud_score_block_threshold),
    fraud_score_review_threshold: Number(row.fraud_score_review_threshold ?? DEFAULT_SETTINGS.fraud_score_review_threshold),
  };
}

export function calculateCommissionCap(totalCommission: number, settings: ReferralSettlementSettings) {
  return Number((Math.max(0, totalCommission) * settings.max_lifetime_commission_share_percent / 100).toFixed(2));
}

export function calculateReferralSettlementDecision(input: {
  rewardAmount: number;
  totalCommission: number;
  paidRewards: number;
  pendingRewards?: number;
  settings: ReferralSettlementSettings;
}): ReferralSettlementDecision {
  const commissionCapAmount = calculateCommissionCap(input.totalCommission, input.settings);
  const committedRewards = Math.max(0, Number(input.paidRewards ?? 0) + Number(input.pendingRewards ?? 0));
  const remainingCommissionCap = Math.max(0, Number((commissionCapAmount - committedRewards).toFixed(2)));
  const rewardAmount = Number(Math.min(input.rewardAmount, remainingCommissionCap).toFixed(2));

  if (rewardAmount <= 0) {
    return {
      rewardAmount: 0,
      commissionCapAmount,
      remainingCommissionCap,
      eligible: false,
      reason: "Commission cap exhausted",
    };
  }

  return {
    rewardAmount,
    commissionCapAmount,
    remainingCommissionCap,
    eligible: true,
    reason: null,
  };
}

export function calculateReferralTotals(orders: Array<Pick<Order, "total_amount" | "marketplace_fee_amount">>): ReferralSettlementTotals {
  return orders.reduce(
    (acc, order) => ({
      totalVolume: Number((acc.totalVolume + Number(order.total_amount ?? 0)).toFixed(2)),
      totalCommission: Number((acc.totalCommission + Number(order.marketplace_fee_amount ?? 0)).toFixed(2)),
      paidRewards: acc.paidRewards,
      pendingRewards: acc.pendingRewards,
    }),
    { totalVolume: 0, totalCommission: 0, paidRewards: 0, pendingRewards: 0 },
  );
}

export function summarizeReferralWallet(wallet: Pick<SellerWallet, "available_balance" | "pending_balance" | "frozen_balance" | "lifetime_earnings">) {
  return {
    available: Number(wallet.available_balance ?? 0),
    pending: Number(wallet.pending_balance ?? 0),
    frozen: Number(wallet.frozen_balance ?? 0),
    lifetime: Number(wallet.lifetime_earnings ?? 0),
  };
}

export function isSettlementWindowOpen(now: string, campaignStartsAt?: string | null, campaignEndsAt?: string | null, paused = false) {
  if (paused) return false;
  const ts = new Date(now).getTime();
  if (campaignStartsAt && ts < new Date(campaignStartsAt).getTime()) return false;
  if (campaignEndsAt && ts > new Date(campaignEndsAt).getTime()) return false;
  return true;
}
