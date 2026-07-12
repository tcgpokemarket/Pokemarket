import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

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
  const body = await request.json().catch(() => ({}));
  const productId = String(body.productId ?? "").trim();
  const amount = Number(body.maxBid ?? 0) || 0;

  if (!productId) {
    return NextResponse.json({ error: "Product is required." }, { status: 400 });
  }

  const { data: product, error: lookupError } = await supabase.from("show_products").select("id, current_bid, bid_count, seller_id, show_id").eq("id", productId).maybeSingle<{ id: string; current_bid: number; bid_count: number; seller_id: string | null; show_id: string }>();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!product || product.show_id !== showId) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const nextAmount = amount > 0 ? amount : Number(product.current_bid) + 1;

  const bidPayload = {
    show_id: showId,
    product_id: productId,
    bidder_id: user.id,
    amount: nextAmount,
    is_auto_bid: false,
  } as any;

  const { error: insertError } = await (supabase.from("live_bids") as any).insert(bidPayload);

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const updatePayload = {
    current_bid: nextAmount,
    bid_count: Number(product.bid_count ?? 0) + 1,
  } as any;

  const { error: updateError } = await (supabase.from("show_products") as any).update(updatePayload).eq("id", productId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true, amount: nextAmount });
}
