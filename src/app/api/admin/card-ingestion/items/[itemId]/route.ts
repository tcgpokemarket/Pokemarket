import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { recordAuditEvent } from "@/lib/audit-log";

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

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { itemId } = await params;
  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  const { data: current, error: lookupError } = await (admin.from("card_ingestion_items") as any)
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!current) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const updates: Record<string, unknown> = {};
  const allowedTextFields = ["card_name", "set_name", "card_number", "rarity", "language", "variant", "title", "description", "review_notes", "error_message", "pricing_source", "condition_notes"] as const;
  for (const field of allowedTextFields) {
    if (field in body) updates[field] = body[field] === null ? null : String(body[field]).trim();
  }

  if ("status" in body) updates.status = String(body.status ?? "").trim();
  if ("likely_condition" in body) updates.likely_condition = String(body.likely_condition ?? "").trim();
  if ("confidence_score" in body) updates.confidence_score = Number(body.confidence_score);
  if ("condition_confidence" in body) updates.condition_confidence = Number(body.condition_confidence);
  if ("estimated_price" in body) updates.estimated_price = body.estimated_price === null ? null : Number(body.estimated_price);
  if ("low_price" in body) updates.low_price = body.low_price === null ? null : Number(body.low_price);
  if ("high_price" in body) updates.high_price = body.high_price === null ? null : Number(body.high_price);
  if ("duplicate_listing_ids" in body && Array.isArray(body.duplicate_listing_ids)) updates.duplicate_listing_ids = body.duplicate_listing_ids;
  if ("duplicate_summary" in body && Array.isArray(body.duplicate_summary)) updates.duplicate_summary = body.duplicate_summary;
  if ("ai_payload" in body && body.ai_payload && typeof body.ai_payload === "object") updates.ai_payload = body.ai_payload;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  updates.processed_at = new Date().toISOString();

  const { data: updated, error } = await (admin.from("card_ingestion_items") as any)
    .update(updates)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Unable to update item." }, { status: 400 });

  recordAuditEvent({
    event_type: "admin.action",
    actor_id: user.id,
    action: "card_ingestion.item_update",
    resource_type: "card_ingestion_item",
    resource_id: itemId,
    previous_value: current,
    new_value: updated,
    ip_address: null,
    user_agent: null,
  });

  return NextResponse.json({ item: updated });
}
