"use client";

import { useMemo } from "react";
import { buildSellerFeeConfig, calculateFeeBreakdown } from "@/lib/seller-fees";
import type { Order } from "@/lib/supabase/types";

export default function FeeSummary({ listingPrice, sellerOrders, shippingPaidBy = "buyer" }: { listingPrice: number; sellerOrders: Order[]; shippingPaidBy?: "buyer" | "seller" }) {
  const feeConfig = useMemo(() => buildSellerFeeConfig({}), []);
  const shipping = shippingPaidBy === "seller" ? 0 : 0;
  const shippingLabel = "USPS shipping";
  const shippingNote = shippingPaidBy === "seller" ? "Seller covered" : "Buyer paid";

  const summary = calculateFeeBreakdown({
    itemSubtotal: listingPrice,
    shipping,
    salesTax: 0,
    orders: sellerOrders,
    config: feeConfig,
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Checkout breakdown</div>
      <div className="mt-4 space-y-2 text-sm">
        {[
          ["Item subtotal", `$${summary.itemSubtotal.toFixed(2)}`],
          ["Shipping", `${shipping > 0 ? `$${summary.shipping.toFixed(2)}` : "$0.00"} · ${shippingLabel} (${shippingNote})`],
          ["Sales tax", `$${summary.salesTax.toFixed(2)}`],
          ["Payment processing fee", `$${summary.paymentProcessingFee.toFixed(2)}`],
          ["Marketplace fee", `$${summary.marketplaceFee.toFixed(2)}`],
          ["Seller payout", `$${summary.sellerPayout.toFixed(2)}`],
        ].map(([label, value]) => (
          <div key={label as string} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3">
            <span className="text-gray-400">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Marketplace fee: {summary.tierName} · {summary.freeSalesUsed} of {feeConfig.freeSalesLimit} free sales used
      </p>
    </div>
  );
}
