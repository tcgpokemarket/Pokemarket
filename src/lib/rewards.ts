import type { Json, Order } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type RewardEntryType =
  | "signup_bonus"
  | "daily_login"
  | "purchase"
  | "seller_sale"
  | "live_bid"
  | "referral_reward"
  | "referral_purchase_bonus"
  | "admin_bonus"
  | "redemption"
  | "expiration_adjustment"
  | "manual_adjustment";

export type RewardRedemptionType = "wallet_credit" | "coupon" | "discount";

export type RewardAccount = {
  user_id: string;
  available_points: number;
  pending_points: number;
  redeemed_points: number;
  lifetime_points: number;
  last_login_bonus_at: string | null;
  points_expire_at: string | null;
  updated_at: string;
  created_at: string;
};

export type RewardLedgerRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  live_show_id: string | null;
  referral_attribution_id: string | null;
  redemption_id: string | null;
  entry_type: RewardEntryType;
  status: "pending" | "posted" | "held" | "failed" | "reversed";
  points: number;
  balance_after: number;
  expires_at: string | null;
  metadata: Json;
  created_by: string | null;
  created_at: string;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function ensureAccount(admin: ReturnType<typeof createAdminClient>, userId: string) {
  await admin.from("rewards_accounts").upsert({ user_id: userId } as any, { onConflict: "user_id" });
}

export async function getRewardsSettings() {
  const admin = createAdminClient();
  const { data } = await admin.from("rewards_program_settings").select("*").limit(1).maybeSingle();
  return (data ?? null) as {
    signup_bonus_points: number;
    daily_login_bonus_points: number;
    purchase_points_per_dollar: number;
    seller_sale_points_per_dollar: number;
    live_bid_points_per_bid: number;
    referral_points_per_successful_referral: number;
    referral_purchase_bonus_points: number;
    admin_bonus_points_per_action: number;
    points_to_wallet_credit_rate: number;
    minimum_redemption_points: number;
    point_expiry_days: number;
  } | null;
}

export async function getRewardsSnapshot(userId: string) {
  const admin = createAdminClient();
  await ensureAccount(admin, userId);
  const [{ data: account }, { data: ledger }, { data: redemptions }, { data: options }] = await Promise.all([
    admin.from("rewards_accounts").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("rewards_ledger").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
    admin.from("rewards_redemptions").select("*, rewards_redemption_options(*)").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    admin.from("rewards_redemption_options").select("*").eq("active", true).order("points_cost", { ascending: true }),
  ]);

  return {
    account: (account ?? null) as RewardAccount | null,
    ledger: (ledger ?? []) as RewardLedgerRow[],
    redemptions: (redemptions ?? []) as Array<{ id: string; status: string; points_spent: number; created_at: string; fulfilled_at: string | null; rewards_redemption_options?: { display_name?: string } | null }>,
    options: (options ?? []) as Array<{ id: string; option_key: string; display_name: string; redemption_type: RewardRedemptionType; points_cost: number; credit_amount: number | null }>,
    settings: await getRewardsSettings(),
  };
}

export async function awardReward(input: {
  userId: string;
  points: number;
  entryType: RewardEntryType;
  status?: "pending" | "posted" | "held";
  orderId?: string | null;
  liveShowId?: string | null;
  referralAttributionId?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  expiresAt?: string | null;
}) {
  const admin = createAdminClient();
  await ensureAccount(admin, input.userId);

  const { data, error } = await (admin as any).rpc("bump_rewards_account_points", {
    p_user_id: input.userId,
    p_points: Math.trunc(input.points),
    p_entry_type: input.entryType,
    p_status: input.status ?? "posted",
    p_order_id: input.orderId ?? null,
    p_live_show_id: input.liveShowId ?? null,
    p_referral_attribution_id: input.referralAttributionId ?? null,
    p_expires_at: input.expiresAt ?? null,
    p_metadata: input.metadata ?? {},
    p_created_by: input.createdBy ?? null,
  });

  if (error) throw new Error(error.message);
  return data as RewardLedgerRow;
}

