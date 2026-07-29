import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCardPrice } from "@/lib/prices";
import { searchPokemonCardMatches, searchPokemonCards } from "@/lib/pokemon";
import type { Database } from "@/lib/supabase/types";

export type CardIngestionStatus =
  | "uploaded"
  | "processing"
  | "needs_review"
  | "ready_to_publish"
  | "published"
  | "duplicate"
  | "rejected"
  | "failed";

export type CardIngestionBatchStatus =
  | "uploaded"
  | "processing"
  | "in_review"
  | "ready"
  | "partial"
  | "published"
  | "failed";

export type CardCondition = "Mint" | "Near Mint" | "Lightly Played" | "Moderately Played" | "Heavily Played" | "Damaged";

export type CardIngestionAIResult = {
  card_name: string;
  set_name: string;
  card_number: string | null;
  rarity: string | null;
  language: string | null;
  variant: string | null;
  category: "single" | "sealed" | "graded" | "accessory";
  ocr_text: string;
  title: string;
  description: string;
  condition_assistance: {
    likely_condition: CardCondition;
    confidence: number;
    notes: string;
  };
  pricing: {
    estimated_price: number | null;
    low_price: number | null;
    high_price: number | null;
    source: string;
  };
  confidence: number;
  duplicate_signals: string[];
  notes: string;
  tags: string[];
};

export type ManualCardMatch = {
  id: string;
  name: string;
  setName?: string;
  number?: string;
  image?: string;
  rarity?: string;
  source: string;
  confidence?: number;
  setId?: string | null;
  cardType?: string | null;
  hp?: string | null;
  illustrator?: string | null;
  releaseDate?: string | null;
  imageLarge?: string | null;
  attacks?: string[];
  reasons?: string[];
};

export type CardIngestionBatchRow = Database["public"]["Tables"]["card_ingestion_batches"]["Row"];
export type CardIngestionItemRow = Database["public"]["Tables"]["card_ingestion_items"]["Row"];
export type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

const MODEL = process.env.OPENAI_CARD_MODEL ?? "gpt-4.1-mini";
const STORAGE_BUCKET = process.env.CARD_INGESTION_STORAGE_BUCKET ?? "card-ingestion-images";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "tcgpokemarketadmin@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function hasMeaningfulLabel(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return !["unknown", "unidentified", "tbd", "card", "pokémon card", "pokemon card", "card back", "back"].includes(normalized);
}

function hasUncertaintyLanguage(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return /\b(approx|assumed|assume|believe|maybe|might|possibly|probably|unclear|uncertain|unsure|not sure|unable to confirm|appears to be)\b/.test(normalized);
}

function adjustRecognitionConfidence(result: CardIngestionAIResult) {
  let confidence = clampConfidence(result.confidence);

  if (!hasMeaningfulLabel(result.card_name)) confidence -= 25;
  if (!hasMeaningfulLabel(result.set_name)) confidence -= 15;
  if (!result.card_number?.trim()) confidence -= 5;
  if (hasUncertaintyLanguage(result.notes) || hasUncertaintyLanguage(result.description)) confidence -= 10;
  if (result.ocr_text && /\b(unknown|unclear|not sure|maybe|possibly|appears to be)\b/i.test(result.ocr_text)) confidence -= 10;
  if (hasMeaningfulLabel(result.card_name) && hasMeaningfulLabel(result.set_name) && result.card_number?.trim()) confidence += 8;
  if (/\b(card not found|unable to identify|could not identify|failed to identify)\b/i.test(`${result.notes} ${result.description} ${result.ocr_text}`)) confidence -= 20;

  return clampConfidence(confidence);
}

function mergeRecognitionFallback(result: CardIngestionAIResult, matches: ManualCardMatch[]) {
  if (!matches.length) return result;
  const [primary] = matches;
  const enrichedSetName = hasMeaningfulLabel(result.set_name) ? result.set_name : primary.setName ?? result.set_name;
  const enrichedCardName = hasMeaningfulLabel(result.card_name) ? result.card_name : primary.name;
  const enrichedCardNumber = result.card_number ?? primary.number ?? null;
  const enrichedRarity = result.rarity ?? primary.rarity ?? null;
  const enrichedVariant = result.variant ?? null;
  const duplicateSignals = [...result.duplicate_signals, `fallback:${primary.source}`].filter((value, index, values) => values.indexOf(value) === index);

  return {
    ...result,
    card_name: enrichedCardName,
    set_name: enrichedSetName,
    card_number: enrichedCardNumber,
    rarity: enrichedRarity,
    variant: enrichedVariant,
    confidence: clampConfidence(Math.max(result.confidence, primary.confidence ?? 55)),
    duplicate_signals: duplicateSignals,
    notes: [result.notes, `Fallback matched ${primary.name}${primary.setName ? ` (${primary.setName})` : ""}.`].filter(Boolean).join(" "),
  };
}

