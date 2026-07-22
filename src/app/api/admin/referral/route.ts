import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { recordAuditEvent } from "@/lib/audit-log";
import type {
  AdminReferralAnalytics,
  AdminRewardActionRequest,
} from "@/lib/referral-types";

export const dynamic = "force-dynamic";

// ── GET: Admin analytics ──────────────────────────────────────
export async function GET(): Promise<NextResponse<AdminReferralAnalytics | { error: string }>> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();

  // Aggregate stats from the view
  const { data: allStats } = await (adminClient as any)
    .from("referral_dashboard_stats")
    .select("*");

  const initialTotals = {
      total_referrals: 0,
      qualified_referrals: 0,
      pending_rewards: 0,
      paid_rewards: 0,
      fraud_flags_open: 0,
    };
  const totals = (allStats ?? []).reduce(
    (acc: typeof initialTotals, row: Record<string, unknown>) => ({
      total_referrals: acc.total_referrals + Number(row.total_referrals ?? 0),
      qualified_referrals:
        acc.qualified_referrals + Number(row.qualified_referrals ?? 0),
      pending_rewards:
        acc.pending_rewards + Number(row.pending_rewards ?? 0),
      paid_rewards: acc.paid_rewards + Number(row.paid_rewards ?? 0),
      fraud_flags_open: acc.fraud_flags_open,
    }),
    initialTotals,
  );

  // Count open fraud flags
  const { count: fraudCount } = await (adminClient as any)
    .from("referral_fraud_flags")
    .select("id", { count: "exact", head: true })
    .eq("reviewed", false);

  totals.fraud_flags_open = fraudCount ?? 0;

  // Top referrers (join stats with profile)
  const { data: topReferrerStats } = await (adminClient as any)
    .from("referral_dashboard_stats")
    .select("*")
    .order("lifetime_earnings", { ascending: false })
    .limit(20);

  const referrerIds = (topReferrerStats ?? []).map((r: Record<string, unknown>) => r.referrer_id as string);
  let topReferrers: AdminReferralAnalytics["top_referrers"] = [];

  if (referrerIds.length > 0) {
    const { data: referrerProfiles } = await (adminClient as any)
      .from("profiles")
      .select("id, username, full_name")
      .in("id", referrerIds);

    const profileMap = new Map(
      (referrerProfiles ?? []).map((p: Record<string, unknown>) => [p.id, p]),
    );

    topReferrers = (topReferrerStats ?? []).map((row: Record<string, unknown>) => {
      const profile = profileMap.get(row.referrer_id as string);
      return {
        referrer_id: row.referrer_id as string,
        username: (profile as any)?.username ?? null,
        full_name: (profile as any)?.full_name ?? null,
        total_referrals: Number(row.total_referrals ?? 0),
        qualified_referrals: Number(row.qualified_referrals ?? 0),
        lifetime_earnings: Number(row.lifetime_earnings ?? 0),
        pending_rewards: Number(row.pending_rewards ?? 0),
      };
    });
  }

  // Pending rewards with participant details
  const { data: pendingRewards } = await (adminClient as any)
    .from("referral_rewards")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  const participantIds = new Set<string>();
  (pendingRewards ?? []).forEach((r: Record<string, unknown>) => {
    participantIds.add(r.referrer_id as string);
    participantIds.add(r.referred_id as string);
  });

  let pendingRewardRows: AdminReferralAnalytics["pending_rewards"] = [];

  if (participantIds.size > 0) {
    const { data: participants } = await (adminClient as any)
      .from("profiles")
      .select("id, username, full_name")
      .in("id", Array.from(participantIds));

    const participantMap = new Map(
      (participants ?? []).map((p: Record<string, unknown>) => [p.id, p]),
    );

    pendingRewardRows = (pendingRewards ?? []).map((r: Record<string, unknown>) => {
      const referrer = participantMap.get(r.referrer_id as string);
      const referred = participantMap.get(r.referred_id as string);
      return {
        ...(r as Parameters<typeof Object.assign>[1]),
        referrer_username: (referrer as any)?.username ?? null,
        referrer_full_name: (referrer as any)?.full_name ?? null,
        referred_username: (referred as any)?.username ?? null,
        referred_full_name: (referred as any)?.full_name ?? null,
      };
    }) as AdminReferralAnalytics["pending_rewards"];
  }

  // Open fraud flags
  const { data: fraudFlags } = await (adminClient as any)
    .from("referral_fraud_flags")
    .select("*")
    .eq("reviewed", false)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    totals,
    top_referrers: topReferrers,
    pending_rewards: pendingRewardRows,
    fraud_flags: (fraudFlags ?? []) as AdminReferralAnalytics["fraud_flags"],
  });
}

// ── PATCH: Approve / deny / revoke a reward ───────────────────
export async function PATCH(
  request: NextRequest,
): Promise<NextResponse<{ ok: boolean } | { error: string }>> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: AdminRewardActionRequest;
  try {
    body = await request.json() as AdminRewardActionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { action, reward_id, reason } = body;

  if (!reward_id || !["approve", "deny", "revoke"].includes(action)) {
    return NextResponse.json(
      { error: "reward_id and a valid action are required" },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();

  // Fetch current reward
  const { data: reward, error: fetchError } = await (adminClient as any)
    .from("referral_rewards")
    .select("*")
    .eq("id", reward_id)
    .single();

  if (fetchError || !reward) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  let updatePayload: Record<string, unknown> = { updated_at: now };

  switch (action) {
    case "approve":
      if (reward.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending rewards can be approved" },
          { status: 400 },
        );
      }
      updatePayload = { ...updatePayload, status: "approved", approved_at: now };
      break;

    case "deny":
      if (!["pending", "approved"].includes(reward.status as string)) {
        return NextResponse.json(
          { error: "Only pending or approved rewards can be denied" },
          { status: 400 },
        );
      }
      updatePayload = {
        ...updatePayload,
        status: "denied",
        denied_at: now,
        denial_reason: reason ?? "Denied by admin",
      };
      break;

    case "revoke":
      if (["paid", "revoked", "expired"].includes(reward.status as string)) {
        return NextResponse.json(
          { error: "Reward cannot be revoked in its current state" },
          { status: 400 },
        );
      }
      updatePayload = {
        ...updatePayload,
        status: "revoked",
        denial_reason: reason ?? "Revoked by admin",
      };
      break;
  }

  const { error: updateError } = await (adminClient as any)
    .from("referral_rewards")
    .update(updatePayload)
    .eq("id", reward_id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update reward" },
      { status: 500 },
    );
  }

  // Notify referrer
  const notificationType =
    action === "approve"
      ? "referral_reward_approved"
      : action === "deny"
        ? "referral_reward_denied"
        : "referral_reward_denied";

  await (adminClient as any).from("notifications").insert({
    user_id: reward.referrer_id,
    type: notificationType,
    related_user: null,
    related_content: {
      reward_id,
      action,
      reward_amount: reward.reward_amount,
      reason: reason ?? null,
    },
    read_status: false,
  });

  recordAuditEvent({
    event_type: "admin.action",
    actor_id: user.id,
    action: `referral_reward_${action}`,
    resource_type: "referral_reward",
    resource_id: reward_id,
    previous_value: { status: reward.status },
    new_value: { status: updatePayload.status, reason },
    ip_address: null,
    user_agent: null,
  });

  return NextResponse.json({ ok: true });
}
