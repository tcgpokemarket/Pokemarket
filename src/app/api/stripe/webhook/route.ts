import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementTotalSales } from "@/lib/supabase/fees";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-06-24.dahlia" });
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const supabase = createAdminClient();

  const sessionId = session.id;
  const orderResult = await supabase
    .from("orders")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .single();
  const order = orderResult.data as any;

  if (orderResult.error || !order) {
    return NextResponse.json({ received: true });
  }

  const orderUpdate = {
    status: "completed",
    completed_at: new Date().toISOString(),
    payout_status: "pending",
    total_amount: Number(session.metadata?.totalAmount ?? order.total_amount),
    item_subtotal: Number(session.metadata?.itemSubtotal ?? order.item_subtotal ?? 0),
    shipping_amount: Number(session.metadata?.shippingAmount ?? order.shipping_amount ?? 0),
    sales_tax_amount: Number(session.metadata?.salesTaxAmount ?? order.sales_tax_amount ?? 0),
    processing_fee_amount: Number(session.metadata?.processingFeeAmount ?? order.processing_fee_amount ?? 0),
    marketplace_fee_amount: Number(session.metadata?.marketplaceFeeAmount ?? order.marketplace_fee_amount ?? 0),
    seller_payout_amount: Number(session.metadata?.sellerPayoutAmount ?? order.seller_payout_amount ?? 0),
    platform_revenue_amount: Number(session.metadata?.platformRevenueAmount ?? order.platform_revenue_amount ?? 0),
    marketplace_fee_percent: Number(session.metadata?.marketplaceFeePercent ?? order.marketplace_fee_percent ?? 0),
    seller_tier_name: session.metadata?.sellerTierName ?? order.seller_tier_name,
  } as const;

  await (supabase as any)
    .from("orders")
    .update(orderUpdate)
    .eq("id", order.id);

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", order.seller_id)
    .single();

  if (sellerProfile) {
    await (supabase as any)
      .from("profiles")
      .update(incrementTotalSales(sellerProfile, order.quantity ?? 1))
      .eq("id", order.seller_id);
  }

  await (supabase as any)
    .from("orders")
    .update({ platform_revenue_amount: Number(session.metadata?.platformRevenueAmount ?? order.platform_revenue_amount ?? 0) })
    .eq("id", order.id);

  await (supabase as any)
    .from("listings")
    .update({ status: "sold" })
    .eq("id", order.listing_id);

  return NextResponse.json({ received: true });
}
