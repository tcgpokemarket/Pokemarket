import { describe, expect, it, vi } from "vitest";
import { recordPaymentEvent } from "./payment-events";

describe("recordPaymentEvent", () => {
  it("skips an already recorded payment event", async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "existing" }, error: null });
    const insert = vi.fn();

    const admin = {
      from: vi.fn(() => ({ select, eq, maybeSingle, insert })),
    } as any;

    const recorded = await recordPaymentEvent(admin, { orderId: "order-1", stripeEventId: "evt-1", status: "paid" });

    expect(recorded).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
