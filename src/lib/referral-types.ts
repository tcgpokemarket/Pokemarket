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
  | "held"
  | "available"
  | "approved"
  | "paid"
  | "denied"
  | "revoked"
  | "expired";

export type ReferralSettlementStatus = "pending" | "held" | "available" | "paid" | "revoked" | "expired";

export type ReferralFraudSeverity = "low" | "medium" | "high" | "critical";

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
  enabled: boolean;
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
  paused: boolean;
  updated_at: string | null;
  created_at: string;
}

export interface ReferralProgramSettingsUpdate {
  enabled?: boolean;
  reward_amount?: number;
  required_successful_volume?: number;
  max_lifetime_commission_share_percent?: number;
  payout_delay_days?: number;
  campaign_starts_at?: string | null;
  campaign_ends_at?: string | null;
  requires_verified_account?: boolean;
  requires_first_successful_order?: boolean;
  requires_no_open_disputes?: boolean;
  requires_no_chargebacks?: boolean;
  fraud_score_block_threshold?: number;
  fraud_score_review_threshold?: number;
  paused?: boolean;
}

export interface ReferralSettlementSummary {
  total_successful_volume: number;
  total_commission_earned: number;
  lifetime_reward_paid: number;
  lifetime_reward_pending: number;
  max_lifetime_reward: number;
  remaining_lifetime_reward: number;
}

export interface ReferralFraudSnapshot {
  blocked: boolean;
  score: number;
  flags: string[];
  severity: ReferralFraudSeverity;
  device_fingerprint_count: number;
  shared_payment_method: boolean;
  shared_phone_number: boolean;
  shared_identity: boolean;
  vpn_or_proxy_suspected: boolean;
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
  commission_earned: number;
  reward_amount: number;
  reward_type: ReferralRewardType;
  status: ReferralRewardStatus;
  fraud_score: number;
  fraud_flags: Record<string, unknown> | null;
  settlement_status: ReferralSettlementStatus;
  approved_at: string | null;
  held_until: string | null;
  available_at: string | null;
  paid_at: string | null;
  denied_at: string | null;
  revoked_at: string | null;
  denial_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
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
  total_commission_generated?: number;
  lifetime_reward_cap?: number;
  last_qualified_order_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralSettlementEvent {
  id: string;
  referral_attribution_id: string;
  order_id: string | null;
  event_type: "qualified" | "held" | "released" | "paid" | "revoked" | "reversed";
  amount: number;
  commission_amount: number;
  reason: string | null;
  created_at: string;
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

export interface ReferralAttributionWithRewards extends ReferralAttribution {
  referred_profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  rewards?: ReferralReward[];
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
