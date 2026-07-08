import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminEmailPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    notFound();
  }



  const admin = createAdminClient();
  const [{ data: queue }, { data: logs }] = await Promise.all([
    admin.from("email_queue").select("id, template_name, recipient_email, status, attempts, next_attempt_at, last_error, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("email_logs").select("id, email_type, template_name, recipient_email, status, provider_message_id, error_message, sent_at, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-yellow-400">Admin</p>
            <h1 className="text-3xl font-black">Email operations</h1>
            <p className="mt-2 text-sm text-gray-400">Queue health, retries, and delivery outcomes.</p>
          </div>
          <Link href="/admin" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Back to admin</Link>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <h2 className="text-xl font-black">Queue</h2>
            <div className="mt-4 space-y-3">
              {(queue ?? []).length ? (queue as Array<{ id: string; template_name: string; recipient_email: string; status: string; attempts: number; next_attempt_at: string; last_error: string | null }>).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">{item.template_name}</div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">{item.status}</div>
                  </div>
                  <div className="mt-2 text-gray-400">{item.recipient_email}</div>
                  <div className="mt-1 text-gray-500">Attempts: {item.attempts} · Next retry: {new Date(item.next_attempt_at).toLocaleString()}</div>
                  {item.last_error ? <div className="mt-2 text-red-300">{item.last_error}</div> : null}
                </div>
              )) : <div className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-8 text-center text-gray-400">No queued emails.</div>}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <h2 className="text-xl font-black">Delivery log</h2>
            <div className="mt-4 space-y-3">
              {(logs ?? []).length ? (logs as Array<{ id: string; email_type: string; template_name: string | null; recipient_email: string; status: string; provider_message_id: string | null; error_message: string | null; sent_at: string | null }>).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">{item.email_type}</div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">{item.status}</div>
                  </div>
                  <div className="mt-2 text-gray-400">{item.recipient_email}</div>
                  <div className="mt-1 text-gray-500">{item.template_name ?? "Template missing"}</div>
                  {item.error_message ? <div className="mt-2 text-red-300">{item.error_message}</div> : null}
                  {item.provider_message_id ? <div className="mt-2 text-gray-500">Provider ID: {item.provider_message_id}</div> : null}
                  {item.sent_at ? <div className="mt-1 text-gray-500">Sent: {new Date(item.sent_at).toLocaleString()}</div> : null}
                </div>
              )) : <div className="rounded-2xl border border-white/10 bg-[#0f0f1a] p-8 text-center text-gray-400">No delivery logs.</div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
