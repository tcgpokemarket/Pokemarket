import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const admin = createAdminClient();
  const { data: order, error: lookupError } = await admin.from("orders").select("id, seller_id, tracking_number").eq("id", orderId).maybeSingle<{ id: string; seller_id: string; tracking_number: string | null }>();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const trackingNumber = `USPS-${orderId.slice(0, 8).toUpperCase()}`;
  const carrier = String(body.mailClass ?? "USPS_GROUND_ADVANTAGE").includes("PRIORITY") ? "USPS Priority Mail" : "USPS Ground Advantage";

  const orderUpdate = {
    tracking_number: order.tracking_number ?? trackingNumber,
    shipping_carrier: carrier,
    status: "shipped",
  } as any;

  const { error: updateError } = await (admin.from("orders") as any).update(orderUpdate).eq("id", orderId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({
    label: {
      trackingNumber: order.tracking_number ?? trackingNumber,
      carrier,
    },
  });
}
