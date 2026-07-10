import { createAdminClient } from "@/lib/supabase/admin";

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? null;
}

function buildUsername(base: string, fallbackId: string) {
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || `user-${fallbackId.slice(0, 8)}`;
}

export async function bootstrapUserAccount(input: {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
}) {
  const admin = createAdminClient();
  const email = normalizeEmail(input.email);
  const fallbackName = input.fullName?.trim() || email?.split("@")[0] || "Marketplace user";
  const usernameBase = fallbackName.replace(/\s+/g, "-");

  const [{ data: existingProfile }, { data: existingWallet }, { data: existingPrivacy }, { data: existingEmails }] = await Promise.all([
    admin.from("profiles").select("id, username").eq("id", input.userId).maybeSingle<{ id: string; username: string | null }>(),
    admin.from("seller_wallets").select("seller_id").eq("seller_id", input.userId).maybeSingle<{ seller_id: string }>(),
    admin.from("profile_privacy_settings").select("user_id").eq("user_id", input.userId).maybeSingle<{ user_id: string }>(),
    admin.from("email_preferences").select("notification_type").eq("user_id", input.userId).limit(1),
  ]);

  const username = existingProfile?.username ?? buildUsername(usernameBase, input.userId);

  if (!existingProfile) {
    const { error } = await (admin as any).from("profiles").upsert(
      {
        id: input.userId,
        username,
        full_name: input.fullName ?? fallbackName,
        avatar_url: input.avatarUrl ?? null,
        is_seller: false,
        seller_rating: 0,
        total_sales: 0,
      },
      { onConflict: "id" },
    );

    if (error) throw new Error(error.message);
  } else if (!existingProfile.username) {
    const { error } = await (admin as any).from("profiles").update({ username }).eq("id", input.userId);
    if (error) throw new Error(error.message);
  }

  if (!existingWallet) {
    const { error } = await (admin as any).from("seller_wallets").upsert(
      {
        seller_id: input.userId,
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

    if (error) throw new Error(error.message);
  }

  if (!existingPrivacy) {
    const { error } = await (admin as any).from("profile_privacy_settings").upsert(
      {
        user_id: input.userId,
        who_can_follow: "everyone",
        who_can_friend_request: "everyone",
        profile_visibility: "public",
        collection_visibility: "public",
        activity_visibility: "public",
        message_visibility: "everyone",
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
  }

  if (!existingEmails?.length) {
    const defaults = ["order_confirmation", "shipping_update", "delivery_confirmation", "login_alert"];
    const { error } = await (admin as any).from("email_preferences").upsert(
      defaults.map((notificationType) => ({ user_id: input.userId, notification_type: notificationType, enabled: true })),
      { onConflict: "user_id,notification_type" },
    );

    if (error) throw new Error(error.message);
  }

  return { username };
}
