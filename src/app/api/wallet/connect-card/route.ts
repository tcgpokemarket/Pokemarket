import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient() as any;
  const { data: wallet } = await admin.from("customer_wallets").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  const stripe = getStripe();
  let customerId = wallet?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id, product: "customer_wallet" } });
    customerId = customer.id;
    await admin.from("customer_wallets").upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    metadata: { wallet_card_setup: "true", user_id: user.id },
    success_url: `${origin}/wallet?card=connected`,
    cancel_url: `${origin}/wallet?card=cancelled`,
  });
  return NextResponse.json({ url: session.url });
}
