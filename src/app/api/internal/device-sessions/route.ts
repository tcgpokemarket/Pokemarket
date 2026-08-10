import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasInternalAuth } from "@/lib/internal-auth";

export async function POST(req: Request) {
  try {
    if (!hasInternalAuth(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const body = await req.json();
    const { user_id, device_id, ip_address, user_agent, platform, locale } = body ?? {};

    if (!user_id || !device_id) {
      return NextResponse.json({ error: "missing user_id or device_id" }, { status: 400 });
    }

    const admin = createAdminClient();

    const payload = {
      user_id,
      device_id,
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      platform: platform ?? null,
      locale: locale ?? null,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    } as any;

    const { error } = await admin.from("device_sessions").upsert(payload, { onConflict: "device_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
