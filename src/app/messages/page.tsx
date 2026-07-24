import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchMessages } from "@/lib/messaging";

export default async function MessagesPage({ searchParams }: { searchParams?: { q?: string } }) {
  const query = searchParams?.q?.trim() ?? "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const results = user && query ? await searchMessages(user.id, query) : [];

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black">Inbox</h1>
            <p className="text-sm text-gray-400">Private marketplace messages and support threads.</p>
          </div>
          <div className="grid gap-3 md:max-w-md">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">Support</div>
              <div className="mt-2 text-lg font-black text-white">Need help now?</div>
              <p className="mt-2 text-sm leading-6 text-gray-300">Open an AI support ticket for orders, seller help, live auctions, or safety questions.</p>
              <Link href="/support" className="mt-4 inline-flex text-sm font-semibold text-yellow-400">Open support →</Link>
            </div>
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
              {results.length ? results.map((item) => (
                <Link key={item.id} href={`/messages/${item.conversation_id}`} className="block rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm text-gray-300 transition hover:border-yellow-400/40">
                  <div className="font-semibold text-white">Conversation {item.conversation_id}</div>
                  <div className="mt-1 text-gray-400">{item.message}</div>
                </Link>
              )) : (
                <div className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm text-gray-300">No matching messages yet.</div>
              )}
            </div>
          </div>
        ) : null}

        {user ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
            Your recent conversations load in the conversation view after sign-in.
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
            Sign in to view your private messages.
          </div>
        )}
      </main>
    </div>
  );
}
