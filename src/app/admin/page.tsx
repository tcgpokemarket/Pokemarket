import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/security";
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
  if (!user) redirect('/auth/signin?redirectTo=/admin');
  if (!isAdmin(user)) redirect('/dashboard');

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
