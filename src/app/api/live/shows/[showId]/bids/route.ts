import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyAntiSnipingExtension, createShowEvent, validateBidAmount } from "@/lib/live-shows";
import { getLiveShowDetails } from "@/lib/live-shows-client";

export async function POST(req: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { productId?: string; amount?: number; isAutoBid?: boolean };
  if (!body.productId || typeof body.amount !== "number") {
    return NextResponse.json({ error: "Missing bid details" }, { status: 400 });
  }

  const { show, products } = await getLiveShowDetails(showId);
  if (show.status !== "live") {
    return NextResponse.json({ error: "Show is not live" }, { status: 409 });
  }

  const product = products.find((item) => item.id === body.productId) as (typeof products)[number] & { passed?: boolean } | undefined;
  if (!product || product.sold || product.passed) {
    return NextResponse.json({ error: "Item is not available" }, { status: 409 });
  }

  const auctionSettings = (show.auction_settings ?? {}) as { min_increment?: number; anti_snipe_seconds?: number };
  const minIncrement = Number(auctionSettings.min_increment ?? 1);
  const antiSnipeSeconds = Number(auctionSettings.anti_snipe_seconds ?? 10);
  if (!validateBidAmount(Number(product.current_bid), body.amount, minIncrement)) {
    return NextResponse.json({ error: `Bid must be at least $${(Number(product.current_bid) + minIncrement).toFixed(2)}` }, { status: 400 });
  }

  const nextSecondsLeft = applyAntiSnipingExtension(product.seconds_left, antiSnipeSeconds);
  const bidPayload = {
    show_id: showId,
    product_id: product.id,
    bidder_id: user.id,
    amount: body.amount,
    is_auto_bid: Boolean(body.isAutoBid),
  };

  const { error: bidError } = await (supabase as any).from("live_bids").insert(bidPayload as any);
  const { error: productError } = await (supabase as any).from("show_products").update({
    current_bid: body.amount,
    bid_count: product.bid_count + 1,
    seconds_left: nextSecondsLeft,
    auction_state: "bidding_active",
    winner_id: user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", product.id);



  if (bidError) {
    return NextResponse.json({ error: bidError.message }, { status: 500 });
  }
  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  await createShowEvent({
    show_id: showId,
    event_type: "bid_placed",
    payload: { productId: product.id, amount: body.amount, bidderId: user.id },
    created_by: user.id,
  });

  return NextResponse.json({ ok: true });
}
