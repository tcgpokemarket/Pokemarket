import type { Metadata } from "next";

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

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Admin compliance</p>
          <h1 className="mt-3 text-3xl font-black">Compliance dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Track legal document versions, user acceptance logs, seller agreement acceptance, dispute history, moderation actions, fraud investigations, and IP reports in one place.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <div key={module.title} className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
                <h2 className="font-bold text-white">{module.title}</h2>
                <p className="mt-2 text-sm text-gray-400">{module.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-6 text-sm text-gray-200">
            Legal review is required for jurisdiction-specific consumer law, privacy requirements, sweepstakes rules, arbitration language, and age-gating rules.
          </div>
        </div>
      </div>
    </div>
  );
}
