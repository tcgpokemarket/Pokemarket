import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildSellerFeeConfig, calculateFeeBreakdown } from "@/lib/seller-fees";
import { decideEscrowFlow, getDeliveryReleaseAt, calculateFraudRisk } from "@/lib/escrow";
import { getRecommendedShippingOptions, loadShippingRules } from "@/lib/shipping-rules";
import { buildReferralOwnership, getReferralSignupSource, lockReferralOwnership } from "@/lib/referrals";
import type { Json } from "@/lib/supabase/types";

function toWeightOz(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DEFAULT_ESCROW_SIGNAL_BASE = {
  failedPayments: 0,
  chargebacks: 0,
  payoutSpikes: 0,
  rapidAccountAgeHours: 0,
  linkedFraudAccounts: 0,
  vpnProxyHits: 0,
  deviceFingerprintMatches: 0,
  velocityBreaches: 0,
  suspiciousIpEvents: 0,
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listingId, quantity: rawQuantity = 1 } = (await req.json()) as { listingId?: string; quantity?: number };

  if (!listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  const quantity = Math.max(1, Math.floor(rawQuantity));
  if (!Number.isFinite(quantity)) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const listingResult = await supabase
    .from("listings")
    .select("*, profiles:seller_id(*), sellers:seller_id(*)")
    .eq("id", listingId)
    .eq("status", "active")
    .single();

  const buyerProfileResult = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const buyerProfile = buyerProfileResult.data as any;
  const referralSource = getReferralSignupSource(buyerProfile?.raw_user_meta_data ?? null) ?? buyerProfile?.referral_source ?? "manual signup";
  const referralCandidate = lockReferralOwnership([
    buyerProfile?.referral_source_code ? { code: String(buyerProfile.referral_source_code), source: referralSource } : null,
    buyerProfile?.referral_source_user_id ? { userId: String(buyerProfile.referral_source_user_id), source: referralSource } : null,
  ].filter(Boolean) as any);
  const referralSourceUserId = referralCandidate?.userId ?? buyerProfile?.referral_source_user_id ?? null;
  const referralSourceCode = referralCandidate?.code ?? buyerProfile?.referral_source_code ?? null;

  const listing = listingResult.data as any;
  if (listingResult.error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const shippingPaidBy = "buyer";
  const admin = createAdminClient();
  const [sellerOrdersResult, feeSettingsResult, feeTiersResult, feeOverrideResult, shippingRules] = await Promise.all([
    supabase.from("orders").select("*").eq("seller_id", listing.seller_id),
    admin.from("seller_fee_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("seller_fee_tiers").select("*").eq("active", true).order("min_monthly_orders", { ascending: true }),
    admin.from("seller_fee_overrides").select("*").eq("seller_id", listing.seller_id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    loadShippingRules(),
  ]);

  const weightOz = toWeightOz((listing as { weight_oz?: unknown }).weight_oz ?? (listing as { weight?: unknown }).weight ?? listing.quantity);
  const packageType = String((listing as { package_type?: unknown }).package_type ?? (listing.category === "single" ? "card envelope" : listing.category === "sealed" ? "bubble mailer" : "box"));
  const shippingOptions = getRecommendedShippingOptions(weightOz, packageType, shippingRules);
  const preferredShipping = shippingOptions[0] ?? { uspsService: "USPS Ground Advantage", shippingPrice: 0, trackingRequired: true, label: "USPS Ground Advantage" };
  const shipping = preferredShipping.shippingPrice;

  const sellerFeeOrders = ((sellerOrdersResult.data ?? []) as Array<{
    seller_id: string;
    status: string;
    created_at?: string | null;
    completed_at?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    total_amount?: number | null;
    item_subtotal?: number | null;
    shipping_amount?: number | null;
    sales_tax_amount?: number | null;
    processing_fee_amount?: number | null;
    marketplace_fee_amount?: number | null;
    seller_payout_amount?: number | null;
    platform_revenue_amount?: number | null;
    payout_status?: string | null;
  }>).filter((order) => order.seller_id === listing.seller_id);

  const feeConfig = buildSellerFeeConfig({ settings: feeSettingsResult.data, tiers: feeTiersResult.data ?? undefined });
  const feeOverrideRow = feeOverrideResult.data as any;
  const feeOverride = feeOverrideRow
    ? {
        sellerId: feeOverrideRow.seller_id,
        feePercent: feeOverrideRow.fee_percent,
        freeSalesLimit: feeOverrideRow.free_sales_limit,
      }
    : null;

  const itemSubtotal = Number(listing.price) * quantity;
  const salesTax = 0;

  const feeBreakdown = calculateFeeBreakdown({
    itemSubtotal,
    shipping,
    salesTax,
    orders: sellerFeeOrders,
    config: feeConfig,
    override: feeOverride,
  });

  const totalAmount = feeBreakdown.totalDue;
  const escrowSignals = calculateFraudRisk(DEFAULT_ESCROW_SIGNAL_BASE);
  const escrowDecision = decideEscrowFlow({
    wallet: {
      completed_orders_count: sellerFeeOrders.length,
      instant_payout_enabled: false,
      fraud_flag: false,
    },
    signals: DEFAULT_ESCROW_SIGNAL_BASE,
    orderAmount: totalAmount,
  });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-06-24.dahlia" });
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://tcg-poke-market.sintra.site"}/dashboard?order=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://tcg-poke-market.sintra.site"}/listings/${listingId}`,
    line_items: [
      {
        quantity,
        price_data: {
          currency: "usd",
          product_data: {
            name: listing.card_name,
            description: `${listing.set_name}${listing.card_number ? ` · #${listing.card_number}` : ""}`,
          },
          unit_amount: Math.round((itemSubtotal * 100) / quantity),
        },
      },
    ],
    metadata: {
      listingId,
      buyerId: user.id,
      sellerId: listing.seller_id,
      quantity: String(quantity),
      itemSubtotal: feeBreakdown.itemSubtotal.toFixed(2),
      shippingAmount: feeBreakdown.shipping.toFixed(2),
      shippingRateLabel: preferredShipping.label,
      shippingService: preferredShipping.uspsService,
      trackingRequired: String(preferredShipping.trackingRequired),
      shippingPaidBy,
      packageType,
      weightOz: String(weightOz),
      availableShippingOptions: JSON.stringify(shippingOptions),
      salesTaxAmount: feeBreakdown.salesTax.toFixed(2),
      processingFeeAmount: feeBreakdown.paymentProcessingFee.toFixed(2),
      marketplaceFeeAmount: feeBreakdown.marketplaceFee.toFixed(2),
      sellerPayoutAmount: feeBreakdown.sellerPayout.toFixed(2),
      platformRevenueAmount: feeBreakdown.platformRevenue.toFixed(2),
      marketplaceFeePercent: feeBreakdown.marketplaceFeePercent.toFixed(2),
      sellerTierName: feeBreakdown.tierName,
      referralSource,
      referralSourceUserId: referralSourceUserId ?? "",
      referralSourceCode: referralSourceCode ?? "",
      referralCommissionAmount: "0",
      referralCommissionStatus: referralSourceUserId ? "held" : "none",
      escrowStatus: escrowDecision.requiresEscrowHold ? "held" : "released",
      escrowRiskScore: String(escrowSignals.score),
      escrowRiskReason: escrowSignals.reasons.join("; "),
      totalAmount: totalAmount.toFixed(2),
    },
  });

  const heldAt = new Date().toISOString();
  const orderPayload = {
    buyer_id: user.id,
    seller_id: listing.seller_id,
    listing_id: listingId,
    quantity,
    unit_price: Number(listing.price),
    total_amount: totalAmount,
    item_subtotal: feeBreakdown.itemSubtotal,
    shipping_amount: feeBreakdown.shipping,
    shipping_carrier: preferredShipping.uspsService,
    sales_tax_amount: feeBreakdown.salesTax,
    processing_fee_amount: feeBreakdown.paymentProcessingFee,
    marketplace_fee_amount: feeBreakdown.marketplaceFee,
    seller_payout_amount: feeBreakdown.sellerPayout,
    platform_revenue_amount: feeBreakdown.platformRevenue,
    marketplace_fee_percent: feeBreakdown.marketplaceFeePercent,
    seller_tier_name: feeBreakdown.tierName,
    buyer_referral_source: referralSource,
    seller_referral_source: null,
    creator_referral_source: referralSource === "creator/affiliate link" ? referralSource : null,
    referral_commission_amount: 0,
    referral_commission_status: referralSourceUserId ? "held" : "none",
    referral_source_code: referralSourceCode,
    referral_source_user_id: referralSourceUserId,
    referral_attribution_id: referralSourceUserId ? `${user.id}:${referralSourceUserId}:${listingId}` : null,
    total_revenue_generated: feeBreakdown.platformRevenue,
    total_rewards_earned: 0,
    first_transaction_at: heldAt,
    status: escrowDecision.requiresEscrowHold ? "escrow" : "paid",
    stripe_checkout_session_id: checkoutSession.id,
    payout_status: escrowDecision.requiresEscrowHold ? "held" : "released",
    escrow_status: escrowDecision.requiresEscrowHold ? "held" : "released",
    escrow_held_at: heldAt,
    escrow_release_at: getDeliveryReleaseAt(heldAt),
  } as const;

  const { error: orderError } = await supabase.from("orders").insert(orderPayload as any);
  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  return NextResponse.json({ url: checkoutSession.url });
}
