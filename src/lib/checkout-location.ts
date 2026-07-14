export type CheckoutLocation = {
  state: string | null;
  country: string | null;
  source: "shipping" | "geo" | "unknown";
};

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

export function resolveCheckoutLocation(input: {
  shippingAddress?: { state?: unknown; country?: unknown } | null;
  geo?: { region?: unknown; country?: unknown } | null;
}): CheckoutLocation {
  const shippingState = normalize(input.shippingAddress?.state);
  const shippingCountry = normalize(input.shippingAddress?.country);
  if (shippingState) {
    return { state: shippingState, country: shippingCountry || "US", source: "shipping" };
  }

  const geoState = normalize(input.geo?.region);
  const geoCountry = normalize(input.geo?.country);
  if (geoState) {
    return { state: geoState, country: geoCountry || "US", source: "geo" };
  }

  return { state: null, country: null, source: "unknown" };
}
