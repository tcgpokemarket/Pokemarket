export type SellerFeeTier = {
  id: string;
  name: string;
  minMonthlyOrders: number;
  feePercent: number;
  active: boolean;
};

export type SellerFeeConfig = {
  freeSalesLimit: number;
  standardMarketplaceFeePercent: number;
  processingFeePercent: number;
  processingFeeFixed: number;
  powerSellerTiers: SellerFeeTier[];
};

export type SellerFeeOverride = {
  sellerId: string;
  feePercent: number | null;
  freeSalesLimit: number | null;
};

export type SellerFeeOrder = {
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
};

export type FeeBreakdown = {
  itemSubtotal: number;
  shipping: number;
  salesTax: number;
  paymentProcessingFee: number;
  marketplaceFee: number;
  totalDue: number;
  sellerPayout: number;
  platformRevenue: number;
  marketplaceFeePercent: number;
  tierName: string;
  freeSalesUsed: number;
  freeSalesRemaining: number;
  freeSalesProgressPercent: number;
};

export type SellerFeeSummary = {
  tierName: string;
  marketplaceFeePercent: number;
  freeSalesUsed: number;
  freeSalesRemaining: number;
  lifetimeSales: number;
  monthlySales: number;
  grossRevenue: number;
  marketplaceFeesPaid: number;
  paymentProcessingFees: number;
  netEarnings: number;
  upcomingPayouts: number;
};

export const DEFAULT_SELLER_FEE_CONFIG: SellerFeeConfig = {
  freeSalesLimit: 100,
  standardMarketplaceFeePercent: 5,
  processingFeePercent: 2.9,
  processingFeeFixed: 0.3,
  powerSellerTiers: [
    {
      id: "power-500",
      name: "Power Seller",
      minMonthlyOrders: 500,
      feePercent: 4,
      active: true,
    },
    {
      id: "power-2000",
      name: "Power Seller",
      minMonthlyOrders: 2000,
      feePercent: 3.5,
      active: true,
    },
  ],
};

export function buildSellerFeeConfig(args: {
  settings?: {
    free_sales_limit?: number | null;
    standard_marketplace_fee_percent?: number | null;
    processing_fee_percent?: number | null;
    processing_fee_fixed?: number | null;
  } | null;
  tiers?: Array<{
    id?: string;
    name: string;
    min_monthly_orders: number;
    fee_percent: number;
    active?: boolean | null;
  }>;
}) {
  return {
    freeSalesLimit: Number(args.settings?.free_sales_limit ?? DEFAULT_SELLER_FEE_CONFIG.freeSalesLimit),
    standardMarketplaceFeePercent: Number(args.settings?.standard_marketplace_fee_percent ?? DEFAULT_SELLER_FEE_CONFIG.standardMarketplaceFeePercent),
    processingFeePercent: Number(args.settings?.processing_fee_percent ?? DEFAULT_SELLER_FEE_CONFIG.processingFeePercent),
    processingFeeFixed: Number(args.settings?.processing_fee_fixed ?? DEFAULT_SELLER_FEE_CONFIG.processingFeeFixed),
    powerSellerTiers: (args.tiers ?? DEFAULT_SELLER_FEE_CONFIG.powerSellerTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      min_monthly_orders: tier.minMonthlyOrders,
      fee_percent: tier.feePercent,
      active: tier.active,
    }))).map((tier) => ({
      id: tier.id ?? `${tier.name.toLowerCase().replace(/\s+/g, "-")}-${tier.min_monthly_orders}`,
      name: tier.name,
      minMonthlyOrders: tier.min_monthly_orders,
      feePercent: tier.fee_percent,
      active: tier.active ?? true,
    })),
  } satisfies SellerFeeConfig;
}

const COMPLETED_STATUSES = new Set(["paid", "escrow", "shipped", "delivered", "completed"]);

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isCompletedOrder(order: SellerFeeOrder) {
  return COMPLETED_STATUSES.has(order.status);
}

export function getOrderCompletedAt(order: SellerFeeOrder) {
  return order.completed_at ?? order.created_at ?? null;
}

export function getLifetimeSales(orders: SellerFeeOrder[]) {
  return orders.filter(isCompletedOrder).length;
}

export function getMonthlySales(orders: SellerFeeOrder[], asOf = new Date()) {
  const year = asOf.getFullYear();
  const month = asOf.getMonth();

  return orders.filter((order) => {
    if (!isCompletedOrder(order)) return false;
    const completedAt = getOrderCompletedAt(order);
    if (!completedAt) return false;
    const date = new Date(completedAt);
    return date.getFullYear() === year && date.getMonth() === month;
  }).length;
}

export function getActiveMarketplaceFeePercent(args: {
  lifetimeSales: number;
  monthlySales: number;
  config?: SellerFeeConfig;
  override?: SellerFeeOverride | null;
}) {
  const config = args.config ?? DEFAULT_SELLER_FEE_CONFIG;
  const overrideFee = args.override?.feePercent;
  const freeSalesLimit = args.override?.freeSalesLimit ?? config.freeSalesLimit;

  if (overrideFee !== null && overrideFee !== undefined) {
    return { feePercent: overrideFee, tierName: "Override", freeSalesLimit };
  }

  if (args.lifetimeSales < freeSalesLimit) {
    return { feePercent: 0, tierName: "New Seller", freeSalesLimit };
  }

  const activeTier = [...config.powerSellerTiers]
    .filter((tier) => tier.active)
    .sort((a, b) => b.minMonthlyOrders - a.minMonthlyOrders)
    .find((tier) => args.monthlySales >= tier.minMonthlyOrders);

  if (activeTier) {
    return {
      feePercent: activeTier.feePercent,
      tierName: `${activeTier.name} (${activeTier.minMonthlyOrders}+ monthly orders)`,
      freeSalesLimit,
    };
  }

  return { feePercent: config.standardMarketplaceFeePercent, tierName: "Standard Seller", freeSalesLimit };
}

