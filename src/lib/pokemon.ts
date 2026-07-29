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

export type PokemonCardDetails = PokemonSearchResult & {
  setId: string | null;
  cardType: string | null;
  hp: string | null;
  illustrator: string | null;
  releaseDate: string | null;
  imageLarge: string | null;
  attacks: string[];
  marketPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  source: string;
};

export type PokemonCardMatch = PokemonCardDetails & {
  confidence: number;
  reasons: string[];
};

type PokemonApiCard = {
  id?: string;
  name?: string;
  number?: string;
  rarity?: string;
  hp?: string | null;
  supertype?: string | null;
  subtypes?: string[] | null;
  types?: string[] | null;
  artist?: string | null;
  attacks?: Array<{ name?: string } | null> | null;
  images?: { small?: string | null; large?: string | null };
  set?: { id?: string | null; name?: string | null; releaseDate?: string | null } | null;
  tcgplayer?: {
    prices?: Record<string, { market?: number | null; low?: number | null; high?: number | null }>;
  } | null;
  cardmarket?: {
    prices?: {
      averageSellPrice?: number | null;
      lowPrice?: number | null;
      trendPrice?: number | null;
    };
  } | null;
};

type CacheEntry<T> = { value: T; expiresAt: number };

type SearchOptions = {
  pageSize?: number;
  forceRefresh?: boolean;
};

type MatchParams = {
  cardName: string;
  setName?: string;
  cardNumber?: string | null;
  rarity?: string | null;
  language?: string | null;
  limit?: number;
};

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const PRICE_CACHE_TTL_MS = 10 * 60 * 1000;
const searchCache = new Map<string, CacheEntry<PokemonApiCard[]>>();
const priceCache = new Map<string, CacheEntry<PokemonPriceResult>>();

function now() {
  return Date.now();
}

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: now() + ttlMs });
}

function firstNumber(values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function escapeQuery(value: string) {
  return value.trim().replace(/"/g, '\\"');
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function scoreTextMatch(source: string, target: string) {
  const normalizedSource = normalizeText(source);
  const normalizedTarget = normalizeText(target);
  if (!normalizedSource || !normalizedTarget) return 0;
  if (normalizedSource === normalizedTarget) return 1;
  if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) return 0.75;
  const sourceWords = new Set(normalizedSource.split(" "));
  const targetWords = normalizedTarget.split(" ").filter(Boolean);
  const overlap = targetWords.filter((word) => sourceWords.has(word)).length;
  return targetWords.length ? overlap / targetWords.length : 0;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url: string, init?: RequestInit, attempts = 3) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < attempts) {
        await sleep(150 * attempt);
      }
    }
  }

  throw lastError ?? new Error("Request failed.");
}

function getCardPrice(card: PokemonApiCard) {
  const prices = card.tcgplayer?.prices ?? {};
  const selected = prices.holofoil ?? prices.normal ?? prices.reverseHolofoil ?? prices.unlimitedHolofoil ?? prices["1stEditionHolofoil"] ?? null;
  const cardmarket = card.cardmarket?.prices ?? {};

  return {
    marketPrice: firstNumber([selected?.market, cardmarket.averageSellPrice, cardmarket.trendPrice, cardmarket.lowPrice]),
    lowPrice: firstNumber([selected?.low, cardmarket.lowPrice, cardmarket.averageSellPrice]),
    highPrice: firstNumber([selected?.high, cardmarket.averageSellPrice, cardmarket.trendPrice]),
  };
}

function mapCard(card: PokemonApiCard, query: string): PokemonCardDetails {
  const pricing = getCardPrice(card);
  const attacks = Array.isArray(card.attacks) ? card.attacks.map((attack) => attack?.name?.trim()).filter(Boolean) as string[] : [];
  const cardType = [card.supertype, ...(card.subtypes ?? [])].filter(Boolean).join(" / ") || null;

  return {
    id: card.id ?? card.name ?? query,
    name: card.name ?? query,
    setName: card.set?.name ?? "",
    setId: card.set?.id ?? null,
    number: card.number ?? null,
    rarity: card.rarity ?? null,
    image: card.images?.small ?? card.images?.large ?? null,
    imageLarge: card.images?.large ?? card.images?.small ?? null,
    cardType,
    hp: card.hp ?? null,
    illustrator: card.artist ?? null,
    releaseDate: card.set?.releaseDate ?? null,
    attacks,
    marketPrice: pricing.marketPrice,
    lowPrice: pricing.lowPrice,
    highPrice: pricing.highPrice,
    source: "Pokémon TCG API",
  };
}

