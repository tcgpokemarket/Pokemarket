import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Operations overview for marketplace, shipping, live commerce, and trust controls.",
};

const modules = [
  { title: "Users", description: "Profiles, seller status, and trust signals", href: "/dashboard" },
  { title: "Seller verification", description: "Approve or reject seller identity checks", href: "/admin/verification" },
  { title: "Listings", description: "Inventory review, moderation, and featured items", href: "/dashboard" },
  { title: "Orders", description: "Checkout, fulfillment, refunds, and payouts", href: "/dashboard" },
  { title: "Shipping", description: "Rates, labels, shipment groups, and tracking", href: "/dashboard" },
  { title: "Live shows", description: "Auctions, chat, bids, and stream health", href: "/live" },
  { title: "Fees", description: "Marketplace fee tiers and overrides", href: "/dashboard/fees" },
] as const;

export default function AdminPage() {
  return (
    <div className="px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Admin dashboard</p>
          <h1 className="mt-3 text-3xl font-black">Operations overview</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Monitor the marketplace, fulfillment, live commerce, and trust systems from one place.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <a key={module.title} href={module.href} className="rounded-2xl border border-white/10 bg-[#13131f] p-5 transition-colors hover:border-yellow-400/40 hover:bg-[#171724]">
                <h2 className="font-bold text-white">{module.title}</h2>
                <p className="mt-2 text-sm text-gray-400">{module.description}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
