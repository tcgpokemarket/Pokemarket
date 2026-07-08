import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyAntiSnipingExtension,
  createShowEvent,
  getProxyBidResult,
  getLeaderSwipeBid,
  getNextSwipeBid,
  isAuctionBidAllowed,
  isBidRequestUnique,
  normalizeAuctionSettings,
  LIVE_BID_STEP,
  LIVE_SNIPE_EXTENSION_SECONDS,
} from "@/lib/live-shows";
import { getLiveShowDetails } from "@/lib/live-shows-client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { productId?: string; nonce?: string };
  if (!body.productId || !body.nonce) {
    return NextResponse.json({ error: "Missing bid details" }, { status: 400 });
  }

  const { show, products } = await getLiveShowDetails(showId);
  const product = products.find((item) => item.id === body.productId) as (typeof products)[number] & { passed?: boolean } | undefined;
  const auctionSettings = normalizeAuctionSettings(show.auction_settings);
  const sellerWallet = await (supabase as any).from("seller_wallets").select("fraud_flag").eq("seller_id", show.seller_id).maybeSingle();
  const validation = isAuctionBidAllowed({
    showStatus: show.status,
    productSold: Boolean(product?.sold),
    productPassed: Boolean(product?.passed),
    sellerId: show.seller_id,
    bidderId: user.id,
    sellerFraudFlag: sellerWallet.data?.fraud_flag ?? null,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 409 });
  }

  if (!product) {
    return NextResponse.json({ error: "Item is not available" }, { status: 409 });
  }

  const lastBid = await (supabase as any)
    .from("live_bids")
    .select("created_at")
    .eq("show_id", showId)
    .eq("product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!isBidRequestUnique(lastBid.data?.created_at ?? null, Date.now())) {
    return NextResponse.json({ error: "Bid already processed" }, { status: 409 });
  }

  const admin = createAdminClient();
  const increment = Math.max(1, Math.floor(Number(auctionSettings.min_increment ?? LIVE_BID_STEP)));
  const currentLeaderId = product.winner_id ?? null;
  const currentLeaderPreference = currentLeaderId
    ? (await admin
        .from("show_bid_preferences")
        .select("max_bid")
        .eq("show_id", showId)
        .eq("product_id", product.id)
        .eq("user_id", currentLeaderId)
        .eq("is_active", true)
        .maybeSingle()) as any
    : { data: null };
  const challengerPreference = (await admin
    .from("show_bid_preferences")
    .select("max_bid")
    .eq("show_id", showId)
    .eq("product_id", product.id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()) as any;
  const challengerMaxBid = Number(challengerPreference.data?.max_bid ?? getNextSwipeBid(Number(product.current_bid ?? 0)));
  const currentLeaderMaxBid = currentLeaderPreference.data?.max_bid == null ? null : Number(currentLeaderPreference.data.max_bid);
  const maxBiddingEnabled = auctionSettings.max_bids_enabled;
  const currentBid = Number(product.current_bid ?? 0);
  const proxyResult = maxBiddingEnabled
    ? getProxyBidResult({
        currentBid,
        currentLeaderId,
        challengerId: user.id,
        challengerMaxBid,
        currentLeaderMaxBid,
        increment,
      })
    : {
        winnerId: user.id,
        displayedBid: getNextSwipeBid(currentBid),
        hiddenMaxBid: null,
        bidderWon: true,
      };

  const nextSecondsLeft = applyAntiSnipingExtension(product.seconds_left, Number(auctionSettings.anti_snipe_seconds ?? LIVE_SNIPE_EXTENSION_SECONDS));
  const finalDisplayBid = maxBiddingEnabled && proxyResult.winnerId !== user.id ? Math.max(currentBid + increment, getLeaderSwipeBid({ currentBid, currentLeaderMaxBid, increment })) : proxyResult.displayedBid;
  const bidPayload = {
    show_id: showId,
    product_id: product.id,
    bidder_id: user.id,
    amount: finalDisplayBid,
    is_auto_bid: !proxyResult.bidderWon,
  };

  const { error: bidError } = await (supabase as any).from("live_bids").insert(bidPayload as any);
  if (bidError) {
    return NextResponse.json({ error: bidError.message }, { status: 500 });
  }

  if (maxBiddingEnabled) {
    const preferencePayload = {
      show_id: showId,
      product_id: product.id,
      user_id: user.id,
      max_bid: challengerMaxBid,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const { error: preferenceError } = await admin.from("show_bid_preferences").upsert(preferencePayload as any, { onConflict: "show_id,product_id,user_id" });
    if (preferenceError) {
      return NextResponse.json({ error: preferenceError.message }, { status: 500 });
    }
  }

  const { error: productError } = await (supabase as any).from("show_products").update({
    current_bid: finalDisplayBid,
    bid_count: Number(product.bid_count ?? 0) + 1,
    seconds_left: nextSecondsLeft,
    auction_state: "bidding_active",
    winner_id: proxyResult.winnerId,
    updated_at: new Date().toISOString(),
  }).eq("id", product.id);

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  await createShowEvent({
    show_id: showId,
    event_type: "bid_placed",
    payload: { productId: product.id, amount: finalDisplayBid, bidderId: user.id, swipeNonce: body.nonce, bidStep: increment, maxBidEnabled: maxBiddingEnabled },
    created_by: user.id,
  });

  return NextResponse.json({ ok: true, nextBid: proxyResult.displayedBid, secondsLeft: nextSecondsLeft, isLeader: proxyResult.winnerId === user.id, maxBidEnabled: maxBiddingEnabled });
}
