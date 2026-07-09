import type { Order, SellerWallet } from "@/lib/supabase/types";

export type ReferralProgramType = "buyer" | "seller" | "creator" | "tiered";

export type ReferralSignupSource =
  | "referral link"
  | "referral code"
  | "invite code"
  | "qr code"
  | "creator/affiliate link"
  | "manual signup";

export type ReferralSourceCandidate = {
  code?: string | null;
  userId?: string | null;
  source: ReferralSignupSource;
};

export type ReferralOwnership = {
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  signupSource: ReferralSignupSource;
  createdAt: string;
  firstTransactionAt: string | null;
  totalRevenueGenerated: number;
  totalRewardsEarned: number;
  status: "pending" | "held" | "available" | "paid" | "rejected" | "adjusted";
};

export type ReferralFraudSignals = {
  sameDevice: boolean;
  samePaymentMethod: boolean;
  sameAddress: boolean;
  sameIpPatterns: boolean;
  selfReferral: boolean;
  fakeTransaction: boolean;
};

export type ReferralRewardCandidate = {
  orderId: string;
  referredUserId: string;
  referrerUserId: string;
  programType: ReferralProgramType;
  marketplaceFeeAmount: number;
  processingFeeAmount: number;
  rewardRate: number;
  maxPayout: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type ReferralRewardDecision = {
  approved: boolean;
  hold: boolean;
  rewardAmount: number;
  companyKeptAmount: number;
  reason: string | null;
};

type ReferralProgramSettings = {
  id: string;
  buyer_reward_credit: number;
  buyer_first_purchase_threshold: number;
  buyer_credit_expiry_days: number;
  buyer_reward_fee_share_percent: number;
  buyer_reward_max_payout: number;
  seller_reward_fee_share_percent: number;
  seller_reward_max_payout: number;
  creator_tier1_fee_share_percent: number;
  creator_tier1_duration_days: number;
  creator_tier1_max_payout: number;
  creator_tier2_fee_share_percent: number;
  creator_tier2_duration_days: number;
  creator_tier2_max_payout: number;
  min_profit_margin_percent: number;
  referral_hold_days: number;
  minimum_withdrawal_amount: number;
  created_at: string;
  updated_at: string;
};

type ReferralProgram = {
  id: string;
  code: string;
};

type ReferralAttribution = {
  id: string;
  referral_code: string;
  signup_source: string;
  referrer_user_id: string;
  referred_user_id: string;
  order_id: string;
  referral_program_id: string | null;
  program_type: ReferralProgramType;
  fee_basis: number;
  reward_rate: number;
  reward_amount: number;
  company_kept_amount: number;
  hold_until: string;
  status: string;
  fraud_flag: boolean;
  fraud_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const DEFAULT_SETTINGS: ReferralProgramSettings = {
  id: "default",
  buyer_reward_credit: 5,
  buyer_first_purchase_threshold: 25,
  buyer_credit_expiry_days: 90,
  buyer_reward_fee_share_percent: 10,
  buyer_reward_max_payout: 50,
  seller_reward_fee_share_percent: 15,
  seller_reward_max_payout: 250,
  creator_tier1_fee_share_percent: 20,
  creator_tier1_duration_days: 90,
  creator_tier1_max_payout: 500,
  creator_tier2_fee_share_percent: 25,
  creator_tier2_duration_days: 365,
  creator_tier2_max_payout: 750,
  min_profit_margin_percent: 60,
  referral_hold_days: 14,
  minimum_withdrawal_amount: 25,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export function lockReferralOwnership(candidates: ReferralSourceCandidate[]) {
  return candidates.find((candidate) => candidate.code || candidate.userId) ?? null;
}

export function buildReferralOwnership(input: {
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  signupSource: ReferralSignupSource;
  createdAt: string;
  firstTransactionAt?: string | null;
  totalRevenueGenerated?: number;
  totalRewardsEarned?: number;
  status?: ReferralOwnership["status"];
}): ReferralOwnership {
  return {
    referrerUserId: input.referrerUserId,
    referredUserId: input.referredUserId,
    referralCode: input.referralCode,
    signupSource: input.signupSource,
    createdAt: input.createdAt,
    firstTransactionAt: input.firstTransactionAt ?? null,
    totalRevenueGenerated: input.totalRevenueGenerated ?? 0,
    totalRewardsEarned: input.totalRewardsEarned ?? 0,
    status: input.status ?? "pending",
  };
}

export function getReferralSignupSource(metadata: Record<string, unknown> | null | undefined): ReferralSignupSource | null {
  if (!metadata) return null;
  if (metadata.referral_user_id || metadata.referralCode || metadata.referral_code || metadata.referred_by) return "referral code";
  if (metadata.invite_code) return "invite code";
  if (metadata.creator_code) return "creator/affiliate link";
  if (metadata.qr_code) return "qr code";
  if (metadata.referral_link) return "referral link";
  return null;
}

export function getReferralDisplayFields(ownership: ReferralOwnership | null) {
  if (!ownership) return null;
  return {
    referrerUserId: ownership.referrerUserId,
    referredUserId: ownership.referredUserId,
    referralCode: ownership.referralCode,
    createdAt: ownership.createdAt,
    signupSource: ownership.signupSource,
    firstTransactionAt: ownership.firstTransactionAt,
    totalRevenueGenerated: ownership.totalRevenueGenerated,
    totalRewardsEarned: ownership.totalRewardsEarned,
    status: ownership.status,
  };
}

export function canManuallyAssignReferral(createdAt: string, confirmedAt: string | null) {
  if (confirmedAt) return false;
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays <= 30;
}

export function getDefaultReferralSettings(): ReferralProgramSettings {
  return { ...DEFAULT_SETTINGS };
}

export function calculateProfitMargin(marketplaceRevenue: number, rewardAmount: number, processingFeeAmount: number) {
  const profit = Math.max(marketplaceRevenue - rewardAmount - processingFeeAmount, 0);
  const margin = marketplaceRevenue > 0 ? (profit / marketplaceRevenue) * 100 : 0;
  return { profit, margin };
}

export function evaluateReferralReward(candidate: ReferralRewardCandidate, settings: ReferralProgramSettings = DEFAULT_SETTINGS): ReferralRewardDecision {
  const cappedReward = Math.min(candidate.marketplaceFeeAmount * (candidate.rewardRate / 100), candidate.maxPayout ?? Number.POSITIVE_INFINITY);
  const { profit, margin } = calculateProfitMargin(candidate.marketplaceFeeAmount, cappedReward, candidate.processingFeeAmount);
  const minMargin = settings.min_profit_margin_percent;

  if (margin < minMargin) {
    return {
      approved: false,
      hold: true,
      rewardAmount: Number(cappedReward.toFixed(2)),
      companyKeptAmount: Number(profit.toFixed(2)),
      reason: `Profit margin would fall below ${minMargin}%`,
    };
  }

  return {
    approved: true,
    hold: false,
    rewardAmount: Number(cappedReward.toFixed(2)),
    companyKeptAmount: Number(profit.toFixed(2)),
    reason: null,
  };
}

export function calculateReferralRewardRate(programType: ReferralProgramType, settings: ReferralProgramSettings, totalSuccessfulReferrals = 0, creatorTier = 1) {
  if (programType === "buyer") return settings.buyer_reward_fee_share_percent;
  if (programType === "seller") return settings.seller_reward_fee_share_percent;
  if (programType === "creator") return creatorTier >= 2 ? settings.creator_tier2_fee_share_percent : settings.creator_tier1_fee_share_percent;
  if (totalSuccessfulReferrals >= 51) return 15;
  if (totalSuccessfulReferrals >= 11) return 12.5;
  return 10;
}

export function getReferralHoldUntil(completedAt: string, settings: ReferralProgramSettings = DEFAULT_SETTINGS) {
  const date = new Date(completedAt);
  date.setDate(date.getDate() + settings.referral_hold_days);
  return date.toISOString();
}

export function isReferralFraud(signals: ReferralFraudSignals) {
  return Object.values(signals).some(Boolean);
}

export function shouldIssueBuyerCredit(firstPurchaseTotal: number, firstPurchaseThreshold: number, rewardIssued = false) {
  return !rewardIssued && firstPurchaseTotal >= firstPurchaseThreshold;
}

export function buildReferralAttribution(input: {
  order: Pick<Order, "id" | "total_amount" | "marketplace_fee_amount" | "processing_fee_amount" | "created_at" | "status" | "buyer_id" | "seller_id">;
  referredUserId: string;
  referrerUserId: string;
  programType: ReferralProgramType;
  rewardRate: number;
  maxPayout: number | null;
  settings?: ReferralProgramSettings;
  fraudSignals?: ReferralFraudSignals;
  metadata?: Record<string, unknown>;
}): ReferralAttribution {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const marketplaceFeeAmount = Number(input.order.marketplace_fee_amount ?? 0);
  const processingFeeAmount = Number(input.order.processing_fee_amount ?? 0);
  const rewardAmount = Math.min(marketplaceFeeAmount * (input.rewardRate / 100), input.maxPayout ?? Number.POSITIVE_INFINITY);
  const profit = Math.max(marketplaceFeeAmount - rewardAmount - processingFeeAmount, 0);
  const holdUntil = getReferralHoldUntil(input.order.created_at, settings);
  const fraudFlag = input.fraudSignals ? isReferralFraud(input.fraudSignals) : false;

  return {
    id: `${input.order.id}-referral`,
    referral_code: input.metadata?.referral_code ? String(input.metadata.referral_code) : "",
    signup_source: String(input.metadata?.signup_source ?? input.metadata?.source ?? "manual signup"),
    referrer_user_id: input.referrerUserId,
    referred_user_id: input.referredUserId,
    order_id: input.order.id,
    referral_program_id: null,
    program_type: input.programType,
    fee_basis: Number(marketplaceFeeAmount.toFixed(2)),
    reward_rate: input.rewardRate,
    reward_amount: Number(rewardAmount.toFixed(2)),
    company_kept_amount: Number(profit.toFixed(2)),
    hold_until: holdUntil,
    status: fraudFlag ? "rejected" : "held",
    fraud_flag: fraudFlag,
    fraud_reason: fraudFlag ? "Blocked by referral fraud rules" : null,
    metadata: input.metadata ?? {},
    created_at: input.order.created_at,
    updated_at: input.order.created_at,
  };
}

export function canWithdrawReferralEarnings(amount: number, availableAt: string | null, minimumWithdrawal: number) {
  return amount >= minimumWithdrawal && (!availableAt || new Date(availableAt).getTime() <= Date.now());
}

export function getReferralProgramDisplayName(programType: ReferralProgramType) {
  if (programType === "buyer") return "Buyer referral";
  if (programType === "seller") return "Seller referral";
  if (programType === "creator") return "Creator / ambassador";
  return "Tiered referral";
}

export function calculateBuyerCreditExpiry(createdAt: string, settings: ReferralProgramSettings = DEFAULT_SETTINGS) {
  const date = new Date(createdAt);
  date.setDate(date.getDate() + settings.buyer_credit_expiry_days);
  return date.toISOString();
}

export function limitBuyerCreditUsage(input: { canCombineWithPromos: boolean; hasOtherPromos: boolean }) {
  return input.canCombineWithPromos && !input.hasOtherPromos;
}

export function summarizeReferralWallet(wallet: Pick<SellerWallet, "available_balance" | "pending_balance" | "frozen_balance" | "lifetime_earnings">) {
  return {
    available: Number(wallet.available_balance ?? 0),
    pending: Number(wallet.pending_balance ?? 0),
    frozen: Number(wallet.frozen_balance ?? 0),
    lifetime: Number(wallet.lifetime_earnings ?? 0),
  };
}
