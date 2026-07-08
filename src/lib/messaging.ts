import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getUserConversations(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversation_members")
    .select("conversation_id, conversations(*)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, foreignTable: "conversations" })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createConversation(context: { contextType?: string | null; contextId?: string | null; memberIds: string[] }) {
  const admin = createAdminClient();
  const { data: conversation, error: convError } = await (admin as any)
    .from("conversations")
    .insert({ context_type: context.contextType ?? null, context_id: context.contextId ?? null })
    .select("id")
    .single();
  if (convError || !conversation) throw new Error(convError?.message ?? "Unable to create conversation");

  const conversationRow = conversation as { id: string };
  const uniqueMembers = context.memberIds.filter(Boolean).filter((memberId, index, array) => array.indexOf(memberId) === index);
  const members = uniqueMembers.map((userId) => ({ conversation_id: conversationRow.id, user_id: userId }));
  const { error: membersError } = await admin.from("conversation_members").insert(members as any);
  if (membersError) throw new Error(membersError.message);

  return conversationRow.id;
}

export async function sendMessage(input: { conversationId: string; senderId: string; message: string; attachmentUrl?: string | null; attachmentType?: string | null; context?: Record<string, unknown> }) {
  const admin = createAdminClient();
  const payload = {
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    message: input.message,
    attachment_url: input.attachmentUrl ?? null,
    attachment_type: input.attachmentType ?? null,
    context: input.context ?? {},
    read_status: false,
  };
  const { data: inserted, error } = await (admin as any).from("messages").insert(payload).select("id, conversation_id").single();

  if (error || !inserted) throw new Error(error?.message ?? "Unable to send message");
  await (admin as any).from("conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: input.message.slice(0, 120) }).eq("id", input.conversationId);
  return inserted;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error: memberError } = await (admin as any)
    .from("conversation_members")
    .update({ last_read_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (memberError) throw new Error(memberError.message);

  const { error } = await (admin as any)
    .from("messages")
    .update({ read_status: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId);
  if (error) throw new Error(error.message);
}

export async function blockConversationUser(blockerId: string, blockedId: string) {
  const admin = createAdminClient();
  const { error } = await (admin as any).from("message_blocks").upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw new Error(error.message);
}

export async function reportMessage(messageId: string, reporterId: string, reason: string, details?: string) {
  const admin = createAdminClient();
  const { error } = await (admin as any).from("message_reports").upsert({ message_id: messageId, reporter_id: reporterId, reason, details: details ?? null }, { onConflict: "message_id,reporter_id" });
  if (error) throw new Error(error.message);
}

export async function getConversationMembers(conversationId: string) {
  const admin = createAdminClient();
  const { data, error } = await (admin as any).from("conversation_members").select("user_id, role, muted, archived, last_read_at").eq("conversation_id", conversationId);
  if (error) throw new Error(error.message);
  return data ?? [];
}
