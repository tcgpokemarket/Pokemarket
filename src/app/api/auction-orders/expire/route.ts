import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";
import { recordPaymentEvent } from "@/lib/payment-events";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const limit = checkRateLimit(`auction-order-expire:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "security.alert",
      severity: "medium",
      actor_id: null,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
      details: { route: "/api/auction-orders/expire", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({} as { orderIds?: string[] }));
  const now = Date.now();
  const ids = Array.isArray(body.orderIds) ? body.orderIds : [];

  const query = (admin as any)
    .from("auction_orders")
    .select("*")
    .eq("payment_status", "payment_pending")
    .lte("payment_deadline", new Date(now).toISOString())
    .order("payment_deadline", { ascending: true });

  if (ids.length > 0) {
    query.in("id", ids);
  }

  const { data: orders, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const order of orders ?? []) {
    await (admin as any).from("auction_orders").update({ payment_status: "expired", updated_at: new Date().toISOString() }).eq("id", order.id).eq("payment_status", "payment_pending");
    await recordPaymentEvent(admin, { orderId: order.id, stripeEventId: `expire-${order.id}`, status: "expired" });
    await (admin as any).from("notifications").insert({
      user_id: order.seller_id,
      type: "auction_payment_expired",
      related_user: order.buyer_id,
      related_content: { orderId: order.id, status: "expired" },
    });
    await (admin as any).from("show_products").update({ sold: false, winner_id: null }).eq("id", order.product_id);
  }

  return NextResponse.json({ ok: true, expired: orders?.length ?? 0 });
}
