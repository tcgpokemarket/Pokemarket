import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-3xl font-black">Messages</h1>
          <p className="mt-3 text-gray-400">Sign in to access your inbox, buyer and seller conversations, and support messages.</p>
          <a href="/auth/signin" className="mt-6 inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">Sign in</a>
        </div>
      </div>
    );
  }

  const [{ data: conversations }, { data: unreadCount }] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id, conversations(*)").eq("user_id", user.id).limit(50),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("read_status", false),
  ]);

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Inbox</h1>
            <p className="text-sm text-gray-400">{unreadCount ?? 0} unread messages</p>
          </div>
          <a href="/social" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">View social feed</a>
        </div>

        <div className="mt-6 space-y-3">
          {conversations?.length ? conversations.map((item: any) => (
            <div key={item.conversation_id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
              <div className="text-sm font-semibold text-white">Conversation {item.conversation_id}</div>
              <div className="mt-1 text-sm text-gray-400">Open the thread to continue the conversation.</div>
            </div>
          )) : (
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-10 text-center text-gray-400">No conversations yet.</div>
          )}
        </div>
      </main>
    </div>
  );
}
