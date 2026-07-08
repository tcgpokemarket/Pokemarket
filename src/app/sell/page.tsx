import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sell on TcgPoké Market",
  description: "Start selling, open your dashboard, or check your seller setup on TcgPoké Market.",
};

const SELLER_BENEFITS = [
  "Seller onboarding and account review",
  "Inventory, listings, and order management",
  "Live shows and auction tools",
  "Payouts, shipping, and storefront support",
];

export default async function SellGatewayPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const { data: profile } = user
    ? await supabase.from("profiles").select("is_seller").eq("id", user.id).maybeSingle()
    : { data: null };

  const sellerProfile = profile as { is_seller: boolean } | null;
  const isSeller = Boolean(sellerProfile?.is_seller);
  const sellHref = !user ? "/auth?redirectTo=/sell" : isSeller ? "/dashboard" : "/sell/onboarding";
  const primaryLabel = !user ? "Sign in to sell" : isSeller ? "Open seller dashboard" : "Continue seller onboarding";
  const secondaryLabel = !user ? "Learn how selling works" : isSeller ? "Create a new listing" : "Review onboarding guide";
  const secondaryHref = !user ? "/sell/onboarding" : isSeller ? "/listings/create" : "/sell/onboarding";

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20">
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Sell on TcgPoké Market
            </div>
            <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">One seller path for onboarding, listings, and live selling.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-300">
              Start selling with a single destination that guides new sellers into onboarding and sends approved sellers straight to their dashboard.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SELLER_BENEFITS.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={sellHref} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300">
                {primaryLabel}
              </Link>
              <Link href={secondaryHref} className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
                {secondaryLabel}
              </Link>
            </div>
          </section>

          <aside className="space-y-4 rounded-[2rem] border border-yellow-400/20 bg-yellow-400/10 p-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.35em] text-yellow-400">Seller tools</div>
              <div className="mt-2 text-2xl font-black text-white">Built for collectors who sell</div>
            </div>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">List singles, sealed products, and graded cards.</div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">Manage inventory, pricing, and order fulfillment.</div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">Launch live shows and keep bidders engaged.</div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">Track payouts, shipping, and seller performance.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
              <div className="font-semibold text-white">Need the guide first?</div>
              <p className="mt-1 text-gray-400">Review onboarding steps, marketplace standards, and seller best practices before you publish.</p>
              <Link href="/sell/onboarding" className="mt-3 inline-flex text-yellow-400 hover:underline">
                Open onboarding guide →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
