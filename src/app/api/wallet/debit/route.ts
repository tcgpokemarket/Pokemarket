import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const referenceId = typeof body.referenceId === "string" ? body.referenceId.slice(0, 200) : null;
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 200) : "";
  if (!Number.isFinite(amount) || amount <= 0 || !idempotencyKey) return NextResponse.json({ error: "Valid amount and idempotencyKey are required." }, { status: 400 });

  const admin = createAdminClient() as any;
  const { data: balance, error } = await admin.rpc("wallet_debit", {
    p_user_id: user.id,
    p_amount: Math.round(amount * 100) / 100,
    p_idempotency_key: idempotencyKey,
    p_reference_id: referenceId,
    p_description: typeof body.description === "string" ? body.description.slice(0, 300) : "Wallet purchase",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("insufficient") ? 409 : 500 });
  return NextResponse.json({ balance: Number(balance) });
}