function hasValidPrice(result: CardIngestionAIResult) {
  const price = result.pricing.estimated_price ?? result.pricing.low_price ?? result.pricing.high_price;
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

export function createImageHash(buffer: ArrayBuffer) {
  return crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

function clampConfidence(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function parseJsonObject(value: string) {
  const trimmed = value.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error("AI response did not include JSON.");
  }
  return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as unknown;
}

async function openAiAnalyzeImage(imageDataUrl: string, fileName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildFallbackRecognitionResult({ imageDataUrl, fileName });
  }

  const schema = {
    name: "pokemon_card_ingestion",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        card_name: { type: "string" },
        set_name: { type: "string" },
        card_number: { anyOf: [{ type: "string" }, { type: "null" }] },
        rarity: { anyOf: [{ type: "string" }, { type: "null" }] },
        language: { anyOf: [{ type: "string" }, { type: "null" }] },
        variant: { anyOf: [{ type: "string" }, { type: "null" }] },
        category: { type: "string", enum: ["single", "sealed", "graded", "accessory"] },
        ocr_text: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        condition_assistance: {
          type: "object",
          additionalProperties: false,
          properties: {
            likely_condition: { type: "string", enum: ["Mint", "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"] },
            confidence: { type: "number" },
            notes: { type: "string" },
          },
          required: ["likely_condition", "confidence", "notes"],
        },
        pricing: {
          type: "object",
          additionalProperties: false,
          properties: {
            estimated_price: { anyOf: [{ type: "number" }, { type: "null" }] },
            low_price: { anyOf: [{ type: "number" }, { type: "null" }] },
            high_price: { anyOf: [{ type: "number" }, { type: "null" }] },
            source: { type: "string" },
          },
          required: ["estimated_price", "low_price", "high_price", "source"],
        },
        confidence: { type: "number" },
        duplicate_signals: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "card_name",
        "set_name",
        "card_number",
        "rarity",
        "language",
        "variant",
        "category",
        "ocr_text",
        "title",
        "description",
        "condition_assistance",
        "pricing",
        "confidence",
        "duplicate_signals",
        "notes",
        "tags",
      ],
    },
    strict: true,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_output_tokens: 1200,
      response_format: { type: "json_schema", json_schema: schema },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You identify Pokémon cards from images for an admin-only marketplace listing workflow.",
                "Return accurate marketplace-ready metadata only.",
                "If the card is unclear, prefer conservative values and mention uncertainty in notes.",
                "Use OCR to capture visible card text when present.",
                "Estimate condition from visible corners, edges, centering, surface, and any wear. This is assistance, not a definitive grading claim.",
                "Generate a concise title and a clean description that can become a draft listing.",
                `Image file: ${fileName}`,
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Analyze this image and return the required JSON object.",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("\n") ?? "";
  const parsed = parseJsonObject(text) as CardIngestionAIResult;

  return {
    card_name: String(parsed.card_name ?? "").trim(),
    set_name: String(parsed.set_name ?? "").trim(),
    card_number: String(parsed.card_number ?? "").trim() || null,
    rarity: String(parsed.rarity ?? "").trim() || null,
    language: String(parsed.language ?? "").trim() || null,
    variant: String(parsed.variant ?? "").trim() || null,
    category: parsed.category,
    ocr_text: String(parsed.ocr_text ?? "").trim(),
    title: String(parsed.title ?? "").trim(),
    description: String(parsed.description ?? "").trim(),
    condition_assistance: {
      likely_condition: parsed.condition_assistance?.likely_condition ?? "Near Mint",
      confidence: clampConfidence(parsed.condition_assistance?.confidence ?? 0),
      notes: String(parsed.condition_assistance?.notes ?? "").trim(),
    },
    pricing: {
      estimated_price: typeof parsed.pricing?.estimated_price === "number" ? parsed.pricing.estimated_price : null,
      low_price: typeof parsed.pricing?.low_price === "number" ? parsed.pricing.low_price : null,
      high_price: typeof parsed.pricing?.high_price === "number" ? parsed.pricing.high_price : null,
      source: String(parsed.pricing?.source ?? "OpenAI estimate").trim(),
    },
    confidence: clampConfidence(parsed.confidence),
    duplicate_signals: Array.isArray(parsed.duplicate_signals) ? parsed.duplicate_signals.map((value) => String(value).trim()).filter(Boolean) : [],
    notes: String(parsed.notes ?? "").trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((value) => String(value).trim()).filter(Boolean).slice(0, 8) : [],
  } satisfies CardIngestionAIResult;
}

