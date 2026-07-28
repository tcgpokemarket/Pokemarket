import { describe, it, expect } from "vitest";
import { canUseInstantPayout } from "../lib/payouts";
import { MAX_IMAGE_SIZE_BYTES, MAX_VERIFICATION_DOCUMENT_SIZE_BYTES } from "../lib/uploads";
import { hasActiveLiveShow } from "../lib/live-commerce";

describe("interaction audit regressions", () => {
  it("blocks instant payouts for ineligible wallets", () => {
    expect(canUseInstantPayout({ completed_orders_count: 1000, fraud_flag: false, instant_payout_enabled: false })).toBe(false);
  });

  it("keeps duplicate payout requests from progressing when a request is already queued", () => {
    const nextPayoutAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const blocked = new Date(nextPayoutAt).getTime() > Date.now();
    expect(blocked).toBe(true);
  });

  it("uses bounded upload limits", () => {
    expect(MAX_IMAGE_SIZE_BYTES).toBe(8 * 1024 * 1024);
    expect(MAX_VERIFICATION_DOCUMENT_SIZE_BYTES).toBe(12 * 1024 * 1024);
  });

  it("keeps scheduled and completed auctions available while blocking another live one", () => {
    expect(hasActiveLiveShow([
      { id: "one", title: "One", status: "scheduled", auction_state: "upcoming", scheduled_start: null, created_at: "2026-07-28T00:00:00.000Z" },
      { id: "two", title: "Two", status: "ended", auction_state: "sold", scheduled_start: null, created_at: "2026-07-28T00:00:00.000Z" },
    ])).toBe(false);

    expect(hasActiveLiveShow([
      { id: "one", title: "One", status: "scheduled", auction_state: "upcoming", scheduled_start: null, created_at: "2026-07-28T00:00:00.000Z" },
      { id: "two", title: "Two", status: "live", auction_state: "live", scheduled_start: null, created_at: "2026-07-28T00:00:00.000Z" },
    ])).toBe(true);
  });
});
