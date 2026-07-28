import { describe, it, expect } from "vitest";
import { getActiveLiveShow, hasActiveLiveShow, type LiveShowSummary } from "../lib/live-commerce";

const scheduledShow: LiveShowSummary = {
  id: "show-scheduled",
  title: "Scheduled room",
  status: "scheduled",
  auction_state: "upcoming",
  scheduled_start: null,
  created_at: "2026-07-28T00:00:00.000Z",
};

const liveShow: LiveShowSummary = {
  id: "show-live",
  title: "Live room",
  status: "live",
  auction_state: "live",
  scheduled_start: null,
  created_at: "2026-07-28T00:00:00.000Z",
};

const endedShow: LiveShowSummary = {
  id: "show-ended",
  title: "Ended room",
  status: "ended",
  auction_state: "sold",
  scheduled_start: null,
  created_at: "2026-07-28T00:00:00.000Z",
};

describe("live auction concurrency guard", () => {
  it("finds the current live auction", () => {
    expect(getActiveLiveShow([scheduledShow, liveShow, endedShow])?.id).toBe("show-live");
  });

  it("ignores the show being updated when checking for conflicts", () => {
    expect(hasActiveLiveShow([liveShow], "show-live")).toBe(false);
  });

  it("blocks a second live auction for the same seller", () => {
    expect(hasActiveLiveShow([scheduledShow, liveShow])).toBe(true);
  });

  it("allows scheduled and completed rooms to coexist", () => {
    expect(hasActiveLiveShow([scheduledShow, endedShow])).toBe(false);
  });
});
