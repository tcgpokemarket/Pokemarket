import { describe, it, expect } from "vitest";
import { canUseInstantPayout } from "../lib/payouts";
import { shouldReleaseFromEscrow, isEscrowBlockingPayout } from "../lib/escrow";

describe("payout request rules", () => {
  it("allows instant payout only for eligible sellers", () => {
    expect(canUseInstantPayout({ completed_orders_count: 1000, fraud_flag: false, instant_payout_enabled: true })).toBe(true);
    expect(canUseInstantPayout({ completed_orders_count: 999, fraud_flag: false, instant_payout_enabled: true })).toBe(false);
    expect(canUseInstantPayout({ completed_orders_count: 1200, fraud_flag: true, instant_payout_enabled: true })).toBe(false);
  });

  it("keeps escrow blocked while funds are held or disputed", () => {
    expect(isEscrowBlockingPayout("held")).toBe(true);
    expect(isEscrowBlockingPayout("disputed")).toBe(true);
    expect(isEscrowBlockingPayout("frozen")).toBe(true);
    expect(isEscrowBlockingPayout("released")).toBe(false);
  });

  it("releases escrow only after the hold clears", () => {
    const now = new Date("2026-07-24T12:00:00.000Z").toISOString();
    expect(
      shouldReleaseFromEscrow({
        disputeStatus: null,
        releaseAfterAt: "2026-07-24T11:59:59.000Z",
        currentStatus: "released",
        now,
      }),
    ).toBe(true);

    expect(
      shouldReleaseFromEscrow({
        disputeStatus: "open",
        releaseAfterAt: "2026-07-24T11:59:59.000Z",
        currentStatus: "held",
        now,
      }),
    ).toBe(false);
  });
});
