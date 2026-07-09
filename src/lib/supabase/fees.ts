type ProfileTotalsRow = {
  total_sales: number;
};


export function incrementTotalSales(profile: ProfileTotalsRow, quantity = 1) {
  return {
    total_sales: profile.total_sales + quantity,
  };
}

type SellerTotalsRow = {
  total_sales?: number | null;
  gross_volume?: number | null;
  total_fees?: number | null;
  total_payouts?: number | null;
};

export function incrementSellerTotals(
  seller: SellerTotalsRow,
  totalAmount: number,
  feeAmount = 0,
  payoutAmount = 0,
) {
  return {
    total_sales: (seller.total_sales ?? 0) + 1,
    gross_volume: (seller.gross_volume ?? 0) + totalAmount,
    total_fees: (seller.total_fees ?? 0) + feeAmount,
    total_payouts: (seller.total_payouts ?? 0) + payoutAmount,
  };
}