export async function issueSignupBonus(userId: string) {
  const settings = await getRewardsSettings();
  const points = Math.max(0, Math.trunc(settings?.signup_bonus_points ?? 0));
  if (!points) return null;
  return awardReward({
    userId,
    points,
    entryType: "signup_bonus",
    metadata: { source: "auth bootstrap" },
    expiresAt: settings?.point_expiry_days ? new Date(Date.now() + settings.point_expiry_days * 24 * 60 * 60 * 1000).toISOString() : null,
  });
}

export async function issueDailyLoginBonus(userId: string, lastLoginBonusAt?: string | null) {
  const settings = await getRewardsSettings();
  const points = Math.max(0, Math.trunc(settings?.daily_login_bonus_points ?? 0));
  if (!points) return null;
  const elapsed = lastLoginBonusAt ? Date.now() - new Date(lastLoginBonusAt).getTime() : Number.POSITIVE_INFINITY;
  if (elapsed < 24 * 60 * 60 * 1000) return null;
  return awardReward({
    userId,
    points,
    entryType: "daily_login",
    metadata: { source: "login" },
    expiresAt: settings?.point_expiry_days ? new Date(Date.now() + settings.point_expiry_days * 24 * 60 * 60 * 1000).toISOString() : null,
  });
}

export async function issuePurchaseRewards(order: Pick<Order, "id" | "buyer_id" | "seller_id" | "total_amount" | "marketplace_fee_amount" | "referral_source_user_id" | "referral_attribution_id">, liveShowId?: string | null) {
  const settings = await getRewardsSettings();
  const pointsPerDollar = Number(settings?.purchase_points_per_dollar ?? 0);
  const purchasePoints = Math.max(0, Math.trunc(toNumber(order.total_amount, 0) * pointsPerDollar));

  if (purchasePoints > 0) {
    await awardReward({
      userId: order.buyer_id,
      points: purchasePoints,
      entryType: "purchase",
      orderId: order.id,
      liveShowId,
      metadata: { totalAmount: order.total_amount },
    });
  }

  const sellerSalePoints = Math.max(0, Math.trunc(toNumber(order.total_amount, 0) * Number(settings?.seller_sale_points_per_dollar ?? 0)));
  if (sellerSalePoints > 0) {
    await awardReward({
      userId: order.seller_id,
      points: sellerSalePoints,
      entryType: "seller_sale",
      orderId: order.id,
      liveShowId,
      metadata: { totalAmount: order.total_amount, marketplaceFeeAmount: order.marketplace_fee_amount },
    });
  }

  if (order.referral_source_user_id) {
    const referralPoints = Math.max(0, Math.trunc(Number(settings?.referral_points_per_successful_referral ?? 0)));
    if (referralPoints > 0) {
      await awardReward({
        userId: order.referral_source_user_id,
        points: referralPoints,
        entryType: "referral_reward",
        orderId: order.id,
        referralAttributionId: order.referral_attribution_id ?? null,
        metadata: { referralSourceUserId: order.referral_source_user_id },
      });
    }

    const referralPurchasePoints = Math.max(0, Math.trunc(Number(settings?.referral_purchase_bonus_points ?? 0)));
    if (referralPurchasePoints > 0) {
      await awardReward({
        userId: order.buyer_id,
        points: referralPurchasePoints,
        entryType: "referral_purchase_bonus",
        orderId: order.id,
        referralAttributionId: order.referral_attribution_id ?? null,
        metadata: { referralSourceUserId: order.referral_source_user_id },
      });
    }
  }

  return {
    purchasePoints,
    sellerSalePoints,
  };
}

export async function issueLiveBidReward(userId: string, liveShowId: string, metadata: Record<string, unknown> = {}) {
  const settings = await getRewardsSettings();
  const points = Math.max(0, Math.trunc(Number(settings?.live_bid_points_per_bid ?? 0)));
  if (!points) return null;
  return awardReward({
    userId,
    points,
    entryType: "live_bid",
    liveShowId,
    metadata,
  });
}

export async function adjustRewardsBalance(input: { userId: string; points: number; entryType?: RewardEntryType; metadata?: Record<string, unknown>; createdBy?: string | null }) {
  return awardReward({
    userId: input.userId,
    points: input.points,
    entryType: input.entryType ?? "manual_adjustment",
    metadata: input.metadata ?? {},
    createdBy: input.createdBy ?? null,
  });
}
