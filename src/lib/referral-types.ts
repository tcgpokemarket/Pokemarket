// ============================================================
// referral-types.ts
// All referral-specific TypeScript types.
// Do NOT modify types.ts directly (it is auto-generated).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────────────────────
// Core domain types
// ──────────────────────────────────────────────────────────────

export type ReferralRewardStatus =
  | "pending"
  | "approved"
  | "paid"
  | "denied"
  | "revoked"
  | "expired";

export type ReferralRewardType = "cash" | "credit" | "points";

export type ReferralTriggerType = "first_purchase" | "sale" | "purchase";

export type ReferralAttributionStatus =
  | "pending"
  | "held"
  | "available"
  | "paid"
  | "rejected"
  | "adjusted"
  | "qualified"
  | "revoked"
  | "expired";

// ──────────────────────────────────────────────────────────────
// Table row types
// ──────────────────────────────────────────────────────────────

export interface ReferralProgramSettings {
  id: string;
  reward_per_referral: number;
  reward_type: string;
  min_order_amount: number;
  max_reward_per_referral: number;
  max_lifetime_rewards_per_referrer: number;
  max_monthly_rewards_per_referrer: number;
  max_annual_rewards_per_referrer: number;
  max_lifetime_rewards_per_referred: number;
  payout_delay_days: number;
  reward_as_pct_of_platform_revenue: number;
  enabled: boolean;
  updated_at: string | null;
  created_at: string;
  // Legacy columns from 0008
  buyer_reward_credit?: number;
  buyer_first_purchase_threshold?: number;
  buyer_credit_expiry_days?: number;
  buyer_reward_fee_share_percent?: number;
  buyer_reward_max_payout?: number;
  seller_reward_fee_share_percent?: number;
  seller_reward_max_payout?: number;
  creator_tier1_fee_share_percent?: number;
  creator_tier1_duration_days?: number;
  creator_tier1_max_payout?: number;
  creator_tier2_fee_share_percent?: number;
  creator_tier2_duration_days?: number;
  creator_tier2_max_payout?: number;
  min_profit_margin_percent?: number;
  referral_hold_days?: number;
  minimum_withdrawal_amount?: number;
}

export interface ReferralProgramSettingsUpdate {
  reward_per_referral?: number;
  reward_type?: string;
  min_order_amount?: number;
  max_reward_per_referral?: number;
  max_lifetime_rewards_per_referrer?: number;
  max_monthly_rewards_per_referrer?: number;
  max_annual_rewards_per_referrer?: number;
  max_lifetime_rewards_per_referred?: number;
  payout_delay_days?: number;
  reward_as_pct_of_platform_revenue?: number;
  enabled?: boolean;
}

export interface ReferralReward {
  id: string;
  referral_attribution_id: string;
  referrer_id: string;
  referred_id: string;
  order_id: string | null;
  trigger_type: ReferralTriggerType;
  gross_transaction_amount: number;
  platform_revenue: number;
  reward_amount: number;
  reward_type: ReferralRewardType;
  status: ReferralRewardStatus;
  fraud_score: number;
  fraud_flags: Record<string, unknown> | null;
  approved_at: string | null;
  paid_at: string | null;
  denied_at: string | null;
  denial_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralFraudFlag {
  id: string;
  flagged_user_id: string | null;
  referrer_id: string | null;
  attribution_id: string | null;
  flag_type: string;
  details: Record<string, unknown> | null;
  reviewed: boolean;
  reviewer_id: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ReferralAttribution {
  id: string;
  referred_user_id: string;
  referrer_user_id: string;
  order_id: string | null;
  referral_program_id: string | null;
  program_type: "buyer" | "seller" | "creator" | "tiered";
  fee_basis: number;
  reward_rate: number;
  reward_amount: number;
  company_kept_amount: number;
  hold_until: string | null;
  status: ReferralAttributionStatus;
  fraud_flag: boolean;
  fraud_reason: string | null;
  metadata: Record<string, unknown>;
  referral_code: string;
  signup_source: string;
  total_revenue_generated: number;
  total_rewards_earned: number;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────────
// View types
// ──────────────────────────────────────────────────────────────

export interface ReferralDashboardStats {
  referrer_id: string;
  total_referrals: number;
  qualified_referrals: number;
  pending_rewards: number;
  paid_rewards: number;
  approved_rewards: number;
  lifetime_earnings: number;
}

// ──────────────────────────────────────────────────────────────
// API request/response types
// ──────────────────────────────────────────────────────────────

export interface ApplyReferralRequest {
  code: string;
}

export interface ApplyReferralResponse {
  ok: boolean;
  referrer_username: string;
}

export interface ReferralLinkResponse {
  code: string;
  link: string;
  profile: {
    id: string;
    username: string | null;
    full_name: string | null;
  };
}

export interface ReferralStatsResponse {
  stats: ReferralDashboardStats | null;
  referrals: ReferralAttributionWithRewards[];
}

export interface ReferralAttributionWithRewards extends ReferralAttribution {
  referred_profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  rewards?: ReferralReward[];
}

// Admin types
export type AdminRewardAction = "approve" | "deny" | "revoke";

export interface AdminRewardActionRequest {
  action: AdminRewardAction;
  reward_id: string;
  reason?: string;
}

export interface AdminReferralAnalytics {
  totals: {
    total_referrals: number;
    qualified_referrals: number;
    pending_rewards: number;
    paid_rewards: number;
    fraud_flags_open: number;
  };
  top_referrers: TopReferrer[];
  pending_rewards: PendingRewardRow[];
  fraud_flags: ReferralFraudFlag[];
}

export interface TopReferrer {
  referrer_id: string;
  referrer_username: string | null;
  referrer_full_name: string | null;
  total_referrals: number;
  qualified_referrals: number;
  paid_rewards: number;
}

export interface PendingRewardRow extends ReferralReward {
  referrer_username: string | null;
  referrer_full_name: string | null;
  referred_username: string | null;
  referred_full_name: string | null;
}

// ──────────────────────────────────────────────────────────────
// Fraud detection types
// ──────────────────────────────────────────────────────────────

export interface FraudCheckResult {
  blocked: boolean;
  flags: string[];
  score: number;
}

// ──────────────────────────────────────────────────────────────
// Notification types for referral events
// ──────────────────────────────────────────────────────────────

export type ReferralNotificationType =
  | "referral_signup"
  | "referral_qualified"
  | "referral_reward_approved"
  | "referral_reward_paid"
  | "referral_reward_denied";

// ──────────────────────────────────────────────────────────────
// Supabase client type convenience
// ──────────────────────────────────────────────────────────────
 
export type AnySupabaseClient = SupabaseClient<any>;
