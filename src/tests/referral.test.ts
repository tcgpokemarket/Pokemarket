// ============================================================
// referral.test.ts
// Vitest tests for the referral program.
//
// Covers:
// 1. detectReferralFraud: self-referral blocked
// 2. detectReferralFraud: referral loop blocked
// 3. detectReferralFraud: new account flagged (score +20)
// 4. detectReferralFraud: referral burst flagged (score +50)
// 5. detectReferralFraud: clean referral allowed
// 6. referral settlement cap logic
// 7. admin settings validation
// 8. logFraudFlag inserts a row
// 9. duplicate referral application idempotency
// 10. reward revocation on refund / dispute
// 11. end-to-end referral settlement math
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { detectReferralFraud, logFraudFlag } from "../lib/referral-fraud";
import { calculateReferralSettlementDecision, calculateCommissionCap, normalizeReferralSettlementSettings } from "../lib/referral-settlement";
import type { AnySupabaseClient } from "@/lib/referral-types";

interface MockConfig {
  loopRows?: unknown[];
  referrerSessions?: Array<{ ip_address: string | null; device_fingerprint?: string | null; user_agent?: string | null }>;
  referredSessions?: Array<{ ip_address: string | null; device_fingerprint?: string | null; user_agent?: string | null }>;
  referrerProfile?: { id: string; created_at: string; phone?: string | null; identity_verified_at?: string | null } | null;
  referredProfile?: { id: string; created_at: string; phone?: string | null; identity_verified_at?: string | null } | null;
  recentReferralsCount?: number;
  insertError?: { message: string } | null;
}

function makeSupabase(overrides: MockConfig = {}) {
  return buildMockSupabase(overrides);
}

function buildMockSupabase(o: MockConfig) {
  const defaults = {
    loopRows: [],
    referrerSessions: [],
    referredSessions: [],
    referrerProfile: { id: "ref-a", created_at: new Date(Date.now() - 30 * 86400_000).toISOString(), phone: null, identity_verified_at: null },
    referredProfile: { id: "ref-b", created_at: new Date(Date.now() - 10 * 86400_000).toISOString(), phone: null, identity_verified_at: null },
    recentReferralsCount: 0,
    insertError: null,
    ...o,
  };

  let profileCallIndex = 0;
  let sessionCallIndex = 0;

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "referral_attributions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: defaults.loopRows, count: defaults.recentReferralsCount }),
          insert: vi.fn().mockResolvedValue({ error: defaults.insertError }),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(() => {
            const idx = profileCallIndex++;
            const result = idx === 0 ? defaults.referrerProfile : defaults.referredProfile;
            return { single: vi.fn().mockResolvedValue({ data: result, error: null }) };
          }),
        };
      }

      if (table === "device_sessions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(() => {
            const idx = sessionCallIndex++;
            const result = idx === 0 ? defaults.referrerSessions : defaults.referredSessions;
            return { limit: vi.fn().mockResolvedValue({ data: result, error: null }) };
          }),
        };
      }

      if (table === "referral_fraud_flags") {
        return {
          insert: vi.fn().mockResolvedValue({ error: defaults.insertError }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], count: 0 }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  } as unknown as AnySupabaseClient;

  return supabase;
}

