import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SetupQueueItem = {
  id?: string;
  listingId?: string | null;
  title?: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  startPrice?: number;
  buyNowPrice?: number | null;
  auctionSeconds?: number;
  pinned?: boolean;
};

type SetupGiveawayItem = {
  id?: string;
  title?: string;
  prizeName?: string;
  prizeType?: string;
  prizeImage?: string | null;
  startAt?: string;
  endAt?: string;
  followRequired?: boolean;
  status?: string;
};

export async function PUT(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const { data: show, error: showError } = await supabase
    .from("live_shows")
    .select("id, seller_id")
    .eq("id", showId)
    .maybeSingle<{ id: string; seller_id: string }>();

  if (showError) {
    return NextResponse.json({ error: showError.message }, { status: 400 });
  }

  if (!show) {
    return NextResponse.json({ error: "Show not found." }, { status: 404 });
  }

  if (show.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  const showUpdates: Record<string, unknown> = {};
  for (const key of ["title", "description", "status", "auction_state", "scheduled_start", "scheduled_end", "thumbnail"] as const) {
    if (key in body) showUpdates[key] = body[key];
  }
  if ("auction_settings" in body) showUpdates.auction_settings = body.auction_settings ?? null;
  if ("host_permissions" in body) showUpdates.host_permissions = Array.isArray(body.host_permissions) ? body.host_permissions : [];
  if ("viewer_count" in body) showUpdates.viewer_count = Number(body.viewer_count ?? 0);
  if ("peak_viewers" in body) showUpdates.peak_viewers = Number(body.peak_viewers ?? 0);

  const { error: updateError } = await (admin.from("live_shows") as any).update(showUpdates as any).eq("id", showId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const queue = Array.isArray(body.items) ? (body.items as SetupQueueItem[]) : [];
  const giveaways = Array.isArray(body.giveaways) ? (body.giveaways as SetupGiveawayItem[]) : [];

  const { error: deleteProductsError } = await (admin.from("show_products") as any).delete().eq("show_id", showId);
  if (deleteProductsError) {
    return NextResponse.json({ error: deleteProductsError.message }, { status: 400 });
  }

  if (queue.length > 0) {
    const productRows = queue.map((item, index) => ({
      show_id: showId,
      listing_id: item.listingId ?? null,
      title: String(item.title ?? "Auction item"),
      subtitle: item.subtitle ?? null,
      image_url: item.imageUrl ?? null,
      start_price: Number(item.startPrice ?? 0),
      buy_now_price: item.buyNowPrice ?? Number(item.startPrice ?? 0),
      current_bid: Number(item.startPrice ?? 0),
      bid_count: 0,
      auction_seconds: Number(item.auctionSeconds ?? 30),
      seconds_left: Number(item.auctionSeconds ?? 30),
      pinned: index === 0 || Boolean(item.pinned),
      sold: false,
      passed: false,
      sort_order: index,
    }));

    const { error: insertProductsError } = await (admin.from("show_products") as any).insert(productRows);
    if (insertProductsError) {
      return NextResponse.json({ error: insertProductsError.message }, { status: 400 });
    }
  }

  const { error: deleteGiveawaysError } = await (admin.from("giveaways") as any).delete().eq("show_id", showId);
  if (deleteGiveawaysError) {
    return NextResponse.json({ error: deleteGiveawaysError.message }, { status: 400 });
  }

  if (giveaways.length > 0) {
    const giveawayRows = giveaways.map((giveaway) => ({
      show_id: showId,
      seller_id: user.id,
      title: String(giveaway.title ?? "Giveaway"),
      prize_type: String(giveaway.prizeType ?? "card"),
      prize_name: String(giveaway.prizeName ?? "Prize"),
      prize_image: giveaway.prizeImage ?? null,
      prize_quantity: 1,
      winner_count: 1,
      start_at: new Date(String(giveaway.startAt ?? new Date().toISOString())).toISOString(),
      end_at: new Date(String(giveaway.endAt ?? new Date(Date.now() + 1000 * 60 * 30).toISOString())).toISOString(),
      eligibility: giveaway.followRequired ? ["follow"] : ["all"],
      follow_required: Boolean(giveaway.followRequired),
      location_restrictions: [],
      age_restriction: null,
      eligible_users: 0,
      claimed_winners: 0,
      live_entries: 0,
      total_entries: 0,
      estimated_item_value: 0,
      platform_processing_fee: 0,
      shipping_cost: 0,
      seller_budget: 0,
      seller_pays_all_fees: true,
      status: giveaway.status ?? "draft",
      winner_ids: [],
      fraud_flags: 0,
    }));

    const { error: insertGiveawaysError } = await (admin.from("giveaways") as any).insert(giveawayRows);
    if (insertGiveawaysError) {
      return NextResponse.json({ error: insertGiveawaysError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    ok: true,
    show: {
      id: showId,
      queueCount: queue.length,
      giveawayCount: giveaways.length,
    },
  });
}
