import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Basic validation
    if (!body || !body.event_type) return NextResponse.json({ error: "missing event_type" }, { status: 400 });

    // TODO: add authentication/authorization for internal callers (e.g. require a signed token or cookie)

    const admin = createAdminClient();
    const payload = {
      event_type: body.event_type,
      actor_id: body.actor_id ?? null,
      action: body.action ?? null,
      resource_type: body.resource_type ?? null,
      resource_id: body.resource_id ?? null,
      previous_value: body.previous_value ?? null,
      new_value: body.new_value ?? null,
      ip_address: body.ip_address ?? null,
      user_agent: body.user_agent ?? null,
      created_at: new Date().toISOString(),
    } as any;

    const { error } = await admin.from("audit_logs").insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
