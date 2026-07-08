import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SupportInlineCard from "@/components/support/support-inline-card";

export const dynamic = "force-dynamic";

type MessagesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-3xl font-black">Messages</h1>
          <p className="mt-3 text-gray-400">Sign in to access your inbox, buyer and seller conversations, and support messages.</p>
          <a href="/auth/signin" className="mt-6 inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const searchResults: Array<{ id: string; conversation_id: string; message: string }> = query
    ? await import("@/lib/messaging").then(({ searchMessages }) => searchMessages(user.id, query))
    : [];

  const [{ data: conversations }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("conversation_members")
      .select("conversation_id, archived, muted, last_read_at, conversations(id, last_message_at, last_message_preview, context_type, context_id, updated_at, is_archived)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false, foreignTable: "conversations" })
      .limit(50),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("read_status", false),
  ]);

  const conversationRows = (conversations ?? []) as Array<{
    conversation_id: string;
    archived: boolean;
    muted: boolean;
    last_read_at: string | null;
    conversations: {
      id: string;
      last_message_at: string | null;
      last_message_preview: string | null;
      context_type: string | null;
      context_id: string | null;
      updated_at: string;
      is_archived: boolean;
    } | null;
  }>;

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black">Inbox</h1>
            <p className="text-sm text-gray-400">{unreadCount ?? 0} unread messages</p>
          </div>
          <div className="grid gap-3 md:max-w-md">
            <SupportInlineCard title="Need help now?" description="Open an AI support ticket for orders, seller help, live auctions, or safety questions." href="/support" />
            <form className="flex gap-2" action="/messages" method="get">
              <input name="q" defaultValue={query} placeholder="Search messages" className="min-w-64 rounded-xl border border-white/10 bg-[#13131f] px-4 py-2 text-sm text-white outline-none" />
              <button className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Search</button>
            </form>
          </div>
        </div>

        {query ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#13131f] p-4">
            <div className="text-sm font-semibold text-white">Search results for “{query}”</div>
            <div className="mt-3 space-y-2">
              {searchResults.length ? (
                searchResults.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm text-gray-300">
                    <div className="font-semibold text-white">Conversation {item.conversation_id.slice(0, 8)}</div>
                    <div className="mt-1 text-gray-400">{item.message}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-400">No matches found.</div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {conversationRows.length ? (
            conversationRows.map((item) => (
              <Link key={item.conversation_id} href={`/messages/${item.conversation_id}`} className="block rounded-2xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Conversation {item.conversation_id.slice(0, 8)}</div>
                  <div className="text-xs text-gray-500">{item.conversations?.last_message_at ? new Date(item.conversations.last_message_at).toLocaleDateString() : "New"}</div>
                </div>
                <div className="mt-1 text-sm text-gray-400">{item.conversations?.last_message_preview ?? "Open the thread to continue the conversation."}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.2em] text-gray-500">{item.conversations?.context_type ? item.conversations.context_type.replace(/_/g, " ") : "Direct message"}</div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-10 text-center text-gray-400">No conversations yet.</div>
          )}
        </div>
      </main>
    </div>
  );
}
