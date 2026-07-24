import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { recordAuditEvent } from "@/lib/audit-log";
import type { ReferralProgramSettings, ReferralProgramSettingsUpdate } from "@/lib/referral-types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ReferralProgramSettings | { error: string }>> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const { data: settings, error } = await (adminClient as any).from("referral_program_settings").select("*").limit(1).single();

  if (error || !settings) {
    return NextResponse.json({ error: "Settings not found" }, { status: 404 });
  }

  return NextResponse.json(settings as ReferralProgramSettings);
}

export async function PUT(request: NextRequest): Promise<NextResponse<ReferralProgramSettings | { error: string }>> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ReferralProgramSettingsUpdate;
  try {
    body = (await request.json()) as ReferralProgramSettingsUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.max_lifetime_commission_share_percent !== undefined && body.max_lifetime_commission_share_percent > 20) {
    return NextResponse.json({ error: "max_lifetime_commission_share_percent cannot exceed 20%." }, { status: 400 });
  }

  if (body.reward_amount !== undefined && body.reward_amount < 0) {
    return NextResponse.json({ error: "reward_amount cannot be negative." }, { status: 400 });
  }

  if (body.required_successful_volume !== undefined && body.required_successful_volume < 0) {
    return NextResponse.json({ error: "required_successful_volume cannot be negative." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: current } = await (adminClient as any).from("referral_program_settings").select("*").limit(1).single();

  const updatePayload: ReferralProgramSettingsUpdate & { updated_at: string } = {
    ...body,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await (adminClient as any)
    .from("referral_program_settings")
    .update(updatePayload)
    .eq("id", current?.id ?? "")
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }

  recordAuditEvent({
    event_type: "admin.action",
    actor_id: user.id,
    action: "referral_settings_update",
    resource_type: "referral_program_settings",
    resource_id: current?.id ?? null,
    previous_value: current,
    new_value: updated,
    ip_address: null,
    user_agent: null,
  });

  return NextResponse.json(updated as ReferralProgramSettings);
}
