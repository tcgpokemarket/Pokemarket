import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/security";
import AdminGate from "./AdminGate";

export const metadata: Metadata = {
  title: "Admin Control Center",
  description: "Protected admin control center connected to live marketplace workflows and Supabase-backed operations.",
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
  { title: "API management", description: "Review connected integration health and runtime configuration.", href: "/admin/apis", area: "System" },
];

const areas = ["Operations", "Commerce", "Trust", "System"] as const;

function countResult(value: { count: number | null } | null | undefined) {
  return value?.count ?? 0;
}

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

  const [users, sellers, pendingVerification, listings, orders, shipments, ripPacks, ripTransactions] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).in("verification_status", ["approved", "pending_review", "more_information_required"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("verification_status", "pending_review"),
    supabase.from("listings").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("shipments").select("id", { count: "exact", head: true }),
    supabase.from("rip_packs").select("id", { count: "exact", head: true }),
    supabase.from("rip_transactions").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    ["Users", countResult(users)],
    ["Sellers", countResult(sellers)],
    ["Pending verification", countResult(pendingVerification)],
    ["Listings", countResult(listings)],
    ["Orders", countResult(orders)],
    ["Shipments", countResult(shipments)],
    ["Rip packs", countResult(ripPacks)],
    ["Rip transactions", countResult(ripTransactions)],
  ] as const;

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
                  Protected operations view backed by the live Supabase data layer. Counts below are queried server-side at request time; navigation targets real application workflows.
                </p>
              </div>
              <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/20">
                Open live dashboard →
              </Link>
            </div>
          </header>

          <section aria-labelledby="admin-live-metrics" className="mt-6">
            <h2 id="admin-live-metrics" className="sr-only">Live metrics</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</p>
                  <p className="mt-2 text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-gray-500">Supabase-backed</p>
                </div>
              ))}
            </div>
          </section>

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
            Admin access is enforced server-side before this page renders. The page uses the authenticated Supabase session and never exposes service-role credentials.
          </footer>
        </div>
      </div>
    </AdminGate>
  );
}
