import { createAdminClient } from "@/lib/supabase/admin";
import { issueSignupBonus } from "@/lib/rewards";

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

type AdminBootstrapResult = {
  email: string;
  userId: string | null;
  created: boolean;
  recoveryLink: string | null;
};

let adminBootstrapPromise: Promise<AdminBootstrapResult> | null = null;

function getPrimaryAdminEmail() {
  const candidates = [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAILS, "tcgpokemarketadmin@gmail.com"];
  for (const candidate of candidates) {
    const email = candidate
      ?.split(",")
      .map((value) => value.trim().toLowerCase())
      .find(Boolean);
    if (email) return email;
  }
  return "tcgpokemarketadmin@gmail.com";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const pageSize = 100;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await (admin.auth.admin as any).listUsers({ page, perPage: pageSize });
    if (error) throw new Error(error.message);
    const user = (data?.users ?? []).find((entry: { email?: string | null }) => entry.email?.toLowerCase() === email);
    if (user) return user;
    if ((data?.users ?? []).length < pageSize) return null;
  }
  return null;
}

async function createRecoveryLink(admin: ReturnType<typeof createAdminClient>, email: string) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tcg-poke-market.sintra.site").replace(/\/$/, "");
  const { data, error } = await (admin.auth.admin as any).generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${siteUrl}/auth/reset-password?redirectTo=%2Fadmin`,
    },
  });

  if (error) throw new Error(error.message);

  return data?.properties?.action_link ?? data?.properties?.actionLink ?? null;
}

async function bootstrapAdminAccount(): Promise<AdminBootstrapResult> {
  const admin = createAdminClient();
  const email = getPrimaryAdminEmail();
  const password = getAdminPassword();
  const existingUser = await findUserByEmail(admin, email);

  if (!existingUser) {
    if (!password) throw new Error("ADMIN_PASSWORD is not configured.");

    const { data, error } = await (admin.auth.admin as any).createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
      app_metadata: { role: "admin" },
    });

    if (error) throw new Error(error.message);

    const userId = data?.user?.id ?? null;
    if (userId) {
      await bootstrapUserAccount({
        userId,
        email,
        fullName: "Marketplace Admin",
        accountType: "buyer",
        skipRewards: true,
      });
    }

    return { email, userId, created: true, recoveryLink: null };
  }

  const { error } = await (admin.auth.admin as any).updateUserById(existingUser.id, {
    app_metadata: { ...(existingUser.app_metadata ?? {}), role: "admin" },
    user_metadata: { ...(existingUser.user_metadata ?? {}), role: "admin" },
  });

  if (error) throw new Error(error.message);

  await bootstrapUserAccount({
    userId: existingUser.id,
    email,
    fullName: existingUser.user_metadata?.full_name ?? existingUser.user_metadata?.name ?? "Marketplace Admin",
    accountType: "buyer",
    skipRewards: true,
  });

  const recoveryLink = await createRecoveryLink(admin, email).catch(() => null);
  return { email, userId: existingUser.id, created: false, recoveryLink };
}

export async function ensureAdminAccount() {
  if (!adminBootstrapPromise) {
    adminBootstrapPromise = bootstrapAdminAccount().catch((error) => {
      adminBootstrapPromise = null;
      throw error;
    });
  }

  return adminBootstrapPromise;
}

export async function bootstrapUserAccount(input: {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  sellerState?: string | null;
  shippingAddress?: unknown;
  accountType?: "buyer" | "seller" | null;
  skipRewards?: boolean;
}) {
  const admin = createAdminClient();
  const email = normalizeEmail(input.email);
  const fallbackName = input.fullName?.trim() || email?.split("@")[0] || "Marketplace user";
  const usernameBase = fallbackName.replace(/\s+/g, "-");
  const username = buildUsername(usernameBase, input.userId);
  const isSeller = input.accountType === "seller";
  const sellerState = input.sellerState?.trim().toUpperCase() || null;
  const sellerStoreName = fallbackName;
  const sellerStoreSlug = `${username}-store`;
  const sellerStoreTheme = {
    accent: "#e22400",
    secondary: "#ffab01",
    highlight: "#fefb41",
    social_links: {
      instagram: null,
      facebook: null,
      youtube: null,
      tiktok: null,
      x: null,
      website: null,
    },
  };

  const [{ data: existingProfile }, { data: existingStore }, { data: existingWallet }, { data: existingPrivacy }, { data: existingEmails }, { data: existingMessageRules }] = await Promise.all([
    admin.from("profiles").select("id, username").eq("id", input.userId).maybeSingle<{ id: string; username: string | null }>(),
    admin.from("seller_stores").select("id, slug").eq("seller_id", input.userId).maybeSingle<{ id: string; slug: string | null }>(),
    admin.from("seller_wallets").select("seller_id").eq("seller_id", input.userId).maybeSingle<{ seller_id: string }>(),
    admin.from("profile_privacy_settings").select("user_id").eq("user_id", input.userId).maybeSingle<{ user_id: string }>(),
    admin.from("email_preferences").select("notification_type").eq("user_id", input.userId).limit(1),
    admin.from("message_access_rules").select("user_id").eq("user_id", input.userId).maybeSingle<{ user_id: string }>(),
  ]);

  if (!existingProfile) {
    const { error } = await (admin as any).from("profiles").upsert(
      {
        id: input.userId,
        username,
        full_name: input.fullName ?? fallbackName,
        avatar_url: input.avatarUrl ?? null,
        seller_state: sellerState,
        shipping_address: input.shippingAddress ?? null,
        is_seller: isSeller,
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

  const { data: refreshedProfile } = await admin.from("profiles").select("id, username").eq("id", input.userId).maybeSingle<{ id: string; username: string | null }>();
  if (!refreshedProfile) {
    throw new Error("Profile setup failed.");
  }

  if (isSeller) {
    if (!existingStore) {
      const { error } = await (admin as any).from("seller_stores").upsert(
        {
          seller_id: input.userId,
          name: sellerStoreName,
          slug: sellerStoreSlug,
          description: `${sellerStoreName}'s storefront is ready for listings and live shows.`,
          banner_url: null,
          logo_url: input.avatarUrl ?? null,
          theme: sellerStoreTheme,
          verified: false,
          featured: false,
        },
        { onConflict: "seller_id" },
      );

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

  if (!existingMessageRules) {
    const { error } = await (admin as any).from("message_access_rules").upsert(
      {
        user_id: input.userId,
        allow_followers: true,
        allow_friends: true,
        allow_sellers: true,
        allow_buyer_support: true,
        allow_admin_messages: true,
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
  }

  if (!existingEmails?.length) {
    const defaults = ["welcome", "order_confirmation", "shipping_update", "delivery_confirmation", "login_alert"];
    const { error } = await (admin as any).from("email_preferences").upsert(
      defaults.map((notificationType) => ({ user_id: input.userId, notification_type: notificationType, enabled: true })),
      { onConflict: "user_id,notification_type" },
    );

    if (error) throw new Error(error.message);
  }

  if (!input.skipRewards) {
    await issueSignupBonus(input.userId).catch(() => null);
  }

  return { username: refreshedProfile.username ?? username, sellerId: input.userId, storefrontSlug: sellerStoreSlug };
}
