import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fullName = String(body.fullName ?? "").trim();
  const username = String(body.username ?? "").trim();
  const accountType = String(body.accountType ?? "").trim();
  const sellerState = String(body.sellerState ?? "").trim().toUpperCase() || null;
  const referralCode = String(body.referralCode ?? "").trim().toUpperCase();
  const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : null;
  const email = user.email?.toLowerCase() ?? "";

  if (!fullName || !username || !accountType) {
    return NextResponse.json({ error: "Missing signup details." }, { status: 400 });
  }

  const admin = createAdminClient();
  const fallbackName = fullName || email.split("@")[0] || "Marketplace user";
  const userId = user.id;

  const [{ data: existingProfile }, { data: existingSeller }, { data: existingWallet }, { data: existingPrivacy }, { data: existingEmails }] = await Promise.all([
    admin.from("profiles").select("id, username").eq("id", userId).maybeSingle<{ id: string; username: string | null }>(),
    admin.from("sellers").select("id").eq("id", userId).maybeSingle<{ id: string }>(),
    admin.from("seller_wallets").select("seller_id").eq("seller_id", userId).maybeSingle<{ seller_id: string }>(),
    admin.from("profile_privacy_settings").select("user_id").eq("user_id", userId).maybeSingle<{ user_id: string }>(),
    admin.from("email_preferences").select("notification_type").eq("user_id", userId).limit(1),
  ]);

  if (!existingSeller) {
    const { error } = await (admin as any).from("sellers").upsert(
      {
        id: userId,
        display_name: fallbackName,
        storefront_slug: username,
        bio: null,
        avatar_url: avatarUrl,
        banner_url: null,
        verified: false,
        rating: 0,
        follower_count: 0,
        sales_count: 0,
        total_revenue: 0,
        total_listings: 0,
        total_live_shows: 0,
      },
      { onConflict: "id" },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!existingProfile) {
    const { error } = await (admin as any).from("profiles").upsert(
      {
        id: userId,
        username,
        full_name: fullName || fallbackName,
        avatar_url: avatarUrl,
        seller_state: sellerState,
        is_seller: accountType === "seller",
        seller_rating: 0,
        total_sales: 0,
        referral_code: referralCode || null,
        referral_code_created_at: referralCode ? new Date().toISOString() : null,
      },
      { onConflict: "id" },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { error } = await (admin as any).from("profiles").update({
      username,
      full_name: fullName || fallbackName,
      avatar_url: avatarUrl,
      seller_state: sellerState,
      is_seller: accountType === "seller",
      referral_code: referralCode || null,
      referral_code_created_at: referralCode ? new Date().toISOString() : null,
    }).eq("id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!existingWallet) {
    const { error } = await (admin as any).from("seller_wallets").upsert(
      {
        seller_id: userId,
        available_balance: 0,
        pending_balance: 0,
        frozen_balance: 0,
        lifetime_earnings: 0,
        completed_orders_count: 0,
        instant_payout_enabled: false,
        fraud_flag: false,
        fraud_risk_score: 0,
        manual_review_required: false,
      },
      { onConflict: "seller_id" },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!existingPrivacy) {
    const { error } = await (admin as any).from("profile_privacy_settings").upsert(
      {
        user_id: userId,
        who_can_follow: "everyone",
        who_can_friend_request: "everyone",
        profile_visibility: "public",
        collection_visibility: "public",
        activity_visibility: "public",
        message_visibility: "everyone",
      },
      { onConflict: "user_id" },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!existingEmails?.length) {
    const defaults = ["order_confirmation", "shipping_update", "delivery_confirmation", "login_alert"];
    const { error } = await (admin as any).from("email_preferences").upsert(
      defaults.map((notificationType) => ({ user_id: userId, notification_type: notificationType, enabled: true })),
      { onConflict: "user_id,notification_type" },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (referralCode) {
    const { data: referrer } = await admin.from("profiles").select("id").eq("referral_code", referralCode).maybeSingle<{ id: string }>();
    if (referrer?.id) {
      const { error } = await (admin as any).from("profiles").update({
        referral_source_user_id: referrer.id,
        referral_source: "referral code",
        referral_source_code: referralCode,
        referral_source_confirmed_at: new Date().toISOString(),
        referral_locked_at: new Date().toISOString(),
      }).eq("id", userId).is("referral_source_user_id", null);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true, accountType }, { status: 200 });
}
