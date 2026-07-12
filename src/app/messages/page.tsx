import Link from "next/link";

const demoConversations = [
  { id: "conv-1", preview: "Open the thread to continue the conversation.", updated: "Today" },
  { id: "conv-2", preview: "Seller replied with shipping details.", updated: "Yesterday" },
  { id: "conv-3", preview: "Support request received.", updated: "2d ago" },
];

export default function MessagesPage() {
  const query = "";

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black">Inbox</h1>
            <p className="text-sm text-gray-400">Demo inbox shell for the static export build.</p>
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
              {demoConversations.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-[#0f0f1a] p-3 text-sm text-gray-300">
                  <div className="font-semibold text-white">Conversation {item.id}</div>
                  <div className="mt-1 text-gray-400">Search is available once message indexing is connected.</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {demoConversations.map((item) => (
            <Link key={item.id} href={`/messages/${item.id}`} className="block rounded-2xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/60">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Conversation {item.id}</div>
                <div className="text-xs text-gray-500">{item.updated}</div>
              </div>
              <div className="mt-1 text-sm text-gray-400">{item.preview}</div>
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-gray-500">Direct message</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
