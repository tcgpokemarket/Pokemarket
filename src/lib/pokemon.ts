export type PokemonPriceResult = {
  cardName: string;
  setName: string;
  marketPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  source: string;
};

export type PokemonSearchResult = {
  id: string;
  name: string;
  setName: string;
  number: string | null;
  rarity: string | null;
  image: string | null;
};

export type PokemonCardMatch = {
  id: string;
  name: string;
  setName: string;
  number: string | null;
  rarity: string | null;
  image: string | null;
  price: {
    marketPrice: number | null;
    lowPrice: number | null;
    highPrice: number | null;
    source: string;
  };
  releaseDate: string | null;
  illustrator: string | null;
  hp: string | null;
  stage: string | null;
  types: string[];
  language: string | null;
  variants: string[];
  suggestedCategory: "single" | "sealed" | "graded" | "accessory";
  suggestedTitle: string;
  suggestedSellPrice: number | null;
  suggestedAuctionStartPrice: number | null;
  suggestedBuyItNowPrice: number | null;
  confidence: number;
};

type PokemonApiCard = {
  id?: string;
  name?: string;
  number?: string;
  rarity?: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  illustrator?: string;
  nationalPokedexNumbers?: number[];
  images?: { small?: string | null; large?: string | null };
  set?: { name?: string; series?: string; releaseDate?: string };
  tcgplayer?: {
    prices?: Record<string, { market?: number | null; low?: number | null; high?: number | null; mid?: number | null }>;
  };
  cardmarket?: {
    prices?: {
      averageSellPrice?: number | null;
      lowPrice?: number | null;
      trendPrice?: number | null;
    };
  };
};

