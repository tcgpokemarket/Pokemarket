import { createAdminClient } from "@/lib/supabase/admin";

export type ShippingRule = {
  id: string;
  weight_min: number;
  weight_max: number | null;
  package_type: string;
  usps_service: string;
  shipping_price: number;
  tracking_required: boolean;
  active_status: boolean;
};

export type RecommendedShippingOption = {
  uspsService: string;
  shippingPrice: number;
  trackingRequired: boolean;
  label: string;
};

const FALLBACK_RULES: ShippingRule[] = [
  { id: "fallback-pwe", weight_min: 0, weight_max: 3, package_type: "card envelope", usps_service: "PWE", shipping_price: 0.89, tracking_required: false, active_status: true },
  { id: "fallback-ground-light", weight_min: 0, weight_max: 3, package_type: "card envelope", usps_service: "USPS Ground Advantage", shipping_price: 4.25, tracking_required: true, active_status: true },
  { id: "fallback-ground", weight_min: 4, weight_max: 16, package_type: "bubble mailer", usps_service: "USPS Ground Advantage", shipping_price: 5.75, tracking_required: true, active_status: true },
  { id: "fallback-priority", weight_min: 4, weight_max: null, package_type: "bubble mailer", usps_service: "Priority Mail", shipping_price: 8.95, tracking_required: true, active_status: true },
  { id: "fallback-flat-rate", weight_min: 16, weight_max: null, package_type: "box", usps_service: "Priority Mail Flat Rate", shipping_price: 10.15, tracking_required: true, active_status: true },
];

function matchesPackageType(ruleType: string, packageType: string) {
  if (ruleType === "any") return true;
  return ruleType.toLowerCase() === packageType.toLowerCase();
}

export function getRecommendedShippingOptions(weightOz: number, packageType: string, rules: ShippingRule[] = FALLBACK_RULES): RecommendedShippingOption[] {
  const normalizedWeight = Math.max(0, Number(weightOz) || 0);
  const normalizedPackage = packageType.trim().toLowerCase();

  return rules
    .filter((rule) => rule.active_status)
    .filter((rule) => normalizedWeight >= rule.weight_min)
    .filter((rule) => rule.weight_max === null || normalizedWeight <= rule.weight_max)
    .filter((rule) => matchesPackageType(rule.package_type, normalizedPackage) || rule.package_type.toLowerCase() === "any")
    .map((rule) => ({
      uspsService: rule.usps_service,
      shippingPrice: Number(rule.shipping_price) || 0,
      trackingRequired: Boolean(rule.tracking_required),
      label: `${rule.usps_service} · $${Number(rule.shipping_price).toFixed(2)}`,
    }))
    .sort((a, b) => a.shippingPrice - b.shippingPrice);
}

export async function loadShippingRules() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("shipping_rules").select("*").eq("active_status", true).order("weight_min", { ascending: true });
  if (error) return FALLBACK_RULES;
  return (data ?? []) as ShippingRule[];
}