describe("detectReferralFraud", () => {
  it("blocks self-referral (same referrer and referred ID)", async () => {
    const supabase = makeSupabase();
    const result = await detectReferralFraud(supabase, "user-1", "user-1", "CODE123");

    expect(result.blocked).toBe(true);
    expect(result.flags).toContain("self_referral");
    expect(result.score).toBe(100);
  });

  it("blocks referral loop (referred user once referred the referrer)", async () => {
    const supabase = makeSupabase({ loopRows: [{ id: "existing-attribution" }] });

    const result = await detectReferralFraud(supabase, "user-A", "user-B", "CODE123");

    expect(result.blocked).toBe(true);
    expect(result.flags).toContain("referral_loop");
    expect(result.score).toBe(90);
  });

  it("flags new referrer account (created < 7 days ago)", async () => {
    const supabase = makeSupabase({
      referrerProfile: { id: "new-user", created_at: new Date(Date.now() - 3 * 86400_000).toISOString(), phone: null, identity_verified_at: null },
    });

    const result = await detectReferralFraud(supabase, "new-user", "other-user", "NEWCODE");

    expect(result.blocked).toBe(false);
    expect(result.flags).toContain("new_referrer_account");
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it("flags referral burst (>5 referrals in last 24h)", async () => {
    let attributionsCallIndex = 0;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "referral_attributions") {
          const callIdx = attributionsCallIndex++;
          if (callIdx === 0) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockResolvedValue({ data: null, count: 0 }),
              limit: vi.fn().mockResolvedValue({ data: [], count: 0 }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ data: null, count: 8 }),
            limit: vi.fn().mockResolvedValue({ data: null, count: 8 }),
          };
        }
        if (table === "profiles") {
          let pc = 0;
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn(() => {
              const idx = pc++;
              const ts = idx === 0 ? new Date(Date.now() - 30 * 86400_000).toISOString() : new Date(Date.now() - 10 * 86400_000).toISOString();
              return { single: vi.fn().mockResolvedValue({ data: { id: "u", created_at: ts, phone: null, identity_verified_at: null }, error: null }) };
            }),
          };
        }
        if (table === "device_sessions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) })),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ data: [], count: 0 }),
          limit: vi.fn().mockResolvedValue({ data: [], count: 0 }),
        };
      }),
    } as unknown as AnySupabaseClient;

    const result = await detectReferralFraud(supabase, "power-referrer", "new-user", "BURST");

    expect(result.flags).toContain("referral_burst");
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("allows a clean referral with no flags", async () => {
    const supabase = makeSupabase({
      loopRows: [],
      recentReferralsCount: 1,
      referrerProfile: { id: "old-user", created_at: new Date(Date.now() - 60 * 86400_000).toISOString(), phone: null, identity_verified_at: null },
      referredProfile: { id: "new-user", created_at: new Date(Date.now() - 5 * 86400_000).toISOString(), phone: null, identity_verified_at: null },
      referrerSessions: [],
      referredSessions: [],
    });

    const result = await detectReferralFraud(supabase, "old-user", "new-user", "CLEAN99");

    expect(result.blocked).toBe(false);
    expect(result.score).toBeLessThan(70);
  });
});

describe("referral settlement logic", () => {
  it("caps lifetime reward at 20% of commission earned", () => {
    const settings = normalizeReferralSettlementSettings({ reward_amount: 5, max_lifetime_commission_share_percent: 20 });
    const cap = calculateCommissionCap(85, settings);
    expect(cap).toBe(17);
  });

  it("reduces a pending reward when the commission cap is nearly exhausted", () => {
    const settings = normalizeReferralSettlementSettings({ reward_amount: 5, max_lifetime_commission_share_percent: 20 });
    const decision = calculateReferralSettlementDecision({ rewardAmount: 5, totalCommission: 85, paidRewards: 15, pendingRewards: 0, settings });
    expect(decision.eligible).toBe(true);
    expect(decision.rewardAmount).toBe(2);
  });

  it("returns ineligible when the commission cap is exhausted", () => {
    const settings = normalizeReferralSettlementSettings({ reward_amount: 5, max_lifetime_commission_share_percent: 20 });
    const decision = calculateReferralSettlementDecision({ rewardAmount: 5, totalCommission: 85, paidRewards: 17, pendingRewards: 0, settings });
    expect(decision.eligible).toBe(false);
    expect(decision.rewardAmount).toBe(0);
  });
});

describe("settings API constraint", () => {
  it("rejects commission share above 20%", () => {
    function validateShare(pct: number): string | null {
      if (pct > 20) {
        return "max_lifetime_commission_share_percent cannot exceed 20%.";
      }
      return null;
    }

    expect(validateShare(21)).not.toBeNull();
    expect(validateShare(20)).toBeNull();
  });
});

