import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { awardReward } from "@/lib/rewards";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { optionId?: string } | null;
  if (!body?.optionId) {
    return NextResponse.json({ error: "Missing redemption option" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: option } = await admin
    .from("rewards_redemption_options")
    .select("*")
    .eq("id", body.optionId)
    .eq("active", true)
    .maybeSingle<{
      id: string;
      option_key: string;
      display_name: string;
      redemption_type: string;
      points_cost: number;
      credit_amount: number | null;
    }>();

  if (!option) {
    return NextResponse.json({ error: "Redemption option not found" }, { status: 404 });
  }

  const accountResult = await admin.from("rewards_accounts").select("*").eq("user_id", user.id).maybeSingle();
  const account = accountResult.data as { available_points: number } | null;
  const availablePoints = Number(account?.available_points ?? 0);
  const pointsCost = Number((option as { points_cost?: number }).points_cost ?? 0);

  if (availablePoints < pointsCost) {
    return NextResponse.json({ error: "Not enough points" }, { status: 409 });
  }

  const redemptionPayload = {
    user_id: user.id,
    option_id: option.id,
    points_spent: pointsCost,
    status: "approved",
    fulfillment_reference: null,
    fulfillment_payload: {
      redemption_type: (option as { redemption_type?: string }).redemption_type,
      option_key: (option as { option_key?: string }).option_key,
      display_name: (option as { display_name?: string }).display_name,
    },
  };

  const { data: redemption, error: redemptionError } = await admin.from("rewards_redemptions").insert(redemptionPayload as any).select("*").single<{ id: string }>();
  if (redemptionError) {
    return NextResponse.json({ error: redemptionError.message }, { status: 500 });
  }

  await awardReward({
    userId: user.id,
    points: -pointsCost,
    entryType: "redemption",
    metadata: {
      redemptionId: redemption.id,
      redemptionType: (option as { redemption_type?: string }).redemption_type,
      optionKey: (option as { option_key?: string }).option_key,
      displayName: (option as { display_name?: string }).display_name,
    },
  });

  if ((option as { redemption_type?: string }).redemption_type === "wallet_credit") {
    const currentBalance = Number(account?.available_points ?? 0);
    await admin.from("seller_wallets").upsert({ seller_id: user.id, available_balance: currentBalance, pending_balance: 0, frozen_balance: 0, lifetime_earnings: currentBalance, completed_orders_count: 0, instant_payout_enabled: false, fraud_flag: false, fraud_risk_score: 0, manual_review_required: false } as any, { onConflict: "seller_id" });
  }

  if (isAdminUser(user) && (option as { redemption_type?: string }).redemption_type !== "wallet_credit") {
    await (admin.from("rewards_redemptions") as any).update({ status: "fulfilled", fulfilled_at: new Date().toISOString(), fulfillment_reference: `admin:${user.id}` }).eq("id", redemption.id);
  }

  return NextResponse.json({ ok: true, redemption });
}
