import { describe, expect, it } from "vitest";
import { canUseInstantPayout, getPayoutTier } from "./payouts";
import { calculateFraudRiskScore, sellerInstantPayoutUnlocked, shouldReleaseEscrow } from "./escrow";

describe("payout and escrow rules", () => {
  it("keeps instant payout locked at 999 sales", () => {
    expect(sellerInstantPayoutUnlocked(999)).toBe(false);
    expect(getPayoutTier(999)).toBe("new");
    expect(canUseInstantPayout({ completed_orders_count: 999, fraud_flag: false, instant_payout_enabled: true })).toBe(false);
  });

  it("unlocks instant payout at exactly 1000 sales", () => {
    expect(sellerInstantPayoutUnlocked(1000)).toBe(true);
    expect(getPayoutTier(1000)).toBe("verified");
    expect(canUseInstantPayout({ completed_orders_count: 1000, fraud_flag: false, instant_payout_enabled: true })).toBe(true);
  });

  it("does not override fraud or disabled instant payout", () => {
    expect(canUseInstantPayout({ completed_orders_count: 1001, fraud_flag: true, instant_payout_enabled: true })).toBe(false);
    expect(canUseInstantPayout({ completed_orders_count: 1001, fraud_flag: false, instant_payout_enabled: false })).toBe(false);
  });

  it("releases escrow after the hold period when there is no dispute", () => {
    const now = new Date("2026-07-08T00:00:00.000Z");
    expect(shouldReleaseEscrow({ deliveryConfirmed: false, disputeOpen: false, releaseAt: "2026-07-07T00:00:00.000Z", now })).toBe(true);
    expect(shouldReleaseEscrow({ deliveryConfirmed: false, disputeOpen: true, releaseAt: "2026-07-07T00:00:00.000Z", now })).toBe(false);
    expect(shouldReleaseEscrow({ deliveryConfirmed: true, disputeOpen: false, releaseAt: null, now })).toBe(true);
  });

  it("calculates fraud risk from common signals", () => {
    const score = calculateFraudRiskScore({
      failedPayments: 3,
      chargebacks: 1,
      payoutSpikes: 2,
      rapidAccountAgeHours: 12,
      linkedFraudAccounts: 1,
      vpnProxyHits: 1,
      deviceFingerprintMatches: 1,
      velocityBreaches: 2,
      suspiciousIpEvents: 1,
    });

    expect(score).toBeGreaterThanOrEqual(70);
  });
});
