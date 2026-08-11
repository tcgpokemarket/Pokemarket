import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient() as any;
  const { data: wallet } = await admin.from("customer_wallets").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (!wallet?.stripe_customer_id) return NextResponse.json({ payment_methods: [] });
  const stripe = getStripe();
  const methods = await stripe.paymentMethods.list({ customer: wallet.stripe_customer_id, type: "card" });
  return NextResponse.json({ payment_methods: methods.data.map((pm) => ({ id: pm.id, brand: pm.card?.brand ?? null, last4: pm.card?.last4 ?? null, exp_month: pm.card?.exp_month ?? null, exp_year: pm.card?.exp_year ?? null })) });
}
