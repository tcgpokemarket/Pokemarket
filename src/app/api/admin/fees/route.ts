import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: settingsRow, error: settingsError }, { data: tiers, error: tiersError }, { data: overrides, error: overridesError }] = await Promise.all([
    supabase.from("seller_fee_settings").select("free_sales_limit, standard_marketplace_fee_percent, processing_fee_percent, processing_fee_fixed").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("seller_fee_tiers").select("id, name, min_monthly_orders, fee_percent, active").order("min_monthly_orders", { ascending: true }),
    supabase.from("seller_fee_overrides").select("seller_id, fee_percent, free_sales_limit, reason"),
  ]);

  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 400 });
  if (tiersError) return NextResponse.json({ error: tiersError.message }, { status: 400 });
  if (overridesError) return NextResponse.json({ error: overridesError.message }, { status: 400 });

  const settings = settingsRow ?? {
    free_sales_limit: 1000,
    standard_marketplace_fee_percent: 5,
    processing_fee_percent: 2.9,
    processing_fee_fixed: 0.3,
  };

  return NextResponse.json({ settings, tiers: tiers ?? [], overrides: overrides ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const settings = body.settings ?? {};
  const tiers = Array.isArray(body.tiers) ? body.tiers : [];
  const override = body.override ?? null;

  const settingsPayload = {
    id: "default",
    free_sales_limit: Number(settings.free_sales_limit ?? 1000),
    standard_marketplace_fee_percent: Number(settings.standard_marketplace_fee_percent ?? 5),
    processing_fee_percent: Number(settings.processing_fee_percent ?? 2.9),
    processing_fee_fixed: Number(settings.processing_fee_fixed ?? 0.3),
    updated_by: user.id,
  } as any;

  const { error: settingsError } = await supabase.from("seller_fee_settings").upsert(settingsPayload, { onConflict: "id" });

  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 400 });

  if (tiers.length) {
    const { error: tierError } = await supabase.from("seller_fee_tiers").upsert(
      tiers.map((tier: { name: string; min_monthly_orders: number; fee_percent: number; active?: boolean }) => ({
        name: String(tier.name),
        min_monthly_orders: Number(tier.min_monthly_orders ?? 0),
        fee_percent: Number(tier.fee_percent ?? 0),
        active: tier.active ?? true,
      })),
      { onConflict: "name,min_monthly_orders" },
    );

    if (tierError) return NextResponse.json({ error: tierError.message }, { status: 400 });
  }

  if (override) {
    const overridePayload = {
      seller_id: String(override.seller_id ?? user.id),
      fee_percent: override.fee_percent === null || override.fee_percent === undefined || override.fee_percent === "" ? null : Number(override.fee_percent),
      free_sales_limit: override.free_sales_limit === null || override.free_sales_limit === undefined || override.free_sales_limit === "" ? null : Number(override.free_sales_limit),
      reason: override.reason ?? null,
    } as any;

    const { error: overrideError } = await supabase.from("seller_fee_overrides").upsert(overridePayload, { onConflict: "seller_id" });

    if (overrideError) return NextResponse.json({ error: overrideError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
