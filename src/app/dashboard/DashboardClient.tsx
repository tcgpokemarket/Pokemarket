"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Listing, Order, Profile, SellerWallet } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { ensureProfileForUser } from "@/lib/auth-bootstrap";
import { getAppRole } from "@/lib/security";

type Tab = "overview" | "listings" | "purchases" | "sales" | "fees";

type DashboardOrder = Order & {
  listings?: { card_name?: string; images?: string[] } | null;
};

function parseTab(value: string | null): Tab {
  if (value === "listings" || value === "purchases" || value === "sales" || value === "fees") return value;
  return "overview";
}

function money(value: number | null | undefined) {
  return `$${(value ?? 0).toFixed(2)}`;
}

function Card({ title, value, description }: { title: string; value: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-gray-500">{title}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      {description && <div className="mt-2 text-sm text-gray-400">{description}</div>}
    </div>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
      <div className="text-xl font-black text-white">{title}</div>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export default function DashboardClient({ orderSuccess }: { orderSuccess: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const searchParams = useSearchParams();
  const currentTab = parseTab(searchParams.get("tab"));
  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<SellerWallet | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [purchases, setPurchases] = useState<DashboardOrder[]>([]);
  const [sales, setSales] = useState<DashboardOrder[]>([]);

  const activeTab = currentTab;
  useEffect(() => {
    let alive = true;
    const timeout = window.setTimeout(() => {
      if (!alive) return;
      setError("Dashboard access check timed out.");
      setLoading(false);
    }, 5000);

    const run = async () => {
      if (!supabase) {
        setError("Dashboard is unavailable right now.");
        setLoading(false);
        return;
      }

      try {
        const [{ data: sessionData }, { data: userData }] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);
        const session = sessionData.session ?? null;
        const user = userData.user ?? session?.user ?? null;

        if (!user || !session) {
          router.replace(`/auth?reason=session_expired&redirectTo=${encodeURIComponent(currentPath)}`);
          return;
        }

        const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        let loadedProfile = profileRow as Profile | null;

        if (!loadedProfile) {
          await ensureProfileForUser({
            userId: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            avatarUrl: user.user_metadata?.avatar_url ?? null,
            sellerState: user.user_metadata?.seller_state ?? null,
            shippingAddress: null,
            accountType: getAppRole(user) === "seller" ? "seller" : "buyer",
          });
          const { data: refreshedProfile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
          loadedProfile = refreshedProfile as Profile | null;
        }

        if (!loadedProfile) throw new Error("Profile could not be loaded.");

        const [walletResult, listingsResult, purchasesResult, salesResult] = await Promise.all([
          supabase.from("seller_wallets").select("*").eq("seller_id", user.id).maybeSingle(),
          supabase.from("listings").select("*").eq("seller_id", user.id).neq("status", "removed").order("created_at", { ascending: false }),
          supabase.from("orders").select("*, listings(card_name, images)").eq("buyer_id", user.id).order("created_at", { ascending: false }),
          supabase.from("orders").select("*, listings(card_name, images)").eq("seller_id", user.id).order("created_at", { ascending: false }),
        ]);

        if (!alive) return;

        if (walletResult.error) throw new Error(walletResult.error.message);
        if (listingsResult.error) throw new Error(listingsResult.error.message);
        if (purchasesResult.error) throw new Error(purchasesResult.error.message);
        if (salesResult.error) throw new Error(salesResult.error.message);

        setProfile(loadedProfile);
        setWallet((walletResult.data ?? null) as SellerWallet | null);
        setListings((listingsResult.data ?? []) as Listing[]);
        setPurchases((purchasesResult.data ?? []) as DashboardOrder[]);
        setSales((salesResult.data ?? []) as DashboardOrder[]);
        setLoading(false);
      } catch (caught) {
        if (!alive) return;
        setError(caught instanceof Error ? caught.message : "Dashboard failed to load.");
        setLoading(false);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    run();
    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!orderSuccess) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("success");
    router.replace(params.toString() ? `/dashboard?${params.toString()}` : "/dashboard");
  }, [orderSuccess, router, searchParams]);

  const activeListings = useMemo(() => listings.filter((listing) => listing.status === "active").length, [listings]);
  const completedSales = useMemo(() => sales.filter((sale) => ["paid", "shipped", "delivered", "completed"].includes(sale.status)), [sales]);
  const totalRevenue = useMemo(() => completedSales.reduce((sum, sale) => sum + (sale.total_amount ?? 0), 0), [completedSales]);
  const walletAvailable = wallet?.available_balance ?? 0;
  const walletPending = wallet?.pending_balance ?? 0;
  const walletFrozen = wallet?.frozen_balance ?? 0;

  const updateTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    router.replace(params.toString() ? `/dashboard?${params.toString()}` : "/dashboard", { scroll: false });
  };

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-6 text-center">
        <EmptyState title="Dashboard unavailable" description="The dashboard could not initialize on this device." action={<Link href="/auth" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Sign in again</Link>} />
      </div>
    );
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] text-gray-400">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-6 text-center text-white">
        <EmptyState title="Dashboard unavailable" description={error} action={<button type="button" onClick={() => router.refresh()} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Try again</button>} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.12),_transparent_26%),linear-gradient(180deg,#0f0f1a_0%,#090b14_100%)] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
          <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8 lg:py-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-yellow-300">
                <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">Dashboard</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300">Collector control center</span>
              </div>
              <div>
                <h1 className="text-4xl font-black leading-tight sm:text-5xl">{profile?.full_name ?? profile?.username ?? "Account"}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">Track your wallet, listings, purchases, sales, and seller tools from one cleaner workspace designed for fast daily use.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Active</div>
                  <div className="mt-2 text-2xl font-black text-white">{activeListings}</div>
                  <div className="mt-1 text-sm text-gray-400">Listings live now</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Sales</div>
                  <div className="mt-2 text-2xl font-black text-white">{completedSales.length}</div>
                  <div className="mt-1 text-sm text-gray-400">Completed orders</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Revenue</div>
                  <div className="mt-2 text-2xl font-black text-white">{money(totalRevenue)}</div>
                  <div className="mt-1 text-sm text-gray-400">All-time total</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#13131f]/80 p-4">
              <Link href="/listings/create" className="rounded-2xl bg-yellow-400 px-4 py-3 text-center text-sm font-bold text-black transition hover:bg-yellow-300">New listing</Link>
              <Link href="/sell/verification" className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/5">Verification</Link>
              <Link href="/sell/scan" className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/5">Scan card</Link>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-gray-500">Wallet available</div>
                <div className="mt-2 text-3xl font-black text-white">{money(walletAvailable)}</div>
                <div className="mt-1 text-sm text-gray-400">Ready to withdraw when eligible</div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto rounded-[1.25rem] border border-white/10 bg-white/5 p-2">
          {[
            ["overview", "Overview"],
            ["listings", `Listings (${listings.length})`],
            ["purchases", `Purchases (${purchases.length})`],
            ["sales", `Sales (${sales.length})`],
            ["fees", "Fees & payouts"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => updateTab(key as Tab)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === key ? "bg-yellow-400 text-black" : "text-gray-300 hover:bg-white/5 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Active listings" value={String(activeListings)} />
            <Card title="Available balance" value={money(walletAvailable)} description="Ready to withdraw when eligible." />
            <Card title="Pending balance" value={money(walletPending)} description="Funds in escrow or awaiting release." />
            <Card title="Frozen balance" value={money(walletFrozen)} description="Held for review if applicable." />
          </section>
        )}

        {activeTab === "overview" && (
          <section className="grid gap-4 md:grid-cols-3">
            <Card title="Total sales" value={String(completedSales.length)} />
            <Card title="Revenue" value={money(totalRevenue)} />
            <Card title="Wallet total" value={money((wallet?.available_balance ?? 0) + (wallet?.pending_balance ?? 0) + (wallet?.frozen_balance ?? 0))} />
          </section>
        )}

        {activeTab === "listings" && (
          <section className="space-y-4">
            {listings.length === 0 ? (
              <EmptyState title="No listings yet" description="Create your first listing to start selling." action={<Link href="/listings/create" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Create listing</Link>} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {listings.map((listing) => (
                  <Link key={listing.id} href={`/listings/${listing.id}`} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-yellow-400/40 hover:bg-white/8">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">{listing.card_name}</div>
                        <div className="mt-1 text-xs text-gray-400">{listing.set_name}</div>
                      </div>
                      <div className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">{money(listing.price)}</div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                      <span>{listing.status}</span>
                      <span>{listing.condition}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "purchases" && (
          <section className="space-y-4">
            {purchases.length === 0 ? (
              <EmptyState title="No purchases yet" description="Browse the marketplace to place your first order." action={<Link href="/listings" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Browse listings</Link>} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {purchases.map((order) => (
                  <div key={order.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{order.listings?.card_name ?? "Order"}</div>
                        <div className="mt-1 text-xs text-gray-400">Status: {order.status}</div>
                      </div>
                      <div className="text-sm font-bold text-yellow-400">{money(order.total_amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "sales" && (
          <section className="space-y-4">
            {sales.length === 0 ? (
              <EmptyState title="No sales yet" description="List an item to start receiving orders." action={<Link href="/listings/create" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Create listing</Link>} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sales.map((order) => (
                  <div key={order.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{order.listings?.card_name ?? "Sale"}</div>
                        <div className="mt-1 text-xs text-gray-400">Status: {order.status}</div>
                      </div>
                      <div className="text-sm font-bold text-yellow-400">{money(order.total_amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "fees" && (
          <section className="grid gap-4 md:grid-cols-3">
            <Card title="Available" value={money(walletAvailable)} />
            <Card title="Pending" value={money(walletPending)} />
            <Card title="Escrow hold" value={money(walletFrozen)} />
          </section>
        )}
      </div>
    </main>
  );
}
