import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();
  const { data: moderation, error: moderationError } = await (admin as any)
    .from("live_show_moderation_actions")
    .select("action_type, active")
    .eq("show_id", showId)
    .eq("target_user_id", user.id)
    .eq("active", true);

  if (moderationError) return NextResponse.json({ error: moderationError.message }, { status: 400 });
  const activeActions = Array.isArray(moderation) ? moderation.map((row: any) => String(row.action_type)) : [];
  if (activeActions.includes("ban_user")) {
    return NextResponse.json({ error: "You are banned from this show." }, { status: 403 });
  }
  if (activeActions.includes("mute_user")) {
    return NextResponse.json({ error: "You are muted in this show." }, { status: 403 });
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

  await (admin as any).from("live_show_moderation_history").insert({
    show_id: showId,
    action_type: "chat_message",
    event_type: "chat_message",
    actor_id: user.id,
    target_user_id: user.id,
    target_username: username,
    reason: null,
    details: { message },
  });

  return NextResponse.json({ ok: true });
}
