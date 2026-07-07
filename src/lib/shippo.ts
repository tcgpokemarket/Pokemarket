type ShippoRate = {
  object_id: string;
  provider: string;
  servicelevel: { name: string };
  estimated_days?: number | null;
  amount: string;
  currency: string;
};

type ShippoShipment = {
  object_id: string;
  tracking_number?: string | null;
  label_url?: string | null;
  carrier?: string | null;
  rates?: ShippoRate[];
};

const SHIPPO_BASE_URL = "https://api.goshippo.com";

export function isShippoEnabled() {
  return Boolean(process.env.SHIPPO_API_KEY);
}

async function shippoFetch(path: string, init?: RequestInit) {
  if (!process.env.SHIPPO_API_KEY) {
    throw new Error("SHIPPO_API_KEY is not set");
  }

  const response = await fetch(`${SHIPPO_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Shippo request failed: ${response.status}`);
  }

  return response.json();
}

export async function getShippoRates(args: {
  fromAddress: Record<string, string>;
  toAddress: Record<string, string>;
  weight: number;
  length: number;
  width: number;
  height: number;
  packageType: string;
}) {
  const payload = {
    address_from: args.fromAddress,
    address_to: args.toAddress,
    parcels: [
      {
        weight: String(args.weight),
        length: String(args.length),
        width: String(args.width),
        height: String(args.height),
        distance_unit: "in",
        mass_unit: "lb",
      },
    ],
    async: false,
  };

  const result = (await shippoFetch("/shipments/", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as ShippoShipment;

  const rates = (result.rates ?? []).map((rate) => ({
    id: rate.object_id,
    carrier: rate.provider,
    serviceLevel: rate.servicelevel?.name ?? "Standard",
    estimatedDays: rate.estimated_days ?? null,
    amount: Number(rate.amount),
    currency: rate.currency,
  }));

  rates.sort((a, b) => a.amount - b.amount);
  return { shipmentId: result.object_id, rates };
}

export async function createShippoLabel(args: {
  fromAddress: Record<string, string>;
  toAddress: Record<string, string>;
  weight: number;
  length: number;
  width: number;
  height: number;
  packageType: string;
  rateId: string;
}) {
  const shipment = (await shippoFetch("/shipments/", {
    method: "POST",
    body: JSON.stringify({
      address_from: args.fromAddress,
      address_to: args.toAddress,
      parcels: [
        {
          weight: String(args.weight),
          length: String(args.length),
          width: String(args.width),
          height: String(args.height),
          distance_unit: "in",
          mass_unit: "lb",
        },
      ],
      async: false,
    }),
  })) as ShippoShipment;

  const label = (await shippoFetch("/transactions/", {
    method: "POST",
    body: JSON.stringify({
      shipment: shipment.object_id,
      rate: args.rateId,
      label_file_type: "PDF",
      metadata: "TcgPoké Market test label",
    }),
  })) as { object_id: string; label_url?: string | null; tracking_number?: string | null; rate?: { provider: string } };

  return {
    shippoShipmentId: shipment.object_id,
    labelUrl: label.label_url ?? null,
    trackingNumber: label.tracking_number ?? null,
    carrier: label.rate?.provider ?? null,
  };
}
