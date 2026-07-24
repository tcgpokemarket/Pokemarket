import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticatedUser } from "@/lib/auth-guards";
import { recordAuditEvent, recordSecurityEvent } from "@/lib/audit-log";
import { canUseInstantPayout, getPayoutTier } from "@/lib/payouts";
import { isEscrowBlockingPayout, shouldReleaseFromEscrow } from "@/lib/escrow";

export const dynamic = "force-dynamic";

function toNumber(value: number | string | null | undefined) {
  return Number(Number(value ?? 0).toFixed(2));
}

export async function POST(request: NextRequest): Promise<NextResponse<{ ok: true; payout_status: string } | { error: string }>> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !isAuthenticatedUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { seller_id?: string };
  try {
    body = (await request.json()) as { seller_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.seller_id || body.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: wallet, error: walletError } = await (admin as any)
    .from("seller_wallets")
    .select("*")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (walletError || !wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  const canInstant = canUseInstantPayout(wallet);
  const availableBalance = toNumber(wallet.available_balance);
  const pendingBalance = toNumber(wallet.pending_balance);
  const frozenBalance = toNumber(wallet.frozen_balance);

  if (frozenBalance > 0 || wallet.fraud_flag || wallet.manual_review_required) {
    recordSecurityEvent({
      event_type: "payout.request.blocked",
      severity: "high",
      actor_id: user.id,
      details: { reason: "wallet_frozen", availableBalance, pendingBalance, frozenBalance },
    });
    return NextResponse.json({ error: "Payouts are currently on hold for review." }, { status: 409 });
  }

  if (availableBalance <= 0) {
    return NextResponse.json({ error: "No available balance to pay out." }, { status: 409 });
  }

  const { data: recentOrders, error: ordersError } = await (admin as any)
    .from("orders")
    .select("id, payout_status, escrow_status, escrow_release_at, dispute_status, seller_payout_amount, total_amount, marketplace_fee_amount, processing_fee_amount, status, delivered_at")
    .eq("seller_id", user.id)
    .in("payout_status", ["pending", "held", "released", "paid", "failed", "frozen"])
    .order("updated_at", { ascending: false })
    .limit(50);

  if (ordersError) {
    return NextResponse.json({ error: "Unable to inspect payout state." }, { status: 500 });
  }

  const blockedOrder = (recentOrders ?? []).find((order: any) => {
    const releaseReady = shouldReleaseFromEscrow({
      disputeStatus: order.dispute_status ?? null,
      releaseAfterAt: order.escrow_release_at ?? null,
      currentStatus: order.escrow_status ?? order.payout_status ?? order.status ?? null,
    });

    return isEscrowBlockingPayout(order.payout_status ?? order.escrow_status ?? order.status ?? null) || !releaseReady;
  });

  if (blockedOrder) {
    return NextResponse.json({ error: "Some funds are still held in escrow or under dispute." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const payoutAmount = canInstant ? availableBalance : Math.max(availableBalance - frozenBalance, 0);
  const payoutStatus = canInstant ? "processing" : "pending";

  const { error: updateError } = await (admin as any)
    .from("seller_wallets")
    .update({
      available_balance: Math.max(availableBalance - payoutAmount, 0),
      pending_balance: pendingBalance,
      next_payout_at: canInstant ? now : wallet.next_payout_at,
      updated_at: now,
    })
    .eq("seller_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to queue payout." }, { status: 500 });
  }

  await (admin as any).from("notifications").insert({
    user_id: user.id,
    type: canInstant ? "payout_requested" : "payout_queued",
    related_user: user.id,
    related_content: {
      seller_id: user.id,
      payout_amount: payoutAmount,
      payout_status: payoutStatus,
      payout_tier: getPayoutTier(wallet.completed_orders_count ?? 0),
    },
    read_status: false,
  });

  recordAuditEvent({
    event_type: "finance.action",
    actor_id: user.id,
    action: canInstant ? "payout.request_instant" : "payout.queue_standard",
    resource_type: "seller_wallets",
    resource_id: user.id,
    previous_value: { available_balance: availableBalance, pending_balance: pendingBalance, next_payout_at: wallet.next_payout_at ?? null },
    new_value: { available_balance: Math.max(availableBalance - payoutAmount, 0), pending_balance: pendingBalance, next_payout_at: canInstant ? now : wallet.next_payout_at ?? null },
    ip_address: null,
    user_agent: null,
  });

  return NextResponse.json({ ok: true, payout_status: payoutStatus });
}
