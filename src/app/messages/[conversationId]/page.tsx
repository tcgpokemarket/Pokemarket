import { createClient } from "@/lib/supabase/server";
import ConversationActions from "./conversation-actions";
import ConversationCompose from "./conversation-compose";
import { markConversationRead, getConversationMembers } from "@/lib/messaging";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-3xl font-black">Messages</h1>
          <p className="mt-3 text-gray-400">Sign in to view this conversation.</p>
          <a href="/auth/signin" className="mt-6 inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">Sign in</a>
        </div>
      </div>
    );
  }

  const [{ data: conversationMembers }, { data: messages }] = await Promise.all([
    supabase.from("conversation_members").select("user_id, archived, muted, last_read_at, conversations(*)").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
    supabase.from("messages").select("id, sender_id, message, attachment_url, attachment_type, context, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100),
  ]);

  const members = await getConversationMembers(conversationId);
  await markConversationRead(conversationId, user.id);

  const participants = (conversationMembers ?? []).filter((item: any) => item.user_id !== user.id);
  const lastReadAt = (members as Array<{ user_id: string; last_read_at: string | null }>).find((member) => member.user_id === user.id)?.last_read_at ?? null;

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-8 text-white">
      <main className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl font-black">Conversation</h1>
            <p className="mt-1 text-sm text-gray-400">{participants.length ? "Private marketplace thread" : "Support or system thread"}</p>
            <p className="mt-1 text-xs text-gray-500">Last read {lastReadAt ? new Date(lastReadAt).toLocaleString() : "just now"}</p>
          </div>
          <a href="/messages" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Back to inbox</a>
        </div>

        <ConversationActions conversationId={conversationId} />

        <div className="mt-6 space-y-3">
          {messages?.length ? messages.map((item: any) => (
            <div key={item.id} className={`rounded-2xl border p-4 ${item.sender_id === user.id ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-[#13131f]"}`}>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">{new Date(item.created_at).toLocaleString()}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-100">{item.message}</div>
              {item.attachment_url ? <a className="mt-3 inline-flex text-sm font-semibold text-yellow-400" href={item.attachment_url} target="_blank" rel="noreferrer">View attachment</a> : null}
            </div>
          )) : (
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-10 text-center text-gray-400">No messages yet.</div>
          )}
        </div>

        <ConversationCompose conversationId={conversationId} />
      </main>
    </div>
  );
}
