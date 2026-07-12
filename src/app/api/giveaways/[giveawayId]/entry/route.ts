import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ giveawayId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { giveawayId } = await params;
  const body = await request.json().catch(() => ({}));
  const followSeller = Boolean(body.followSeller);

  const { data: giveaway, error: giveawayError } = await supabase.from("giveaways").select("id, show_id, seller_id, follow_required, status").eq("id", giveawayId).maybeSingle<{ id: string; show_id: string; seller_id: string | null; follow_required: boolean; status: string }>();

  if (giveawayError) return NextResponse.json({ error: giveawayError.message }, { status: 400 });
  if (!giveaway) return NextResponse.json({ error: "Giveaway not found." }, { status: 404 });

  if (giveaway.follow_required && !followSeller) {
    return NextResponse.json({ error: "Follow this seller to enter.", requiresFollow: true }, { status: 403 });
  }

  const { data: existingEntry } = await supabase.from("giveaway_entries").select("id, entry_status").eq("giveaway_id", giveawayId).eq("user_id", user.id).maybeSingle();
  if (existingEntry) {
    return NextResponse.json({ ok: true, entered: true });
  }

  if (followSeller && giveaway.seller_id) {
    const followActionPayload = { giveaway_id: giveawayId, seller_id: giveaway.seller_id, user_id: user.id, followed_at: new Date().toISOString() } as any;
    await supabase.from("giveaway_follow_actions").upsert(followActionPayload, { onConflict: "giveaway_id,seller_id,user_id" });
  }

  const entryPayload = {
    giveaway_id: giveawayId,
    show_id: giveaway.show_id,
    seller_id: giveaway.seller_id ?? user.id,
    user_id: user.id,
    entry_status: "entered",
    following_seller: followSeller,
    winner_status: "pending",
    qualified_at: new Date().toISOString(),
    eligibility_status: { follow_required: giveaway.follow_required, follow_confirmed: followSeller },
  } as any;

  const { error } = await supabase.from("giveaway_entries").insert(entryPayload);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, entered: true });
}
