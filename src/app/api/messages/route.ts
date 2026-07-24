import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  archiveConversation,
  blockConversationUser,
  createConversation,
  deleteConversation,
  getConversationMembers,
  listUserConversations,
  markConversationRead,
  reportMessage,
  sendMessage,
  setConversationMuted,
  updateConversationPrivacyRule,
} from "@/lib/messaging";
import {
  addSupportResponse,
  appendSupportTicketEvent,
  createSupportTicket,
  getSupportAgentGreeting,
  routeSupportAgent,
  shouldEscalateSupport,
  updateSupportTicketStatus,
} from "@/lib/support";

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

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function handleInboxList() {
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await listUserConversations(user.id);
  const conversationIds = rows.map((row) => row.conversation_id);
  const unreadConversationIds = new Set<string>();

  if (conversationIds.length) {
    const { data: unreadMessages, error } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("read_status", false)
      .neq("sender_id", user.id);

    if (!error) {
      for (const row of unreadMessages ?? []) {
        unreadConversationIds.add((row as { conversation_id: string }).conversation_id);
      }
    }
  }

  return NextResponse.json({
    conversations: rows.map((row) => ({
      conversationId: row.conversation_id,
      archived: row.archived,
      muted: row.muted,
      lastReadAt: row.last_read_at,
      unread: unreadConversationIds.has(row.conversation_id),
      conversation: row.conversations,
    })),
  });
}

async function handleConversationMessages(conversationId: string) {
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await requireConversationMember(conversationId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim() ?? "";
  if (!conversationId) {
    return handleInboxList();
  }

  return handleConversationMessages(conversationId);
}

export async function POST(req: Request) {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = normalizeString(body.action) || "send";
  const conversationId = normalizeString(body.conversationId);

  if (action === "read") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    if (!(await requireConversationMember(conversationId, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await markConversationRead(conversationId, user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "archive") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    if (!(await requireConversationMember(conversationId, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await archiveConversation(conversationId, user.id, Boolean(body.archived ?? true));
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    if (!(await requireConversationMember(conversationId, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await deleteConversation(conversationId, user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "mute") {
    if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    if (!(await requireConversationMember(conversationId, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const blockedId = normalizeString(body.blockedId);
    if (!blockedId) return NextResponse.json({ error: "Missing blockedId" }, { status: 400 });
    await blockConversationUser(user.id, blockedId);
    return NextResponse.json({ ok: true });
  }

  if (action === "report") {
    const messageId = normalizeString(body.messageId);
    const reason = normalizeString(body.reason);
    if (!messageId || !reason) return NextResponse.json({ error: "Missing report data" }, { status: 400 });
    await reportMessage(messageId, user.id, reason, normalizeString(body.details) || undefined);
    return NextResponse.json({ ok: true });
  }

  if (action === "support") {
    try {
      const category = normalizeString(body.category) || "general_question";
      const issueSummary = normalizeString(body.issueSummary);
      const priority = normalizeString(body.priority) || "normal";
      const orderId = normalizeString(body.orderId) || null;
      const listingId = normalizeString(body.listingId) || null;
      const sellerId = normalizeString(body.sellerId) || null;
      const conversationIdInput = normalizeString(body.conversationId) || null;
      if (!issueSummary) return NextResponse.json({ error: "Missing issue summary" }, { status: 400 });

      const assignedAiAgent = routeSupportAgent(category as Parameters<typeof routeSupportAgent>[0]);
      const ticket = await createSupportTicket({
        userId: user.id,
        category: category as Parameters<typeof createSupportTicket>[0]["category"],
        issueSummary,
        priority,
        orderId,
        listingId,
        sellerId,
        conversationId: conversationIdInput,
        assignedAiAgent,
      });

      const greeting = await getSupportAgentGreeting(assignedAiAgent, category as Parameters<typeof routeSupportAgent>[0], issueSummary);
      const needsHuman = shouldEscalateSupport(category as Parameters<typeof routeSupportAgent>[0], priority, issueSummary);

      await addSupportResponse({
        ticketId: ticket.id,
        assistantRole: assignedAiAgent,
        responseText: greeting,
        policyNotes: needsHuman ? "Escalated due to sensitive category or priority." : "Handled by AI support workflow.",
        needsHuman,
      });

      await appendSupportTicketEvent(ticket.id, "created", { category, priority, orderId, listingId, sellerId, conversationId: conversationIdInput });
      if (needsHuman) {
        await updateSupportTicketStatus(ticket.id, "escalated", "Escalated to human support.");
      } else {
        await updateSupportTicketStatus(ticket.id, "ai_handling");
      }

      return NextResponse.json({ ok: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber, assistantRole: assignedAiAgent, needsHuman, message: greeting });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Support is temporarily unavailable.";
      console.error("[messages.support] failed", { userId: user.id, error: message });
      return NextResponse.json({ error: "Support is temporarily unavailable right now." }, { status: 503 });
    }
  }

  const message = normalizeString(body.message);
  const recipientId = normalizeString(body.recipientId);
  const contextType = typeof body.contextType === "string" ? body.contextType : null;
  const contextId = typeof body.contextId === "string" ? body.contextId : null;
  const attachmentUrl = typeof body.attachmentUrl === "string" ? body.attachmentUrl : null;
  const attachmentType = typeof body.attachmentType === "string" ? body.attachmentType : null;

  if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });
  if (!conversationId && !recipientId) return NextResponse.json({ error: "Missing recipient" }, { status: 400 });

  const resolvedConversationId = conversationId
    ? conversationId
    : await createConversation({
        contextType,
        contextId,
        memberIds: [user.id, recipientId],
      });

  if (!(await requireConversationMember(resolvedConversationId, user.id))) {
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
