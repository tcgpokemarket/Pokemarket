import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const message = String(body.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const username = user.user_metadata?.username ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Guest";

  const chatPayload = {
    show_id: showId,
    user_id: user.id,
    username,
    message,
    role: String(user.user_metadata?.role ?? "viewer"),
    highlighted: false,
  } as any;

  const { error } = await (supabase.from("live_chat") as any).insert(chatPayload);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
