import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("show_events")
    .select("id, show_id, event_type, payload, created_by, created_at")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: moderationHistory } = await (admin as any)
    .from("live_show_moderation_history")
    .select("id, show_id, event_type, action_type, reason, details, created_at")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []).map((event: any) => ({
    ...event,
    event_type: String(event.event_type ?? event.eventType ?? "event"),
  }));

  const moderationEvents = (moderationHistory ?? []).map((event: any) => ({
    id: event.id,
    show_id: event.show_id,
    event_type: String(event.event_type ?? event.action_type ?? "moderation"),
    payload: {
      action_type: event.action_type,
      reason: event.reason,
      details: event.details,
    },
    created_by: null,
    created_at: event.created_at,
  }));

  return NextResponse.json({ events: [...moderationEvents, ...events] });
}

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const body = await request.json().catch(() => ({}));
  const eventType = String(body.eventType ?? "").trim();

  if (!eventType) {
    return NextResponse.json({ error: "Event type is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: show, error: showError } = await (admin as any)
    .from("live_shows")
    .select("id, seller_id, status, auction_state, host_permissions")
    .eq("id", showId)
    .maybeSingle();

  if (showError) {
    return NextResponse.json({ error: showError.message }, { status: 400 });
  }
  if (!show) {
    return NextResponse.json({ error: "Show not found." }, { status: 404 });
  }

  const permissions = Array.isArray(show.host_permissions) ? show.host_permissions : [];
  const isHostAction = eventType.startsWith("host_");
  const canHost = show.seller_id === user.id || permissions.includes("host");
  if (isHostAction && !canHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = body.payload ?? null;
  const now = new Date().toISOString();

  if (eventType === "host_start_auction") {
    await (admin as any).from("live_shows").update({ status: "live", auction_state: "live", updated_at: now }).eq("id", showId);
  }

  if (eventType === "host_pause_auction") {
    await (admin as any).from("live_shows").update({ auction_state: "locked", updated_at: now }).eq("id", showId);
  }

  if (eventType === "host_resume_auction") {
    await (admin as any).from("live_shows").update({ status: "live", auction_state: "bidding_active", updated_at: now }).eq("id", showId);
  }

  if (eventType === "host_end_auction") {
    await (admin as any).from("live_shows").update({ status: "ended", auction_state: "sold", updated_at: now }).eq("id", showId);
  }

  if (eventType === "host_next_item" && payload && typeof payload === "object") {
    const itemId = typeof (payload as { itemId?: unknown }).itemId === "string" ? (payload as { itemId: string }).itemId : null;
    if (itemId) {
      await (admin as any).from("show_products").update({ pinned: false, updated_at: now }).eq("show_id", showId);
      await (admin as any).from("show_products").update({ pinned: true, updated_at: now }).eq("id", itemId).eq("show_id", showId);
    }
  }

  if (eventType === "host_confirm_winner" && payload && typeof payload === "object") {
    const itemId = typeof (payload as { itemId?: unknown }).itemId === "string" ? (payload as { itemId: string }).itemId : null;
    if (itemId) {
      const { data: item } = await (admin as any)
        .from("show_products")
        .select("id, current_bid, winner_id, listing_id, sold")
        .eq("id", itemId)
        .eq("show_id", showId)
        .maybeSingle();

      if (item) {
        const winnerId = item.winner_id ?? show.seller_id;
        const paymentDeadline = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const { data: existingOrder } = await (admin as any)
          .from("auction_orders")
          .select("id")
          .eq("auction_id", showId)
          .eq("product_id", item.id)
          .maybeSingle();

        if (!existingOrder) {
          await (admin as any).from("auction_orders").insert({
            auction_id: showId,
            product_id: item.id,
            buyer_id: winnerId,
            seller_id: show.seller_id,
            item_id: item.listing_id ?? null,
            winning_bid: Number(item.current_bid ?? 0),
            payment_status: "payment_pending",
            payment_deadline: paymentDeadline,
          });
        }

        await (admin as any).from("show_products").update({ sold: true, winner_id: winnerId, updated_at: now }).eq("id", item.id);
      }
    }
  }

  if (eventType === "host_request_payment" && payload && typeof payload === "object") {
    const orderId = typeof (payload as { orderId?: unknown }).orderId === "string" ? (payload as { orderId: string }).orderId : null;
    if (orderId) {
      await (admin as any).from("auction_orders").update({ payment_status: "payment_pending", payment_deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(), updated_at: now }).eq("id", orderId);
    }
  }

  const { error } = await (admin as any).from("show_events").insert({
    show_id: showId,
    event_type: eventType,
    payload,
    created_by: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
