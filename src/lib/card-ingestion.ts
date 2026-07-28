import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCardPrice } from "@/lib/prices";
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

  return clampConfidence(confidence);
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
    throw new Error("OPENAI_API_KEY is not configured.");
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
  const price = hasValidPrice(ai) ? null : await fetchCardPrice(ai.card_name, ai.set_name).catch(() => null);
  const confidence = adjustRecognitionConfidence(ai);
  return {
    ...ai,
    confidence,
    pricing: {
      estimated_price: ai.pricing.estimated_price ?? price?.marketPrice ?? null,
      low_price: ai.pricing.low_price ?? price?.lowPrice ?? null,
      high_price: ai.pricing.high_price ?? price?.highPrice ?? null,
      source: ai.pricing.source || price?.source || "OpenAI estimate",
    },
  } satisfies CardIngestionAIResult;
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
