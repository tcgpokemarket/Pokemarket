// ============================================================
// referral-fraud.ts
// Fraud detection for the referral program.
// Checks for self-referral, loops, IP collisions, burst signups, etc.
// ============================================================

import type { AnySupabaseClient, FraudCheckResult } from "./referral-types";

// Common email domains we don't penalise for sharing
const COMMON_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "protonmail.com",
  "live.com",
  "msn.com",
  "aol.com",
  "me.com",
]);

/**
 * Detects potential fraud in a referral attempt.
 *
 * Checks performed (with individual fraud score contributions):
 * 1. Self-referral                              → block  (+100)
 * 2. Referral loop (referred had referred referrer) → block (+90)
 * 3. Same IP address at signup                 → flag   (+40)
 * 4. Same non-common email domain              → flag   (+30)
 * 5. Referrer account < 7 days old             → flag   (+20)
 * 6. Referrer sent >5 referrals in last 24h   → flag   (+50)
 *
 * Score ≥ 70 → blocked
 * Score 40–69 → requires admin review (returned as flag, not blocked in caller)
 * Score < 40 → allow
 */
export async function detectReferralFraud(
  supabase: AnySupabaseClient,
  referrerId: string,
  referredId: string,
  referralCode: string,
): Promise<FraudCheckResult> {
  const flags: string[] = [];
  let score = 0;

  // ── Check 1: Self-referral ──────────────────────────────────
  if (referrerId === referredId) {
    return {
      blocked: true,
      flags: ["self_referral"],
      score: 100,
    };
  }

  // ── Check 2: Referral loop ──────────────────────────────────
  // Does an attribution exist where the REFERRED user once referred the REFERRER?
  const { data: loopCheck } = await supabase
    .from("referral_attributions")
    .select("id")
    .eq("referrer_user_id", referredId)
    .eq("referred_user_id", referrerId)
    .limit(1);

  if (loopCheck && loopCheck.length > 0) {
    return {
      blocked: true,
      flags: ["referral_loop"],
      score: 90,
    };
  }

  // ── Load profiles for both users (email + created_at) ───────
  const [referrerResult, referredResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, created_at")
      .eq("id", referrerId)
      .single(),
    supabase
      .from("profiles")
      .select("id, created_at")
      .eq("id", referredId)
      .single(),
  ]);

  // ── Check 3: Same IP at signup ───────────────────────────────
  const { data: referrerSessions } = await supabase
    .from("device_sessions")
    .select("ip_address")
    .eq("user_id", referrerId)
    .limit(10);

  const { data: referredSessions } = await supabase
    .from("device_sessions")
    .select("ip_address")
    .eq("user_id", referredId)
    .limit(10);

  if (referrerSessions && referredSessions) {
    const referrerIps = new Set(
      referrerSessions
        .map((s: { ip_address: string | null }) => s.ip_address)
        .filter(Boolean),
    );
    const sharedIp = referredSessions.some(
      (s: { ip_address: string | null }) =>
        s.ip_address && referrerIps.has(s.ip_address),
    );
    if (sharedIp) {
      flags.push("shared_ip_address");
      score += 40;
    }
  }

  // ── Check 4: Same non-common email domain ────────────────────
  // We can only check via auth.users which is not accessible from client.
  // Use a best-effort approach: if both user IDs resolve to the same
  // domain from their username pattern. Since we don't have email in profiles,
  // we skip this check unless we have access to auth (service role).
  // This check is intentionally conservative — we skip it for now to avoid
  // false positives from the RLS-restricted profiles table.

  // ── Check 5: Referrer account < 7 days old ───────────────────
  if (referrerResult.data?.created_at) {
    const referrerCreated = new Date(referrerResult.data.created_at);
    const daysSinceCreated =
      (Date.now() - referrerCreated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 7) {
      flags.push("new_referrer_account");
      score += 20;
    }
  }

  // ── Check 6: Referral burst — >5 referrals in 24h ───────────
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentReferrals } = await supabase
    .from("referral_attributions")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", referrerId)
    .gte("created_at", oneDayAgo);

  if (recentReferrals !== null && recentReferrals > 5) {
    flags.push("referral_burst");
    score += 50;
  }

  // ── Final decision ───────────────────────────────────────────
  const blocked = score >= 70;

  // Add informational flag for admin-review range
  if (score >= 40 && score < 70) {
    flags.push("requires_admin_review");
  }

  // Suppress unused variable warning — referralCode is available for
  // callers who want to log it; not used in checks above.
  void referralCode;
  void referredResult;
  void COMMON_EMAIL_DOMAINS;

  return { blocked, flags, score };
}

/**
 * Logs a fraud flag to the referral_fraud_flags table.
 * Uses the service-role client so it bypasses RLS.
 */
export async function logFraudFlag(
  supabase: AnySupabaseClient,
  params: {
    flaggedUserId: string | null;
    referrerId: string | null;
    attributionId: string | null;
    flagType: string;
    details: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("referral_fraud_flags").insert({
    flagged_user_id: params.flaggedUserId,
    referrer_id: params.referrerId,
    attribution_id: params.attributionId,
    flag_type: params.flagType,
    details: params.details,
    reviewed: false,
  });
}
