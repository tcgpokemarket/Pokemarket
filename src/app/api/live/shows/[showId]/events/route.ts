import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("show_events")
    .select("id, show_id, event_type, payload, created_by, created_at")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const body = await request.json().catch(() => ({}));
  const eventType = String(body.eventType ?? "").trim();

  if (!eventType) {
    return NextResponse.json({ error: "Event type is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await (admin as any).from("show_events").insert({
    show_id: showId,
    event_type: eventType,
    payload: body.payload ?? null,
    created_by: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
