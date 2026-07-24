import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";
import { bootstrapUserAccount } from "@/lib/auth-bootstrap";
import { calculateFeeBreakdown } from "@/lib/seller-fees";
import { calculateSalesTax } from "@/lib/sales-tax";
import { resolveCheckoutLocation } from "@/lib/checkout-location";
import { calculatePromotionCharge, getPromotionPricing, getPromotionWindow, type PromotionTier } from "@/lib/promotion-tools";
import { buildEscrowLedgerKey } from "@/lib/escrow";
import { queueEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await bootstrapUserAccount({
    userId: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  });

  const body = await request.json().catch(() => ({}));
  const promotionTier = typeof body.promotionTier === "string" ? (body.promotionTier.trim() as PromotionTier) : null;
  const listingId = String(body.listingId ?? "").trim();
  const quantity = Math.max(1, Number(body.quantity ?? 1));
  const admin = createAdminClient();

  if (!listingId && !promotionTier) {
    return NextResponse.json({ error: "Listing or promotion is required." }, { status: 400 });
  }

  if (promotionTier) {
    const pricing = getPromotionPricing(promotionTier);
    const targetId = String(body.targetId ?? "").trim();
    const targetType = String(body.targetType ?? pricing.targetType).trim();
    const title = String(body.title ?? pricing.title).trim();
    const saleAmount = typeof body.saleAmount === "number" ? Number(body.saleAmount) : null;
    const charge = calculatePromotionCharge({ tier: promotionTier, saleAmount });
    const startsAt = new Date().toISOString();
    const window = getPromotionWindow(promotionTier, startsAt);

    if (!targetId) {
      return NextResponse.json({ error: "Promotion target is required." }, { status: 400 });
    }

    const stripe = createStripeClient();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      allow_promotion_codes: false,
      customer_email: user.email ?? undefined,
      success_url: `${request.headers.get("origin") ?? ""}/dashboard?tab=fees&success=1`,
      cancel_url: `${request.headers.get("origin") ?? ""}/dashboard?tab=fees`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(charge * 100),
            product_data: {
              name: title,
              description: `${pricing.placementLabel ?? "Promotion"} · ${promotionTier}`,
            },
          },
        },
      ],
      metadata: {
        promotionTier,
        promotionTargetType: targetType,
        promotionTargetId: targetId,
        promotionTitle: title,
        promotionStartsAt: window.startsAt,
        promotionEndsAt: window.endsAt,
        promotionPrice: charge.toFixed(2),
        promotionBadge: pricing.badgeLabel ?? "Promotion",
        promotionPlacement: pricing.placementLabel ?? "Promotion",
      },
    });

    const { data: promotion, error: promotionError } = await admin.from("promotions").insert({
      seller_id: user.id,
      target_type: targetType as "listing" | "auction" | "store" | "event",
      target_id: targetId,
      tier: promotionTier,
      title,
      status: "pending",
      starts_at: window.startsAt,
      ends_at: window.endsAt,
      price: charge,
      sale_price_percent: pricing.salePricePercent,
      minimum_fee: pricing.minimumFee,
      maximum_fee: pricing.maximumFee,
      visibility_rank: pricing.visibilityRank,
      badge_label: pricing.badgeLabel,
      placement_label: pricing.placementLabel,
      stripe_checkout_session_id: checkoutSession.id,
    }).select("id").single<{ id: string }>();

    if (promotionError) {
      return NextResponse.json({ error: promotionError.message }, { status: 400 });
    }

    await admin.from("promotion_ledger").insert({
      promotion_id: promotion.id,
      seller_id: user.id,
      entry_type: "hold",
      amount: charge,
      status: "pending",
      reference_id: buildEscrowLedgerKey(promotion.id, "hold"),
      note: `Promotion purchase hold for ${promotionTier}`,
    });

    return NextResponse.json({ url: checkoutSession.url, promotionId: promotion.id }, { status: 200 });
  }

  if (!listingId) {
    return NextResponse.json({ error: "Listing is required." }, { status: 400 });
  }

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, seller_id, card_name, set_name, price, quantity, images, status, condition, description")
    .eq("id", listingId)
    .maybeSingle<{
      id: string;
      seller_id: string;
      card_name: string;
      set_name: string;
      price: number;
      quantity: number;
      images: string[] | null;
      status: string;
      condition: string;
      description: string | null;
    }>();

  if (listingError) {
    return NextResponse.json({ error: listingError.message }, { status: 400 });
  }

  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: "You cannot buy your own listing." }, { status: 400 });
  }

  if (listing.status !== "active") {
    return NextResponse.json({ error: "Listing is not available." }, { status: 400 });
  }

  if (listing.quantity < quantity) {
    return NextResponse.json({ error: "Not enough inventory available." }, { status: 400 });
  }

  const itemSubtotal = Number(listing.price) * quantity;
  const shipping = Number(body.shippingAmount ?? 0);
  const shippingService = typeof body.shippingService === "string" ? body.shippingService.trim() : "USPS Ground Advantage";
  const { data: sellerProfile } = await admin.from("profiles").select("seller_state").eq("id", listing.seller_id).maybeSingle<{ seller_state: string | null }>();
  const sellerState = sellerProfile?.seller_state ?? null;
  const checkoutLocation = resolveCheckoutLocation({
    shippingAddress: body.shippingAddress ?? null,
    geo: body.geo ?? null,
  });
  const { tax: salesTax } = calculateSalesTax(itemSubtotal + shipping, {
    sellerState,
    buyerState: checkoutLocation.state,
    buyerCountry: checkoutLocation.country,
  });
  const fees = calculateFeeBreakdown({ itemSubtotal, shipping, salesTax, orders: [] });
  const totalDue = fees.totalDue;
  const totalAmount = fees.totalDue;
  const shippingAmount = shipping;
  const salesTaxAmount = salesTax;
  const paymentProcessingFeeAmount = fees.paymentProcessingFee;
  const marketplaceFeeAmount = fees.marketplaceFee;
  const sellerPayoutAmount = fees.sellerPayout;
  const platformRevenueAmount = fees.platformRevenue;
  const marketplaceFeePercent = fees.marketplaceFeePercent;
  const sellerTierName = fees.tierName;
  const buyerState = checkoutLocation.state ?? "";
  const buyerCountry = checkoutLocation.country ?? "";
  const sellerStateValue = sellerState ?? "";
  const referralSource = typeof body.referralSource === "string" ? body.referralSource : "";
  const referralSourceCode = typeof body.referralSourceCode === "string" ? body.referralSourceCode : "";
  const referralSourceUserId = typeof body.referralSourceUserId === "string" ? body.referralSourceUserId : "";
  const referralCommissionAmount = Number(body.referralCommissionAmount ?? 0);
  const referralCommissionStatus = typeof body.referralCommissionStatus === "string" ? body.referralCommissionStatus : "";

  const stripe = createStripeClient();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    submit_type: "pay",
    allow_promotion_codes: true,
    customer_email: user.email ?? undefined,
    success_url: `${request.headers.get("origin") ?? ""}/dashboard?success=1`,
    cancel_url: `${request.headers.get("origin") ?? ""}/listings/${listing.id}`,
    line_items: [
      {
        quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(totalDue * 100),
          product_data: {
            name: `${listing.card_name} — ${listing.set_name}`,
            description: listing.description ?? undefined,
            images: Array.isArray(listing.images) ? listing.images.filter((image): image is string => typeof image === "string") : undefined,
          },
        },
      },
    ],
    metadata: {
      listing_id: listing.id,
      seller_id: listing.seller_id,
      buyer_id: user.id,
      quantity: String(quantity),
      itemSubtotal: itemSubtotal.toFixed(2),
      shippingAmount: shippingAmount.toFixed(2),
      salesTaxAmount: salesTaxAmount.toFixed(2),
      buyerState,
      buyerCountry,
      sellerState: sellerStateValue,
      paymentProcessingFeeAmount: paymentProcessingFeeAmount.toFixed(2),
      marketplaceFeeAmount: marketplaceFeeAmount.toFixed(2),
      sellerPayoutAmount: sellerPayoutAmount.toFixed(2),
      platformRevenueAmount: platformRevenueAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      marketplaceFeePercent: marketplaceFeePercent.toFixed(2),
      sellerTierName,
      referralSource,
      referralSourceCode,
      referralSourceUserId,
      referralCommissionAmount: referralCommissionAmount.toFixed(2),
      referralCommissionStatus,
      shippingService,
    },
  });

  const orderInsert = {
    buyer_id: user.id,
    seller_id: listing.seller_id,
    listing_id: listing.id,
    quantity,
    unit_price: Number(listing.price),
    total_amount: totalDue,
    item_subtotal: itemSubtotal,
    shipping_amount: shipping,
    sales_tax_amount: salesTax,
    processing_fee_amount: fees.paymentProcessingFee,
    marketplace_fee_amount: fees.marketplaceFee,
    seller_payout_amount: fees.sellerPayout,
    platform_revenue_amount: fees.platformRevenue,
    marketplace_fee_percent: fees.marketplaceFeePercent,
    seller_tier_name: fees.tierName,
    status: "pending" as const,
    stripe_checkout_session_id: checkoutSession.id,
    escrow_status: "held" as const,
    escrow_held_at: new Date().toISOString(),
  };

  const { data: order, error: orderError } = await admin.from("orders").insert(orderInsert as never).select("id").single<{ id: string }>();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 400 });
  }

  return NextResponse.json({ url: checkoutSession.url, orderId: order?.id ?? null }, { status: 200 });
}
