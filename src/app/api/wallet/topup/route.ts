import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const MIN_TOPUP = 1;
const MAX_TOPUP = 1000;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    return NextResponse.json({ error: `Top-up must be between $${MIN_TOPUP} and $${MAX_TOPUP}.` }, { status: 400 });
  }
  const cents = Math.round(amount * 100);
  if (cents < 100 || cents > 100000) return NextResponse.json({ error: "Invalid amount." }, { status: 400 });

  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from("profiles").select("username,full_name").eq("id", user.id).maybeSingle();
  const { data: wallet } = await admin.from("customer_wallets").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();

  const stripe = getStripe();
  let customerId = wallet?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: profile?.full_name ?? profile?.username ?? undefined,
      metadata: { user_id: user.id, product: "customer_wallet" },
    });
    customerId = customer.id;
    await admin.from("customer_wallets").upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: "usd", product_data: { name: "TCG Poke Market Wallet Top-Up" }, unit_amount: cents }, quantity: 1 }],
    metadata: { wallet_topup: "true", user_id: user.id, amount_cents: String(cents) },
    payment_intent_data: { metadata: { wallet_topup: "true", user_id: user.id, amount_cents: String(cents) } },
    success_url: `${origin}/wallet?topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/wallet?topup=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
