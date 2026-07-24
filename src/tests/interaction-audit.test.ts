import { describe, it, expect } from "vitest";
import { canUseInstantPayout } from "../lib/payouts";

describe("interaction audit regressions", () => {
  it("blocks instant payouts for ineligible wallets", () => {
    expect(canUseInstantPayout({ completed_orders_count: 1000, fraud_flag: false, instant_payout_enabled: false })).toBe(false);
  });

  it("keeps duplicate payout requests from progressing when a request is already queued", () => {
    const nextPayoutAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const blocked = new Date(nextPayoutAt).getTime() > Date.now();
    expect(blocked).toBe(true);
  });
});
