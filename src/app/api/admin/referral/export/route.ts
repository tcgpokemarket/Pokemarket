import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { recordAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// ── GET: export all referrals as CSV ─────────────────────────
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();

  // Fetch all attributions with basic stats
  const { data: attributions, error } = await (adminClient as any)
    .from("referral_attributions")
    .select(
      `
      id,
      referral_code,
      signup_source,
      status,
      program_type,
      total_revenue_generated,
      total_rewards_earned,
      fraud_flag,
      created_at,
      updated_at,
      referrer_user_id,
      referred_user_id
    `,
    )
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }

  // Collect all user IDs
  const userIds = new Set<string>();
  (attributions ?? []).forEach((a: Record<string, unknown>) => {
    userIds.add(a.referrer_user_id as string);
    userIds.add(a.referred_user_id as string);
  });

  const { data: profiles } = await (adminClient as any)
    .from("profiles")
    .select("id, username, full_name")
    .in("id", Array.from(userIds));

  const profileMap = new Map(
    (profiles ?? []).map((p: Record<string, unknown>) => [
      p.id as string,
      `${(p.username as string | undefined | null) ?? ""} (${(p.full_name as string | undefined | null) ?? ""})`.trim(),
    ]),
  );

  // Build CSV
  const headers = [
    "id",
    "referral_code",
    "referrer",
    "referred",
    "signup_source",
    "status",
    "program_type",
    "total_revenue_generated",
    "total_rewards_earned",
    "fraud_flag",
    "created_at",
    "updated_at",
  ];

  const rows = (attributions ?? []).map((a: Record<string, unknown>) =>
    [
      a.id,
      a.referral_code,
      profileMap.get(a.referrer_user_id as string) ?? a.referrer_user_id,
      profileMap.get(a.referred_user_id as string) ?? a.referred_user_id,
      a.signup_source,
      a.status,
      a.program_type,
      a.total_revenue_generated,
      a.total_rewards_earned,
      a.fraud_flag,
      a.created_at,
      a.updated_at,
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");

  recordAuditEvent({
    event_type: "admin.action",
    actor_id: user.id,
    action: "referral_export_csv",
    resource_type: "referral_attributions",
    resource_id: null,
    previous_value: null,
    new_value: { row_count: rows.length },
    ip_address: null,
    user_agent: null,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="referrals-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
