export type PromotionTargetType = "listing" | "auction" | "store" | "event";
export type PromotionTier =
  | "boost_24h"
  | "boost_7d"
  | "spotlight_24h"
  | "spotlight_3d"
  | "spotlight_7d"
  | "store_7d"
  | "store_30d"
  | "event_basic"
  | "event_featured"
  | "event_premium";

export type PromotionPricing = {
  tier: PromotionTier;
  title: string;
  targetType: PromotionTargetType;
  durationHours: number;
  price: number;
  salePricePercent: number | null;
  minimumFee: number | null;
  maximumFee: number | null;
  visibilityRank: number;
  badgeLabel: string | null;
  placementLabel: string | null;
};

const PROMOTION_PRICING: Record<PromotionTier, PromotionPricing> = {
  boost_24h: {
    tier: "boost_24h",
    title: "Featured listing promotion",
    targetType: "listing",
    durationHours: 24,
    price: 0.99,
    salePricePercent: 3,
    minimumFee: 0.99,
    maximumFee: 25,
    visibilityRank: 40,
    badgeLabel: "Featured",
    placementLabel: "Search boost",
  },
  boost_7d: {
    tier: "boost_7d",
    title: "Featured listing promotion",
    targetType: "listing",
    durationHours: 24 * 7,
    price: 0,
    salePricePercent: 5,
    minimumFee: 0.99,
    maximumFee: 25,
    visibilityRank: 55,
    badgeLabel: "Featured",
    placementLabel: "Search boost",
  },
  spotlight_24h: {
    tier: "spotlight_24h",
    title: "Homepage / marketplace spotlight",
    targetType: "store",
    durationHours: 24,
    price: 9.99,
    salePricePercent: null,
    minimumFee: null,
    maximumFee: null,
    visibilityRank: 70,
    badgeLabel: "Spotlight",
    placementLabel: "Homepage placement",
  },
  spotlight_3d: {
    tier: "spotlight_3d",
    title: "Homepage / marketplace spotlight",
    targetType: "store",
    durationHours: 24 * 3,
    price: 24.99,
    salePricePercent: null,
    minimumFee: null,
    maximumFee: null,
    visibilityRank: 80,
    badgeLabel: "Spotlight",
    placementLabel: "Homepage placement",
  },
  spotlight_7d: {
    tier: "spotlight_7d",
    title: "Homepage / marketplace spotlight",
    targetType: "store",
    durationHours: 24 * 7,
    price: 49.99,
    salePricePercent: null,
    minimumFee: null,
    maximumFee: null,
    visibilityRank: 90,
    badgeLabel: "Spotlight",
    placementLabel: "Homepage placement",
  },
  store_7d: {
    tier: "store_7d",
    title: "Seller store promotion",
    targetType: "store",
    durationHours: 24 * 7,
    price: 14.99,
    salePricePercent: null,
    minimumFee: null,
    maximumFee: null,
    visibilityRank: 60,
    badgeLabel: "Promoted store",
    placementLabel: "Seller feed boost",
  },
  store_30d: {
    tier: "store_30d",
    title: "Seller store promotion",
    targetType: "store",
    durationHours: 24 * 30,
    price: 39.99,
    salePricePercent: null,
    minimumFee: null,
    maximumFee: null,
    visibilityRank: 75,
    badgeLabel: "Promoted store",
    placementLabel: "Seller feed boost",
  },
  event_basic: {
    tier: "event_basic",
    title: "Break / event promotion",
    targetType: "event",
    durationHours: 24,
    price: 4.99,
    salePricePercent: null,
    minimumFee: null,
    maximumFee: null,
    visibilityRank: 35,
    badgeLabel: "Event",
    placementLabel: "Event discovery",
  },
  event_featured: {
    tier: "event_featured",
    title: "Break / event promotion",
    targetType: "event",
    durationHours: 24 * 3,
    price: 14.99,
    salePricePercent: null,
    minimumFee: null,
    maximumFee: null,
    visibilityRank: 50,
    badgeLabel: "Featured event",
    placementLabel: "Event discovery",
  },
  event_premium: {
    tier: "event_premium",
    title: "Break / event promotion",
    targetType: "event",
    durationHours: 24 * 7,
    price: 49.99,
    salePricePercent: null,
    minimumFee: null,
    maximumFee: null,
    visibilityRank: 65,
    badgeLabel: "Premium event",
    placementLabel: "Event takeover",
  },
};

export function getPromotionPricing(tier: PromotionTier) {
  return PROMOTION_PRICING[tier];
}

export function listPromotionPricing() {
  return Object.values(PROMOTION_PRICING);
}

export function calculatePromotionCharge(input: {
  tier: PromotionTier;
  saleAmount?: number | null;
}) {
  const pricing = PROMOTION_PRICING[input.tier];
  if (pricing.salePricePercent == null) {
    return pricing.price;
  }

  const saleAmount = Math.max(0, Number(input.saleAmount ?? 0));
  const rawFee = saleAmount * (pricing.salePricePercent / 100);
  const minFee = pricing.minimumFee ?? 0;
  const maxFee = pricing.maximumFee ?? rawFee;
  return Math.min(Math.max(rawFee, minFee), maxFee);
}

export function getPromotionWindow(tier: PromotionTier, startsAt: string) {
  const pricing = PROMOTION_PRICING[tier];
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + pricing.durationHours * 60 * 60 * 1000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
