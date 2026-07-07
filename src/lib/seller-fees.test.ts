import { describe, expect, it } from "vitest";
import {
  DEFAULT_SELLER_FEE_CONFIG,
  calculateFeeBreakdown,
  getActiveMarketplaceFeePercent,
  summarizeSellerEarnings,
} from "./seller-fees";

const completedOrder = (overrides: Partial<{ status: string; created_at: string; completed_at: string; quantity: number; unit_price: number; total_amount: number; item_subtotal: number; shipping_amount: number; sales_tax_amount: number; processing_fee_amount: number; marketplace_fee_amount: number; seller_payout_amount: number; platform_revenue_amount: number; payout_status: string }> = {}) => ({
  status: "completed",
  created_at: "2026-07-01T00:00:00.000Z",
  completed_at: "2026-07-01T00:00:00.000Z",
  quantity: 1,
  unit_price: 100,
  total_amount: 100,
  item_subtotal: 100,
  shipping_amount: 0,
  sales_tax_amount: 0,
  processing_fee_amount: 3.2,
  marketplace_fee_amount: 5,
  seller_payout_amount: 91.8,
  platform_revenue_amount: 5,
  payout_status: "pending",
  ...overrides,
});

describe("seller fee rules", () => {
  it("keeps the first 100 sales at 0% marketplace fee", () => {
    const orders = Array.from({ length: 99 }, () => completedOrder());
    const tier = getActiveMarketplaceFeePercent({ lifetimeSales: orders.length, monthlySales: 10, config: DEFAULT_SELLER_FEE_CONFIG });
    expect(tier.feePercent).toBe(0);
    const breakdown = calculateFeeBreakdown({ itemSubtotal: 50, shipping: 0, salesTax: 0, orders });
    expect(breakdown.marketplaceFee).toBe(0);
    expect(breakdown.freeSalesUsed).toBe(99);
  });

  it("switches sale 101 to the standard fee", () => {
    const orders = Array.from({ length: 100 }, () => completedOrder());
    const tier = getActiveMarketplaceFeePercent({ lifetimeSales: orders.length, monthlySales: 10, config: DEFAULT_SELLER_FEE_CONFIG });
    expect(tier.feePercent).toBe(5);
    const breakdown = calculateFeeBreakdown({ itemSubtotal: 100, shipping: 0, salesTax: 0, orders });
    expect(breakdown.marketplaceFee).toBe(5);
    expect(breakdown.sellerPayout).toBe(91.8);
  });

  it("applies power seller discounts by monthly volume", () => {
    const orders = Array.from({ length: 600 }, () => completedOrder({ completed_at: "2026-07-02T00:00:00.000Z" }));
    const tier = getActiveMarketplaceFeePercent({ lifetimeSales: 200, monthlySales: 600, config: DEFAULT_SELLER_FEE_CONFIG });
    expect(tier.feePercent).toBe(4);
    expect(tier.tierName).toContain("500+");
    const breakdown = calculateFeeBreakdown({ itemSubtotal: 100, shipping: 0, salesTax: 0, orders });
    expect(breakdown.marketplaceFee).toBe(4);
  });

  it("summarizes seller earnings correctly", () => {
    const orders = [
      completedOrder({ total_amount: 50, item_subtotal: 50, marketplace_fee_amount: 0, processing_fee_amount: 1.75, seller_payout_amount: 48.25, payout_status: "paid" }),
      completedOrder({ total_amount: 100, item_subtotal: 100, marketplace_fee_amount: 5, processing_fee_amount: 3.2, seller_payout_amount: 91.8, payout_status: "pending" }),
    ];

    const summary = summarizeSellerEarnings({ orders });
    expect(summary.lifetimeSales).toBe(2);
    expect(summary.marketplaceFeesPaid).toBe(5);
    expect(summary.paymentProcessingFees).toBe(4.95);
    expect(summary.netEarnings).toBe(140.05);
    expect(summary.upcomingPayouts).toBe(91.8);
  });
});
