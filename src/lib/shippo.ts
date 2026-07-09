export function isShippoEnabled() {
  return false;
}

export async function getShippoRates() {
  throw new Error("Shippo shipping quotes have been replaced by USPS labels.");
}

export async function createShippoLabel() {
  throw new Error("Shippo labels have been replaced by USPS labels.");
}
