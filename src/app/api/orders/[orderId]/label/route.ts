import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin-access";
import { buildUSPSLabelRequest, createUSPSLabel } from "@/lib/usps-labels";

function parseAddress(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function splitSellerName(legalName: string) {
  const parts = legalName.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return {
    firstName: parts[0] ?? legalName,
    lastName: parts.slice(1).join(" ") || parts[0] || legalName,
  };
}

function parseResidentialAddress(residentialAddress: string) {
  const lines = residentialAddress.split(/\n|,/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const lastLine = lines[lines.length - 1] ?? "";
  const match = lastLine.match(/^(.+?)\s*,?\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (!match) return null;

  return {
    streetAddress: lines.slice(0, -1).join(", "),
    city: match[1].trim(),
    state: match[2].trim().toUpperCase(),
    ZIPCode: match[3].trim(),
  };
}

function sellerAddressFromVerification(verification: Record<string, unknown> | null) {
  if (!verification) return null;
  const legalName = String(verification.legal_name ?? "").trim();
  const residentialAddress = String(verification.residential_address ?? "").trim();
  if (!legalName || !residentialAddress) return null;

  const name = splitSellerName(legalName);
  const address = parseResidentialAddress(residentialAddress);
  if (!name || !address) return null;

  return {
    ...name,
    ...address,
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
