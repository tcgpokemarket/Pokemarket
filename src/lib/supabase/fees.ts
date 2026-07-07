import type { Database } from "./types";

export function incrementTotalSales(profile: Database["public"]["Tables"]["profiles"]["Row"], quantity = 1) {
  return {
    total_sales: profile.total_sales + quantity,
  };
}

export function incrementSellerTotals(seller: Database["public"]["Tables"]["sellers"]["Row"], amount = 0, listings = 0, shows = 0) {
  return {
    total_revenue: seller.total_revenue + amount,
    total_listings: seller.total_listings + listings,
    total_live_shows: seller.total_live_shows + shows,
    sales_count: seller.sales_count + 1,
  };
}
