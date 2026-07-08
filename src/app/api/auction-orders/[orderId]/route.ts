import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";

export async function GET(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("auction_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (data.buyer_id !== user.id && data.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ order: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`auction-order-update:${orderId}:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "security.alert",
      severity: "medium",
      actor_id: user.id,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
      details: { route: "/api/auction-orders/[orderId]", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({} as { action?: string }));
  const admin = createAdminClient();
  const { data: order, error } = await (admin as any)
    .from("auction_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const isParticipant = order.buyer_id === user.id || order.seller_id === user.id;
  const isAdmin = isAdminUser(user);
  const isSellerActionAllowed = order.seller_id === user.id || isAdmin;
  const isBuyerActionAllowed = order.buyer_id === user.id || isAdmin;
  const canMutate = isParticipant || isAdmin;

  if (!canMutate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.action === "mark_paid" && !isBuyerActionAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.action === "mark_expired" && !isSellerActionAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.action === "mark_paid" && order.payment_status === "paid") {
    return NextResponse.json({ order });
  }

  if (body.action === "mark_expired" && !(order.payment_status === "payment_pending" && new Date(order.payment_deadline).getTime() <= Date.now())) {
    return NextResponse.json({ order });
  }

  if (body.action === "mark_paid") {
    if (order.payment_status === "paid") {
      return NextResponse.json({ order });
    }

    if (!isBuyerActionAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateError } = await (admin as any)
      .from("auction_orders")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: body.stripePaymentIntentId ?? order.stripe_payment_intent_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("payment_events").insert({
      order_id: orderId,
      stripe_event_id: body.stripeEventId ?? `manual-${orderId}`,
      status: "paid",
    });

    await (admin as any).from("notifications").insert([
      {
        user_id: order.seller_id,
        type: "auction_payment_received",
        related_user: order.buyer_id,
        related_content: { orderId, status: "paid" },
      },
      {
        user_id: order.buyer_id,
        type: "auction_payment_successful",
        related_user: order.seller_id,
        related_content: { orderId, status: "paid" },
      },
    ]);

    return NextResponse.json({ ok: true });
  }

  if (body.action === "mark_expired") {
    if (!isSellerActionAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (order.payment_status !== "payment_pending" || new Date(order.payment_deadline).getTime() > Date.now()) {
      return NextResponse.json({ order });
    }

    const { error: updateError } = await (admin as any)
      .from("auction_orders")
      .update({
        payment_status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("notifications").insert({
      user_id: order.seller_id,
      type: "auction_payment_expired",
      related_user: order.buyer_id,
      related_content: { orderId, status: "expired" },
    });

    await (admin as any).from("show_products").update({ sold: false, winner_id: null }).eq("id", order.product_id);

    return NextResponse.json({ ok: true });
  }

  if (body.action === "release_escrow" || body.action === "freeze_escrow" || body.action === "open_dispute") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextStatus = body.action === "release_escrow" ? "released" : body.action === "freeze_escrow" ? "frozen" : "disputed";
    const updatePayload =
      body.action === "release_escrow"
        ? { payment_status: "paid", updated_at: new Date().toISOString() }
        : body.action === "freeze_escrow"
          ? { payment_status: "failed", updated_at: new Date().toISOString() }
          : { payment_status: "payment_pending", updated_at: new Date().toISOString() };

    const { error: updateError } = await (admin as any)
      .from("auction_orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("payment_events").insert({
      order_id: orderId,
      stripe_event_id: `${body.action}-${orderId}`,
      status: nextStatus,
    });

    await (admin as any).from("notifications").insert({
      user_id: order.seller_id,
      type: `auction_escrow_${nextStatus}`,
      related_user: order.buyer_id,
      related_content: { orderId, status: nextStatus },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ order });
}
