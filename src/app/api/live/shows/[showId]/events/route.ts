import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await createServerSupabaseClient();
  return NextResponse.json({ events: [] });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const eventType = String(body.eventType ?? "").trim();

  if (!eventType) {
    return NextResponse.json({ error: "Event type is required." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
