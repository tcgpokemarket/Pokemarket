import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";
import { detectReferralFraud, logFraudFlag } from "@/lib/referral-fraud";
import type { ApplyReferralRequest, ApplyReferralResponse } from "@/lib/referral-types";

export const dynamic = "force-dynamic";

const REFERRAL_APPLY_WINDOW_DAYS = 30;

export async function POST(request: NextRequest): Promise<NextResponse<ApplyReferralResponse | { error: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateKey = `referral:apply:${user.id}`;
  const rate = checkRateLimit(rateKey, 5, 60 * 60 * 1000);
  if (!rate.allowed) {
    recordSecurityEvent({
      event_type: "referral.apply.rate_limited",
      severity: "medium",
      actor_id: user.id,
      details: { reset_at: rate.resetAt },
    });
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  let body: ApplyReferralRequest;
  try {
    body = (await request.json()) as ApplyReferralRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Referral code is required" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: currentProfile, error: profileError } = await (adminClient as any)
    .from("profiles")
    .select("id, created_at, referral_source_user_id, referral_code, identity_verified_at, referral_source_confirmed_at")
    .eq("id", user.id)
    .single();

  if (profileError || !currentProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const signupDate = new Date(currentProfile.created_at);
  const daysSinceSignup = (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceSignup > REFERRAL_APPLY_WINDOW_DAYS) {
    return NextResponse.json({ error: `Referral codes must be applied within ${REFERRAL_APPLY_WINDOW_DAYS} days of signup.` }, { status: 400 });
  }

  if (currentProfile.referral_source_user_id) {
    return NextResponse.json({ error: "You have already been referred by someone." }, { status: 409 });
  }

  const { data: existingAttribution } = await (adminClient as any)
    .from("referral_attributions")
    .select("id")
    .eq("referred_user_id", user.id)
    .limit(1);
  if (existingAttribution && existingAttribution.length > 0) {
    return NextResponse.json({ error: "A referral has already been applied to your account." }, { status: 409 });
  }

  const { data: referrerProfile, error: referrerError } = await (adminClient as any)
    .from("profiles")
    .select("id, username, full_name, referral_code")
    .eq("referral_code", code)
    .single();
  if (referrerError || !referrerProfile) {
    return NextResponse.json({ error: "Invalid referral code." }, { status: 404 });
  }

  if (referrerProfile.id === user.id) {
    return NextResponse.json({ error: "You cannot use your own referral code." }, { status: 400 });
  }

  const fraudResult = await detectReferralFraud(adminClient, referrerProfile.id, user.id, code);
  if (fraudResult.blocked) {
    recordSecurityEvent({
      event_type: "referral.apply.fraud_blocked",
      severity: "high",
      actor_id: user.id,
      details: { referrer_id: referrerProfile.id, code, flags: fraudResult.flags, score: fraudResult.score },
    });

    await logFraudFlag(adminClient, {
      flaggedUserId: user.id,
      referrerId: referrerProfile.id,
      attributionId: null,
      flagType: fraudResult.flags[0] ?? "fraud_detected",
      details: { flags: fraudResult.flags, score: fraudResult.score, severity: fraudResult.score >= 90 ? "critical" : "high" },
    });

    return NextResponse.json({ error: "This referral code cannot be applied to your account." }, { status: 400 });
  }

  const insertPayload = {
    referred_user_id: user.id,
    referrer_user_id: referrerProfile.id,
    referral_code: code,
    signup_source: currentProfile.referral_source_confirmed_at ? "referral code" : "manual_code_entry",
    program_type: "buyer",
    fee_basis: 0,
    reward_rate: 0,
    reward_amount: 0,
    company_kept_amount: 0,
    hold_until: null,
    status: "pending",
    fraud_flag: fraudResult.score >= 40,
    fraud_reason: fraudResult.score >= 40 ? fraudResult.flags.join(", ") : null,
    metadata: {
      source: "api_apply",
      fraud_score: fraudResult.score,
      fraud_flags: fraudResult.flags,
      blocked: fraudResult.blocked,
      eligible_after: "first_verified_successful_order",
      reward_amount: 5,
      required_successful_volume: 200,
      commission_cap_percent: 20,
    },
  };

  const { data: attribution, error: insertError } = await (adminClient as any)
    .from("referral_attributions")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError || !attribution) {
    recordSecurityEvent({
      event_type: "referral.apply.insert_failed",
      severity: "medium",
      actor_id: user.id,
      details: { error: insertError?.message },
    });
    return NextResponse.json({ error: "Failed to apply referral code. Please try again." }, { status: 500 });
  }

  if (fraudResult.score >= 40 && !fraudResult.blocked) {
    await logFraudFlag(adminClient, {
      flaggedUserId: user.id,
      referrerId: referrerProfile.id,
      attributionId: attribution.id,
      flagType: "admin_review_required",
      details: { flags: fraudResult.flags, score: fraudResult.score },
    });
  }

  await (adminClient as any)
    .from("profiles")
    .update({
      referral_source_user_id: referrerProfile.id,
      referral_source: "referral code",
      referral_source_code: code,
      referral_source_confirmed_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .is("referral_source_user_id", null);

  await (adminClient as any).from("notifications").insert({
    user_id: referrerProfile.id,
    type: "referral_signup",
    related_user: user.id,
    related_content: {
      referred_user_id: user.id,
      attribution_id: attribution.id,
      code,
    },
    read_status: false,
  });

  return NextResponse.json({
    ok: true,
    referrer_username: referrerProfile.username ?? referrerProfile.full_name ?? "Unknown",
  });
}
