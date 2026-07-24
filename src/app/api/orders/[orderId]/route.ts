import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { recordEscrowAuditEvent } from "@/lib/audit-log";
import { buildEscrowLedgerReference, buildEscrowAuditPayload, shouldReleaseFromEscrow } from "@/lib/escrow";

type LinkedEscrowRow = {
  support_ticket_id: string | null;
  dispute_id: string | null;
};

async function getLinkedEscrowRows(admin: ReturnType<typeof createAdminClient>, orderId: string): Promise<LinkedEscrowRow> {
  const [{ data: supportTicket }, { data: disputeRecord }] = await Promise.all([
    (admin as any).from("support_tickets").select("id").eq("order_id", orderId).maybeSingle(),
    (admin as any).from("dispute_records").select("id").eq("order_id", orderId).maybeSingle(),
  ]);

  return {
    support_ticket_id: supportTicket?.id ?? null,
    dispute_id: disputeRecord?.id ?? null,
  };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order, error } = await (admin as any)
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const canAct = isAdminUser(user) || order.buyer_id === user.id || order.seller_id === user.id;
  if (!canAct) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as { action?: string; reason?: string }));
  const now = new Date().toISOString();
  const linkedEscrowRows = await getLinkedEscrowRows(admin, orderId);

  if (body.action === "release_escrow") {
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const releaseReady = shouldReleaseFromEscrow({
      disputeStatus: order.escrow_status === "disputed" ? "open" : null,
      releaseAfterAt: order.escrow_release_at,
      currentStatus: order.status,
      now,
    });

    if (!releaseReady) {
      return NextResponse.json({ order });
    }

    const { error: updateError } = await (admin as any)
      .from("orders")
      .update({
        status: "released",
        payout_status: "released",
        escrow_status: "released",
        escrow_released_at: now,
        updated_at: now,
      })
      .eq("id", orderId)
      .eq("seller_id", order.seller_id)
      .eq("buyer_id", order.buyer_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("escrow_ledger").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      entry_type: "release",
      amount: order.seller_payout_amount ?? 0,
      status: "posted",
      reference_id: buildEscrowLedgerReference(orderId, "release", linkedEscrowRows.support_ticket_id, linkedEscrowRows.dispute_id),
      note: body.reason ?? "Manual escrow release",
      created_by: user.id,
    }, { onConflict: "order_id,entry_type,reference_id" });

    recordEscrowAuditEvent({
      ...buildEscrowAuditPayload({
        orderId,
        transactionId: order.stripe_payment_intent_id ?? order.stripe_checkout_session_id ?? null,
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
        supportTicketId: linkedEscrowRows.support_ticket_id,
        disputeId: linkedEscrowRows.dispute_id,
        action: "release",
        amount: order.seller_payout_amount ?? 0,
        reason: body.reason ?? "Manual escrow release",
        actorId: user.id,
      }),
      resource_type: "order",
      resource_id: orderId,
      previous_value: { escrow_status: order.escrow_status, payout_status: order.payout_status },
      new_value: { escrow_status: "released", payout_status: "released" },
      action: "escrow.release",
      actor_id: user.id,
      ip_address: null,
      user_agent: null,
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "refund_escrow") {
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateError } = await (admin as any)
      .from("orders")
      .update({
        status: "refunded",
        payout_status: "failed",
        escrow_status: "refunded",
        updated_at: now,
      })
      .eq("id", orderId)
      .eq("seller_id", order.seller_id)
      .eq("buyer_id", order.buyer_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("escrow_ledger").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      entry_type: "refund",
      amount: order.seller_payout_amount ?? 0,
      status: "posted",
      reference_id: buildEscrowLedgerReference(orderId, "refund", linkedEscrowRows.support_ticket_id, linkedEscrowRows.dispute_id),
      note: body.reason ?? "Manual escrow refund",
      created_by: user.id,
    }, { onConflict: "order_id,entry_type,reference_id" });

    recordEscrowAuditEvent({
      ...buildEscrowAuditPayload({
        orderId,
        transactionId: order.stripe_payment_intent_id ?? order.stripe_checkout_session_id ?? null,
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
        supportTicketId: linkedEscrowRows.support_ticket_id,
        disputeId: linkedEscrowRows.dispute_id,
        action: "refund",
        amount: order.seller_payout_amount ?? 0,
        reason: body.reason ?? "Manual escrow refund",
        actorId: user.id,
      }),
      resource_type: "order",
      resource_id: orderId,
      previous_value: { escrow_status: order.escrow_status, payout_status: order.payout_status },
      new_value: { escrow_status: "refunded", payout_status: "failed" },
      action: "escrow.refund",
      actor_id: user.id,
      ip_address: null,
      user_agent: null,
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "open_dispute") {
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: disputeRow, error: disputeError } = await (admin as any).from("escrow_disputes").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      buyer_id: order.buyer_id,
      reason: body.reason ?? "Manual dispute opened",
      status: "open",
      created_by: user.id,
      updated_at: now,
    }, { onConflict: "order_id" }).select("id").single();

    if (disputeError) {
      return NextResponse.json({ error: disputeError.message }, { status: 500 });
    }

    await (admin as any).from("orders").update({
      status: "disputed",
      payout_status: "held",
      escrow_status: "disputed",
      updated_at: now,
    }).eq("id", orderId).eq("seller_id", order.seller_id).eq("buyer_id", order.buyer_id);

    await (admin as any).from("escrow_ledger").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      entry_type: "freeze",
      amount: order.seller_payout_amount ?? 0,
      status: "posted",
      reference_id: buildEscrowLedgerReference(orderId, "freeze", linkedEscrowRows.support_ticket_id, disputeRow?.id ?? null),
      note: body.reason ?? "Manual dispute opened",
      created_by: user.id,
    }, { onConflict: "order_id,entry_type,reference_id" });

    recordEscrowAuditEvent({
      ...buildEscrowAuditPayload({
        orderId,
        transactionId: order.stripe_payment_intent_id ?? order.stripe_checkout_session_id ?? null,
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
        supportTicketId: order.support_ticket_id ?? null,
        disputeId: disputeRow?.id ?? null,
        action: "freeze",
        amount: order.seller_payout_amount ?? 0,
        reason: body.reason ?? "Manual dispute opened",
        actorId: user.id,
      }),
      resource_type: "order",
      resource_id: orderId,
      previous_value: { escrow_status: order.escrow_status, payout_status: order.payout_status },
      new_value: { escrow_status: "disputed", payout_status: "held" },
      action: "escrow.freeze",
      actor_id: user.id,
      ip_address: null,
      user_agent: null,
    });

    return NextResponse.json({ ok: true, disputeId: disputeRow?.id ?? null });
  }

  if (body.action === "freeze_escrow") {
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateError } = await (admin as any)
      .from("orders")
      .update({
        status: "frozen",
        payout_status: "frozen",
        escrow_status: "frozen",
        escrow_frozen_at: now,
        updated_at: now,
      })
      .eq("id", orderId)
      .eq("seller_id", order.seller_id)
      .eq("buyer_id", order.buyer_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("escrow_ledger").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      entry_type: "freeze",
      amount: order.seller_payout_amount ?? 0,
      status: "posted",
      reference_id: buildEscrowLedgerReference(orderId, "freeze", linkedEscrowRows.support_ticket_id, linkedEscrowRows.dispute_id),
      note: body.reason ?? "Manual escrow freeze",
      created_by: user.id,
    }, { onConflict: "order_id,entry_type,reference_id" });

    recordEscrowAuditEvent({
      ...buildEscrowAuditPayload({
        orderId,
        transactionId: order.stripe_payment_intent_id ?? order.stripe_checkout_session_id ?? null,
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
        supportTicketId: linkedEscrowRows.support_ticket_id,
        disputeId: linkedEscrowRows.dispute_id,
        action: "freeze",
        amount: order.seller_payout_amount ?? 0,
        reason: body.reason ?? "Manual escrow freeze",
        actorId: user.id,
      }),
      resource_type: "order",
      resource_id: orderId,
      previous_value: { escrow_status: order.escrow_status, payout_status: order.payout_status },
      new_value: { escrow_status: "frozen", payout_status: "frozen" },
      action: "escrow.override",
      actor_id: user.id,
      ip_address: null,
      user_agent: null,
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "open_dispute") {
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: disputeRow, error: disputeError } = await (admin as any).from("dispute_records").insert({
      order_id: orderId,
      user_id: order.buyer_id,
      dispute_type: body.reason ?? "order_dispute",
      status: "open",
      resolution: null,
      updated_at: now,
    }).select("id").single();

    if (disputeError) {
      return NextResponse.json({ error: disputeError.message }, { status: 500 });
    }

    await (admin as any).from("orders").update({
      status: "disputed",
      payout_status: "held",
      escrow_status: "disputed",
      updated_at: now,
    }).eq("id", orderId).eq("seller_id", order.seller_id).eq("buyer_id", order.buyer_id);

    await (admin as any).from("escrow_ledger").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      entry_type: "freeze",
      amount: order.seller_payout_amount ?? 0,
      status: "posted",
      reference_id: buildEscrowLedgerReference(orderId, "freeze", linkedEscrowRows.support_ticket_id, disputeRow?.id ?? null),
      note: body.reason ?? "Manual dispute opened",
      created_by: user.id,
    }, { onConflict: "order_id,entry_type,reference_id" });

    recordEscrowAuditEvent({
      ...buildEscrowAuditPayload({
        orderId,
        transactionId: order.stripe_payment_intent_id ?? order.stripe_checkout_session_id ?? null,
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
        supportTicketId: linkedEscrowRows.support_ticket_id,
        disputeId: disputeRow?.id ?? null,
        action: "freeze",
        amount: order.seller_payout_amount ?? 0,
        reason: body.reason ?? "Manual dispute opened",
        actorId: user.id,
      }),
      resource_type: "order",
      resource_id: orderId,
      previous_value: { escrow_status: order.escrow_status, payout_status: order.payout_status },
      new_value: { escrow_status: "disputed", payout_status: "held" },
      action: "escrow.freeze",
      actor_id: user.id,
      ip_address: null,
      user_agent: null,
    });

    return NextResponse.json({ ok: true, disputeId: disputeRow?.id ?? null });
  }

  return NextResponse.json({ order });
}
