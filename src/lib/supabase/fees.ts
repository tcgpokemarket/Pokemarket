import type { Database } from "./types";

export function incrementTotalSales(profile: Database["public"]["Tables"]["profiles"]["Row"], quantity = 1) {
  return {
    total_sales: profile.total_sales + quantity,
  };
}
