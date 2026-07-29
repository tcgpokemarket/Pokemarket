import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeCardImage, buildListingDraftFromIngestionItem, buildDraftDescription, buildDraftTitle, findManualCardMatches } from "@/lib/card-ingestion";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";
import { MAX_IMAGE_SIZE_BYTES, uploadImageFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireSellScanAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized", stage: "auth" }, { status: 401 }) };
  }

  const limit = checkRateLimit(`sell-scan:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "api.rate_limited",
      severity: "medium",
      actor_id: user.id,
      details: { route: "/api/sell/scan", resetAt: limit.resetAt },
    });
    return { user: null, response: NextResponse.json({ error: "Too many scans. Please wait a moment and try again.", stage: "rate_limit" }, { status: 429 }) };
  }

  return { user, response: null };
}

export async function GET(request: Request) {
  const { user, response } = await requireSellScanAccess();
  if (!user) return response;

  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const cardNumber = url.searchParams.get("number") ?? null;
  const setName = url.searchParams.get("set") ?? null;
  const rarity = url.searchParams.get("rarity") ?? null;
  const language = url.searchParams.get("language") ?? null;

  if (!query.trim()) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await findManualCardMatches({
    cardName: query,
    cardNumber,
    setName,
    rarity,
    language,
    limit: 6,
  }).catch(() => []);

  return NextResponse.json({ matches });
}

export async function POST(request: Request) {
  const { user, response } = await requireSellScanAccess();
  if (!user) return response;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", stage: "auth" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose an image file.", stage: "capture" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Please upload an image file.", stage: "capture" }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: `Please keep the file under ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB.`, stage: "capture" }, { status: 400 });
    }

    const limit = checkRateLimit(`sell-scan:${user.id}`, 20, 60_000);
    if (!limit.allowed) {
      recordSecurityEvent({
        event_type: "api.rate_limited",
        severity: "medium",
        actor_id: user.id,
        details: { route: "/api/sell/scan", resetAt: limit.resetAt },
      });
      return NextResponse.json({ error: "Too many scans. Please wait a moment and try again.", stage: "rate_limit" }, { status: 429 });
    }

    const admin = createAdminClient();
    const uploaded = await uploadImageFile({
      supabase: admin,
      target: "listing",
      ownerId: user.id,
      file,
      prefix: "scan-card",
    });

    const buffer = await file.arrayBuffer();
    const imageDataUrl = `data:${file.type};base64,${Buffer.from(buffer).toString("base64")}`;

    let analysis;
    try {
      analysis = await analyzeCardImage({ imageDataUrl, fileName: file.name });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Recognition failed.", stage: "recognition" }, { status: 502 });
    }

    const topMatches = analysis.confidence < 90
      ? await findManualCardMatches({
          cardName: analysis.card_name || analysis.ocr_text || file.name,
          setName: analysis.set_name,
          cardNumber: analysis.card_number,
          rarity: analysis.rarity,
          language: analysis.language,
          limit: 5,
        }).catch(() => [])
      : [];

    const sourceImageUrl = uploaded.publicUrl;
    const draft = buildListingDraftFromIngestionItem({
      created_by: user.id,
      card_name: analysis.card_name,
      set_name: analysis.set_name,
      card_number: analysis.card_number,
      rarity: analysis.rarity,
      likely_condition: analysis.condition_assistance.likely_condition,
      category: analysis.category,
      estimated_price: analysis.pricing.estimated_price,
      low_price: analysis.pricing.low_price,
      high_price: analysis.pricing.high_price,
      review_notes: analysis.notes,
      description: buildDraftDescription(analysis),
      title: buildDraftTitle(analysis),
      source_image_url: sourceImageUrl,
    });

    return NextResponse.json({
      result: {
        ...analysis,
        source_image_url: sourceImageUrl,
        draft,
        top_matches: topMatches,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Scan failed.",
      stage: "processing",
    }, { status: 500 });
  }
}
