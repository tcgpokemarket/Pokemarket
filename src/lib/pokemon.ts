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

type PokemonApiCard = {
  id?: string;
  name?: string;
  number?: string;
  rarity?: string;
  images?: { small?: string | null; large?: string | null };
  set?: { name?: string };
  tcgplayer?: {
    prices?: Record<string, { market?: number | null; low?: number | null; high?: number | null }>;
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
