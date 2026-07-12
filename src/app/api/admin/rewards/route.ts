import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { adjustRewardsBalance, getRewardsSnapshot } from "@/lib/rewards";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: accounts } = await admin.from("rewards_accounts").select("*").order("updated_at", { ascending: false }).limit(100);
  return NextResponse.json({ accounts: accounts ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { userId?: string; points?: number; note?: string } | null;
  if (!body?.userId || !Number.isFinite(Number(body.points))) {
    return NextResponse.json({ error: "Missing reward details" }, { status: 400 });
  }

  const ledger = await adjustRewardsBalance({
    userId: body.userId,
    points: Math.trunc(Number(body.points)),
    entryType: "admin_bonus",
    createdBy: user.id,
    metadata: { note: body.note ?? "Admin reward adjustment" },
  });

  const snapshot = await getRewardsSnapshot(body.userId);
  return NextResponse.json({ ledger, snapshot });
}
