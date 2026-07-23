import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildUSPSLabelRequest, createUSPSLabel } from "@/lib/usps-labels";

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
  const { data: order, error: lookupError } = await admin.from("orders").select("id, seller_id, tracking_number, shipping_carrier, buyer_address, seller_id").eq("id", orderId).maybeSingle<{ id: string; seller_id: string; tracking_number: string | null; shipping_carrier: string | null; buyer_address: unknown; }>();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const mailClass = String(body.mailClass ?? "USPS_GROUND_ADVANTAGE");
  const sellerAddress = body.sellerAddress ?? null;
  const buyerAddress = order.buyer_address ?? body.buyerAddress ?? null;
  const shipmentRequest = buildUSPSLabelRequest({
    buyerAddress,
    sellerAddress,
    packageWeight: Number(body.packageWeight ?? 1),
    packageLength: body.packageLength ? Number(body.packageLength) : undefined,
    packageWidth: body.packageWidth ? Number(body.packageWidth) : undefined,
    packageHeight: body.packageHeight ? Number(body.packageHeight) : undefined,
    mailClass,
  });

  const label = await createUSPSLabel(shipmentRequest);
  const trackingNumber = label.trackingNumber ?? `USPS-${orderId.slice(0, 8).toUpperCase()}`;
  const carrier = label.carrier === "USPS" ? (mailClass.includes("PRIORITY") ? "USPS Priority Mail" : "USPS Ground Advantage") : label.carrier;

  const { error: updateError } = await (admin.from("orders") as any).update({
    tracking_number: trackingNumber,
    shipping_carrier: carrier,
    status: "shipped",
  }).eq("id", orderId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({
    label: {
      trackingNumber,
      carrier,
      labelUrl: label.labelUrl,
      receiptUrl: label.receiptUrl,
    },
  });
}
