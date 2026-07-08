import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEmailPreferences, upsertEmailPreference } from "@/lib/notifications";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const preferences = await getEmailPreferences(user.id);
  return NextResponse.json({ preferences });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as { notificationType?: string; enabled?: boolean }));
  if (!body.notificationType) return NextResponse.json({ error: "Missing notification type" }, { status: 400 });

  await upsertEmailPreference(user.id, body.notificationType, Boolean(body.enabled));
  return NextResponse.json({ ok: true });
}
