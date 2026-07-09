export type USPSAddress = {
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  state: string;
  ZIPCode: string;
  ZIPPlus4?: string;
};

export type USPSLabelRequest = {
  toAddress: USPSAddress;
  fromAddress: USPSAddress;
  senderAddress?: USPSAddress;
  returnAddress?: USPSAddress;
  packageDescription: {
    mailClass: string;
    rateIndicator?: string;
    weightUOM: "lb" | "oz";
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    dimensionUOM?: "in" | "cm";
  };
  imageInfo?: {
    labelFormat?: string;
    receiptOption?: string;
  };
};

export type USPSLabelResult = {
  trackingNumber: string | null;
  labelUrl: string | null;
  receiptUrl: string | null;
  carrier: string;
  mailClass: string;
};

const USPS_LABELS_URL = process.env.USPS_LABELS_URL ?? "https://api.private.usps.com/labels/v3/label";
const USPS_PAYMENT_TOKEN = process.env.USPS_PAYMENT_AUTHORIZATION_TOKEN ?? process.env.USPS_PAYMENT_AUTH_TOKEN ?? "";

function normalizeAddress(input: unknown): USPSAddress | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const firstName = String(value.firstName ?? value.first_name ?? "").trim();
  const lastName = String(value.lastName ?? value.last_name ?? "").trim();
  const streetAddress = String(value.streetAddress ?? value.address1 ?? value.address ?? "").trim();
  const city = String(value.city ?? "").trim();
  const state = String(value.state ?? "").trim();
  const ZIPCode = String(value.ZIPCode ?? value.zipCode ?? value.zip ?? value.postalCode ?? "").trim();

  if (!firstName || !lastName || !streetAddress || !city || !state || !ZIPCode) return null;

  return {
    firstName,
    lastName,
    streetAddress,
    city,
    state,
    ZIPCode,
    ZIPPlus4: value.ZIPPlus4 ? String(value.ZIPPlus4).trim() : undefined,
  };
}

export function buildUSPSLabelRequest(input: {
  buyerAddress: unknown;
  sellerAddress: unknown;
  packageWeight: number;
  packageLength?: number;
  packageWidth?: number;
  packageHeight?: number;
  mailClass?: string;
}) {
  const toAddress = normalizeAddress(input.buyerAddress);
  const fromAddress = normalizeAddress(input.sellerAddress);

  if (!toAddress) throw new Error("Buyer shipping address is missing or incomplete");
  if (!fromAddress) throw new Error("Seller shipping address is missing or incomplete");

  return {
    toAddress,
    fromAddress,
    senderAddress: fromAddress,
    returnAddress: fromAddress,
    packageDescription: {
      mailClass: input.mailClass ?? "USPS_GROUND_ADVANTAGE",
      rateIndicator: "SP",
      weightUOM: "lb" as const,
      weight: Math.max(0.1, input.packageWeight),
      length: input.packageLength,
      width: input.packageWidth,
      height: input.packageHeight,
      dimensionUOM: input.packageLength || input.packageWidth || input.packageHeight ? ("in" as const) : undefined,
    },
    imageInfo: {
      labelFormat: "PDF",
      receiptOption: "RECEIPT",
    },
  } satisfies USPSLabelRequest;
}

export async function createUSPSLabel(request: USPSLabelRequest): Promise<USPSLabelResult> {
  if (!USPS_PAYMENT_TOKEN) {
    throw new Error("USPS payment authorization token is not configured");
  }

  const response = await fetch(USPS_LABELS_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-Payment-Authorization-Token": USPS_PAYMENT_TOKEN,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`USPS label request failed: ${response.status} ${message}`);
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
  const metadata = payload.labelMetadata ?? payload.metadata ?? payload.data?.labelMetadata ?? {};
  const trackingNumber = String(metadata.trackingNumber ?? metadata.tracking_number ?? payload.trackingNumber ?? payload.tracking_number ?? "").trim() || null;
  const labelUrl = String(payload.labelUrl ?? payload.label_url ?? payload.labelImageUrl ?? payload.label_image_url ?? "").trim() || null;
  const receiptUrl = String(payload.receiptUrl ?? payload.receipt_url ?? payload.receiptImageUrl ?? payload.receipt_image_url ?? "").trim() || null;

  return {
    trackingNumber,
    labelUrl,
    receiptUrl,
    carrier: "USPS",
    mailClass: String(request.packageDescription.mailClass),
  };
}
