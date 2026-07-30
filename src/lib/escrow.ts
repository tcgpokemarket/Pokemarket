export const INSTANT_PAYOUT_COMPLETED_SALES_THRESHOLD = 1000;
export const DELIVERY_CONFIRMATION_WAIT_HOURS = 72;

export type EscrowRiskSignals = {
  failedPayments: number;
  chargebacks: number;
  payoutSpikes: number;
  rapidAccountAgeHours: number;
  linkedFraudAccounts: number;
  vpnProxyHits: number;
  deviceFingerprintMatches: number;
  velocityBreaches: number;
  suspiciousIpEvents: number;
};

export type EscrowWalletState = {
  completed_orders_count?: number | null;
  instant_payout_enabled?: boolean | null;
  fraud_flag?: boolean | null;
  available_balance?: number | null;
  pending_balance?: number | null;
  frozen_balance?: number | null;
};

export type EscrowDecision = {
  instantEligible: boolean;
  requiresEscrowHold: boolean;
  requiresManualReview: boolean;
  fraudRiskScore: number;
  fraudRiskReasons: string[];
  holdReason: string;
};

export type SellerPayoutProfile = {
  completedSalesCount: number;
  fraudFlag: boolean;
  instantPayoutEnabled: boolean;
  highRiskOrder: boolean;
  disputeOpen: boolean;
  pendingEscrow: number;
  sellerHold: boolean;
};

export type SellerRiskSignals = EscrowRiskSignals;

export function canUseInstantPayout(wallet: Pick<EscrowWalletState, "completed_orders_count" | "instant_payout_enabled" | "fraud_flag">) {
  return (wallet.completed_orders_count ?? 0) >= INSTANT_PAYOUT_COMPLETED_SALES_THRESHOLD && !wallet.fraud_flag && Boolean(wallet.instant_payout_enabled);
}

export function sellerInstantPayoutUnlocked(completedOrdersCount: number) {
  return completedOrdersCount >= INSTANT_PAYOUT_COMPLETED_SALES_THRESHOLD;
}

export function getPayoutTier(completedOrdersCount: number) {
  return completedOrdersCount >= INSTANT_PAYOUT_COMPLETED_SALES_THRESHOLD ? "verified" : "new";
}

export function buildEscrowLedgerKey(orderId: string, action: string, suffix = "") {
  return ["escrow", orderId, action, suffix].filter(Boolean).join(":");
}

export function getDeliveryReleaseAt(deliveredAt: string, waitHours = DELIVERY_CONFIRMATION_WAIT_HOURS) {
  const date = new Date(deliveredAt);
  date.setHours(date.getHours() + waitHours);
  return date.toISOString();
}

export function calculateReleaseAt(deliveredAt?: string | null) {
  return deliveredAt ? getDeliveryReleaseAt(deliveredAt) : null;
}

export function calculateFraudRisk(signals: EscrowRiskSignals) {
  const reasons: string[] = [];
  let score = 0;

  const add = (points: number, reason: string) => {
    if (points <= 0) return;
    score += points;
    reasons.push(reason);
  };

  add(signals.failedPayments * 12, "Multiple failed payments");
  add(signals.chargebacks * 30, "Chargeback history");
  add(signals.payoutSpikes * 18, "Unusual payout spike");
  add(signals.rapidAccountAgeHours > 72 ? 20 : 0, "Rapid account creation");
  add(signals.linkedFraudAccounts * 25, "Linked fraudulent account");
  add(signals.vpnProxyHits * 15, "VPN/proxy activity");
  add(signals.deviceFingerprintMatches * 18, "Device fingerprint match");
  add(signals.velocityBreaches * 14, "Velocity breach");
  add(signals.suspiciousIpEvents * 16, "Suspicious IP activity");

  const capped = Math.min(100, score);
  return {
    score: capped,
    reasons: Array.from(new Set(reasons)),
    requiresManualReview: capped >= 50 || signals.chargebacks > 0 || signals.linkedFraudAccounts > 0,
  };
}

export function calculateFraudRiskScore(signals: EscrowRiskSignals) {
  return calculateFraudRisk(signals).score;
}

export function isHighRiskSeller(score: number) {
  return score >= 70;
}

export function getSellerPayoutDisposition(profile: SellerPayoutProfile) {
  if (profile.fraudFlag || profile.highRiskOrder || profile.disputeOpen || profile.sellerHold) return "frozen";
  if (profile.instantPayoutEnabled && profile.completedSalesCount >= INSTANT_PAYOUT_COMPLETED_SALES_THRESHOLD) return "instant";
  return "escrow";
}

export function decideEscrowFlow(args: {
  wallet: EscrowWalletState;
  signals: EscrowRiskSignals;
  orderAmount: number;
}) : EscrowDecision {
  const fraud = calculateFraudRisk(args.signals);
  const instantEligible = canUseInstantPayout(args.wallet);
  const requiresEscrowHold = true;
  const requiresManualReview = fraud.requiresManualReview || Boolean(args.wallet.fraud_flag);
  const holdReason = requiresManualReview
    ? "Manual review required"
    : instantEligible
      ? "Instant payout eligible"
      : "Awaiting delivery confirmation";

  return {
    instantEligible,
    requiresEscrowHold,
    requiresManualReview,
    fraudRiskScore: fraud.score,
    fraudRiskReasons: fraud.reasons,
    holdReason,
  };
}

export function shouldReleaseFromEscrow(args: {
  disputeStatus?: string | null;
  releaseAfterAt?: string | null;
  currentStatus?: string | null;
  now?: string;
}) {
  const now = new Date(args.now ?? new Date().toISOString()).getTime();
  const releaseAfter = args.releaseAfterAt ? new Date(args.releaseAfterAt).getTime() : Number.POSITIVE_INFINITY;
  const disputeOpen = args.disputeStatus === "open";
  const frozen = args.currentStatus === "frozen" || args.currentStatus === "disputed";
  return !disputeOpen && !frozen && now >= releaseAfter;
}

export function shouldReleaseEscrow(args: { deliveryConfirmed: boolean; disputeOpen: boolean; releaseAt: string | null; now?: Date }) {
  if (args.deliveryConfirmed) return true;
  if (args.disputeOpen) return false;
  return shouldReleaseFromEscrow({ releaseAfterAt: args.releaseAt, now: args.now?.toISOString() });
}
