import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createShowEvent } from "@/lib/live-shows";
import type { Database } from "@/lib/supabase/types";

export async function POST(req: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { eventType?: string; payload?: Record<string, unknown> };
  if (!body.eventType) {
    return NextResponse.json({ error: "Event type is required" }, { status: 400 });
  }

  await createShowEvent({
    show_id: showId,
    event_type: body.eventType,
    payload: (body.payload ?? {}) as Database["public"]["Tables"]["show_events"]["Insert"]["payload"],
    created_by: user.id,
  });

  return NextResponse.json({ ok: true });
}
