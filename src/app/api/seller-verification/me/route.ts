import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin-access";
import { getSellerVerificationSummary, type SellerVerificationStatus } from "@/lib/seller-verification";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verification = await getSellerVerificationSummary(user.id) as { status?: SellerVerificationStatus | null } | null;
  const adminBypass = isAdminUser(user);
  const status: SellerVerificationStatus = adminBypass ? "approved" : (verification?.status ?? "not_started");

  return NextResponse.json({
    adminBypass,
    status,
    verification: adminBypass ? null : verification,
  });
}
