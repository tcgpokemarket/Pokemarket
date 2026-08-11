import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: wallet, error } = await (supabase.from("customer_wallets") as any)
    .select("user_id,balance,stripe_customer_id,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: ledger, error: ledgerError } = await (supabase.from("customer_wallet_ledger") as any)
    .select("id,entry_type,amount,balance_after,reference_id,description,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 });

  return NextResponse.json({
    wallet: wallet ?? { user_id: user.id, balance: 0, stripe_customer_id: null },
    ledger: ledger ?? [],
  });
}