async function fetchPokemonCards(query: string, options: SearchOptions = {}) {
  const pageSize = options.pageSize ?? 10;
  const cacheKey = `${query.trim().toLowerCase()}::${pageSize}`;
  if (!options.forceRefresh) {
    const cached = readCache(searchCache, cacheKey);
    if (cached) return cached;
  }

  const apiKey = process.env.POKEMON_TCG_API_KEY || process.env.POKEMON_TCG_API_TOKEN;
  const response = await fetchJsonWithRetry(
    `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:\"${escapeQuery(query)}\"`)}&page=1&pageSize=${pageSize}`,
    apiKey ? { headers: { "X-Api-Key": apiKey } } : undefined,
  );

  const cards = Array.isArray(response?.data) ? (response.data as PokemonApiCard[]) : [];
  writeCache(searchCache, cacheKey, cards, SEARCH_CACHE_TTL_MS);
  return cards;
}

export async function searchPokemonCards(query: string): Promise<PokemonSearchResult[]> {
  const cards = await fetchPokemonCards(query, { pageSize: 10 });
  return cards.map((card) => ({
    id: card.id ?? card.name ?? query,
    name: card.name ?? query,
    setName: card.set?.name ?? "",
    number: card.number ?? null,
    rarity: card.rarity ?? null,
    image: card.images?.small ?? card.images?.large ?? null,
  }));
}

export async function searchPokemonCardMatches(params: MatchParams): Promise<PokemonCardMatch[]> {
  const limit = params.limit ?? 6;
  const queries = [params.cardName, params.setName ? `${params.cardName} ${params.setName}` : null, params.cardNumber ? `${params.cardName} ${params.cardNumber}` : null].filter((value): value is string => Boolean(value && value.trim()));
  const uniqueQueries = Array.from(new Set(queries.map((value) => value.trim())));
  const responses = await Promise.all(uniqueQueries.map((query) => fetchPokemonCards(query, { pageSize: 12 }).catch(() => [])));
  const cards = responses.flat();
  const deduped = Array.from(new Map(cards.map((card) => [`${card.id ?? card.name ?? ""}:${card.set?.id ?? card.set?.name ?? ""}:${card.number ?? ""}`.toLowerCase(), card])).values());

  const ranked = deduped
    .map((card) => {
      const details = mapCard(card, params.cardName);
      let score = 0;
      const reasons: string[] = [];

      const nameScore = scoreTextMatch(details.name, params.cardName);
      if (nameScore >= 0.95) {
        score += 55;
        reasons.push("exact card name match");
      } else if (nameScore >= 0.75) {
        score += 40;
        reasons.push("strong card name match");
      } else if (nameScore >= 0.5) {
        score += 24;
        reasons.push("partial card name match");
      }

      if (params.setName) {
        const setScore = scoreTextMatch(details.setName, params.setName);
        if (setScore >= 0.95) {
          score += 22;
          reasons.push("exact set match");
        } else if (setScore >= 0.75) {
          score += 15;
          reasons.push("strong set match");
        } else if (setScore >= 0.5) {
          score += 8;
          reasons.push("partial set match");
        }
      }

      if (params.cardNumber && details.number) {
        const normalizedMatch = normalizeText(details.number) === normalizeText(params.cardNumber) || normalizeText(details.number).replace(/^0+/, "") === normalizeText(params.cardNumber).replace(/^0+/, "");
        if (normalizedMatch) {
          score += 18;
          reasons.push("card number match");
        } else if (normalizeText(details.number).includes(normalizeText(params.cardNumber)) || normalizeText(params.cardNumber).includes(normalizeText(details.number))) {
          score += 8;
          reasons.push("partial card number match");
        }
      }

      if (params.rarity && details.rarity) {
        const rarityMatch = scoreTextMatch(details.rarity, params.rarity);
        if (rarityMatch >= 0.95) {
          score += 6;
          reasons.push("rarity match");
        } else if (rarityMatch >= 0.75) {
          score += 3;
          reasons.push("rarity appears similar");
        }
      }

      if (params.language && /japanese|jp|jp\b/i.test(params.language) && /japanese|jp/i.test(details.setName)) {
        score += 4;
        reasons.push("language hint match");
      }

      if (details.imageLarge || details.image) {
        score += 2;
        reasons.push("official card image available");
      }

      if (details.attacks.length) {
        score += 1;
      }

      const confidence = Math.max(1, Math.min(100, Math.round(score)));
      return {
        ...details,
        confidence,
        reasons,
      } satisfies PokemonCardMatch;
    })
    .sort((left, right) => right.confidence - left.confidence || left.name.localeCompare(right.name));

  return ranked.slice(0, limit);
}

export async function fetchPokemonCardPrice(cardName: string, setName: string): Promise<PokemonPriceResult> {
  const cacheKey = `${normalizeText(cardName)}::${normalizeText(setName)}`;
  const cached = readCache(priceCache, cacheKey);
  if (cached) return cached;

  const cards = await fetchPokemonCards(cardName, { pageSize: 12 }).catch(() => []);
  const card =
    cards.find((item) => {
      const nameMatches = item.name?.trim().toLowerCase().includes(cardName.trim().toLowerCase());
      const setMatches = !setName.trim() || item.set?.name?.trim().toLowerCase().includes(setName.trim().toLowerCase());
      return Boolean(nameMatches && setMatches);
    }) ?? cards[0];

  const pricing = card ? getCardPrice(card) : { marketPrice: null, lowPrice: null, highPrice: null };
  const result = {
    cardName: card?.name ?? cardName,
    setName: card?.set?.name ?? setName,
    marketPrice: pricing.marketPrice,
    lowPrice: pricing.lowPrice,
    highPrice: pricing.highPrice,
    source: "Pokémon TCG API",
  } satisfies PokemonPriceResult;

  writeCache(priceCache, cacheKey, result, PRICE_CACHE_TTL_MS);
  return result;
}
