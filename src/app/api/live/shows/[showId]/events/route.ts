import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createShowEvent } from "@/lib/live-shows";
import type { Database } from "@/lib/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/audit-log";

export async function POST(req: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`live-events:${showId}:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    recordSecurityEvent({
      event_type: "security.alert",
      severity: "medium",
      actor_id: user.id,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
      details: { route: "/api/live/shows/[showId]/events", reason: "rate_limited" },
    });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data: show } = await (admin as any).from("live_shows").select("seller_id, host_permissions").eq("id", showId).maybeSingle() as { data: { seller_id: string; host_permissions: string[] | null } | null };
  if (!show || (show.seller_id !== user.id && !(Array.isArray(show.host_permissions) && show.host_permissions.includes(user.id)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
