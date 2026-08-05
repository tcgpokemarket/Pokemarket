import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2022-11-15" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createAdminClient();

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

        // Create an escrow ledger hold entry
        const amount = session.amount_total ? Number(session.amount_total) / 100 : undefined;
        await admin.from("escrow_ledger").insert({ order_id: orderId, seller_id: null, entry_type: "hold", amount: amount ?? 0, created_at: new Date().toISOString() });
      }
    }

    // handle other event types as needed
  } catch (err) {
    // Log error record to webhook_events -> we already inserted event payload above; additional error logging can be added
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
