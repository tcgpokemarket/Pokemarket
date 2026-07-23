import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("auction_orders")
    .select("id, auction_id, product_id, buyer_id, seller_id, item_id, winning_bid, payment_status, payment_deadline, stripe_checkout_session_id, stripe_payment_intent_id, created_at, updated_at, show_products(title)")
    .eq("auction_id", showId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}
