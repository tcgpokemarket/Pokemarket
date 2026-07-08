import type { Metadata } from "next";
import Link from "next/link";
import { getSupportStats } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin-access";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Operations overview for marketplace, shipping, live commerce, and trust controls.",
};

const modules = [
  { title: "Users", description: "Profiles, seller status, and trust signals", href: "/dashboard" },
  { title: "Listings", description: "Inventory review, moderation, and featured items", href: "/dashboard" },
  { title: "Orders", description: "Checkout, fulfillment, refunds, and payouts", href: "/dashboard" },
  { title: "Unpaid auctions", description: "Pending buyer payments, deadline extensions, and cancellations", href: "/admin/unpaid-auctions" },
  { title: "Shipping", description: "Rates, labels, shipment groups, and tracking", href: "/dashboard" },
  { title: "Live shows", description: "Auctions, chat, bids, and stream health", href: "/live" },
  { title: "Giveaways", description: "Review prizes, fraud checks, and seller limits", href: "/live" },
  { title: "Fees", description: "Marketplace fee tiers and overrides", href: "/dashboard/fees" },
  { title: "Email operations", description: "Queue health, delivery logs, and retries", href: "/admin/email" },
  { title: "Giveaway operations", description: "Entries, winner tracking, and audit logs", href: "/admin/giveaways" },
] as const;

const giveawayControls = [
  "Review giveaway eligibility and fraud flags",
  "Track seller-funded giveaway expenses",
  "Handle disputes and refunds",
  "Throttle repeated giveaway abuse",
] as const;

const supportHighlights = [
  { label: "Open tickets", valueKey: "open" },
  { label: "AI handling", valueKey: "aiHandling" },
  { label: "Waiting on user", valueKey: "waitingForUser" },
  { label: "Escalated", valueKey: "escalated" },
  { label: "Resolved", valueKey: "resolved" },
] as const;

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAdminUser(user)) {
    notFound();
  }

  let supportStats = { total: 0, escalated: 0, resolved: 0, open: 0, aiHandling: 0, waitingForUser: 0 };

  try {
    supportStats = await getSupportStats();
  } catch {
    supportStats = { total: 0, escalated: 0, resolved: 0, open: 0, aiHandling: 0, waitingForUser: 0 };
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Admin dashboard</p>
          <h1 className="mt-3 text-3xl font-black">Operations overview</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Monitor the marketplace, fulfillment, live commerce, trust systems, and support activity from one place.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <a key={module.title} href={module.href} className="rounded-2xl border border-white/10 bg-[#13131f] p-5 transition-colors hover:border-yellow-400/40 hover:bg-[#171724]">
                <h2 className="font-bold text-white">{module.title}</h2>
                <p className="mt-2 text-sm text-gray-400">{module.description}</p>
              </a>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
            <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Support analytics</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                <div className="text-xs uppercase tracking-widest text-gray-500">Tickets total</div>
                <div className="mt-2 text-2xl font-black text-yellow-400">{supportStats.total}</div>
              </div>
              {supportHighlights.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                  <div className="text-xs uppercase tracking-widest text-gray-500">{item.label}</div>
                  <div className="mt-2 text-2xl font-black text-yellow-400">{supportStats[item.valueKey]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
            <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Giveaway admin controls</div>
            <div className="grid gap-3 md:grid-cols-2">
              {giveawayControls.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
