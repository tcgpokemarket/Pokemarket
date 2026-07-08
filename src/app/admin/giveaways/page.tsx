import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin-access";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminGiveawaysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    notFound();
  }


  const [{ data: giveaways }, { data: entries }, { data: audits }] = await Promise.all([
    supabase.from("giveaways").select("id, show_id, seller_id, prize_name, status, follow_required, start_at, end_at, created_at").order("created_at", { ascending: false }).limit(25),
    supabase.from("giveaway_entries").select("id, giveaway_id, user_id, following_seller, entry_status, winner_status, qualified_at, created_at").order("created_at", { ascending: false }).limit(25),
    supabase.from("giveaway_audit_logs").select("id, giveaway_id, actor_id, action, details, created_at").order("created_at", { ascending: false }).limit(25),
  ]);

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-yellow-400">Admin</p>
            <h1 className="text-3xl font-black">Giveaway operations</h1>
            <p className="mt-2 text-sm text-gray-400">Active giveaways, entries, and audit trail.</p>
          </div>
          <Link href="/admin" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Back to admin</Link>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <h2 className="text-xl font-black">Giveaways</h2>
            <div className="mt-4 space-y-3">
              {(giveaways ?? []).length ? (giveaways as Array<{ id: string; prize_name: string; status: string; follow_required: boolean; start_at: string; end_at: string }>).map((giveaway) => (
                <div key={giveaway.id} className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4 text-sm">
                  <div className="font-semibold text-white">{giveaway.prize_name}</div>
                  <div className="mt-2 text-gray-400">{giveaway.status} · {giveaway.follow_required ? "follow required" : "open entry"}</div>
                  <div className="mt-1 text-gray-500">{new Date(giveaway.start_at).toLocaleString()} → {new Date(giveaway.end_at).toLocaleString()}</div>
                </div>
              )) : <div className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-8 text-center text-gray-400">No giveaways.</div>}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <h2 className="text-xl font-black">Entries</h2>
            <div className="mt-4 space-y-3">
              {(entries ?? []).length ? (entries as Array<{ id: string; giveaway_id: string; user_id: string; following_seller: boolean; entry_status: string; winner_status: string; qualified_at: string | null; created_at: string }>).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4 text-sm">
                  <div className="font-semibold text-white">{entry.giveaway_id.slice(0, 8)}</div>
                  <div className="mt-2 text-gray-400">User {entry.user_id.slice(0, 8)} · {entry.entry_status}</div>
                  <div className="mt-1 text-gray-500">{entry.following_seller ? "Following seller" : "Not following"} · {entry.winner_status}</div>
                </div>
              )) : <div className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-8 text-center text-gray-400">No entries.</div>}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <h2 className="text-xl font-black">Audit logs</h2>
            <div className="mt-4 space-y-3">
              {(audits ?? []).length ? (audits as Array<{ id: string; giveaway_id: string; actor_id: string; action: string; details: unknown; created_at: string }>).map((audit) => (
                <div key={audit.id} className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4 text-sm">
                  <div className="font-semibold text-white">{audit.action}</div>
                  <div className="mt-2 text-gray-400">Giveaway {audit.giveaway_id.slice(0, 8)}</div>
                  <div className="mt-1 text-gray-500">Actor {audit.actor_id.slice(0, 8)}</div>
                </div>
              )) : <div className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-8 text-center text-gray-400">No audit logs.</div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
