import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementSellerTotals, incrementTotalSales } from "@/lib/supabase/fees";

async function recordWebhookEvent(
  supabase: ReturnType<typeof createAdminClient>,
  event: Stripe.Event,
) {
  const { data, error } = await (supabase as any)
    .from("webhook_events")
    .insert({
      provider: "stripe",
      event_id: event.id,
      event_type: event.type,
      payload: event,
    })
    .select("id")
    .maybeSingle();

  if (error && !String(error.message ?? "").includes("duplicate key")) {
    throw error;
  }

  return Boolean(data);
}

export const runtime = "nodejs";

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function isProcessed(supabase: ReturnType<typeof createAdminClient>, sessionId: string) {
  const { data, error } = await (supabase as any)
    .from("orders")
    .select("id, status, completed_at")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean(data.completed_at || data.status === "completed");
}

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

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_failed") {
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const supabase = createAdminClient();
    await (supabase as any).from("webhook_events").insert({
      provider: "stripe",
      event_id: event.id,
      event_type: event.type,
      payload: event,
    }).select("id").maybeSingle();
    return NextResponse.json({ received: true });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const supabase = createAdminClient();
  const sessionId = session.id;

  try {
    const recorded = await recordWebhookEvent(supabase, event);
    if (!recorded) {
      return NextResponse.json({ received: true });
    }
  } catch {
    return NextResponse.json({ received: true });
  }

  if (await isProcessed(supabase, sessionId)) {
    return NextResponse.json({ received: true });
  }

  const orderResult = await (supabase as any)
    .from("orders")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  const order = orderResult.data as any;

  if (orderResult.error || !order) {
    return NextResponse.json({ received: true });
  }

  const orderUpdate = {
    status: "completed",
    completed_at: new Date().toISOString(),
    payout_status: "pending",
    total_amount: toNumber(session.metadata?.totalAmount, order.total_amount),
    item_subtotal: toNumber(session.metadata?.itemSubtotal, order.item_subtotal ?? 0),
    shipping_amount: toNumber(session.metadata?.shippingAmount, order.shipping_amount ?? 0),
    sales_tax_amount: toNumber(session.metadata?.salesTaxAmount, order.sales_tax_amount ?? 0),
    processing_fee_amount: toNumber(session.metadata?.processingFeeAmount, order.processing_fee_amount ?? 0),
    marketplace_fee_amount: toNumber(session.metadata?.marketplaceFeeAmount, order.marketplace_fee_amount ?? 0),
    seller_payout_amount: toNumber(session.metadata?.sellerPayoutAmount, order.seller_payout_amount ?? 0),
    platform_revenue_amount: toNumber(session.metadata?.platformRevenueAmount, order.platform_revenue_amount ?? 0),
    marketplace_fee_percent: toNumber(session.metadata?.marketplaceFeePercent, order.marketplace_fee_percent ?? 0),
    seller_tier_name: session.metadata?.sellerTierName ?? order.seller_tier_name,
  } as const;

  await (supabase as any)
    .from("orders")
    .update(orderUpdate)
    .eq("id", order.id)
    .is("completed_at", null)
    .or("status.eq.pending,status.eq.paid");

  const [{ data: sellerProfile }, { data: sellerRecord }] = await Promise.all([
    (supabase as any).from("profiles").select("*").eq("id", order.seller_id).maybeSingle(),
    (supabase as any).from("sellers").select("*").eq("id", order.seller_id).maybeSingle(),
  ]);

  if (sellerProfile) {
    await (supabase as any)
      .from("profiles")
      .update(incrementTotalSales(sellerProfile, order.quantity ?? 1))
      .eq("id", order.seller_id);
  }

  if (sellerRecord) {
    await (supabase as any)
      .from("sellers")
      .update(incrementSellerTotals(sellerRecord, toNumber(order.total_amount, 0), 0, 0))
      .eq("id", order.seller_id);
  }

  await (supabase as any)
    .from("listings")
    .update({ status: "sold" })
    .eq("id", order.listing_id);

  return NextResponse.json({ received: true });
}
