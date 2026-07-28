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
  const { data: show, error: showError } = await (admin as any)
    .from("live_shows")
    .select("seller_id, host_permissions")
    .eq("id", showId)
    .maybeSingle();

  if (showError) {
    return NextResponse.json({ error: showError.message }, { status: 500 });
  }
  if (!show) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  const permissions = Array.isArray(show.host_permissions) ? show.host_permissions : [];
  const canViewOrders = show.seller_id === user.id || permissions.includes("host");
  if (!canViewOrders) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
