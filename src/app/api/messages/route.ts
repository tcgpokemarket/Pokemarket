import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { blockConversationUser, createConversation, getConversationMembers, markConversationRead, reportMessage, sendMessage } from "@/lib/messaging";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action ?? "send");
  const conversationId = String(body.conversationId ?? "").trim();

  if (action === "read") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    await markConversationRead(conversationId, user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "block") {
    const blockedId = String(body.blockedId ?? "").trim();
    if (!blockedId) return NextResponse.json({ error: "Missing blockedId" }, { status: 400 });
    await blockConversationUser(user.id, blockedId);
    return NextResponse.json({ ok: true });
  }

  if (action === "report") {
    const messageId = String(body.messageId ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    if (!messageId || !reason) return NextResponse.json({ error: "Missing report data" }, { status: 400 });
    await reportMessage(messageId, user.id, reason, typeof body.details === "string" ? body.details : undefined);
    return NextResponse.json({ ok: true });
  }

  const message = String(body.message ?? "").trim();
  const recipientId = String(body.recipientId ?? "").trim();
  const contextType = typeof body.contextType === "string" ? body.contextType : null;
  const contextId = typeof body.contextId === "string" ? body.contextId : null;

  if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });
  if (!recipientId && !conversationId) return NextResponse.json({ error: "Missing recipient" }, { status: 400 });

  let resolvedConversationId = conversationId;
  if (!resolvedConversationId) {
    resolvedConversationId = await createConversation({ contextType, contextId, memberIds: [user.id, recipientId] });
  }

  const inserted = await sendMessage({ conversationId: resolvedConversationId, senderId: user.id, message, context: { contextType, contextId } });
  return NextResponse.json({ ok: true, message: inserted, conversationId: resolvedConversationId });
}
