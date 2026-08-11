import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/security";
import AdminGate from "./AdminGate";

export const metadata: Metadata = {
  title: "Admin Control Center",
  description: "Admin control center connected to the live TCG Poké Market dashboard and operations modules.",
};

type AdminModule = {
  title: string;
  description: string;
  href: string;
  area: "Operations" | "Commerce" | "Trust" | "System";
};

const modules: AdminModule[] = [
  { title: "User dashboard", description: "Open the live dashboard and verify user-facing listings, purchases, sales, wallet, fees, and live tools.", href: "/dashboard", area: "Operations" },
  { title: "Listings", description: "Review the production marketplace listing workflow and seller listing controls.", href: "/dashboard?tab=listings", area: "Commerce" },
  { title: "Purchases", description: "Inspect the buyer order experience and purchase records.", href: "/dashboard?tab=purchases", area: "Commerce" },
  { title: "Sales", description: "Inspect seller orders, sales status, shipping workflow, and seller-side records.", href: "/dashboard?tab=sales", area: "Commerce" },
  { title: "Seller fees", description: "Review the live seller fee experience and fee calculations.", href: "/dashboard/fees", area: "Commerce" },
  { title: "Live auctions", description: "Open the live auction dashboard used by marketplace users and sellers.", href: "/dashboard/live-auctions", area: "Commerce" },
  { title: "Seller verification", description: "Review and manage the existing seller verification workflow.", href: "/admin/verification", area: "Trust" },
  { title: "Referrals", description: "Manage the existing referral administration workflow.", href: "/admin/referrals", area: "Trust" },
  { title: "Rips", description: "Manage live rip/break administration and related production controls.", href: "/admin/rips", area: "Commerce" },
  { title: "Rip inventory", description: "Manage rip inventory and uploaded product/card assets.", href: "/admin/rips/inventory", area: "Commerce" },
  { title: "API management", description: "Review the connected API management controls available to administrators.", href: "/admin/apis", area: "System" },
];

const areas = ["Operations", "Commerce", "Trust", "System"] as const;

export default async function AdminPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin?redirectTo=/admin");
  if (!isAdmin(user)) redirect("/dashboard");

  return (
    <AdminGate>
      <div className="min-h-screen px-4 py-6 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <header className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">Admin control center</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Admin ↔ Dashboard</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                  One protected entry point to the live marketplace, seller tools, commerce workflows, trust controls, and system administration. Links below target the existing production routes instead of mock admin screens.
                </p>
              </div>
              <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/20">
                Open live dashboard →
              </Link>
            </div>
          </header>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {areas.map((area) => {
              const count = modules.filter((module) => module.area === area).length;
              return (
                <div key={area} className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{area}</p>
                  <p className="mt-2 text-2xl font-black">{count}</p>
                  <p className="mt-1 text-xs text-gray-500">connected modules</p>
                </div>
              );
            })}
          </div>

          <main className="mt-8 space-y-8">
            {areas.map((area) => (
              <section key={area} aria-labelledby={`admin-${area.toLowerCase()}`}>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 id={`admin-${area.toLowerCase()}`} className="text-xl font-black">{area}</h2>
                  <span className="text-xs text-gray-500">Protected admin navigation</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {modules.filter((module) => module.area === area).map((module) => (
                    <Link
                      key={module.href}
                      href={module.href}
                      className="group rounded-2xl border border-white/10 bg-[#13131f] p-5 transition hover:border-yellow-400/40 hover:bg-[#171724] focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-bold text-white">{module.title}</h3>
                        <span aria-hidden="true" className="text-gray-500 transition group-hover:translate-x-1 group-hover:text-yellow-300">→</span>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-gray-400">{module.description}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </main>

          <footer className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-xs leading-5 text-gray-500">
            Admin access is still enforced server-side before this page renders. This control center does not grant permissions or expose service-role credentials; it only routes an authenticated administrator to existing application workflows.
          </footer>
        </div>
      </div>
    </AdminGate>
  );
}
