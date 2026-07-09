export type IntegrationStatus = "enabled" | "disabled" | "degraded" | "unavailable";

export type IntegrationResult<T> = {
  ok: boolean;
  data: T | null;
  source: string;
  updatedAt: string | null;
  error?: string;
};

export type CardSearchResult = {
  game: string;
  id: string;
  name: string;
  setName?: string;
  number?: string;
  image?: string;
  rarity?: string;
  legality?: string;
  source: string;
};

export type PricingResult = {
  marketPrice: number | null;
  lowPrice: number | null;
  soldPrice: number | null;
  highPrice: number | null;
  source: string;
  updatedAt: string | null;
};

export type IntegrationHealth = {
  key: string;
  name: string;
  enabled: boolean;
  status: IntegrationStatus;
  lastSync: string | null;
  requestCount: number;
  rateLimit: string;
  errors: string[];
};

type ProviderName = "pokemon" | "scryfall" | "ygopro" | "ctcgx" | "tcgplayer" | "pricecharting" | "cardmarket" | "ebay" | "stripe" | "livekit" | "openai" | "cloudinary";

type ProviderConfig = {
  key: ProviderName;
  name: string;
  enabled: boolean;
  status: IntegrationStatus;
  lastSync: string | null;
  requestCount: number;
  rateLimit: string;
  errors: string[];
};

const health: Record<ProviderName, ProviderConfig> = {
  pokemon: { key: "pokemon", name: "Pokémon TCG API", enabled: true, status: "enabled", lastSync: null, requestCount: 0, rateLimit: "public", errors: [] },
  scryfall: { key: "scryfall", name: "Scryfall", enabled: true, status: "enabled", lastSync: null, requestCount: 0, rateLimit: "public", errors: [] },
  ygopro: { key: "ygopro", name: "YGOPRODeck", enabled: true, status: "enabled", lastSync: null, requestCount: 0, rateLimit: "public", errors: [] },
  ctcgx: { key: "ctcgx", name: "CTCGX", enabled: false, status: "unavailable", lastSync: null, requestCount: 0, rateLimit: "unknown", errors: [] },
  tcgplayer: { key: "tcgplayer", name: "TCGplayer", enabled: Boolean(process.env.TCGPLAYER_API_KEY && process.env.TCGPLAYER_API_SECRET), status: process.env.TCGPLAYER_API_KEY && process.env.TCGPLAYER_API_SECRET ? "enabled" : "disabled", lastSync: null, requestCount: 0, rateLimit: "keyed", errors: [] },
  pricecharting: { key: "pricecharting", name: "PriceCharting", enabled: false, status: "unavailable", lastSync: null, requestCount: 0, rateLimit: "unknown", errors: [] },
  cardmarket: { key: "cardmarket", name: "Cardmarket", enabled: false, status: "unavailable", lastSync: null, requestCount: 0, rateLimit: "unknown", errors: [] },
  ebay: { key: "ebay", name: "eBay Browse API", enabled: Boolean(process.env.EBAY_APP_ID), status: process.env.EBAY_APP_ID ? "enabled" : "disabled", lastSync: null, requestCount: 0, rateLimit: "keyed", errors: [] },
  stripe: { key: "stripe", name: "Stripe Connect", enabled: Boolean(process.env.STRIPE_SECRET_KEY), status: process.env.STRIPE_SECRET_KEY ? "enabled" : "disabled", lastSync: null, requestCount: 0, rateLimit: "keyed", errors: [] },
  livekit: { key: "livekit", name: "LiveKit", enabled: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.NEXT_PUBLIC_LIVEKIT_URL), status: process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET ? "enabled" : "disabled", lastSync: null, requestCount: 0, rateLimit: "keyed", errors: [] },
  openai: { key: "openai", name: "OpenAI", enabled: Boolean(process.env.OPENAI_API_KEY), status: process.env.OPENAI_API_KEY ? "enabled" : "disabled", lastSync: null, requestCount: 0, rateLimit: "keyed", errors: [] },
  cloudinary: { key: "cloudinary", name: "Cloudinary", enabled: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET), status: process.env.CLOUDINARY_CLOUD_NAME ? "enabled" : "disabled", lastSync: null, requestCount: 0, rateLimit: "keyed", errors: [] },
};

