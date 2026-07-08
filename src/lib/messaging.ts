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
  const { data: inserted, error } = await admin.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    message: input.message,
    attachment_url: input.attachmentUrl ?? null,
    attachment_type: input.attachmentType ?? null,
    context: input.context ?? {},
    read_status: false,
  } as any).select("id, conversation_id").single();

  if (error || !inserted) throw new Error(error?.message ?? "Unable to send message");
  return inserted;
}