function firstNumber(values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function escapeQuery(value: string) {
  return value.trim().replace(/"/g, '\\"');
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function scoreCardMatch(card: PokemonApiCard, query: string) {
  const queryText = normalizeText(query);
  const name = normalizeText(card.name);
  const setName = normalizeText(card.set?.name);
  const number = normalizeText(card.number);
  let score = 0;
  if (name === queryText) score += 60;
  if (name.includes(queryText) || queryText.includes(name)) score += 35;
  if (setName.includes(queryText)) score += 10;
  if (number) score += 5;
  if (card.tcgplayer?.prices) score += 10;
  return score;
}

function deriveVariants(card: PokemonApiCard) {
  const variants: string[] = [];
  const name = normalizeText(card.name);
  const rarity = normalizeText(card.rarity);
  const subtypes = (card.subtypes ?? []).map(normalizeText);
  const types = (card.types ?? []).map(normalizeText);
  const add = (variant: string) => {
    if (!variants.includes(variant)) variants.push(variant);
  };
  if (rarity.includes("reverse holo")) add("Reverse Holo");
  if (rarity.includes("holo")) add("Holo");
  if (rarity.includes("full art")) add("Full Art");
  if (rarity.includes("alternate art") || rarity.includes("alt art")) add("Alternate Art");
  if (subtypes.includes("ex") || name.endsWith(" ex")) add("ex");
  if (subtypes.includes("gx") || name.endsWith(" gx")) add("GX");
  if (subtypes.includes("v") || name.endsWith(" v")) add("V");
  if (subtypes.includes("vmax") || name.endsWith(" vmax")) add("VMAX");
  if (subtypes.includes("vstar") || name.endsWith(" vstar")) add("VSTAR");
  if (types.includes("trainer")) add("Trainer");
  if (types.includes("energy")) add("Energy");
  return variants;
}

function pickPrice(card: PokemonApiCard) {
  const prices = card.tcgplayer?.prices ?? {};
  const selected = prices.holofoil ?? prices.normal ?? prices.reverseHolofoil ?? prices.unlimitedHolofoil ?? prices["1stEditionHolofoil"] ?? null;
  const cardmarket = card.cardmarket?.prices ?? {};
  const marketPrice = firstNumber([selected?.market, cardmarket.averageSellPrice, cardmarket.trendPrice, cardmarket.lowPrice]);
  const lowPrice = firstNumber([selected?.low, cardmarket.lowPrice, cardmarket.averageSellPrice]);
  const highPrice = firstNumber([selected?.high, cardmarket.averageSellPrice, cardmarket.trendPrice]);
  const midPrice = firstNumber([selected?.mid, marketPrice, cardmarket.trendPrice, cardmarket.averageSellPrice]);
  return { marketPrice, lowPrice, highPrice, midPrice, source: "Pokémon TCG API" };
}

async function fetchPokemonCards(query: string) {
  const apiKey = process.env.POKEMON_TCG_API_KEY || process.env.POKEMON_TCG_API_TOKEN;
  const response = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:\"${escapeQuery(query)}\"`)}&page=1&pageSize=10`,
    apiKey ? { headers: { "X-Api-Key": apiKey } } : undefined,
  );

  if (!response.ok) {
    throw new Error(`Pokémon TCG API request failed: ${response.status}`);
  }

  const data = (await response.json()) as { data?: PokemonApiCard[] };
  return data.data ?? [];
}

function buildCardMatch(card: PokemonApiCard, query: string): PokemonCardMatch {
  const price = pickPrice(card);
  const variants = deriveVariants(card);
  const suggestedSellPrice = price.marketPrice ?? price.highPrice ?? price.lowPrice;
  const suggestedAuctionStartPrice = suggestedSellPrice ? Number((suggestedSellPrice * 0.65).toFixed(2)) : null;
  const suggestedBuyItNowPrice = suggestedSellPrice ? Number((suggestedSellPrice * 1.1).toFixed(2)) : null;
  const stage = card.evolvesFrom ? "Stage 1 or higher" : (card.supertype === "Pokémon" ? "Basic" : null);
  const category = card.supertype === "Trainer" ? "single" : card.supertype === "Energy" ? "accessory" : "single";
  const title = [card.name ?? query, card.set?.name, card.number ? `#${card.number}` : null].filter(Boolean).join(" · ");

  return {
    id: card.id ?? `${card.name ?? query}-${card.set?.name ?? ""}`,
    name: card.name ?? query,
    setName: card.set?.name ?? "",
    number: card.number ?? null,
    rarity: card.rarity ?? null,
    image: card.images?.large ?? card.images?.small ?? null,
    price,
    releaseDate: card.set?.releaseDate ?? null,
    illustrator: card.illustrator ?? null,
    hp: card.hp ?? null,
    stage,
    types: card.types ?? [],
    language: "English",
    variants,
    suggestedCategory: category,
    suggestedTitle: title,
    suggestedSellPrice,
    suggestedAuctionStartPrice,
    suggestedBuyItNowPrice,
    confidence: Math.min(100, Math.max(10, scoreCardMatch(card, query))),
  };
}

export async function identifyPokemonCard(query: string): Promise<PokemonCardMatch[]> {
  const cards = await fetchPokemonCards(query);
  return cards
    .map((card) => buildCardMatch(card, query))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

export async function searchPokemonCards(query: string): Promise<PokemonSearchResult[]> {
  const cards = await fetchPokemonCards(query);
  return cards.map((card) => ({
    id: card.id ?? card.name ?? query,
    name: card.name ?? query,
    setName: card.set?.name ?? "",
    number: card.number ?? null,
    rarity: card.rarity ?? null,
    image: card.images?.small ?? card.images?.large ?? null,
  }));
}

export async function fetchPokemonCardPrice(cardName: string, setName: string): Promise<PokemonPriceResult> {
  const cards = await fetchPokemonCards(cardName);
  const card =
    cards.find((item) => {
      const nameMatches = item.name?.trim().toLowerCase().includes(cardName.trim().toLowerCase());
      const setMatches = !setName.trim() || item.set?.name?.trim().toLowerCase().includes(setName.trim().toLowerCase());
      return Boolean(nameMatches && setMatches);
    }) ?? cards[0];

  const prices = card?.tcgplayer?.prices ?? {};
  const selected = prices.holofoil ?? prices.normal ?? prices.reverseHolofoil ?? prices.unlimitedHolofoil ?? prices["1stEditionHolofoil"] ?? null;
  const cardmarket = card?.cardmarket?.prices ?? {};

  return {
    cardName: card?.name ?? cardName,
    setName: card?.set?.name ?? setName,
    marketPrice: firstNumber([selected?.market, cardmarket.averageSellPrice, cardmarket.trendPrice, cardmarket.lowPrice]),
    lowPrice: firstNumber([selected?.low, cardmarket.lowPrice, cardmarket.averageSellPrice]),
    highPrice: firstNumber([selected?.high, cardmarket.averageSellPrice, cardmarket.trendPrice]),
    source: "Pokémon TCG API",
  };
}

