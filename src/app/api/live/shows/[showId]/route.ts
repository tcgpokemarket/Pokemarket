import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";
import { LIVE_MAX_CHAT_LENGTH } from "@/lib/live-shows";
import type { Database } from "@/lib/supabase/types";

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function createAuctionOrder(input: {
  showId: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  itemId: string | null;
  winningBid: number;
  paymentDeadline: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("auction_orders")
    .upsert({
      auction_id: input.showId,
      product_id: input.productId,
      buyer_id: input.buyerId,
      seller_id: input.sellerId,
      item_id: input.itemId,
      winning_bid: input.winningBid,
      payment_status: "payment_pending",
      payment_deadline: input.paymentDeadline,
      updated_at: new Date().toISOString(),
    }, { onConflict: "auction_id,product_id" })
    .select("*")
    .maybeSingle() as { data: Database["public"]["Tables"]["auction_orders"]["Row"] | null; error: { message: string } | null };

  if (error) throw new Error(error.message);
  return data;
}

async function queueAuctionNotification(input: {
  userId: string;
  type: string;
  message: string;
  relatedUser?: string | null;
  relatedContent?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await (admin as any).from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    related_user: input.relatedUser ?? null,
    related_content: input.relatedContent ?? {},
    read_status: false,
  });
  if (error) throw new Error(error.message);
}

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("live_shows").select("*").eq("id", showId).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ show: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`live-show-patch:${showId}:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "security.alert",
      severity: "medium",
      actor_id: user.id,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
      details: { route: "/api/live/shows/[showId]", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json() as Record<string, unknown>;
  const { data: existing } = await supabase.from("live_shows").select("seller_id, status, auction_state").eq("id", showId).single();
  const existingRow = existing as any;
  if (!existingRow || existingRow.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const endingShow = body.status === "ended" || body.auction_state === "ended";
  const nextAuctionState = endingShow ? "payment_pending" : body.auction_state;
  const nextStatus = body.status ?? existingRow.status;

  const { data, error } = await (supabase as any).from("live_shows").update({
    ...body,
    status: nextStatus,
    auction_state: nextAuctionState,
    updated_at: now,
  }).eq("id", showId).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (endingShow && existingRow.status !== "ended") {
    const admin = createAdminClient();
    const deadline = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: products } = await (admin as any)
      .from("show_products")
      .select("id, listing_id, title, current_bid, winner_id")
      .eq("show_id", showId)
      .eq("sold", false)
      .eq("passed", false);

    for (const product of (products ?? []) as Array<{ id: string; listing_id: string | null; title: string; current_bid: number; winner_id: string | null }>) {
      if (!product.winner_id) continue;
      const auctionOrder = await createAuctionOrder({
        showId,
        productId: product.id,
        buyerId: product.winner_id,
        sellerId: user.id,
        itemId: product.listing_id,
        winningBid: toNumber(product.current_bid, 0),
        paymentDeadline: deadline,
      });

      await queueAuctionNotification({
        userId: user.id,
        type: "auction_payment_pending",
        message: "🎉 Your auction sold! Waiting for buyer payment.",
        relatedUser: product.winner_id,
        relatedContent: {
          showId,
          productId: product.id,
          auctionOrderId: auctionOrder?.id ?? null,
          title: product.title,
          winningBid: toNumber(product.current_bid, 0),
          paymentDeadline: deadline,
          status: "payment_pending",
        },
      });

      await queueAuctionNotification({
        userId: product.winner_id,
        type: "auction_payment_required",
        message: "You won this auction! Complete payment within 15 minutes.",
        relatedUser: user.id,
        relatedContent: {
          showId,
          productId: product.id,
          auctionOrderId: auctionOrder?.id ?? null,
          title: product.title,
          winningBid: toNumber(product.current_bid, 0),
          paymentDeadline: deadline,
          status: "payment_pending",
        },
      });
    }
  }

  return NextResponse.json({ show: data });
}
