import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { buildEscrowLedgerKey, shouldReleaseFromEscrow } from "@/lib/escrow";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: orders, error } = await (admin as any)
    .from("orders")
    .select("*")
    .eq("escrow_status", "held")
    .lte("escrow_release_at", now);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const released: string[] = [];

  for (const order of orders ?? []) {
    if (!shouldReleaseFromEscrow({
      disputeStatus: order.escrow_status === "disputed" ? "open" : null,
      releaseAfterAt: order.escrow_release_at,
      currentStatus: order.status,
      now,
    })) {
      continue;
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
      .eq("id", order.id)
      .eq("escrow_status", "held");

    if (updateError) {
      continue;
    }

    await (admin as any).from("escrow_ledger").upsert({
      order_id: order.id,
      seller_id: order.seller_id,
      entry_type: "release",
      amount: order.seller_payout_amount ?? 0,
      status: "posted",
      reference_id: buildEscrowLedgerKey(order.id, "release", "job"),
      note: "Automated escrow release job",
      created_by: user.id,
    }, { onConflict: "order_id,entry_type,reference_id" });

    released.push(order.id);
  }

  return NextResponse.json({ ok: true, released_count: released.length, released });
}
