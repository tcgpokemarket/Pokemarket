import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createShowEvent, isGiveawayActive } from "@/lib/live-shows";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";

export async function POST(req: Request, { params }: { params: Promise<{ giveawayId: string }> }) {
  const { giveawayId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`giveaway-entry:${giveawayId}:${user.id}`, 6, 60_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "security.alert",
      severity: "medium",
      actor_id: user.id,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
      details: { route: "/api/giveaways/[giveawayId]/entry", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({} as { followSeller?: boolean }));
  const recentEntry = await admin
    .from("giveaway_entries")
    .select("id, created_at")
    .eq("giveaway_id", giveawayId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { created_at: string } | null };
  if (recentEntry.data) {
    return NextResponse.json({ error: "Already entered" }, { status: 409 });
  }
  const { data: giveaway, error: giveawayError } = await (admin as any)
    .from("giveaways")
    .select("*")
    .eq("id", giveawayId)
    .maybeSingle();

  if (giveawayError || !giveaway) {
    return NextResponse.json({ error: "Giveaway not found" }, { status: 404 });
  }

  if (!isGiveawayActive(giveaway as any)) {
    return NextResponse.json({ error: "Giveaway is not active" }, { status: 409 });
  }

  const followerCheck = await (admin as any)
    .from("seller_followers")
    .select("id")
    .eq("seller_id", giveaway.seller_id)
    .eq("follower_id", user.id)
    .maybeSingle();

  const alreadyEntered = await admin
    .from("giveaway_entries")
    .select("id")
    .eq("giveaway_id", giveawayId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (alreadyEntered.data) {
    return NextResponse.json({ error: "Already entered" }, { status: 409 });
  }

  const followingSeller = Boolean(followerCheck.data);
  if (giveaway.follow_required && !followingSeller && !body.followSeller) {
    return NextResponse.json({ error: "Follow this seller to enter.", requiresFollow: true }, { status: 403 });
  }

  if (body.followSeller && !followingSeller) {
    const { error: followError } = await admin.from("seller_followers").insert({ seller_id: giveaway.seller_id, follower_id: user.id } as any);
    if (followError) {
      return NextResponse.json({ error: followError.message }, { status: 500 });
    }
  }

  const entryPayload = {
    giveaway_id: giveawayId,
    show_id: giveaway.show_id,
    seller_id: giveaway.seller_id,
    user_id: user.id,
    entry_status: "eligible",
    eligibility_status: {
      follow_required: Boolean(giveaway.follow_required),
      follow_satisfied: followingSeller || Boolean(body.followSeller),
      location_restrictions: giveaway.location_restrictions ?? [],
      age_restriction: giveaway.age_restriction ?? null,
    },
    following_seller: followingSeller || Boolean(body.followSeller),
    winner_status: "pending",
    qualified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: entryError, data: entry } = await admin.from("giveaway_entries").insert(entryPayload as any).select("*").single();
  if (entryError) {
    return NextResponse.json({ error: entryError.message }, { status: 500 });
  }

  await createShowEvent({
    show_id: giveaway.show_id,
    event_type: "giveaway_entry_created",
    payload: { giveawayId, userId: user.id, followedSeller: Boolean(body.followSeller), followRequired: Boolean(giveaway.follow_required) },
    created_by: user.id,
  });

  await admin.from("giveaway_audit_logs").insert({
    giveaway_id: giveawayId,
    actor_id: user.id,
    action: "entry_created",
    details: { followedSeller: Boolean(body.followSeller), followRequired: Boolean(giveaway.follow_required) },
  } as any);

  return NextResponse.json({ entry, ok: true });
}
