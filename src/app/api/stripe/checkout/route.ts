/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient as _createAdminClient } from "@/lib/supabase/admin";

function adminDb() { return _createAdminClient() as any }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { listingId, quantity = 1, idempotencyKey } = body as { listingId?: string; quantity?: number; idempotencyKey?: string };

    if (!listingId) return NextResponse.json({ error: "missing listingId" }, { status: 400 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" as "2026-06-24.dahlia" });
    const admin = adminDb();

    // Validate listing & price
    const { data: listing, error: listErr } = await admin.from("listings").select("*").eq("id", listingId).maybeSingle();
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    if (!listing || listing.status !== "active") return NextResponse.json({ error: "Listing unavailable" }, { status: 400 });

    // Create pending order
    const orderPayload: any = {
      buyer_id: null,
      seller_id: listing.seller_id,
      listing_id: listing.id,
      unit_price: listing.price,
      quantity,
      total_amount: Number(listing.price) * Number(quantity),
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const { data: orderData, error: orderErr } = await admin.from("orders").insert(orderPayload).select().single();
    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: listing.card_name },
              unit_amount: Math.round(Number(listing.price) * 100),
            },
            quantity,
          },
        ],
        mode: "payment",
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/orders/${orderData.id}/thank-you`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/listings/${listingId}`,
        metadata: { order_id: orderData.id },
      },
      { idempotencyKey: idempotencyKey ?? `checkout-${orderData.id}` },
    );

    // Save session id to order
    await admin.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", orderData.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
