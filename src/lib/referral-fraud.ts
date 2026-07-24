// ============================================================
// referral-fraud.ts
// Fraud detection for the referral program.
// Checks for self-referral, loops, IP collisions, burst signups, device overlap, and account abuse.
// ============================================================

import type { AnySupabaseClient, FraudCheckResult, ReferralFraudSeverity } from "./referral-types";

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

function classifySeverity(score: number): ReferralFraudSeverity {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export async function detectReferralFraud(
  supabase: AnySupabaseClient,
  referrerId: string,
  referredId: string,
  referralCode: string,
): Promise<FraudCheckResult> {
  const flags: string[] = [];
  let score = 0;

  if (referrerId === referredId) {
    return { blocked: true, flags: ["self_referral"], score: 100 };
  }

  const { data: loopCheck } = await supabase
    .from("referral_attributions")
    .select("id")
    .eq("referrer_user_id", referredId)
    .eq("referred_user_id", referrerId)
    .limit(1);

  if (loopCheck && loopCheck.length > 0) {
    return { blocked: true, flags: ["referral_loop"], score: 90 };
  }

  const [referrerResult, referredResult] = await Promise.all([
    supabase.from("profiles").select("id, created_at, phone, identity_verified_at").eq("id", referrerId).single(),
    supabase.from("profiles").select("id, created_at, phone, identity_verified_at").eq("id", referredId).single(),
  ]);

  const referrerProfile = referrerResult.data as { id: string; created_at: string; phone?: string | null; identity_verified_at?: string | null } | null;
  const referredProfile = referredResult.data as { id: string; created_at: string; phone?: string | null; identity_verified_at?: string | null } | null;

  const [referrerSessions, referredSessions] = await Promise.all([
    supabase.from("device_sessions").select("ip_address, device_fingerprint, user_agent").eq("user_id", referrerId).limit(10),
    supabase.from("device_sessions").select("ip_address, device_fingerprint, user_agent").eq("user_id", referredId).limit(10),
  ]);

  const referrerIpSet = new Set(
    (referrerSessions.data ?? [])
      .map((session: { ip_address: string | null }) => session.ip_address)
      .filter(Boolean),
  );
  const referrerFingerprintSet = new Set(
    (referrerSessions.data ?? [])
      .map((session: { device_fingerprint: string | null }) => session.device_fingerprint)
      .filter(Boolean),
  );
  const referrerUserAgentSet = new Set(
    (referrerSessions.data ?? [])
      .map((session: { user_agent: string | null }) => session.user_agent)
      .filter(Boolean),
  );

  const sharedIp = (referredSessions.data ?? []).some((session: { ip_address: string | null }) => session.ip_address && referrerIpSet.has(session.ip_address));
  if (sharedIp) {
    flags.push("shared_ip_address");
    score += 35;
  }

  const sharedFingerprint = (referredSessions.data ?? []).some((session: { device_fingerprint: string | null }) => session.device_fingerprint && referrerFingerprintSet.has(session.device_fingerprint));
  if (sharedFingerprint) {
    flags.push("duplicate_device_fingerprint");
    score += 60;
  }

  const sharedUserAgent = (referredSessions.data ?? []).some((session: { user_agent: string | null }) => session.user_agent && referrerUserAgentSet.has(session.user_agent));
  if (sharedUserAgent && sharedIp) {
    flags.push("device_session_overlap");
    score += 15;
  }

  if (referrerProfile?.created_at) {
    const referrerAgeDays = (Date.now() - new Date(referrerProfile.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (referrerAgeDays < 7) {
      flags.push("new_referrer_account");
      score += 20;
    }
  }

  if (referrerProfile?.identity_verified_at && referredProfile?.identity_verified_at && referrerProfile.identity_verified_at === referredProfile.identity_verified_at) {
    flags.push("shared_identity_verification");
    score += 40;
  }

  if (referrerProfile?.phone && referredProfile?.phone && referrerProfile.phone === referredProfile.phone) {
    flags.push("shared_phone_number");
    score += 45;
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [recentReferrals, recentProfiles] = await Promise.all([
    supabase.from("referral_attributions").select("id", { count: "exact", head: true }).eq("referrer_user_id", referrerId).gte("created_at", oneDayAgo),
    supabase.from("referral_attributions").select("id", { count: "exact", head: true }).eq("referrer_user_id", referrerId).gte("created_at", oneHourAgo),
  ]);

  const recentReferralCount = Number((recentReferrals as { count?: number | null }).count ?? 0);
  const recentReferralBurst = Number((recentProfiles as { count?: number | null }).count ?? 0);
  if (recentReferralCount > 5 || recentReferralBurst > 2) {
    flags.push("referral_burst");
    score += 50;
  }

  const referredRecentSessions = (referredSessions.data ?? []).length;
  if (referredRecentSessions === 0) {
    flags.push("missing_device_history");
    score += 10;
  }

  if ((referredProfile?.created_at && Date.now() - new Date(referredProfile.created_at).getTime() < 1000 * 60 * 60 * 24) || recentReferralBurst > 0) {
    flags.push("new_referred_account");
    score += 10;
  }

  if (referralCode && typeof referralCode === "string" && referralCode.length < 4) {
    flags.push("short_referral_code");
    score += 5;
  }

  void COMMON_EMAIL_DOMAINS;

  const blocked = score >= 70;
  if (score >= 40 && score < 70) {
    flags.push("requires_admin_review");
  }

  return { blocked, flags, score };
}

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
