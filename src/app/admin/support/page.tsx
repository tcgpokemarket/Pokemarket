import type { Metadata } from "next";
import { getSupportStats, getSupportTickets } from "@/lib/support";

type SupportTicketRow = {
  id: string;
  ticket_number: string | null;
  user_id: string;
  order_id: string | null;
  listing_id: string | null;
  seller_id: string | null;
  conversation_id: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_ai_agent: string | null;
  assigned_human_agent: string | null;
  issue_summary: string;
  resolution_notes: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  created_at: string;
};


export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support Tickets",
  description: "Review marketplace support tickets, escalations, and resolution status.",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function AdminSupportPage() {
  const [stats, tickets] = await Promise.all([getSupportStats(), getSupportTickets()]);
  const supportTickets = tickets as SupportTicketRow[];


  return (
    <div className="px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Admin support</p>
          <h1 className="mt-3 text-3xl font-black">Support tickets</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">Live support records from the marketplace, including escalations, AI handling, and unresolved issues.</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Total", value: stats.total },
              { label: "Open", value: stats.open },
              { label: "Escalated", value: stats.escalated },
              { label: "AI handling", value: stats.aiHandling },
              { label: "Waiting", value: stats.waitingForUser },
              { label: "Resolved", value: stats.resolved },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                <div className="text-xs uppercase tracking-widest text-gray-500">{item.label}</div>
                <div className="mt-2 text-2xl font-black text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {supportTickets.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-gray-400">
              No support tickets found.
            </div>
          ) : (
            supportTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-widest text-gray-500">
                      <span>#{ticket.ticket_number ?? ticket.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span>{ticket.category}</span>
                      <span>•</span>
                      <span>{ticket.priority}</span>
                    </div>
                    <h2 className="text-xl font-bold text-white">{ticket.issue_summary}</h2>
                    <p className="text-sm text-gray-400">User: {ticket.user_id}</p>
                    <p className="text-sm text-gray-400">Order: {ticket.order_id ?? "—"} · Listing: {ticket.listing_id ?? "—"} · Seller: {ticket.seller_id ?? "—"}</p>
                    <p className="text-sm text-gray-400">Conversation: {ticket.conversation_id ?? "—"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-gray-300">{ticket.status}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-gray-300">AI: {ticket.assigned_ai_agent ?? "—"}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-gray-300">Human: {ticket.assigned_human_agent ?? "—"}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-gray-300">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Created</div>
                    <div className="mt-1">{formatDate(ticket.created_at)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Escalated</div>
                    <div className="mt-1">{formatDate(ticket.escalated_at)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-widest text-gray-500">Resolved</div>
                    <div className="mt-1">{formatDate(ticket.resolved_at)}</div>
                  </div>
                </div>

                {ticket.resolution_notes ? (
                  <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                    {ticket.resolution_notes}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
