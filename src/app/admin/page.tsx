import type { Metadata } from "next";
import Link from "next/link";
import AdminGate from "./AdminGate";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Operations overview for marketplace, shipping, live commerce, and trust controls.",
};

const modules = [
  { title: "Users", href: "/dashboard" },
  { title: "Seller verification", href: "/admin/verification" },
  { title: "Listings", href: "/dashboard" },
  { title: "Orders", href: "/dashboard" },
  { title: "Shipping", href: "/dashboard" },
  { title: "Live shows", href: "/live" },
  { title: "Fees", href: "/dashboard/fees" },
  { title: "Referral tools", href: "/admin/referrals" },
] as const;

export default function AdminPage() {
  return (
    <AdminGate>
      <div className="px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-widest text-yellow-400">Admin dashboard</p>
            <h1 className="mt-3 text-3xl font-black">Operations overview</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">
              Monitor marketplace operations.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => (
                <Link key={module.title} href={module.href} className="rounded-2xl border border-white/10 bg-[#13131f] p-5 transition-colors hover:border-yellow-400/40 hover:bg-[#171724]">
                  <h2 className="font-bold text-white">{module.title}</h2>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminGate>
  );
}
