import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const [settingsResult, tiersResult, overridesResult] = await Promise.all([
    admin.from("seller_fee_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("seller_fee_tiers").select("*").order("min_monthly_orders", { ascending: true }),
    admin.from("seller_fee_overrides").select("*").order("updated_at", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    settings: settingsResult.data,
    tiers: tiersResult.data ?? [],
    overrides: overridesResult.data ?? [],
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`admin-fees:${user.id}`, 10, 60_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "security.alert",
      severity: "medium",
      actor_id: user.id,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
      details: { route: "/api/admin/fees", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    settings?: {
      free_sales_limit?: number;
      standard_marketplace_fee_percent?: number;
      processing_fee_percent?: number;
      processing_fee_fixed?: number;
    };
    tiers?: Array<{
      id?: string;
      name: string;
      min_monthly_orders: number;
      fee_percent: number;
      active?: boolean;
    }>;
    override?: {
      seller_id: string;
      fee_percent: number | null;
      free_sales_limit: number | null;
      reason?: string | null;
    } | null;
  };

  const admin = createAdminClient();

  if (body.settings) {
    const existingSettings = (await admin.from("seller_fee_settings").select("id").order("updated_at", { ascending: false }).limit(1).maybeSingle()) as { data: { id: string } | null; error: { message: string } | null };
    if (existingSettings.error) {
      return NextResponse.json({ error: existingSettings.error.message }, { status: 500 });
    }

    const payload = {
      free_sales_limit: body.settings.free_sales_limit ?? 100,
      standard_marketplace_fee_percent: body.settings.standard_marketplace_fee_percent ?? 5,
      processing_fee_percent: body.settings.processing_fee_percent ?? 2.9,
      processing_fee_fixed: body.settings.processing_fee_fixed ?? 0.3,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const settingsError = existingSettings.data
      ? (await (admin as any).from("seller_fee_settings").update(payload).eq("id", existingSettings.data.id)).error
      : (await (admin as any).from("seller_fee_settings").insert(payload)).error;

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }
  }

  if (body.tiers?.length) {
    const { error: deleteError } = await admin.from("seller_fee_tiers").delete().not("id", "is", null);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const { error: tiersError } = await (admin as any).from("seller_fee_tiers").insert(
      body.tiers.map((tier) => ({
        name: tier.name,
        min_monthly_orders: tier.min_monthly_orders,
        fee_percent: tier.fee_percent,
        active: tier.active ?? true,
      })),
    );

    if (tiersError) {
      return NextResponse.json({ error: tiersError.message }, { status: 500 });
    }
  }

  if (body.override !== undefined) {
    if (body.override) {
      const { error: overrideError } = await (admin as any).from("seller_fee_overrides").upsert({
        seller_id: body.override.seller_id,
        fee_percent: body.override.fee_percent,
        free_sales_limit: body.override.free_sales_limit,
        reason: body.override.reason ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "seller_id" });

      if (overrideError) {
        return NextResponse.json({ error: overrideError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
