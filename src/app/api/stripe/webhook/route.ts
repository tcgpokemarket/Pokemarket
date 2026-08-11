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
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = adminDb();

  try {
    const { data: existing } = await admin.from("webhook_events").select("id").eq("provider_event_id", event.id).maybeSingle();
    if (existing) return NextResponse.json({ received: true });

    await admin.from("webhook_events").insert({ event_type: event.type, provider_event_id: event.id, payload: event, created_at: new Date().toISOString() });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.wallet_topup === "true" && session.payment_status === "paid") {
        const userId = session.metadata.user_id;
        const amountCents = Number(session.metadata.amount_cents);
        if (!userId || !Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Invalid wallet top-up metadata");
        const { error } = await admin.rpc("wallet_credit_topup", {
          p_user_id: userId,
          p_amount: amountCents / 100,
          p_idempotency_key: `stripe_checkout:${session.id}`,
          p_reference_id: session.payment_intent ? String(session.payment_intent) : session.id,
          p_description: "Stripe wallet top-up",
        });
        if (error) throw error;
      }

      const orderId = session.metadata?.order_id;
      if (orderId) {
        const { data: completion, error: completionError } = await admin.rpc('complete_marketplace_order', { p_order_id: orderId });
        if (completionError) throw completionError;

        const { data: order } = await admin.from('orders').select('seller_id,total_amount').eq('id', orderId).maybeSingle();
        const amount = session.amount_total ? Number(session.amount_total) / 100 : Number(order?.total_amount ?? 0);
        const { data: existingHold } = await admin.from("escrow_ledger").select("id").eq("order_id", orderId).eq("entry_type", "hold").maybeSingle();
        if (!existingHold) {
          await admin.from("escrow_ledger").insert({ order_id: orderId, seller_id: order?.seller_id ?? null, entry_type: "hold", amount, created_at: new Date().toISOString() });
        }

        console.info('[stripe/webhook] marketplace order completed', { orderId, completion });
      }
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
