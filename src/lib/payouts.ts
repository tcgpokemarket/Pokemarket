import type { SellerWallet } from "@/lib/supabase/types";

export function getPayoutTier(completedOrdersCount: number) {
  return completedOrdersCount >= 100 ? "verified" : "new";
}

export function canUseInstantPayout(wallet: Pick<SellerWallet, "completed_orders_count" | "fraud_flag" | "instant_payout_enabled">) {
  return (wallet.completed_orders_count ?? 0) >= 100 && !wallet.fraud_flag && wallet.instant_payout_enabled;
}

export function nextPayoutDate(lastPayoutAt: string | null, timezoneOffsetHours = 0) {
  if (!lastPayoutAt) return null;
  const next = new Date(lastPayoutAt);
  next.setDate(next.getDate() + 1);
  next.setHours(0 - timezoneOffsetHours, 0, 0, 0);
  return next.toISOString();
}
