import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMessageReports, getReportedConversations, suspendMessagingAccess, blockConversationUser } from "@/lib/messaging";
import { isAdminUser } from "@/lib/admin-access";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handleModerationAction(formData: FormData) {
  "use server";
  const action = String(formData.get("action") ?? "");
  const targetId = String(formData.get("targetId") ?? "").trim();
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const blockedId = String(formData.get("blockedId") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) throw new Error("Unauthorized");

  if (action === "suspend" && targetId) {
    await suspendMessagingAccess(targetId, true);
    return;
  }

  if (action === "unsuspend" && targetId) {
    await suspendMessagingAccess(targetId, false);
    return;
  }

  if (action === "block" && conversationId && blockedId) {
    await blockConversationUser(user.id, blockedId);
  }
}

export const metadata: Metadata = {
  title: "Compliance Dashboard",
  description: "Legal document versions, acceptance logs, disputes, moderation, and fraud controls.",
};

const modules = [
  { title: "Legal versions", description: "Track active document versions by jurisdiction" },
  { title: "User acceptances", description: "View who accepted which policy and when" },
  { title: "Seller agreements", description: "Confirm onboarding and seller rule acceptance" },
  { title: "Dispute records", description: "Review refunds, chargebacks, and escalations" },
  { title: "Moderation actions", description: "Audit bans, takedowns, and content removals" },
  { title: "Fraud investigations", description: "Monitor suspicious sellers, buyers, and giveaways" },
  { title: "IP reports", description: "Handle copyright and trademark complaints" },
  { title: "Compliance reports", description: "Export summaries for internal review and counsel" },
];

export default async function CompliancePage() {
  const [messageReports, reportedConversations] = (await Promise.all([getMessageReports(), getReportedConversations()])) as [
    Array<{ id: string; message_id: string; reporter_id: string; reason: string; details: string | null; status: string; created_at: string; updated_at: string | null }>,
    Array<{ id: string; message_id: string; reporter_id: string; reason: string; details: string | null; status: string; created_at: string; messages?: { conversation_id: string; sender_id: string; message: string; created_at: string } | null }>,
  ];

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Admin compliance</p>
          <h1 className="mt-3 text-3xl font-black">Compliance dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Track legal document versions, user acceptance logs, seller agreement acceptance, dispute history, moderation actions, fraud investigations, and messaging reports in one place.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <div key={module.title} className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
                <h2 className="font-bold text-white">{module.title}</h2>
                <p className="mt-2 text-sm text-gray-400">{module.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
              <h2 className="text-lg font-bold">Message reports</h2>
              <p className="mt-1 text-sm text-gray-400">Recent user reports on individual messages.</p>
              <div className="mt-4 space-y-3">
                {messageReports.length ? messageReports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-white">{report.reason}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-gray-500">{report.status}</span>
                    </div>
                    <p className="mt-2 text-gray-400">{report.details ?? "No extra details provided."}</p>
                    <p className="mt-2 text-xs text-gray-500">Message {report.message_id.slice(0, 8)} · Reporter {report.reporter_id.slice(0, 8)}</p>
                  </div>
                )) : <p className="text-sm text-gray-400">No message reports yet.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
              <h2 className="text-lg font-bold">Reported conversations</h2>
              <p className="mt-1 text-sm text-gray-400">Messages that need review in context.</p>
              <div className="mt-4 space-y-3">
                {reportedConversations.length ? reportedConversations.map((report) => (
                  <div key={report.id} className="rounded-xl border border-white/10 bg-[#0f0f1a] p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-white">{report.reason}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-gray-500">{report.status}</span>
                    </div>
                    <p className="mt-2 text-gray-400">{report.messages?.message ?? "Message content unavailable."}</p>
                    <p className="mt-2 text-xs text-gray-500">Conversation {report.messages?.conversation_id?.slice(0, 8) ?? "n/a"}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={handleModerationAction}>
                        <input type="hidden" name="action" value="suspend" />
                        <input type="hidden" name="targetId" value={report.messages?.sender_id ?? ""} />
                        <button className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white">Suspend sender</button>
                      </form>
                      <form action={handleModerationAction}>
                        <input type="hidden" name="action" value="unsuspend" />
                        <input type="hidden" name="targetId" value={report.messages?.sender_id ?? ""} />
                        <button className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white">Unsuspend sender</button>
                      </form>
                    </div>
                  </div>
                )) : <p className="text-sm text-gray-400">No reported conversations yet.</p>}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-6 text-sm text-gray-200">
            Legal review is required for jurisdiction-specific consumer law, privacy requirements, sweepstakes rules, arbitration language, and age-gating rules.
          </div>
        </div>
      </div>
    </div>
  );
}
