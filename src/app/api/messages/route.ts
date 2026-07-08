import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  archiveConversation,
  blockConversationUser,
  createConversation,
  deleteConversation,
  getConversationMembers,
  markConversationRead,
  reportMessage,
  sendMessage,
  setConversationMuted,
  updateConversationPrivacyRule,
} from "@/lib/messaging";

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function requireConversationMember(conversationId: string, userId: string) {
  const members = (await getConversationMembers(conversationId)) as Array<{ user_id: string }>;
  return members.some((member) => member.user_id === userId);
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  const isMember = await requireConversationMember(conversationId, user.id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "send");
  const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";

  if (action === "read") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    if (!(await requireConversationMember(conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await markConversationRead(conversationId, user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "archive") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    if (!(await requireConversationMember(conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await archiveConversation(conversationId, user.id, Boolean(body.archived ?? true));
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    if (!(await requireConversationMember(conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await deleteConversation(conversationId, user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "mute") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    if (!(await requireConversationMember(conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await setConversationMuted(conversationId, user.id, Boolean(body.muted ?? true));
    return NextResponse.json({ ok: true });
  }

  if (action === "privacy") {
    await updateConversationPrivacyRule(user.id, {
      allow_followers: typeof body.allowFollowers === "boolean" ? body.allowFollowers : undefined,
      allow_friends: typeof body.allowFriends === "boolean" ? body.allowFriends : undefined,
      allow_sellers: typeof body.allowSellers === "boolean" ? body.allowSellers : undefined,
      allow_buyer_support: typeof body.allowBuyerSupport === "boolean" ? body.allowBuyerSupport : undefined,
      allow_admin_messages: typeof body.allowAdminMessages === "boolean" ? body.allowAdminMessages : undefined,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "block") {
    const blockedId = typeof body.blockedId === "string" ? body.blockedId.trim() : "";
    if (!blockedId) return NextResponse.json({ error: "Missing blockedId" }, { status: 400 });
    await blockConversationUser(user.id, blockedId);
    return NextResponse.json({ ok: true });
  }

  if (action === "report") {
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!messageId || !reason) return NextResponse.json({ error: "Missing report data" }, { status: 400 });
    await reportMessage(messageId, user.id, reason, typeof body.details === "string" ? body.details : undefined);
    return NextResponse.json({ ok: true });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const recipientId = typeof body.recipientId === "string" ? body.recipientId.trim() : "";
  const contextType = typeof body.contextType === "string" ? body.contextType : null;
  const contextId = typeof body.contextId === "string" ? body.contextId : null;
  const attachmentUrl = typeof body.attachmentUrl === "string" ? body.attachmentUrl : null;
  const attachmentType = typeof body.attachmentType === "string" ? body.attachmentType : null;

  if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });
  if (!conversationId && !recipientId) return NextResponse.json({ error: "Missing recipient" }, { status: 400 });

  let resolvedConversationId = conversationId;
  if (!resolvedConversationId) {
    resolvedConversationId = await createConversation({ contextType, contextId, memberIds: [user.id, recipientId] });
  } else if (!(await requireConversationMember(resolvedConversationId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inserted = await sendMessage({
    conversationId: resolvedConversationId,
    senderId: user.id,
    message,
    attachmentUrl,
    attachmentType,
    context: { contextType, contextId },
  });

  return NextResponse.json({ ok: true, message: inserted, conversationId: resolvedConversationId });
}
