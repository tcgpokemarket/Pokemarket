import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReferralLinkResponse } from "@/lib/referral-types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ReferralLinkResponse | { error: string }>> {
  // ── Auth ─────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // ── Fetch profile with referral code ──────────────────────────
  const { data: profile, error: profileError } = await (adminClient as any)
    .from("profiles")
    .select("id, username, full_name, referral_code")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.referral_code) {
    return NextResponse.json({ error: "Referral code not yet generated" }, { status: 404 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tcgpoke.app";
  const link = `${baseUrl}/signup?ref=${encodeURIComponent(profile.referral_code)}`;

  return NextResponse.json({
    code: profile.referral_code,
    link,
    profile: {
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
    },
  });
}
