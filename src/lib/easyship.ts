export type EasyshipRate = {
  courier_name: string;
  courier_service_name: string;
  total_charge: number;
  currency: string;
  delivery_time_min?: number | null;
  delivery_time_max?: number | null;
  courier_logo_url?: string | null;
};

export type EasyshipRatesResponse = {
  rates: EasyshipRate[];
  cheapestRate: EasyshipRate | null;
};

export type EasyshipQuoteSelection = {
  courier_name: string;
  courier_service_name: string;
  total_charge: number;
  currency: string;
};

type EasyshipRatesPayload = {
  rates?: any[];
  data?: any[];
};

export function getSelectedRate(rates: EasyshipRate[], label?: string | null) {
  if (!label) return rates[0] ?? null;
  return rates.find((rate) => `${rate.courier_name} · ${rate.courier_service_name}` === label) ?? rates[0] ?? null;
}

const EASYSHIP_RATES_URL = "https://public-api.easyship.com/2024-09/rates";
const DEFAULT_DESTINATION_COUNTRY = "US";
const FALLBACK_RATES: EasyshipRate[] = [
  { courier_name: "Standard Mail", courier_service_name: "Economy", total_charge: 4.99, currency: "USD", delivery_time_min: 3, delivery_time_max: 7 },
  { courier_name: "Tracked Parcel", courier_service_name: "Priority", total_charge: 8.99, currency: "USD", delivery_time_min: 2, delivery_time_max: 4 },
  { courier_name: "Express", courier_service_name: "Overnight", total_charge: 19.99, currency: "USD", delivery_time_min: 1, delivery_time_max: 2 },
];

function normalizeRate(rate: any): EasyshipRate | null {
  const totalCharge = Number(rate.total_charge ?? rate.total_charge_amount ?? rate.shipping_fee ?? rate.total ?? 0);
  if (!Number.isFinite(totalCharge) || totalCharge <= 0) return null;

  return {
    courier_name: String(rate.courier_name ?? rate.courier_code ?? rate.courier?.name ?? "Shipping"),
    courier_service_name: String(rate.courier_service_name ?? rate.service_name ?? rate.shipping_method_name ?? "Standard"),
    total_charge: totalCharge,
    currency: String(rate.currency ?? rate.total_charge_currency ?? "USD").toUpperCase(),
    delivery_time_min: rate.delivery_time_min ?? rate.min_delivery_time ?? null,
    delivery_time_max: rate.delivery_time_max ?? rate.max_delivery_time ?? null,
    courier_logo_url: rate.courier_logo_url ?? rate.logo_url ?? null,
  };
}

function formatPayload(destinationCountry: string) {
  return {
    destination_address: {
      country_alpha2: destinationCountry || DEFAULT_DESTINATION_COUNTRY,
    },
    incoterms: "DDU",
    insurance: {
      is_insured: false,
    },
    courier_settings: {
      show_courier_logo_url: false,
      apply_shipping_rules: true,
    },
    shipping_settings: {
      units: {
        weight: "kg",
        dimensions: "cm",
      },
    },
    parcels: [
      {
        items: [],
      },
    ],
    calculate_tax_and_duties: true,
  };
}

export async function getEasyshipRates(destinationCountry = DEFAULT_DESTINATION_COUNTRY): Promise<EasyshipRatesResponse> {
  const apiKey = process.env.EASYSHIP_API_KEY;

  if (!apiKey) {
    return {
      rates: FALLBACK_RATES,
      cheapestRate: FALLBACK_RATES[0] ?? null,
    };
  }

  const response = await fetch(EASYSHIP_RATES_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(formatPayload(destinationCountry.toUpperCase())),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Easyship rates request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { rates?: any[]; data?: any[] };
  const rates = [...(data.rates ?? data.data ?? [])]
    .map(normalizeRate)
    .filter((rate): rate is EasyshipRate => Boolean(rate))
    .sort((a, b) => a.total_charge - b.total_charge);

  return {
    rates,
    cheapestRate: rates[0] ?? null,
  };
}

export { DEFAULT_DESTINATION_COUNTRY };
