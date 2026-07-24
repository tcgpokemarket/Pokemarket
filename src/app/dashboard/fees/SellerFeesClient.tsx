"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildSellerFeeConfig, calculateFeeBreakdown, formatPercent } from "@/lib/seller-fees";

type FeePayload = {
  settings?: {
    free_sales_limit?: number;
    standard_marketplace_fee_percent?: number;
    processing_fee_percent?: number;
    processing_fee_fixed?: number;
  } | null;
  tiers?: Array<{
    id?: string;
    name: string;
    min_monthly_orders: number;
    fee_percent: number;
    active?: boolean;
  }>;
};

const defaultConfig = {
  freeSalesLimit: 100,
  standardMarketplaceFeePercent: 8.5,
  processingFeePercent: 2.9,
  processingFeeFixed: 0.3,
  powerSeller500: 7.5,
  powerSeller2000: 6.5,
};

function normalizeFeeSettings(payload: FeePayload) {
  return buildSellerFeeConfig({
    settings: payload.settings,
    tiers: payload.tiers?.map((tier) => ({
      id: tier.id,
      name: tier.name,
      min_monthly_orders: tier.min_monthly_orders,
      fee_percent: tier.fee_percent,
      active: tier.active,
    })),
  });
}

function FeeRow({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-6">
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
        <div className="text-sm font-bold text-yellow-400 md:text-right">{value}</div>
      </div>
    </div>
  );
}

