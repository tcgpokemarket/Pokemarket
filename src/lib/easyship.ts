export const DEFAULT_DESTINATION_COUNTRY = "US";

export type EasyshipRate = never;
export type EasyshipRatesResponse = never;
export type EasyshipQuoteSelection = never;

export function getSelectedRate(): never {
  throw new Error("Easyship shipping quotes have been replaced by USPS labels.");
}

export async function getEasyshipRates(): Promise<never> {
  throw new Error("Easyship shipping quotes have been replaced by USPS labels.");
}
