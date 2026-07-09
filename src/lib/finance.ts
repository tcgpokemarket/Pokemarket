import { calculateFraudRiskScore, calculateReleaseAt, getSellerPayoutDisposition, isHighRiskSeller, sellerInstantPayoutUnlocked, type SellerPayoutProfile, type SellerRiskSignals } from "@/lib/escrow";

export type FinanceOrderState = {
  id: string;
  seller_id: string;
  buyer_id: string;
  total_amount: number;
  marketplace_fee_amount: number;
  processing_fee_amount: number;
  seller_payout_amount: number;
  status: string;
  escrow_status?: string | null;
  payout_status?: string | null;
  dispute_status?: string | null;
  delivered_at?: string | null;
  escrow_release_at?: string | null;
  seller_completed_sales_count?: number | null;
  tracking_number?: string | null;
};

export type FinanceWalletState = {
  seller_id: string;
  available_balance: number;
  pending_balance: number;
  escrow_balance: number;
  frozen_balance: number;
  platform_balance: number;
  completed_orders_count: number;
  instant_payout_enabled: boolean;
  fraud_flag: boolean;
  fraud_risk_score: number;
  hold_reason: string | null;
};

export type FinanceSnapshot = {
  order: FinanceOrderState;
  wallet: FinanceWalletState;
  disposition: ReturnType<typeof getSellerPayoutDisposition>;
  sellerEligibleForInstantPayout: boolean;
  releaseAt: string | null;
  riskScore: number;
  highRisk: boolean;
};

export function buildSellerPayoutProfile(wallet: FinanceWalletState, highRiskOrder = false, disputeOpen = false): SellerPayoutProfile {
  return {
    completedSalesCount: wallet.completed_orders_count,
    fraudFlag: wallet.fraud_flag,
    instantPayoutEnabled: wallet.instant_payout_enabled,
    highRiskOrder,
    disputeOpen,
    pendingEscrow: wallet.pending_balance,
    sellerHold: Boolean(wallet.hold_reason),
  };
}

export function buildFinanceSnapshot(order: FinanceOrderState, wallet: FinanceWalletState, riskSignals: SellerRiskSignals) {
  const riskScore = calculateFraudRiskScore(riskSignals);
  const highRisk = isHighRiskSeller(riskScore);
  const disposition = getSellerPayoutDisposition(buildSellerPayoutProfile(wallet, highRisk, order.dispute_status === "open"));
  return {
    order,
    wallet,
    disposition,
    sellerEligibleForInstantPayout: sellerInstantPayoutUnlocked(wallet.completed_orders_count),
    releaseAt: calculateReleaseAt(order.delivered_at),
    riskScore,
    highRisk,
  } satisfies FinanceSnapshot;
}

export function normalizeMoney(value: number | string | null | undefined) {
  return Number((Number(value ?? 0)).toFixed(2));
}

export function calculateOrderEscrowAmounts(order: Pick<FinanceOrderState, "total_amount" | "marketplace_fee_amount" | "processing_fee_amount">) {
  const sellerPayout = Math.max(order.total_amount - order.marketplace_fee_amount - order.processing_fee_amount, 0);
  const escrowAmount = Math.max(order.total_amount - order.marketplace_fee_amount, 0);
  return {
    sellerPayout: normalizeMoney(sellerPayout),
    escrowAmount: normalizeMoney(escrowAmount),
    platformFeeAmount: normalizeMoney(order.marketplace_fee_amount),
  };
}
