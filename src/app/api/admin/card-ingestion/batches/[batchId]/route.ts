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

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { batchId } = await params;
  const admin = createAdminClient();
  const [{ data: batch, error: batchError }, { data: items, error: itemError }] = await Promise.all([
    admin.from("card_ingestion_batches").select("*").eq("id", batchId).maybeSingle(),
    admin.from("card_ingestion_items").select("*, card_ingestion_item_images(*)").eq("batch_id", batchId).order("created_at", { ascending: false }),
  ]);

  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 400 });
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 400 });

  return NextResponse.json({ batch, items: items ?? [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { batchId } = await params;
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if ("status" in body) updates.status = String(body.status ?? "").trim();
  if ("notes" in body) updates.notes = body.notes === null ? null : String(body.notes).trim();

  if (!Object.keys(updates).length) return NextResponse.json({ error: "No updates provided." }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await (admin.from("card_ingestion_batches") as any).select("*").eq("id", batchId).maybeSingle();
  const { data: updated, error } = await (admin.from("card_ingestion_batches") as any).update(updates).eq("id", batchId).select("*").single();
  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Unable to update batch." }, { status: 400 });

  recordAuditEvent({
    event_type: "admin.action",
    actor_id: user.id,
    action: "card_ingestion.batch_update",
    resource_type: "card_ingestion_batch",
    resource_id: batchId,
    previous_value: current,
    new_value: updated,
    ip_address: null,
    user_agent: null,
  });

  return NextResponse.json({ batch: updated });
}
