import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const { data: show, error: lookupError } = await supabase.from("live_shows").select("id, seller_id").eq("id", showId).maybeSingle<{ id: string; seller_id: string }>();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!show) return NextResponse.json({ error: "Show not found." }, { status: 404 });
  if (show.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  for (const key of ["title", "description", "status", "auction_state", "scheduled_start", "scheduled_end", "thumbnail"] as const) {
    if (key in body) updates[key] = body[key];
  }

  if ("host_permissions" in body) updates.host_permissions = Array.isArray(body.host_permissions) ? body.host_permissions : [];
  if ("viewer_count" in body) updates.viewer_count = Number(body.viewer_count ?? 0);
  if ("peak_viewers" in body) updates.peak_viewers = Number(body.peak_viewers ?? 0);
  if ("auction_settings" in body) updates.auction_settings = body.auction_settings ?? null;

  const { error } = await (supabase.from("live_shows") as any).update(updates as any).eq("id", showId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
