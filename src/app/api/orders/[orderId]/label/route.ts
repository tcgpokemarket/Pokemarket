import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin-access";
import { buildUSPSLabelRequest, createUSPSLabel } from "@/lib/usps-labels";

function parseAddress(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function sellerAddressFromVerification(verification: Record<string, unknown> | null) {
  if (!verification) return null;
  const legalName = String(verification.legal_name ?? "").trim();
  const residentialAddress = String(verification.residential_address ?? "").trim();
  const phoneNumber = String(verification.phone_number ?? "").trim();
  if (!legalName || !residentialAddress || !phoneNumber) return null;

  return {
    firstName: legalName.split(" ")[0] ?? legalName,
    lastName: legalName.split(" ").slice(1).join(" ") || legalName.split(" ")[0] || legalName,
    streetAddress: residentialAddress,
    city: String(verification.city ?? verification.address_city ?? "").trim(),
    state: String(verification.state ?? verification.address_state ?? "").trim(),
    ZIPCode: String(verification.postal_code ?? verification.zip_code ?? verification.zip ?? "").trim(),
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await (admin as any)
    .from("orders")
    .select("*, profiles:buyer_id(*), seller_verifications:seller_id(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const canAct = isAdminUser(user) || order.seller_id === user.id;
  if (!canAct) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    packageWeight?: number;
    packageLength?: number;
    packageWidth?: number;
    packageHeight?: number;
    mailClass?: string;
  };

  const buyerAddress = parseAddress(order.buyer_address);
  const sellerVerification = parseAddress(order.seller_verifications ?? null);
  const sellerAddress = sellerAddressFromVerification(sellerVerification);

  if (!buyerAddress) {
    return NextResponse.json({ error: "Buyer address is missing" }, { status: 400 });
  }

  if (!sellerAddress) {
    return NextResponse.json({ error: "Seller shipping address is missing" }, { status: 400 });
  }

  try {
    const request = buildUSPSLabelRequest({
      buyerAddress,
      sellerAddress,
      packageWeight: body.packageWeight ?? 1,
      packageLength: body.packageLength,
      packageWidth: body.packageWidth,
      packageHeight: body.packageHeight,
      mailClass: body.mailClass ?? "USPS_GROUND_ADVANTAGE",
    });

    const label = await createUSPSLabel(request);
    const now = new Date().toISOString();

    const { error: updateError } = await (admin as any)
      .from("orders")
      .update({
        tracking_number: label.trackingNumber,
        shipping_carrier: label.carrier,
        status: "shipped",
        updated_at: now,
      })
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: shipmentError } = await (admin as any).from("shipments").insert({
      order_id: orderId,
      status: "label_created",
      tracking_number: label.trackingNumber,
      carrier: label.carrier,
    });

    if (shipmentError) {
      return NextResponse.json({ error: shipmentError.message }, { status: 500 });
    }

    return NextResponse.json({ label });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create USPS label" }, { status: 500 });
  }
}
