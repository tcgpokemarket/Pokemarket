import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { normalizeListingImageUrls } from "@/lib/uploads";
import { bootstrapUserAccount } from "@/lib/auth-bootstrap";
import { recordAuditEvent } from "@/lib/audit-log";
import type { Database } from "@/lib/supabase/types";

type IngestionItem = Database["public"]["Tables"]["card_ingestion_items"]["Row"];
type IngestionBatch = Database["public"]["Tables"]["card_ingestion_batches"]["Row"];
type PublishBody = { itemIds?: unknown };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { batchId } = await params;
  const admin = createAdminClient();
  const body = (await request.json().catch(() => ({}))) as PublishBody;
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map((value: unknown) => String(value)).filter(Boolean) : [];

  const { data: items, error: itemsError } = await (admin.from("card_ingestion_items") as any)
    .select("*")
    .eq("batch_id", batchId)
    .in("status", ["ready_to_publish", "needs_review", "duplicate"])
    .order("created_at", { ascending: true }) as { data: IngestionItem[] | null; error: { message: string } | null };
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

  const publishable = (items ?? []).filter((item: IngestionItem) => itemIds.length === 0 || itemIds.includes(item.id));
  if (!publishable.length) return NextResponse.json({ error: "No publishable items found." }, { status: 400 });

  const { data: batch, error: batchError } = await (admin.from("card_ingestion_batches") as any)
    .select("*")
    .eq("id", batchId)
    .maybeSingle() as { data: IngestionBatch | null; error: { message: string } | null };
  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 400 });
  if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

  const publishedListings: Array<{ itemId: string; listingId: string }> = [];
  let duplicateCount = 0;
  let failedCount = 0;

  for (const item of publishable) {
    if ((item.duplicate_listing_ids ?? []).length && item.status === "duplicate") {
      duplicateCount += 1;
      continue;
    }

    try {
      await bootstrapUserAccount({
        userId: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      });

      const aiPayload = item.ai_payload as { title?: string; description?: string } | null;
      const payload = {
        seller_id: user.id,
        card_name: item.card_name ?? aiPayload?.title ?? "Unknown Card",
        set_name: item.set_name ?? "Unknown Set",
        card_number: item.card_number ?? null,
        rarity: item.rarity ?? null,
        condition: item.likely_condition ?? "Near Mint",
        category: item.category ?? "single",
        grade_company: null,
        grade_score: null,
        price: Number(item.estimated_price ?? item.low_price ?? 0),
        quantity: 1,
        description: [aiPayload?.description, item.review_notes].filter(Boolean).join("\n\n").trim() || null,
        images: normalizeListingImageUrls([item.source_image_url]),
        status: "active",
      };

      const { data: listing, error: listingError } = await (admin.from("listings") as any).insert(payload).select("id").single() as { data: { id: string } | null; error: { message: string } | null };
      if (listingError || !listing) throw listingError ?? new Error("Listing creation failed.");

      await (admin.from("card_ingestion_items") as any)
        .update({ status: "published", published_listing_id: listing.id, published_at: new Date().toISOString() })
        .eq("id", item.id);

      publishedListings.push({ itemId: item.id, listingId: listing.id });
    } catch {
      failedCount += 1;
    }
  }

  const status = failedCount && publishedListings.length ? "partial" : failedCount ? "failed" : "published";
  const { data: updatedBatch } = await (admin.from("card_ingestion_batches") as any)
    .update({
      status,
      processed_count: publishable.length,
      draft_count: publishable.length - duplicateCount - failedCount,
      published_count: publishedListings.length,
      duplicate_count: duplicateCount,
      error_count: failedCount,
      notes: failedCount ? `${failedCount} item(s) failed to publish.` : null,
    })
    .eq("id", batchId)
    .select("*")
    .single();

  recordAuditEvent({
    event_type: "admin.action",
    actor_id: user.id,
    action: "card_ingestion.publish_batch",
    resource_type: "card_ingestion_batch",
    resource_id: batchId,
    previous_value: batch,
    new_value: { batch: updatedBatch ?? batch, publishedListings, duplicateCount, failedCount },
    ip_address: null,
    user_agent: null,
  });

  return NextResponse.json({ batch: updatedBatch ?? batch, publishedListings, duplicateCount, failedCount });
}
