import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeCardImage, buildListingDraftFromIngestionItem, buildDraftDescription, buildDraftTitle } from "@/lib/card-ingestion";
import { MAX_IMAGE_SIZE_BYTES, uploadImageFile } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please upload an image file." }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: `Please keep the file under ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB.` }, { status: 400 });
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
  const analysis = await analyzeCardImage({ imageDataUrl, fileName: file.name });
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
    },
  });
}
