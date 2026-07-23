import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyAntiSnipingExtension, isAuctionBidAllowed, normalizeAuctionSettings } from "@/lib/live-shows";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const limit = checkRateLimit(`live-bid:${showId}:${user.id}`, 20, 10_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "security.alert",
      severity: "medium",
      actor_id: user.id,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: request.headers.get("user-agent"),
      details: { route: "/api/live/shows/[showId]/bids", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Too many bids too quickly." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = String(body.productId ?? "").trim();
  const maxBid = Number(body.maxBid ?? 0) || 0;
  const bidNonce = typeof body.nonce === "string" ? body.nonce.trim() : "";

  if (!productId) {
    return NextResponse.json({ error: "Product is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: show, error: showError } = await (admin as any).from("live_shows").select("id, seller_id, status, auction_state, auction_settings").eq("id", showId).maybeSingle();
  if (showError) return NextResponse.json({ error: showError.message }, { status: 400 });
  if (!show) return NextResponse.json({ error: "Show not found." }, { status: 404 });

  const { data: product, error: lookupError } = await (admin as any)
    .from("show_products")
    .select("id, current_bid, bid_count, seller_id, show_id, sold, passed, auction_seconds, seconds_left, winner_id, buy_now_price")
    .eq("id", productId)
    .maybeSingle();

  const moderationState = await (admin as any)
    .from("live_show_moderation_actions")
    .select("action_type, active")
    .eq("show_id", showId)
    .eq("target_user_id", user.id)
    .eq("active", true);

  if (moderationState.error) return NextResponse.json({ error: moderationState.error.message }, { status: 400 });
  const activeActions = Array.isArray(moderationState.data) ? moderationState.data.map((row: any) => String(row.action_type)) : [];
  if (activeActions.includes("ban_user") || activeActions.includes("remove_bidder")) {
    return NextResponse.json({ error: "You are currently restricted from bidding in this show." }, { status: 403 });
  }

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!product || product.show_id !== showId) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const allowed = isAuctionBidAllowed({
    showStatus: show.status,
    productSold: product.sold,
    productPassed: product.passed,
    sellerId: show.seller_id,
    bidderId: user.id,
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.reason ?? "Bid not allowed." }, { status: 400 });
  }

  if (product.seller_id === user.id) {
    return NextResponse.json({ error: "You cannot bid on your own auction." }, { status: 400 });
  }

  const auctionSettings = normalizeAuctionSettings(show.auction_settings);
  const minIncrement = Math.max(1, Number(auctionSettings.min_increment ?? 1));
  const nextAmount = maxBid > 0 ? maxBid : Number(product.current_bid ?? 0) + minIncrement;
  const minimumAllowed = Number(product.current_bid ?? 0) + minIncrement;

  if (nextAmount < minimumAllowed) {
    return NextResponse.json({ error: `Minimum bid increment is $${minIncrement.toFixed(2)}.` }, { status: 400 });
  }

  const { data: existingBid } = await (admin as any)
    .from("live_bids")
    .select("id, created_at")
    .eq("show_id", showId)
    .eq("product_id", productId)
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingBid && bidNonce && !bidNonce) {
    return NextResponse.json({ error: "Duplicate bid." }, { status: 400 });
  }

  const extensionSeconds = Number(auctionSettings.anti_snipe_seconds ?? 0);
  const nextSecondsLeft = applyAntiSnipingExtension(Number(product.seconds_left ?? 0), extensionSeconds);
  const now = new Date().toISOString();

  const { data: bidderProfile } = await (admin as any).from("profiles").select("username, full_name").eq("id", user.id).maybeSingle();
  const bidderUsername = bidderProfile?.username ?? bidderProfile?.full_name ?? user.user_metadata?.username ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null;

  const bidPayload = {
    show_id: showId,
    product_id: productId,
    bidder_id: user.id,
    amount: nextAmount,
    is_auto_bid: false,
    username: bidderUsername,
  } as const;

  const { error: insertError } = await (admin as any).from("live_bids").insert(bidPayload);
  await (admin as any).from("live_show_moderation_history").insert({
    show_id: showId,
    action_type: "bid_placed",
    event_type: "bid_placed",
    actor_id: user.id,
    target_user_id: user.id,
    target_username: bidderUsername,
    reason: null,
    details: { productId, amount: nextAmount, secondsLeft: nextSecondsLeft, nonce: bidNonce || null },
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const { error: updateError } = await (admin as any)
    .from("show_products")
    .update({
      current_bid: nextAmount,
      bid_count: Number(product.bid_count ?? 0) + 1,
      seconds_left: nextSecondsLeft,
      updated_at: now,
    })
    .eq("id", productId)
    .eq("show_id", showId)
    .eq("sold", false)
    .eq("passed", false);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await (admin as any).from("show_events").insert({
    show_id: showId,
    event_type: "bid_placed",
    payload: { productId, bidderId: user.id, amount: nextAmount, secondsLeft: nextSecondsLeft, nonce: bidNonce || null },
    created_by: user.id,
  });

  if (product.buy_now_price && nextAmount >= Number(product.buy_now_price)) {
    await (admin as any).from("show_products").update({ sold: true, winner_id: user.id, updated_at: now }).eq("id", productId);
  }

  return NextResponse.json({ ok: true, amount: nextAmount, secondsLeft: nextSecondsLeft });
}
