import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { buildEscrowLedgerKey, shouldReleaseFromEscrow } from "@/lib/escrow";

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
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("escrow_ledger").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      entry_type: "release",
      amount: order.seller_payout_amount ?? 0,
      status: "posted",
      reference_id: buildEscrowLedgerKey(orderId, "release"),
      note: body.reason ?? "Manual escrow release",
      created_by: user.id,
    }, { onConflict: "order_id,entry_type,reference_id" });

    return NextResponse.json({ ok: true });
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
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await (admin as any).from("escrow_ledger").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      entry_type: "freeze",
      amount: order.seller_payout_amount ?? 0,
      status: "posted",
      reference_id: buildEscrowLedgerKey(orderId, "freeze"),
      note: body.reason ?? "Manual escrow freeze",
      created_by: user.id,
    }, { onConflict: "order_id,entry_type,reference_id" });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "open_dispute") {
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: disputeError } = await (admin as any).from("escrow_disputes").upsert({
      order_id: orderId,
      seller_id: order.seller_id,
      buyer_id: order.buyer_id,
      reason: body.reason ?? "Manual dispute opened",
      status: "open",
      created_by: user.id,
      updated_at: now,
    }, { onConflict: "order_id" });

    if (disputeError) {
      return NextResponse.json({ error: disputeError.message }, { status: 500 });
    }

    await (admin as any).from("orders").update({
      status: "disputed",
      payout_status: "frozen",
      escrow_status: "disputed",
      updated_at: now,
    }).eq("id", orderId);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ order });
}
