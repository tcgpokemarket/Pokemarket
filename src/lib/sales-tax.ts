const TAX_RATES: Record<string, number> = {
  AL: 0.04,
  AK: 0,
  AZ: 0.056,
  AR: 0.065,
  CA: 0.0725,
  CO: 0.029,
  CT: 0.0635,
  DE: 0,
  FL: 0.06,
  GA: 0.04,
  HI: 0.04,
  ID: 0.06,
  IL: 0.0625,
  IN: 0.07,
  IA: 0.06,
  KS: 0.065,
  KY: 0.06,
  LA: 0.0445,
  ME: 0.055,
  MD: 0.06,
  MA: 0.0625,
  MI: 0.06,
  MN: 0.06875,
  MS: 0.07,
  MO: 0.04225,
  MT: 0,
  NE: 0.055,
  NV: 0.0685,
  NH: 0,
  NJ: 0.06625,
  NM: 0.05125,
  NY: 0.04,
  NC: 0.0475,
  ND: 0.05,
  OH: 0.0575,
  OK: 0.045,
  OR: 0,
  PA: 0.06,
  RI: 0.07,
  SC: 0.06,
  SD: 0.045,
  TN: 0.07,
  TX: 0.0625,
  UT: 0.047,
  VT: 0.06,
  VA: 0.053,
  WA: 0.065,
  WV: 0.06,
  WI: 0.05,
  WY: 0.04,
};

function normalizeState(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

export function getSalesTaxRate(args: { sellerState?: string | null; buyerState?: string | null; buyerCountry?: string | null }) {
  const sellerState = normalizeState(args.sellerState);
  const buyerState = normalizeState(args.buyerState);
  const buyerCountry = String(args.buyerCountry ?? "US").trim().toUpperCase();

  if (!sellerState || !buyerState || buyerCountry !== "US") {
    return { rate: 0, reason: "no-tax" as const };
  }

  if (sellerState !== buyerState) {
    return { rate: 0, reason: "cross-state" as const };
  }

  return { rate: TAX_RATES[sellerState] ?? 0, reason: "same-state" as const };
}

export function calculateSalesTax(amount: number, args: { sellerState?: string | null; buyerState?: string | null; buyerCountry?: string | null }) {
  const { rate, reason } = getSalesTaxRate(args);
  return { tax: Math.round(amount * rate * 100) / 100, rate, reason };
}
