/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient as _createAdminClient } from "@/lib/supabase/admin";

function adminDb() { return _createAdminClient() as any }

export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" as "2026-06-24.dahlia" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = adminDb();

  try {
    // Idempotency: skip if we've already processed this provider_event_id
    const { data: existing } = await admin.from("webhook_events").select("id").eq("provider_event_id", event.id).maybeSingle();
    if (existing) return NextResponse.json({ received: true });

    await admin.from("webhook_events").insert({ event_type: event.type, provider_event_id: event.id, payload: event, created_at: new Date().toISOString() });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        // Mark the order as paid and record payment intent
        await admin.from("orders").update({ status: "paid", stripe_payment_intent_id: session.payment_intent }).eq("id", orderId);

        const { data: order } = await admin
          .from('orders')
          .select('seller_id')
          .eq('id', orderId)
          .maybeSingle()

        // Create an escrow ledger hold entry
        const amount = session.amount_total ? Number(session.amount_total) / 100 : undefined;
        await admin.from("escrow_ledger").insert({ order_id: orderId, seller_id: order?.seller_id ?? null, entry_type: "hold", amount: amount ?? 0, created_at: new Date().toISOString() });
      }
    }

    // handle other event types as needed
  } catch (err) {
    // Log error record to webhook_events -> we already inserted event payload above; additional error logging can be added
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