export function calculateFeeBreakdown(args: {
  itemSubtotal: number;
  shipping: number;
  salesTax: number;
  orders?: SellerFeeOrder[];
  config?: SellerFeeConfig;
  override?: SellerFeeOverride | null;
  asOf?: Date;
  marketplaceFeePercentOverride?: number | null;
}): FeeBreakdown {
  const config = args.config ?? DEFAULT_SELLER_FEE_CONFIG;
  const orders = args.orders ?? [];
  const lifetimeSales = getLifetimeSales(orders);
  const monthlySales = getMonthlySales(orders, args.asOf ?? new Date());
  const activeTier = getActiveMarketplaceFeePercent({
    lifetimeSales,
    monthlySales,
    config,
    override: args.override,
  });

  const marketplaceFeePercent = args.marketplaceFeePercentOverride ?? activeTier.feePercent;
  const paymentProcessingFee = roundMoney(
    args.itemSubtotal * (config.processingFeePercent / 100) + config.processingFeeFixed,
  );
  const marketplaceFee = roundMoney(args.itemSubtotal * (marketplaceFeePercent / 100));
  const sellerPayout = roundMoney(
    args.itemSubtotal + args.shipping + args.salesTax - paymentProcessingFee - marketplaceFee,
  );
  const totalDue = roundMoney(
    args.itemSubtotal + args.shipping + args.salesTax + paymentProcessingFee + marketplaceFee,
  );
  const freeSalesUsed = Math.min(lifetimeSales, activeTier.freeSalesLimit);
  const freeSalesRemaining = Math.max(0, activeTier.freeSalesLimit - lifetimeSales);
  const freeSalesProgressPercent = activeTier.freeSalesLimit > 0
    ? Math.min(100, (freeSalesUsed / activeTier.freeSalesLimit) * 100)
    : 0;

  return {
    itemSubtotal: roundMoney(args.itemSubtotal),
    shipping: roundMoney(args.shipping),
    salesTax: roundMoney(args.salesTax),
    paymentProcessingFee,
    marketplaceFee,
    totalDue,
    sellerPayout,
    platformRevenue: marketplaceFee,
    marketplaceFeePercent,
    tierName: activeTier.tierName,
    freeSalesUsed,
    freeSalesRemaining,
    freeSalesProgressPercent,
  };
}

export function summarizeSellerEarnings(args: {
  orders: SellerFeeOrder[];
  config?: SellerFeeConfig;
  override?: SellerFeeOverride | null;
  asOf?: Date;
}): SellerFeeSummary {
  const config = args.config ?? DEFAULT_SELLER_FEE_CONFIG;
  const orders = args.orders.filter(isCompletedOrder);
  const lifetimeSales = orders.length;
  const monthlySales = getMonthlySales(orders, args.asOf ?? new Date());
  const activeTier = getActiveMarketplaceFeePercent({
    lifetimeSales,
    monthlySales,
    config,
    override: args.override,
  });
  const freeSalesUsed = Math.min(lifetimeSales, activeTier.freeSalesLimit);
  const freeSalesRemaining = Math.max(0, activeTier.freeSalesLimit - lifetimeSales);

  let grossRevenue = 0;
  let marketplaceFeesPaid = 0;
  let paymentProcessingFees = 0;
  let netEarnings = 0;
  let upcomingPayouts = 0;

  for (const order of orders) {
    const itemSubtotal = order.item_subtotal ?? roundMoney((order.unit_price ?? 0) * (order.quantity ?? 1));
    const shipping = order.shipping_amount ?? 0;
    const salesTax = order.sales_tax_amount ?? 0;
    const processingFee = order.processing_fee_amount ?? roundMoney(itemSubtotal * (config.processingFeePercent / 100) + config.processingFeeFixed);
    const marketplaceFee = order.marketplace_fee_amount ?? roundMoney(itemSubtotal * (activeTier.feePercent / 100));
    const sellerPayout = order.seller_payout_amount ?? roundMoney(itemSubtotal + shipping + salesTax - processingFee - marketplaceFee);

    grossRevenue += itemSubtotal + shipping + salesTax;
    marketplaceFeesPaid += marketplaceFee;
    paymentProcessingFees += processingFee;
    netEarnings += sellerPayout;

    if (order.payout_status !== "paid") {
      upcomingPayouts += sellerPayout;
    }
  }

  return {
    tierName: activeTier.tierName,
    marketplaceFeePercent: activeTier.feePercent,
    freeSalesUsed,
    freeSalesRemaining,
    lifetimeSales,
    monthlySales,
    grossRevenue: roundMoney(grossRevenue),
    marketplaceFeesPaid: roundMoney(marketplaceFeesPaid),
    paymentProcessingFees: roundMoney(paymentProcessingFees),
    netEarnings: roundMoney(netEarnings),
    upcomingPayouts: roundMoney(upcomingPayouts),
  };
}

export function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}
