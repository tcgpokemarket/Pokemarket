export const DEFAULT_DESTINATION_COUNTRY = "US";

export type EasyshipRate = never;
export type EasyshipRatesResponse = never;
export type EasyshipQuoteSelection = never;

export function getSelectedRate() {
  return null;
}

export async function getEasyshipRates() {
  throw new Error("Easyship shipping quotes have been replaced by USPS labels.");
}
