export type ImageSourceType =
  | "pokemon_api"
  | "scryfall"
  | "ygoprodeck"
  | "tcgplayer"
  | "cardmarket"
  | "ebay_verified"
  | "psa"
  | "beckett"
  | "cgc"
  | "seller_verified"
  | "seller_unverified";

export type ImageMatchConfidence = "verified" | "high" | "medium" | "low" | "blocked";

export type ImageVerificationResult = {
  imageUrl: string;
  source: ImageSourceType;
  confidence: ImageMatchConfidence;
  score: number;
  verified: boolean;
  reason: string;
  cardName: string;
  setName?: string;
  cardNumber?: string | null;
  variant?: string | null;
  width?: number | null;
  height?: number | null;
};

export type CardIdentity = {
  name: string;
  setName?: string;
  cardNumber?: string | null;
  variant?: string | null;
};

const MIN_DISPLAY_WIDTH = 512;

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function containsMatch(haystack: string, needle: string) {
  if (!needle) return true;
  return haystack.includes(needle);
}

function sourceRank(source: ImageSourceType) {
  switch (source) {
    case "pokemon_api":
    case "scryfall":
    case "ygoprodeck":
      return 100;
    case "tcgplayer":
    case "cardmarket":
    case "ebay_verified":
      return 90;
    case "psa":
    case "beckett":
    case "cgc":
      return 80;
    case "seller_verified":
      return 65;
    case "seller_unverified":
      return 25;
  }
}

export function evaluateImageMatch(identity: CardIdentity, candidate: { imageUrl: string; source: ImageSourceType; setName?: string; cardNumber?: string | null; variant?: string | null; width?: number | null; height?: number | null }): ImageVerificationResult {
  const name = normalize(identity.name);
  const setName = normalize(identity.setName);
  const cardNumber = normalize(identity.cardNumber);
  const variant = normalize(identity.variant);
  const candidateSet = normalize(candidate.setName);
  const candidateNumber = normalize(candidate.cardNumber);
  const candidateVariant = normalize(candidate.variant);
  const imageUrl = candidate.imageUrl;

  const width = candidate.width ?? null;
  const height = candidate.height ?? null;

  let score = sourceRank(candidate.source);
  let reason = "";
  let verified = false;

  const exactSetMatch = Boolean(setName && candidateSet && setName === candidateSet);
  const exactNumberMatch = Boolean(cardNumber && candidateNumber && cardNumber === candidateNumber);
  const exactVariantMatch = Boolean(variant && candidateVariant && variant === candidateVariant);
  const partialNameMatch = containsMatch(normalize(identity.name), normalize(identity.name));

  if (exactSetMatch) score += 20;
  if (exactNumberMatch) score += 20;
  if (exactVariantMatch) score += 10;
  if (candidate.source === "seller_verified") score += 10;
  if (candidate.source === "seller_unverified") score -= 35;
  if ((width ?? 0) >= MIN_DISPLAY_WIDTH) score += 5;

  if (candidate.source === "seller_unverified" && !(exactSetMatch && exactNumberMatch)) {
    score = Math.min(score, 34);
  }

  if (candidate.source === "pokemon_api" || candidate.source === "scryfall" || candidate.source === "ygoprodeck") {
    verified = exactSetMatch ? true : Boolean(exactNumberMatch && exactVariantMatch);
  } else if (candidate.source === "tcgplayer" || candidate.source === "cardmarket" || candidate.source === "ebay_verified") {
    verified = exactSetMatch && exactNumberMatch;
  } else if (candidate.source === "psa" || candidate.source === "beckett" || candidate.source === "cgc") {
    verified = exactSetMatch && exactNumberMatch && (candidateVariant ? exactVariantMatch || !variant : true);
  } else if (candidate.source === "seller_verified") {
    verified = exactSetMatch && exactNumberMatch;
  }

  if (!exactSetMatch && cardNumber && candidateNumber && !exactNumberMatch) {
    score -= 30;
  }

  if (!exactSetMatch && candidate.source !== "pokemon_api" && candidate.source !== "scryfall" && candidate.source !== "ygoprodeck") {
    score -= 15;
  }

  if (!exactSetMatch && !exactNumberMatch && candidate.source === "seller_unverified") {
    reason = "Image pending verification";
  } else if (!exactSetMatch || !exactNumberMatch) {
    reason = "Metadata mismatch";
  } else {
    reason = "Verified match";
  }

  const confidence: ImageMatchConfidence = score >= 110 && verified
    ? "verified"
    : score >= 95 && verified
      ? "high"
      : score >= 70
        ? "medium"
        : score >= 40
          ? "low"
          : "blocked";

  return {
    imageUrl,
    source: candidate.source,
    confidence,
    score: Math.max(0, Math.min(120, Math.round(score))),
    verified: confidence === "verified" || confidence === "high",
    reason: confidence === "blocked" ? "Blocked by image validation" : reason,
    cardName: identity.name,
    setName: identity.setName,
    cardNumber: identity.cardNumber ?? null,
    variant: identity.variant ?? null,
    width,
    height,
  };
}

export function choosePrimaryImage(images: ImageVerificationResult[]) {
  return [...images]
    .filter((image) => image.confidence !== "blocked")
    .sort((a, b) => {
      const confidenceOrder: Record<ImageMatchConfidence, number> = { verified: 5, high: 4, medium: 3, low: 2, blocked: 1 };
      return (confidenceOrder[b.confidence] - confidenceOrder[a.confidence]) || (b.score - a.score);
    })[0] ?? null;
}

export function buildImageOverlayTag(listing: { card_name: string; set_name: string; card_number?: string | null }) {
  const number = listing.card_number ? `#${listing.card_number}` : "";
  return `${listing.set_name}${number ? ` · ${number}` : ""}`;
}

export function canGoLiveWithImage(image: ImageVerificationResult | null) {
  if (!image) return false;
  return image.verified && image.score >= 70;
}