export async function analyzeCardImage(params: { imageDataUrl: string; fileName: string }) {
  const ai = await openAiAnalyzeImage(params.imageDataUrl, params.fileName);
  const confidence = adjustRecognitionConfidence(ai);
  const shouldFallback = confidence < 70 || !hasMeaningfulLabel(ai.card_name) || !hasMeaningfulLabel(ai.set_name) || !ai.card_number?.trim();
  const fallbackMatches = shouldFallback ? await findManualCardMatches({ cardName: ai.card_name || ai.ocr_text || params.fileName, setName: ai.set_name, cardNumber: ai.card_number, rarity: ai.rarity, language: ai.language, limit: 5 }).catch(() => []) : [];
  const enriched = mergeRecognitionFallback(ai, fallbackMatches);
  const price = hasValidPrice(enriched) ? null : await fetchCardPrice(enriched.card_name, enriched.set_name).catch(() => null);
  return {
    ...enriched,
    confidence: enriched.confidence,
    pricing: {
      estimated_price: enriched.pricing.estimated_price ?? price?.marketPrice ?? null,
      low_price: enriched.pricing.low_price ?? price?.lowPrice ?? null,
      high_price: enriched.pricing.high_price ?? price?.highPrice ?? null,
      source: enriched.pricing.source || price?.source || "OpenAI estimate",
    },
  } satisfies CardIngestionAIResult;
}

export async function findManualCardMatches(params: { cardName: string; setName?: string | null; cardNumber?: string | null; rarity?: string | null; language?: string | null; limit?: number }) {
  const matches = await searchPokemonCardMatches({
    cardName: params.cardName,
    setName: params.setName || undefined,
    cardNumber: params.cardNumber,
    rarity: params.rarity,
    language: params.language,
    limit: params.limit ?? 6,
  }).catch(() => []);

  return matches.map((match) => ({
    id: match.id,
    name: match.name,
    setName: match.setName,
    number: match.number || undefined,
    image: match.image ?? match.imageLarge ?? undefined,
    rarity: match.rarity ?? undefined,
    source: `${match.source} · ${match.confidence}%`,
    confidence: match.confidence,
    setId: match.setId,
    cardType: match.cardType,
    hp: match.hp,
    illustrator: match.illustrator,
    releaseDate: match.releaseDate,
    imageLarge: match.imageLarge,
    attacks: match.attacks,
    reasons: match.reasons,
  })) satisfies ManualCardMatch[];
}