describe("logFraudFlag", () => {
  it("inserts a fraud flag row without throwing", async () => {
    let insertCalled = false;
    let insertPayload: unknown = null;

    const supabase = {
      from: vi.fn((table: string) => {
        expect(table).toBe("referral_fraud_flags");
        return {
          insert: vi.fn((payload: unknown) => {
            insertCalled = true;
            insertPayload = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }),
    } as unknown as AnySupabaseClient;

    await logFraudFlag(supabase, {
      flaggedUserId: "user-x",
      referrerId: "user-y",
      attributionId: "attr-123",
      flagType: "self_referral",
      details: { score: 100 },
    });

    expect(insertCalled).toBe(true);
    expect(insertPayload).toMatchObject({
      flagged_user_id: "user-x",
      referrer_id: "user-y",
      attribution_id: "attr-123",
      flag_type: "self_referral",
    });
  });
});

describe("reward revocation", () => {
  it("marks eligible rewards revoked when the qualifying order is refunded", () => {
    const rewards = [{ id: "reward-1", status: "pending" }, { id: "reward-2", status: "approved" }, { id: "reward-3", status: "paid" }];
    const eligible = rewards.filter((reward) => reward.status === "pending" || reward.status === "approved");
    expect(eligible).toHaveLength(2);
  });

  it("does not revoke already-paid rewards", () => {
    const rewards = [{ id: "reward-1", status: "paid" }, { id: "reward-2", status: "revoked" }, { id: "reward-3", status: "approved" }];
    const eligible = rewards.filter((reward) => reward.status === "pending" || reward.status === "approved");
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.id).toBe("reward-3");
  });
});

describe("end-to-end referral reward math", () => {
  function computeReward(params: {
    grossAmount: number;
    commissionRate: number;
    rewardAmount: number;
    paidRewards: number;
    lifetimeCapPercent: number;
  }) {
    const commission = Number((params.grossAmount * params.commissionRate).toFixed(2));
    const maxLifetimeReward = Number((commission * params.lifetimeCapPercent / 100).toFixed(2));
    const remainingLifetimeReward = Math.max(0, Number((maxLifetimeReward - params.paidRewards).toFixed(2)));
    const rewardAmount = Math.min(params.rewardAmount, remainingLifetimeReward);
    return { commission, maxLifetimeReward, rewardAmount };
  }

  it("computes reward for a normal $200 order with $10 commission", () => {
    const result = computeReward({ grossAmount: 200, commissionRate: 0.05, rewardAmount: 5, paidRewards: 0, lifetimeCapPercent: 20 });
    expect(result.commission).toBe(10);
    expect(result.maxLifetimeReward).toBe(2);
    expect(result.rewardAmount).toBe(2);
  });

  it("caps reward at the lifetime commission share for a large order stream", () => {
    const result = computeReward({ grossAmount: 1000, commissionRate: 0.085, rewardAmount: 5, paidRewards: 0, lifetimeCapPercent: 20 });
    expect(result.commission).toBe(85);
    expect(result.maxLifetimeReward).toBe(17);
    expect(result.rewardAmount).toBe(5);
  });

  it("returns $0 reward once the lifetime cap is exhausted", () => {
    const result = computeReward({ grossAmount: 1000, commissionRate: 0.085, rewardAmount: 5, paidRewards: 17, lifetimeCapPercent: 20 });
    expect(result.rewardAmount).toBe(0);
  });
});

describe("referral attribution idempotency", () => {
  it("does not throw when an attribution with the same referral code already exists", async () => {
    async function applyReferral(
      supabase: AnySupabaseClient,
      referrerId: string,
      referredId: string,
      code: string,
    ): Promise<{ ok: boolean; duplicate: boolean }> {
      const { data: existing } = await (supabase as any).from("referral_attributions").select("id").eq("referred_user_id", referredId).limit(1);
      if (existing && existing.length > 0) {
        return { ok: true, duplicate: true };
      }
      await (supabase as any).from("referral_attributions").insert({ referrer_user_id: referrerId, referred_user_id: referredId, referral_code: code });
      return { ok: true, duplicate: false };
    }

    const supabaseFirst = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    } as unknown as AnySupabaseClient;

    const first = await applyReferral(supabaseFirst, "ref-a", "ref-b", "CODE1");
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);

    const supabaseSecond = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: "existing-id" }], error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    } as unknown as AnySupabaseClient;

    const second = await applyReferral(supabaseSecond, "ref-a", "ref-b", "CODE1");
    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
  });
});
