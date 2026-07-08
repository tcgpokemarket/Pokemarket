import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createConversation, sendMessage } from "@/lib/messaging";

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
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const message = String(body.message ?? "").trim();
  const recipientId = String(body.recipientId ?? "").trim();
  const contextType = typeof body.contextType === "string" ? body.contextType : null;
  const contextId = typeof body.contextId === "string" ? body.contextId : null;

  if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });
  if (!recipientId && !body.conversationId) return NextResponse.json({ error: "Missing recipient" }, { status: 400 });

  let conversationId = String(body.conversationId ?? "");
  if (!conversationId) {
    conversationId = await createConversation({ contextType, contextId, memberIds: [user.id, recipientId] });
  }

  const inserted = await sendMessage({ conversationId, senderId: user.id, message, context: { contextType, contextId } });
  return NextResponse.json({ ok: true, message: inserted, conversationId });
}
