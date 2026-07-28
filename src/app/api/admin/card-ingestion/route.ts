import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { analyzeCardImage, createImageHash, downloadStorageImage, ensureCardIngestionStorageBucket, listPotentialDuplicates, summarizeDuplicateSignals } from "@/lib/card-ingestion";
import { recordAuditEvent, recordSecurityEvent } from "@/lib/audit-log";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ensureAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, response: null };
}

async function readUploadFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, 50);
}

export async function GET() {
  const { user, response } = await ensureAdminUser();
  if (!user) return response;

  const admin = createAdminClient();
  const [batchesRes, itemsRes] = await Promise.all([
    admin
      .from("card_ingestion_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("card_ingestion_items")
      .select("*, card_ingestion_item_images(*)")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (batchesRes.error) return NextResponse.json({ error: batchesRes.error.message }, { status: 400 });
  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 400 });

  return NextResponse.json({
    batches: batchesRes.data ?? [],
    items: itemsRes.data ?? [],
  });
}

export async function POST(request: Request) {
  const { user, response } = await ensureAdminUser();
  if (!user) return response;

  const admin = createAdminClient();
  const contentType = request.headers.get("content-type") ?? "";
  const formData = contentType.includes("multipart/form-data") ? await request.formData() : null;
  const body = contentType.includes("multipart/form-data") ? null : await request.json().catch(() => ({}));
  const action = String(formData?.get("action") ?? body?.action ?? "upload");

  if (action === "upload") {
    const files = formData ? await readUploadFiles(formData) : [];
    if (!files.length) return NextResponse.json({ error: "No files provided." }, { status: 400 });

    await ensureCardIngestionStorageBucket();
    const createdBy = user.id;
    const { data: batch, error: batchError } = await (admin.from("card_ingestion_batches") as any)
      .insert({
        created_by: createdBy,
        source: "admin_upload",
        status: "uploaded",
        original_file_count: files.length,
        processed_count: 0,
        draft_count: 0,
        published_count: 0,
        duplicate_count: 0,
        error_count: 0,
      })
      .select("*")
      .single();

    if (batchError || !batch) return NextResponse.json({ error: batchError?.message ?? "Unable to create batch." }, { status: 400 });

    const uploadedItems: Array<Record<string, unknown>> = [];
    const sourceBucket = process.env.CARD_INGESTION_STORAGE_BUCKET ?? "card-ingestion-images";

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: `${file.name} must be an image.` }, { status: 400 });
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json({ error: `${file.name} exceeds the ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB upload limit.` }, { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const hash = createImageHash(buffer);
      const path = `admin/${user.id}/${batch.id}/${hash.slice(0, 16)}-${file.name.replace(/[^a-z0-9._-]/gi, "-")}`;
      const { error: uploadError } = await admin.storage.from(sourceBucket).upload(path, buffer, { contentType: file.type, upsert: false });
      if (uploadError) {
        await (admin.from("card_ingestion_batches") as any).update({ status: "failed", error_count: 1, notes: uploadError.message }).eq("id", batch.id);
        recordSecurityEvent({ event_type: "api.denied", severity: "medium", actor_id: user.id, details: { reason: uploadError.message, batchId: batch.id } });
        return NextResponse.json({ error: uploadError.message }, { status: 400 });
      }

      const { data: urlData } = admin.storage.from(sourceBucket).getPublicUrl(path);
      const dataUrl = `data:${file.type};base64,${Buffer.from(buffer).toString("base64")}`;
      const analysis = await analyzeCardImage({ imageDataUrl: dataUrl, fileName: file.name });
      const duplicates = await listPotentialDuplicates({ cardName: analysis.card_name, setName: analysis.set_name, cardNumber: analysis.card_number, variant: analysis.variant });
      const duplicateIds = duplicates.map((listing) => listing.id);
      const duplicateSummary = summarizeDuplicateSignals(duplicates);
      const status = duplicateIds.length ? "duplicate" : analysis.confidence >= 80 ? "ready_to_publish" : "needs_review";

      const itemPayload = {
        batch_id: batch.id,
        created_by: user.id,
        source_image_url: urlData.publicUrl,
        source_image_bucket: sourceBucket,
        source_image_path: path,
        source_image_hash: hash,
        status,
        card_name: analysis.card_name,
        set_name: analysis.set_name,
        card_number: analysis.card_number,
        rarity: analysis.rarity,
        language: analysis.language,
        variant: analysis.variant,
        category: analysis.category,
        ocr_text: analysis.ocr_text,
        title: analysis.title,
        description: analysis.description,
        likely_condition: analysis.condition_assistance.likely_condition,
        condition_confidence: analysis.condition_assistance.confidence,
        condition_notes: analysis.condition_assistance.notes,
        estimated_price: analysis.pricing.estimated_price,
        low_price: analysis.pricing.low_price,
        high_price: analysis.pricing.high_price,
        pricing_source: analysis.pricing.source,
        confidence_score: analysis.confidence,
        duplicate_listing_ids: duplicateIds,
        duplicate_summary: duplicateSummary,
        ai_payload: analysis,
        review_notes: analysis.notes,
        processed_at: new Date().toISOString(),
      };

      const { data: item, error: itemError } = await (admin.from("card_ingestion_items") as any).insert(itemPayload).select("*").single();
      if (itemError || !item) {
        await (admin.from("card_ingestion_batches") as any).update({ status: "failed", error_count: 1, notes: itemError?.message ?? "Item insert failed" }).eq("id", batch.id);
        return NextResponse.json({ error: itemError?.message ?? "Unable to save analyzed item." }, { status: 400 });
      }

      const { error: imageError } = await (admin.from("card_ingestion_item_images") as any).insert({
        item_id: item.id,
        bucket: sourceBucket,
        storage_path: path,
        public_url: urlData.publicUrl,
        sort_order: 0,
      });
      if (imageError) {
        return NextResponse.json({ error: imageError.message }, { status: 400 });
      }

      uploadedItems.push({ id: item.id, status: item.status, duplicates: duplicateIds.length, confidence: analysis.confidence });
    }

    const { data: finalBatch } = await (admin.from("card_ingestion_batches") as any)
      .update({
        status: uploadedItems.some((item) => item.duplicates) ? "partial" : "ready",
        processed_count: uploadedItems.length,
        draft_count: uploadedItems.filter((item) => String(item.status) === "ready_to_publish").length,
        duplicate_count: uploadedItems.filter((item) => Number(item.duplicates) > 0).length,
        error_count: 0,
        notes: null,
      })
      .eq("id", batch.id)
      .select("*")
      .single();

    recordAuditEvent({
      event_type: "admin.action",
      actor_id: user.id,
      action: "card_ingestion.upload",
      resource_type: "card_ingestion_batch",
      resource_id: batch.id,
      previous_value: null,
      new_value: { batch: finalBatch ?? batch, uploadedItems },
      ip_address: null,
      user_agent: null,
    });

    return NextResponse.json({ batch: finalBatch ?? batch, items: uploadedItems }, { status: 201 });
  }

  if (action === "refresh") {
    const itemId = String(body?.itemId ?? "");
    if (!itemId) return NextResponse.json({ error: "itemId is required." }, { status: 400 });

    const { data: item, error } = await (admin.from("card_ingestion_items") as any)
      .select("*, card_ingestion_item_images(*)")
      .eq("id", itemId)
      .maybeSingle();
    if (error || !item) return NextResponse.json({ error: error?.message ?? "Item not found." }, { status: 404 });

    const image = (item.card_ingestion_item_images ?? [])[0];
    if (!image) return NextResponse.json({ error: "No source image found." }, { status: 400 });

    const downloaded = await downloadStorageImage({ bucket: image.bucket, path: image.storage_path });
    const analysis = await analyzeCardImage({ imageDataUrl: downloaded.dataUrl, fileName: image.storage_path.split("/").pop() ?? "card.jpg" });
    const duplicates = await listPotentialDuplicates({ cardName: analysis.card_name, setName: analysis.set_name, cardNumber: analysis.card_number, variant: analysis.variant });
    const duplicateIds = duplicates.map((listing) => listing.id);
    const duplicateSummary = summarizeDuplicateSignals(duplicates);
    const status = duplicateIds.length ? "duplicate" : analysis.confidence >= 80 ? "ready_to_publish" : "needs_review";

    const { data: updated, error: updateError } = await (admin.from("card_ingestion_items") as any)
      .update({
        status,
        card_name: analysis.card_name,
        set_name: analysis.set_name,
        card_number: analysis.card_number,
        rarity: analysis.rarity,
        language: analysis.language,
        variant: analysis.variant,
        category: analysis.category,
        ocr_text: analysis.ocr_text,
        title: analysis.title,
        description: analysis.description,
        likely_condition: analysis.condition_assistance.likely_condition,
        condition_confidence: analysis.condition_assistance.confidence,
        condition_notes: analysis.condition_assistance.notes,
        estimated_price: analysis.pricing.estimated_price,
        low_price: analysis.pricing.low_price,
        high_price: analysis.pricing.high_price,
        pricing_source: analysis.pricing.source,
        confidence_score: analysis.confidence,
        duplicate_listing_ids: duplicateIds,
        duplicate_summary: duplicateSummary,
        ai_payload: analysis,
        review_notes: analysis.notes,
        error_message: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select("*")
      .single();

    if (updateError || !updated) return NextResponse.json({ error: updateError?.message ?? "Unable to refresh item." }, { status: 400 });

    return NextResponse.json({ item: updated }, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
