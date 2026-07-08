import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";
import { notFound } from "next/navigation";

export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminUser = user!;
  const limit = checkRateLimit(`admin-auction-order:${orderId}:${adminUser.id}`, 30, 60_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "security.alert",
      severity: "medium",
      actor_id: adminUser.id,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
      details: { route: "/api/admin/auction-orders/[orderId]", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({} as { action?: string }));
  const admin = createAdminClient();
  const { data: order, error } = await (admin as any).from("auction_orders").select("*").eq("id", orderId).maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (body.action === "extend") {
    const nextDeadline = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: updateError } = await (admin as any)
      .from("auction_orders")
      .update({ payment_deadline: nextDeadline, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("payment_status", "payment_pending");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("notifications").insert({
      user_id: order.buyer_id,
      type: "auction_payment_extended",
      related_user: order.seller_id,
      related_content: { orderId, paymentDeadline: nextDeadline },
    });

    return NextResponse.json({ ok: true, paymentDeadline: nextDeadline });
  }

  if (body.action === "cancel") {
    const { error: updateError } = await (admin as any)
      .from("auction_orders")
      .update({ payment_status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("payment_status", "payment_pending");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("notifications").insert([
      {
        user_id: order.seller_id,
        type: "auction_payment_cancelled",
        related_user: order.buyer_id,
        related_content: { orderId, status: "cancelled" },
      },
      {
        user_id: order.buyer_id,
        type: "auction_payment_cancelled",
        related_user: order.seller_id,
        related_content: { orderId, status: "cancelled" },
      },
    ]);

    await (admin as any).from("show_products").update({ sold: false, winner_id: null }).eq("id", order.product_id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
