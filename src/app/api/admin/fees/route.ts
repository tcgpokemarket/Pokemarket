import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const { error: deleteSettingsError } = await admin.from("seller_fee_settings").delete().not("id", "is", null);
    if (deleteSettingsError) {
      return NextResponse.json({ error: deleteSettingsError.message }, { status: 500 });
    }

    const { error: settingsError } = await (admin as any).from("seller_fee_settings").insert({
      free_sales_limit: body.settings.free_sales_limit ?? 100,
      standard_marketplace_fee_percent: body.settings.standard_marketplace_fee_percent ?? 5,
      processing_fee_percent: body.settings.processing_fee_percent ?? 2.9,
      processing_fee_fixed: body.settings.processing_fee_fixed ?? 0.3,
      updated_by: user.id,
    });

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
        id: tier.id,
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
    const { error: deleteOverrideError } = await admin.from("seller_fee_overrides").delete().eq("seller_id", body.override?.seller_id ?? "");
    if (deleteOverrideError) {
      return NextResponse.json({ error: deleteOverrideError.message }, { status: 500 });
    }

    if (body.override) {
      const { error: overrideError } = await (admin as any).from("seller_fee_overrides").insert({
        seller_id: body.override.seller_id,
        fee_percent: body.override.fee_percent,
        free_sales_limit: body.override.free_sales_limit,
        reason: body.override.reason ?? null,
      });

      if (overrideError) {
        return NextResponse.json({ error: overrideError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