function nowIso() {
  return new Date().toISOString();
}

function logFailure(provider: ProviderName, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const current = health[provider];
  current.status = current.enabled ? "degraded" : current.status;
  current.errors.unshift(`${nowIso()} · ${message}`);
  current.errors = current.errors.slice(0, 10);
}

function markSync(provider: ProviderName) {
  health[provider].lastSync = nowIso();
  health[provider].requestCount += 1;
}

export function getIntegrationHealth() {
  return Object.values(health).map((item) => ({ ...item }));
}

export function setIntegrationEnabled(provider: ProviderName, enabled: boolean) {
  health[provider].enabled = enabled;
  health[provider].status = enabled ? "enabled" : "disabled";
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

export async function searchPokemonCards(query: string): Promise<CardSearchResult[]> {
  try {
    markSync("pokemon");
    const apiKey = process.env.POKEMON_TCG_API_KEY || process.env.POKEMON_TCG_API_TOKEN;
    const data = await fetchJson(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:\"${query.replace(/\"/g, '\\\"')}\"`)}&page=1&pageSize=8`,
      apiKey ? { headers: { "X-Api-Key": apiKey } } : undefined,
    );
    const cards = Array.isArray(data?.data) ? data.data : [];
    return cards.map((card: { id?: string; name?: string; set?: { name?: string }; number?: string; images?: { small?: string }; rarity?: string }) => ({
      game: "pokemon",
      id: card.id ?? card.name ?? query,
      name: card.name ?? query,
      setName: card.set?.name,
      number: card.number,
      image: card.images?.small,
      rarity: card.rarity,
      source: "Pokémon TCG API",
    }));
  } catch (error) {
    logFailure("pokemon", error);
    return [];
  }
}

export async function searchScryfall(query: string): Promise<CardSearchResult[]> {
  try {
    markSync("scryfall");
    const data = await fetchJson(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`);
    const cards = Array.isArray(data.data) ? data.data : [];
    return cards.map((card: { id: string; name: string; set_name?: string; collector_number?: string; image_uris?: { normal?: string }; rarity?: string; legalities?: Record<string, string> }) => ({
      game: "magic",
      id: card.id,
      name: card.name,
      setName: card.set_name,
      number: card.collector_number,
      image: card.image_uris?.normal,
      rarity: card.rarity,
      legality: card.legalities ? Object.entries(card.legalities).find(([, value]) => value === "legal")?.[0] ?? null : null,
      source: "Scryfall",
    }));
  } catch (error) {
    logFailure("scryfall", error);
    return [];
  }
}

export async function searchYgoPro(query: string): Promise<CardSearchResult[]> {
  try {
    markSync("ygopro");
    const data = await fetchJson(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`);
    const cards = Array.isArray(data.data) ? data.data : [];
    return cards.map((card: { id: number; name: string; archetype?: string; card_sets?: { set_name?: string }[]; card_images?: { image_url?: string }[]; race?: string }) => ({
      game: "yugioh",
      id: String(card.id),
      name: card.name,
      setName: card.card_sets?.[0]?.set_name,
      image: card.card_images?.[0]?.image_url,
      rarity: card.race,
      source: "YGOPRODeck",
    }));
  } catch (error) {
    logFailure("ygopro", error);
    return [];
  }
}

export async function searchUnifiedCards(query: string) {
  const [pokemon, magic, ygo] = await Promise.all([searchPokemonCards(query), searchScryfall(query), searchYgoPro(query)]);
  return [...pokemon, ...magic, ...ygo];
}

export async function fetchUnifiedPricing(query: { name: string; setName?: string }): Promise<PricingResult[]> {
  const results: PricingResult[] = [];
  try {
    const cardPrice = await import("./prices");
    const current = await cardPrice.fetchCardPrice(query.name, query.setName ?? "");
    results.push({
      marketPrice: current.marketPrice,
      lowPrice: current.lowPrice,
      soldPrice: null,
      highPrice: current.highPrice,
      source: current.source,
      updatedAt: nowIso(),
    });
  } catch (error) {
    logFailure("tcgplayer", error);
  }
  return results;
}

export function getAdminIntegrationSnapshot() {
  return getIntegrationHealth();
}

export function recordIntegrationError(provider: ProviderName, error: unknown) {
  logFailure(provider, error);
}