function cleanFallbackQuery(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildFallbackRecognitionResult(params: { imageDataUrl: string; fileName: string }): Promise<CardIngestionAIResult> {
  const query = cleanFallbackQuery(params.fileName);
  const matches = query ? await findManualCardMatches({ cardName: query, limit: 3 }).catch(() => []) : [];
  const primary = matches[0] ?? null;
  const cardName = primary?.name ?? (query || "Pokémon Card");
  const setName = primary?.setName ?? "Unknown Set";
  const cardNumber = primary?.number ?? null;
  const rarity = primary?.rarity ?? null;
  const price = primary ? await fetchCardPrice(primary.name, primary.setName ?? "").catch(() => null) : null;
  const title = primary
    ? `${primary.name}${primary.setName ? ` — ${primary.setName}` : ""}${primary.number ? ` · ${primary.number}` : ""}`.trim()
    : "Pokémon Card — Manual Review Needed";

  return {
    card_name: cardName,
    set_name: setName,
    card_number: cardNumber,
    rarity,
    language: null,
    variant: null,
    category: "single",
    ocr_text: query,
    title,
    description: primary
      ? `Fallback card lookup used because automated recognition was unavailable. Review the details before publishing.`
      : `Automated recognition was unavailable. Add the card details manually before publishing.`,
    condition_assistance: {
      likely_condition: "Near Mint",
      confidence: 30,
      notes: primary
        ? `Fallback matched ${primary.name}${primary.setName ? ` (${primary.setName})` : ""}.`
        : "No automated recognition provider was available.",
    },
    pricing: {
      estimated_price: price?.marketPrice ?? null,
      low_price: price?.lowPrice ?? null,
      high_price: price?.highPrice ?? null,
      source: primary ? `Fallback + ${price?.source ?? "manual lookup"}` : "manual review",
    },
    confidence: primary ? primary.confidence ?? 45 : 15,
    duplicate_signals: primary ? [`fallback:${primary.source}`] : ["fallback:manual-review"],
    notes: primary
      ? `Fallback lookup from filename because automated recognition was unavailable.`
      : `Manual review required because automated recognition was unavailable.`,
    tags: primary ? ["fallback", "manual-review"] : ["manual-review"],
  };
}

export function getPublishabilityIssues(item: {
  card_name: string | null;
  set_name: string | null;
  likely_condition: string | null;
  category: string | null;
  estimated_price: number | null;
  low_price: number | null;
  high_price: number | null;
}) {
  const issues: string[] = [];
  const cardName = normalizeText(item.card_name);
  const setName = normalizeText(item.set_name);
  const condition = normalizeText(item.likely_condition);
  const category = normalizeText(item.category);
  const price = Number(item.estimated_price ?? item.low_price ?? item.high_price ?? 0);

  if (!cardName) issues.push("card name is missing");
  if (!setName) issues.push("set name is missing");
  if (!condition) issues.push("condition is missing");
  if (!category) issues.push("category is missing");
  if (!Number.isFinite(price) || price <= 0) issues.push("pricing is missing");

  return issues;
}

export function buildListingDraftFromIngestionItem(item: {
  created_by: string;
  card_name: string | null;
  set_name: string | null;
  card_number: string | null;
  rarity: string | null;
  likely_condition: string | null;
  category: string | null;
  estimated_price: number | null;
  low_price: number | null;
  high_price: number | null;
  review_notes: string | null;
  description: string | null;
  title: string | null;
  source_image_url: string;
}) {
  const price = Number(item.estimated_price ?? item.low_price ?? item.high_price ?? 0);
  return {
    seller_id: item.created_by,
    card_name: String(item.card_name ?? "").trim(),
    set_name: String(item.set_name ?? "").trim(),
    card_number: item.card_number ? String(item.card_number).trim() : null,
    rarity: item.rarity ? String(item.rarity).trim() : null,
    condition: String(item.likely_condition ?? "Near Mint").trim() as CardCondition,
    category: String(item.category ?? "single").trim() as "single" | "sealed" | "graded" | "accessory",
    price,
    quantity: 1,
    description: [item.description, item.review_notes].filter(Boolean).join("\n\n").trim() || null,
    images: [item.source_image_url],
    status: "active" as const,
  };
}

export function buildDraftTitle(result: CardIngestionAIResult) {
  const number = result.card_number ? ` · ${result.card_number}` : "";
  const variant = result.variant ? ` · ${result.variant}` : "";
  return `${result.card_name}${result.set_name ? ` — ${result.set_name}` : ""}${number}${variant}`.trim();
}

export function buildDraftDescription(result: CardIngestionAIResult) {
  const parts = [result.description.trim()];
  if (result.ocr_text) parts.push(`OCR: ${result.ocr_text.trim()}`);
  if (result.notes) parts.push(`Review notes: ${result.notes.trim()}`);
  if (result.condition_assistance?.notes) parts.push(`Condition assist: ${result.condition_assistance.notes.trim()}`);
  return parts.filter(Boolean).join("\n\n").trim();
}

export async function listPotentialDuplicates(params: { cardName: string; setName: string; cardNumber: string | null; variant: string | null; limit?: number }) {
  const admin = createAdminClient();
  const name = normalizeText(params.cardName);
  const setName = normalizeText(params.setName);
  const number = normalizeText(params.cardNumber);
  const variant = normalizeText(params.variant);
  const limit = params.limit ?? 8;

  let query = admin
    .from("listings")
    .select("id, card_name, set_name, card_number, rarity, condition, category, status, price, images, created_at")
    .eq("status", "active")
    .limit(limit);

  if (name) query = query.ilike("card_name", `%${escapeIlike(name)}%`);
  if (setName) query = query.ilike("set_name", `%${escapeIlike(setName)}%`);
  if (number) query = query.or(`card_number.ilike.%${escapeIlike(number)}%,card_number.eq.${params.cardNumber}`);
  if (variant) query = query.ilike("rarity", `%${escapeIlike(variant)}%`);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ListingRow[];
}

export async function downloadStorageImage(params: { bucket: string; path: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(params.bucket).download(params.path);
  if (error || !data) throw error ?? new Error("Unable to download image");
  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = data.type || (params.path.endsWith(".png") ? "image/png" : params.path.endsWith(".webp") ? "image/webp" : "image/jpeg");
  return { arrayBuffer, dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
}

export async function ensureCardIngestionStorageBucket() {
  const admin = createAdminClient();
  await admin.storage.createBucket(STORAGE_BUCKET, { public: false }).catch(() => null);
  return STORAGE_BUCKET;
}

export function summarizeDuplicateSignals(listings: ListingRow[]) {
  return listings.slice(0, 3).map((listing) => `${listing.card_name} · ${listing.set_name}${listing.card_number ? ` · #${listing.card_number}` : ""}`);
}

export function isAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return ADMIN_EMAILS.includes(normalized);
}
