"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSellerFeeConfig, calculateFeeBreakdown } from "@/lib/seller-fees";

type AdminFeePayload = {
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
  overrides?: Array<{
    seller_id: string;
    fee_percent: number | null;
    free_sales_limit: number | null;
    reason: string | null;
  }>;
};

const defaultConfig = {
  freeSalesLimit: 1000,
  standardMarketplaceFeePercent: 5,
  processingFeePercent: 2.9,
  processingFeeFixed: 0.3,
  powerSeller500: 4,
  powerSeller2000: 3.5,
};

function normalizeAdminSettings(payload: AdminFeePayload) {
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
        const payload = (await response.json()) as AdminFeePayload & { error?: string };

        if (!active) return;

        if (!response.ok) {
          setStatus("error");
          setMessage(payload.error ?? "Unable to load admin fee settings.");
          return;
        }

        const nextConfig = normalizeAdminSettings(payload);
        setConfig({
          freeSalesLimit: nextConfig.freeSalesLimit,
          standardMarketplaceFeePercent: nextConfig.standardMarketplaceFeePercent,
          processingFeePercent: nextConfig.processingFeePercent,
          processingFeeFixed: nextConfig.processingFeeFixed,
          powerSeller500: nextConfig.powerSellerTiers[0]?.feePercent ?? defaultConfig.powerSeller500,
          powerSeller2000: nextConfig.powerSellerTiers[1]?.feePercent ?? defaultConfig.powerSeller2000,
        });
        setStatus("idle");
        setMessage("Live admin settings loaded.");
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
    const orders = Array.from({ length: exampleSales }, (_, index) => ({
      status: "completed",
      completed_at: new Date(2026, 6, Math.min(28, index + 1)).toISOString(),
    }));

    return calculateFeeBreakdown({
      itemSubtotal: 100,
      shipping: 0,
      salesTax: 0,
      orders,
      config: {
        freeSalesLimit: config.freeSalesLimit,
        standardMarketplaceFeePercent: config.standardMarketplaceFeePercent,
        processingFeePercent: config.processingFeePercent,
        processingFeeFixed: config.processingFeeFixed,
        powerSellerTiers: [
          { id: "power-500", name: "Power Seller", minMonthlyOrders: 500, feePercent: config.powerSeller500, active: true },
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
        freeSalesLimit: config.freeSalesLimit,
        standardMarketplaceFeePercent: config.standardMarketplaceFeePercent,
        processingFeePercent: config.processingFeePercent,
        processingFeeFixed: config.processingFeeFixed,
        powerSellerTiers: [
          { minMonthlyOrders: 500, feePercent: config.powerSeller500 },
          { minMonthlyOrders: 2000, feePercent: config.powerSeller2000 },
        ],
        overrideFee: overrideFee === "" ? null : Number(overrideFee),
        overrideFreeSales: overrideFreeSales === "" ? null : Number(overrideFreeSales),
        exampleSales,
      },
      null,
      2,
    );
  }, [config, exampleSales, overrideFee, overrideFreeSales]);

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
          { name: "Power Seller", min_monthly_orders: 500, fee_percent: config.powerSeller500, active: true },
          { name: "Elite Seller", min_monthly_orders: 2000, fee_percent: config.powerSeller2000, active: true },
        ],
        override: overrideFee !== "" || overrideFreeSales !== "" ? {
          seller_id: "preview-seller",
          fee_percent: overrideFee === "" ? null : Number(overrideFee),
          free_sales_limit: overrideFreeSales === "" ? null : Number(overrideFreeSales),
          reason: "Admin preview override",
        } : null,
      }),
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      setStatus("error");
      setMessage(data.error ?? "Unable to save admin fee settings.");
      return;
    }

    setStatus("saved");
    setMessage("Live admin settings saved.");
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <div className="mb-8">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Admin Dashboard</div>
          <h1 className="text-3xl font-black">Seller Fee Management</h1>
          <p className="mt-3 max-w-2xl text-gray-400">Edit the fee model, save it to shared admin settings, and preview the effect on seller earnings.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
            <h2 className="text-lg font-bold">Pricing model</h2>

            <label className="block space-y-2 text-sm">
              <div className="text-gray-300">Free sales limit</div>
              <input
                type="number"
                min={0}
                value={config.freeSalesLimit}
                onChange={(e) => setConfig((current) => ({ ...current, freeSalesLimit: Number(e.target.value || 0) }))}
                className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400"
              />
            </label>

            <label className="block space-y-2 text-sm">
              <div className="text-gray-300">Standard marketplace fee %</div>
              <input
                type="number"
                step="0.1"
                min={0}
                value={config.standardMarketplaceFeePercent}
                onChange={(e) => setConfig((current) => ({ ...current, standardMarketplaceFeePercent: Number(e.target.value || 0) }))}
                className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400"
              />
            </label>

            <label className="block space-y-2 text-sm">
              <div className="text-gray-300">Processing fee %</div>
              <input
                type="number"
                step="0.1"
                min={0}
                value={config.processingFeePercent}
                onChange={(e) => setConfig((current) => ({ ...current, processingFeePercent: Number(e.target.value || 0) }))}
                className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400"
              />
            </label>

            <label className="block space-y-2 text-sm">
              <div className="text-gray-300">Processing fee fixed</div>
              <input
                type="number"
                step="0.01"
                min={0}
                value={config.processingFeeFixed}
                onChange={(e) => setConfig((current) => ({ ...current, processingFeeFixed: Number(e.target.value || 0) }))}
                className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <div className="text-gray-300">500+ monthly orders fee %</div>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={config.powerSeller500}
                  onChange={(e) => setConfig((current) => ({ ...current, powerSeller500: Number(e.target.value || 0) }))}
                  className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <div className="text-gray-300">2,000+ monthly orders fee %</div>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={config.powerSeller2000}
                  onChange={(e) => setConfig((current) => ({ ...current, powerSeller2000: Number(e.target.value || 0) }))}
                  className="w-full rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-white outline-none focus:border-yellow-400"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <div className="mb-3 text-sm font-semibold text-yellow-400">Seller override preview</div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-2 text-sm">
                  <div className="text-gray-300">Override fee %</div>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Leave blank"
                    value={overrideFee}
                    onChange={(e) => setOverrideFee(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-white outline-none focus:border-yellow-400"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <div className="text-gray-300">Override free sales limit</div>
                  <input
                    type="number"
                    placeholder="Leave blank"
                    value={overrideFreeSales}
                    onChange={(e) => setOverrideFreeSales(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-white outline-none focus:border-yellow-400"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-bold">Platform revenue</h2>
              <div className="mt-4 rounded-xl border border-white/10 bg-[#13131f] p-4">
                <div className="text-xs uppercase tracking-widest text-gray-500">Projected platform revenue</div>
                <div className="mt-2 text-3xl font-black">${preview.platformRevenue.toFixed(2)}</div>
                <div className="mt-1 text-sm text-gray-400">Based on the current fee model and sample checkout.</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Save config</h2>
                <div className="flex gap-2">
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
              </div>
              <p className="mt-3 text-sm text-gray-400">{message || "Saved settings are stored in the shared admin tables and used by the fee engine."}</p>
              <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-[#13131f] p-4 text-xs text-gray-300">{configJson}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
