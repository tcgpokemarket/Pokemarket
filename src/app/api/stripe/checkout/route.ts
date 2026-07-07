import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildSellerFeeConfig, calculateFeeBreakdown } from "@/lib/seller-fees";
import { DEFAULT_DESTINATION_COUNTRY, getEasyshipRates } from "@/lib/easyship";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listingId, quantity = 1, shippingPaidBy: shippingPaidByInput, shippingRateIndex = 0 } = (await req.json()) as { listingId?: string; quantity?: number; shippingPaidBy?: "buyer" | "seller"; shippingRateIndex?: number };

  if (!listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  const listingResult = await supabase
    .from("listings")
    .select("*, profiles:seller_id(*)")
    .eq("id", listingId)
    .eq("status", "active")
    .single();

  const listing = listingResult.data as any;

  if (listingResult.error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const shippingPaidBy = shippingPaidByInput ?? listing.shipping_paid_by ?? "buyer";

  const admin = createAdminClient();
  const [sellerOrdersResult, feeSettingsResult, feeTiersResult, feeOverrideResult] = await Promise.all([
    supabase.from("orders").select("*").eq("seller_id", listing.seller_id),
    admin.from("seller_fee_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("seller_fee_tiers").select("*").eq("active", true).order("min_monthly_orders", { ascending: true }),
    admin.from("seller_fee_overrides").select("*").eq("seller_id", listing.seller_id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const sellerFeeOrders = ((sellerOrdersResult.data ?? []) as Array<{ seller_id: string; status: string; created_at?: string | null; completed_at?: string | null; quantity?: number | null; unit_price?: number | null; total_amount?: number | null; item_subtotal?: number | null; shipping_amount?: number | null; sales_tax_amount?: number | null; processing_fee_amount?: number | null; marketplace_fee_amount?: number | null; seller_payout_amount?: number | null; platform_revenue_amount?: number | null; payout_status?: string | null }>).filter((order) => order.seller_id === listing.seller_id);
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

  let shipping = 0;
  let shippingRateLabel = "Standard shipping";
  try {
    const shippingRates = await getEasyshipRates(DEFAULT_DESTINATION_COUNTRY);
    const selectedRate = shippingRates.rates?.[Math.max(0, Math.min(shippingRateIndex, (shippingRates.rates?.length ?? 1) - 1))] ?? shippingRates.cheapestRate;
    shipping = shippingPaidBy === "seller" ? 0 : selectedRate?.total_charge ?? 0;
    shippingRateLabel = selectedRate
      ? `${selectedRate.courier_name} · ${selectedRate.courier_service_name}`
      : shippingRateLabel;
  } catch {
    shipping = 0;
  }

  const feeBreakdown = calculateFeeBreakdown({
    itemSubtotal,
    shipping,
    salesTax,
    orders: sellerFeeOrders,
    config: feeConfig,
    override: feeOverride,
  });

  const totalAmount = feeBreakdown.totalDue;
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
          unit_amount: Math.round(itemSubtotal * 100 / quantity),
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
      shippingRateLabel,
      shippingPaidBy,
      salesTaxAmount: feeBreakdown.salesTax.toFixed(2),
      processingFeeAmount: feeBreakdown.paymentProcessingFee.toFixed(2),
      marketplaceFeeAmount: feeBreakdown.marketplaceFee.toFixed(2),
      sellerPayoutAmount: feeBreakdown.sellerPayout.toFixed(2),
      platformRevenueAmount: feeBreakdown.platformRevenue.toFixed(2),
      marketplaceFeePercent: feeBreakdown.marketplaceFeePercent.toFixed(2),
      sellerTierName: feeBreakdown.tierName,
      totalAmount: totalAmount.toFixed(2),
    },
  });

  const orderPayload = {
    buyer_id: user.id,
    seller_id: listing.seller_id,
    listing_id: listingId,
    quantity,
    unit_price: Number(listing.price),
    total_amount: totalAmount,
    item_subtotal: feeBreakdown.itemSubtotal,
    shipping_amount: feeBreakdown.shipping,
    sales_tax_amount: feeBreakdown.salesTax,
    processing_fee_amount: feeBreakdown.paymentProcessingFee,
    marketplace_fee_amount: feeBreakdown.marketplaceFee,
    seller_payout_amount: feeBreakdown.sellerPayout,
    platform_revenue_amount: feeBreakdown.platformRevenue,
    marketplace_fee_percent: feeBreakdown.marketplaceFeePercent,
    seller_tier_name: feeBreakdown.tierName,
    status: "pending",
    stripe_checkout_session_id: checkoutSession.id,
    payout_status: "pending",
  } as const;

  const { error: orderError } = await supabase.from("orders").insert(orderPayload as any);

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  return NextResponse.json({ url: checkoutSession.url });
}
