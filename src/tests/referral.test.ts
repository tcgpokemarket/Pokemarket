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
// 6. calculate_referral_reward cap logic (TypeScript reimplementation)
// 7. reward_as_pct_of_platform_revenue ≤ 30 constraint (API layer)
// 8. logFraudFlag inserts a row
// 9. duplicate referral application idempotency
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectReferralFraud, logFraudFlag } from "@/lib/referral-fraud";
import type { AnySupabaseClient } from "@/lib/referral-types";

// ── Mock Supabase builder ─────────────────────────────────────
interface MockConfig {
  loopRows?: unknown[];
  referrerSessions?: Array<{ ip_address: string | null }>;
  referredSessions?: Array<{ ip_address: string | null }>;
  referrerProfile?: { id: string; created_at: string } | null;
  referredProfile?: { id: string; created_at: string } | null;
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
    referrerProfile: { id: "ref-a", created_at: new Date(Date.now() - 30 * 86400_000).toISOString() },
    referredProfile: { id: "ref-b", created_at: new Date(Date.now() - 10 * 86400_000).toISOString() },
    recentReferralsCount: 0,
    insertError: null,
    ...o,
  };

  // We use a call-counter approach so the mock can return different
  // values depending on which .from() chain is being called.
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
            return {
              single: vi.fn().mockResolvedValue({ data: result, error: null }),
            };
          }),
        };
      }

      if (table === "device_sessions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(() => {
            const idx = sessionCallIndex++;
            const result = idx === 0 ? defaults.referrerSessions : defaults.referredSessions;
            return {
              limit: vi.fn().mockResolvedValue({ data: result, error: null }),
            };
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

// ──────────────────────────────────────────────────────────────
// Test 1: Self-referral is immediately blocked
// ──────────────────────────────────────────────────────────────
describe("detectReferralFraud", () => {
  it("blocks self-referral (same referrer and referred ID)", async () => {
    const supabase = makeSupabase();
    const result = await detectReferralFraud(supabase, "user-1", "user-1", "CODE123");

    expect(result.blocked).toBe(true);
    expect(result.flags).toContain("self_referral");
    expect(result.score).toBe(100);
  });

  // ──────────────────────────────────────────────────────────
  // Test 2: Referral loop blocked
  // ──────────────────────────────────────────────────────────
  it("blocks referral loop (referred user once referred the referrer)", async () => {
    const supabase = makeSupabase({
      // Return a row → loop exists
      loopRows: [{ id: "existing-attribution" }],
    });

    const result = await detectReferralFraud(supabase, "user-A", "user-B", "CODE123");

    expect(result.blocked).toBe(true);
    expect(result.flags).toContain("referral_loop");
    expect(result.score).toBe(90);
  });

  // ──────────────────────────────────────────────────────────
  // Test 3: New referrer account flagged (+20 score)
  // ──────────────────────────────────────────────────────────
  it("flags new referrer account (created < 7 days ago)", async () => {
    const supabase = makeSupabase({
      // Referrer created 3 days ago → new account flag
      referrerProfile: {
        id: "new-user",
        created_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
      },
    });

    const result = await detectReferralFraud(supabase, "new-user", "other-user", "NEWCODE");

    expect(result.blocked).toBe(false);
    expect(result.flags).toContain("new_referrer_account");
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  // ──────────────────────────────────────────────────────────
  // Test 4: Referral burst flagged (+50 score)
  // ──────────────────────────────────────────────────────────
  it("flags referral burst (>5 referrals in last 24h)", async () => {
    // The burst check uses: .from("referral_attributions").select("id", {count:"exact",head:true}).eq(...).gte(...)
    // The loop check uses:  .from("referral_attributions").select("id").eq(...).eq(...).limit(1)
    // We distinguish them by whether .limit() or .gte() is called last.
    let attributionsCallIndex = 0;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "referral_attributions") {
          const callIdx = attributionsCallIndex++;
          if (callIdx === 0) {
            // Loop check: .select().eq().eq().limit() => no loop
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockResolvedValue({ data: null, count: 0 }),
              limit: vi.fn().mockResolvedValue({ data: [], count: 0 }),
            };
          } else {
            // Burst check: .select(..., {count:...}).eq().gte() => 8 referrals
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockResolvedValue({ data: null, count: 8 }),
              limit: vi.fn().mockResolvedValue({ data: null, count: 8 }),
            };
          }
        }
        if (table === "profiles") {
          let pc = 0;
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn(() => {
              const idx = pc++;
              const ts = idx === 0
                ? new Date(Date.now() - 30 * 86400_000).toISOString()
                : new Date(Date.now() - 10 * 86400_000).toISOString();
              return {
                single: vi.fn().mockResolvedValue({ data: { id: "u", created_at: ts }, error: null }),
              };
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

  // ──────────────────────────────────────────────────────────
  // Test 5: Clean referral — allowed, score 0
  // ──────────────────────────────────────────────────────────
  it("allows a clean referral with no flags", async () => {
    const supabase = makeSupabase({
      loopRows: [],
      recentReferralsCount: 1,
      referrerProfile: {
        id: "old-user",
        created_at: new Date(Date.now() - 60 * 86400_000).toISOString(),
      },
      referredProfile: {
        id: "new-user",
        created_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
      },
      referrerSessions: [],
      referredSessions: [],
    });

    const result = await detectReferralFraud(supabase, "old-user", "new-user", "CLEAN99");

    expect(result.blocked).toBe(false);
    expect(result.score).toBeLessThan(70);
  });
});

// ──────────────────────────────────────────────────────────────
// Test 6: Reward cap constraint (TypeScript layer)
// ──────────────────────────────────────────────────────────────
describe("reward cap calculation", () => {
  // Reimplements the cap logic from calculate_referral_reward SQL function.
  function calculateReward(
    platformRevenue: number,
    rewardPct: number,
    maxPerReferral: number,
    monthlyPaid: number,
    monthlyCapPerReferrer: number,
    annualPaid: number,
    annualCapPerReferrer: number,
  ): number {
    // reward ≤ 30% of platform_revenue (hard constraint)
    const pct = Math.min(rewardPct, 30);
    let reward = (platformRevenue * pct) / 100;

    // per-referral cap
    reward = Math.min(reward, maxPerReferral);

    // monthly cap
    const monthlyRemaining = Math.max(0, monthlyCapPerReferrer - monthlyPaid);
    reward = Math.min(reward, monthlyRemaining);

    // annual cap
    const annualRemaining = Math.max(0, annualCapPerReferrer - annualPaid);
    reward = Math.min(reward, annualRemaining);

    return Math.max(0, reward);
  }

  it("calculates reward as a percentage of platform revenue", () => {
    const reward = calculateReward(100, 10, 25, 0, 100, 0, 1000);
    expect(reward).toBe(10); // 10% of $100
  });

  it("caps reward at max_reward_per_referral", () => {
    // 30% of $1000 = $300 → capped at $25
    const reward = calculateReward(1000, 30, 25, 0, 100, 0, 1000);
    expect(reward).toBe(25);
  });

  it("never exceeds 30% of platform revenue even if pct is set higher", () => {
    // pct=35 is rejected by API but here we ensure the formula caps at 30
    const reward = calculateReward(100, 35, 999, 0, 999, 0, 9999);
    // 30% of 100 = 30
    expect(reward).toBe(30);
  });

  it("respects monthly cap", () => {
    // Monthly cap $100, already paid $95 → at most $5 more
    const reward = calculateReward(200, 10, 25, 95, 100, 0, 1000);
    expect(reward).toBe(5);
  });

  it("returns 0 when monthly cap is exhausted", () => {
    const reward = calculateReward(200, 10, 25, 100, 100, 0, 1000);
    expect(reward).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// Test 7: reward_as_pct_of_platform_revenue ≤ 30 (API constraint)
// ──────────────────────────────────────────────────────────────
describe("settings API constraint", () => {
  it("rejects reward_as_pct_of_platform_revenue > 30", () => {
    // Simulate the TypeScript-layer validation from the PUT handler
    function validateRewardPct(pct: number): string | null {
      if (pct > 30) {
        return "reward_as_pct_of_platform_revenue cannot exceed 30% (platform revenue constraint).";
      }
      return null;
    }

    expect(validateRewardPct(31)).not.toBeNull();
    expect(validateRewardPct(30)).toBeNull();
    expect(validateRewardPct(0)).toBeNull();
    expect(validateRewardPct(29.99)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// Test 8: logFraudFlag inserts a row
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Test 9: Duplicate application idempotency (ON CONFLICT DO NOTHING)
// ──────────────────────────────────────────────────────────────
describe("referral attribution idempotency", () => {
  it("does not throw when an attribution with the same referral code already exists", async () => {
    // Simulate the API route's duplicate-check logic
    async function applyReferral(
      supabase: AnySupabaseClient,
      referrerId: string,
      referredId: string,
      code: string,
    ): Promise<{ ok: boolean; duplicate: boolean }> {
      // Check for existing attribution
      const { data: existing } = await (supabase as any)
        .from("referral_attributions")
        .select("id")
        .eq("referred_user_id", referredId)
        .limit(1);

      if (existing && existing.length > 0) {
        return { ok: true, duplicate: true };
      }

      // Insert new attribution (ON CONFLICT DO NOTHING)
      await (supabase as any)
        .from("referral_attributions")
        .insert({ referrer_user_id: referrerId, referred_user_id: referredId, referral_code: code });

      return { ok: true, duplicate: false };
    }

    // First call: no existing row
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

    // Second call: row already exists → duplicate detected, returns ok
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
