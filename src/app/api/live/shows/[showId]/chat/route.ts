import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LIVE_MAX_CHAT_LENGTH, createShowEvent } from "@/lib/live-shows";

export async function POST(req: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { message?: string; role?: string; highlighted?: boolean };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > LIVE_MAX_CHAT_LENGTH) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const { data: show } = await supabase.from("live_shows").select("seller_id, status, auction_settings").eq("id", showId).single();
  const showRow = show as any;
  if (!showRow) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  if (showRow.status !== "live") {
    return NextResponse.json({ error: "Show is not live" }, { status: 409 });
  }

  const auctionSettings = showRow.auction_settings ?? {};
  const isHost = user.id === showRow.seller_id;
  if (body.role === "seller" && !isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blockedWords = Array.isArray(auctionSettings.blocked_words) ? auctionSettings.blocked_words : [];










































































































  const lowered = message.toLowerCase();
  if (blockedWords.some((word: string) => lowered.includes(word.toLowerCase()))) {
    return NextResponse.json({ error: "Message contains blocked words" }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("username, full_name").eq("id", user.id).single();
  const profileRow = profile as any;
  const username = profileRow?.username ?? profileRow?.full_name ?? "Viewer";

  const { error } = await supabase.from("live_chat").insert({
    show_id: showId,
    user_id: user.id,
    username,
    message,
    role: body.role ?? (user.id === showRow.seller_id ? "seller" : "viewer"),
    highlighted: Boolean(body.highlighted),
  } as any);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createShowEvent({
    show_id: showId,
    event_type: "chat_message",
    payload: { userId: user.id, message },
    created_by: user.id,
  });

  return NextResponse.json({ ok: true });
}