export default function SellerFeesClient() {
  const [config, setConfig] = useState(defaultConfig);
  const [overrideFee, setOverrideFee] = useState("");
  const [overrideFreeSales, setOverrideFreeSales] = useState("");
  const [exampleSales, setExampleSales] = useState(104);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/admin/fees");
        const payload = (await response.json()) as FeePayload & { error?: string };

        if (!active) return;

        if (!response.ok) {
          setStatus("error");
          setMessage(payload.error ?? "Unable to load fee settings.");
          return;
        }

        const nextConfig = normalizeFeeSettings(payload);
        setConfig({
          freeSalesLimit: nextConfig.freeSalesLimit,
          standardMarketplaceFeePercent: nextConfig.standardMarketplaceFeePercent,
          processingFeePercent: nextConfig.processingFeePercent,
          processingFeeFixed: nextConfig.processingFeeFixed,
          powerSeller500: nextConfig.powerSellerTiers[0]?.feePercent ?? defaultConfig.powerSeller500,
          powerSeller2000: nextConfig.powerSellerTiers[1]?.feePercent ?? defaultConfig.powerSeller2000,
        });
        setStatus("idle");
        setMessage("Live fee settings loaded.");
      } catch {
        if (!active) return;
        setStatus("error");
        setMessage("Unable to load admin fee settings.");
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const preview = useMemo(() => {
    const completedOrders = Array.from({ length: exampleSales }, (_, index) => ({
      status: "completed",
      completed_at: new Date(2026, 6, Math.min(28, index + 1)).toISOString(),
    }));

    return calculateFeeBreakdown({
      itemSubtotal: 100,
      shipping: 0,
      salesTax: 0,
      orders: completedOrders,
      config: {
        freeSalesLimit: config.freeSalesLimit,
        standardMarketplaceFeePercent: config.standardMarketplaceFeePercent,
        processingFeePercent: config.processingFeePercent,
        processingFeeFixed: config.processingFeeFixed,
        powerSellerTiers: [
          { id: "power-500", name: "High-Volume Seller", minMonthlyOrders: 500, feePercent: config.powerSeller500, active: true },
          { id: "power-2000", name: "Elite Seller", minMonthlyOrders: 2000, feePercent: config.powerSeller2000, active: true },
        ],
      },
      override: {
        sellerId: "preview-seller",
        feePercent: overrideFee === "" ? null : Number(overrideFee),
        freeSalesLimit: overrideFreeSales === "" ? null : Number(overrideFreeSales),
      },
    });
  }, [config, exampleSales, overrideFee, overrideFreeSales]);

  const configJson = useMemo(() => {
    return JSON.stringify(
      {
        sellerFees: {
          first100Sales: "0% marketplace fee",
          after100Sales: `${config.standardMarketplaceFeePercent}% marketplace fee`,
          highVolumeSellerRate: `${config.powerSeller500}% / ${config.powerSeller2000}% approval-based reduced rates`,
        },
        paymentProcessing: {
          percent: config.processingFeePercent,
          fixed: config.processingFeeFixed,
        },
        buyerProtectionFee: {
          percent: 2.5,
          cap: "Admin-controlled cap",
        },
        instantPayout: {
          standard: "Free after escrow/order requirements are met",
          instant: "2% fee",
        },
        optionalPromotionFees: ["Featured listings", "Auction promotion", "Homepage/store placement"],
      },
      null,
      2,
    );
  }, [config.powerSeller2000, config.powerSeller500, config.processingFeeFixed, config.processingFeePercent, config.standardMarketplaceFeePercent]);

  const handleSave = async () => {
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/admin/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          free_sales_limit: config.freeSalesLimit,
          standard_marketplace_fee_percent: config.standardMarketplaceFeePercent,
          processing_fee_percent: config.processingFeePercent,
          processing_fee_fixed: config.processingFeeFixed,
        },
        tiers: [
          { name: "High-Volume Seller", min_monthly_orders: 500, fee_percent: config.powerSeller500, active: true },
          { name: "Elite Seller", min_monthly_orders: 2000, fee_percent: config.powerSeller2000, active: true },
        ],
        override: overrideFee !== "" || overrideFreeSales !== "" ? {
          seller_id: "preview-seller",
          fee_percent: overrideFee === "" ? null : Number(overrideFee),
          free_sales_limit: overrideFreeSales === "" ? null : Number(overrideFreeSales),
          reason: "Seller preview override",
        } : null,
      }),
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setStatus("error");
      setMessage(data.error ?? "Unable to save fee settings.");
      return;
    }

    setStatus("saved");
    setMessage("Live fee settings saved.");
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Seller dashboard</div>
            <h1 className="text-3xl font-black md:text-4xl">Marketplace fee breakdown</h1>
            <p className="mt-3 max-w-3xl text-gray-400">A clear, seller-friendly fee structure with transparent payment processing, buyer protection, instant payout options, and optional promotions.</p>
          </div>
          <Link href="/dashboard" className="inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5">Back to dashboard</Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/10 via-white/5 to-transparent p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Seller fees</div>
              <div className="mt-3 grid gap-3">
                <FeeRow label="First 100 completed sales" value="0% marketplace fee" description="New sellers keep every sale in their first 100 completed transactions." />
                <FeeRow label="After first 100 sales" value={`${formatPercent(config.standardMarketplaceFeePercent)}`} description="A competitive marketplace fee applies after the free starter volume is used." />
                <FeeRow label="High-volume sellers" value="Admin-approved reduced rate" description={`Optional reduced pricing can be approved by admin for qualified high-volume sellers. Preview rate: ${formatPercent(config.powerSeller500)} at 500+ monthly orders, ${formatPercent(config.powerSeller2000)} at 2,000+ monthly orders.`} />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Payment processing</div>
              <div className="mt-4 space-y-3">
                <FeeRow label="Stripe / payment processing" value={`${formatPercent(config.processingFeePercent)} + $${config.processingFeeFixed.toFixed(2)}`} description="These processor fees are shown separately so sellers can see exactly what the payment network charges." />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Buyer protection fee</div>
              <div className="mt-4 space-y-3">
                <FeeRow label="Buyer protection" value="2.5% fee" description="Covers escrow protection, disputes, fraud prevention, and marketplace support. A reasonable cap can be applied to larger purchases by admin approval." />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Instant payout</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <FeeRow label="Standard payout" value="Free" description="Payouts are free once escrow and order requirements are met." />
                <FeeRow label="Instant payout" value="2% fee" description="Optional fast payout for sellers who want same-day access to eligible funds." />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Optional promotion fees</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <FeeRow label="Featured listings" value="Optional" description="Boost visibility for selected items." />
                <FeeRow label="Auction promotion" value="Optional" description="Promote auction listings to reach more active buyers." />
                <FeeRow label="Homepage / store placement" value="Optional" description="Premium placement options for approved promotional campaigns." />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-lg font-bold">Fee preview</h2>
              <p className="mt-2 text-sm text-gray-400">Example on a $100 item sale with no promotions.</p>
              <div className="mt-5 space-y-3 text-sm">
                {[
                  ["Item subtotal", `$${preview.itemSubtotal.toFixed(2)}`],
                  ["Seller marketplace fee", `$${preview.marketplaceFee.toFixed(2)}`],
                  ["Processing fee", `$${preview.paymentProcessingFee.toFixed(2)}`],
                  ["Buyer protection fee", `$2.50`],
                  ["Seller payout", `$${preview.sellerPayout.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-lg font-bold">Live config</h2>
              <p className="mt-2 text-sm text-gray-400">Saved settings are still stored in the shared admin tables and used by the fee engine.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => void handleSave()}
                  disabled={status === "loading" || status === "saving"}
                  className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-60"
                >
                  {status === "saved" ? "Saved" : status === "saving" ? "Saving..." : status === "loading" ? "Loading..." : "Save settings"}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(configJson)}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Copy JSON
                </button>
              </div>
              {message && <p className="mt-4 text-sm text-gray-300">{message}</p>}
              <pre className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-[#13131f] p-4 text-xs text-gray-300">{configJson}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
