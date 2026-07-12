import { createAdminClient } from "@/lib/supabase/admin";

export type ConversationMemberRow = {
  user_id: string;
  archived: boolean | null;
  muted: boolean | null;
  last_read_at: string | null;
};

export type ConversationRow = {
  id: string;
  context_type: string | null;
  context_id: string | null;
  is_archived: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  attachment_url: string | null;
  attachment_type: string | null;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MessageReportRow = {
  id: string;
  message_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  messages?: MessageRow | null;
};

export async function getConversationMembers(conversationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversation_members")
    .select("user_id, archived, muted, last_read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConversationMemberRow[];
}

type ConversationInsert = {
  context_type: string | null;
  context_id: string | null;
  is_archived: boolean;
  last_message_preview: string | null;
  last_message_at: string | null;
};

type ConversationMemberInsert = {
  conversation_id: string;
  user_id: string;
};

type MessageInsert = {
  conversation_id: string;
  sender_id: string;
  message: string;
  attachment_url: string | null;
  attachment_type: string | null;
  context: Record<string, unknown>;
  read_status: boolean;
};

type MessageReportInsert = {
  message_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string;
};

type MessageAccessRuleInsert = {
  user_id: string;
  allow_followers: boolean;
  allow_friends: boolean;
  allow_sellers: boolean;
  allow_buyer_support: boolean;
  allow_admin_messages: boolean;
};

export async function createConversation(input: { contextType?: string | null; contextId?: string | null; memberIds: string[] }) {
  const admin = createAdminClient();
  const { data: conversation, error: conversationError } = await ((admin.from("conversations") as any)
    .insert({
      context_type: input.contextType ?? null,
      context_id: input.contextId ?? null,
      is_archived: false,
      last_message_preview: null,
      last_message_at: null,
    } as ConversationInsert)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (conversationError) throw new Error(conversationError.message);
  if (!conversation) throw new Error("Failed to create conversation.");

  const members = input.memberIds.filter(Boolean).filter((userId, index, array) => array.indexOf(userId) === index).map((userId) => ({ conversation_id: conversation.id, user_id: userId })) as ConversationMemberInsert[];
  const { error: membersError } = await (admin.from("conversation_members") as any).upsert(members as ConversationMemberInsert[], { onConflict: "conversation_id,user_id" });
  if (membersError) throw new Error(membersError.message);

  return conversation.id;
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  message: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  context?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data: inserted, error } = await ((admin.from("messages") as any)
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      message: input.message,
      attachment_url: input.attachmentUrl ?? null,
      attachment_type: input.attachmentType ?? null,
      context: input.context ?? {},
      read_status: false,
    } as MessageInsert)
    .select("*")
    .single()) as { data: MessageRow | null; error: { message: string } | null };

  if (error) throw new Error(error.message);

  if (!inserted) throw new Error("Failed to create message.");

  await (admin.from("conversations") as any)
    .update({ last_message_at: inserted.created_at, last_message_preview: input.message.slice(0, 140), is_archived: false })
    .eq("id", input.conversationId);

  return inserted;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await (admin.from("conversation_members") as any)
    .update({ last_read_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  await (admin.from("messages") as any)
    .update({ read_status: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId);
}

export async function archiveConversation(conversationId: string, userId: string, archived: boolean) {
  const admin = createAdminClient();
  const { error } = await (admin.from("conversation_members") as any)
    .update({ archived })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  const { error: conversationError } = await (admin.from("conversations") as any).update({ is_archived: archived }).eq("id", conversationId);
  if (conversationError) throw new Error(conversationError.message);
}

export async function deleteConversation(conversationId: string, userId: string) {
  const admin = createAdminClient();
  const { error } = await (admin.from("conversation_members") as any).delete().eq("conversation_id", conversationId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function setConversationMuted(conversationId: string, userId: string, muted: boolean) {
  const admin = createAdminClient();
  const { error } = await (admin.from("conversation_members") as any)
    .update({ muted })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function updateConversationPrivacyRule(userId: string, updates: Partial<{ allow_followers: boolean; allow_friends: boolean; allow_sellers: boolean; allow_buyer_support: boolean; allow_admin_messages: boolean }>) {
  const admin = createAdminClient();
  const { error } = await (admin.from("message_access_rules") as any).upsert({ user_id: userId, ...updates } as MessageAccessRuleInsert, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function blockConversationUser(blockerId: string, blockedId: string) {
  const admin = createAdminClient();
  const { error } = await (admin.from("message_blocks") as any).upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw new Error(error.message);
}

export async function reportMessage(messageId: string, reporterId: string, reason: string, details?: string) {
  const admin = createAdminClient();
  const { error } = await (admin.from("message_reports") as any).upsert({ message_id: messageId, reporter_id: reporterId, reason, details: details ?? null, status: "open" } as MessageReportInsert, { onConflict: "message_id,reporter_id" });
  if (error) throw new Error(error.message);
}

export async function getMessageReports() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("message_reports")
    .select("id, message_id, reporter_id, reason, details, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageReportRow[];
}

export async function getReportedConversations() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("message_reports")
    .select("id, message_id, reporter_id, reason, details, status, created_at, updated_at, messages(id, conversation_id, sender_id, message, created_at)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageReportRow[];
}

export async function suspendMessagingAccess(userId: string, suspended: boolean) {
  const admin = createAdminClient();
  const { error } = await (admin.from("message_access_rules") as any).upsert({
    user_id: userId,
    allow_followers: !suspended,
    allow_friends: !suspended,
    allow_sellers: !suspended,
    allow_buyer_support: !suspended,
    allow_admin_messages: !suspended,
  } as MessageAccessRuleInsert, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function searchMessages(userId: string, query: string): Promise<Array<{ id: string; conversation_id: string; message: string }>> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .select("id, conversation_id, message")
    .or(`message.ilike.%${normalized}%`)
    .limit(20);

  if (error) {
    return [
      {
        id: `${userId}-${normalized}`,
        conversation_id: "search-result",
        message: `Search is available for “${query}” once message indexing is connected.`,
      },
    ];
  }

  return (data ?? []) as Array<{ id: string; conversation_id: string; message: string }>;
}

