"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const primaryNav = [
  { label: "Home", href: "/" },
  { label: "Browse", href: "/listings" },
  { label: "Live Auctions", href: "/live" },
  { label: "Marketplace", href: "/collection" },
  { label: "Categories", href: "/cards" },
  { label: "Sell", href: "/sell" },
  { label: "Wallet", href: "/dashboard?tab=overview" },
  { label: "Rewards", href: "/rewards" },
  { label: "Messages", href: "/messages" },
  { label: "Notifications", href: "/dashboard?tab=overview" },
  { label: "Community", href: "/social" },
  { label: "Events", href: "/giveaway-rules" },
  { label: "Help Center", href: "/help" },
] as const;

const userNav = [
  { label: "Profile", href: "/dashboard" },
  { label: "My Listings", href: "/dashboard?tab=listings" },
  { label: "My Purchases", href: "/dashboard?tab=purchases" },
  { label: "My Sales", href: "/dashboard?tab=sales" },
  { label: "Watchlist", href: "/collection?filter=watchlist" },
  { label: "Saved Searches", href: "/collection?saved=1" },
  { label: "Orders", href: "/messages" },
  { label: "Payouts", href: "/dashboard?tab=fees" },
  { label: "Settings", href: "/account/email-preferences" },
  { label: "Identity Verification", href: "/sell/verification" },
] as const;


const routeLabels: Record<string, string> = {
  "/": "Home",
  "/listings": "Browse",
  "/live": "Live Auctions",
  "/collection": "Marketplace",
  "/cards": "Categories",
  "/sell": "Sell",
  "/dashboard": "Wallet",
  "/messages": "Messages",
  "/social": "Community",
  "/giveaway-rules": "Events",
  "/help": "Help Center",
  "/support": "Help Center",
  "/profile": "Profile",
  "/sellers": "Community",
  "/account": "Settings",
  "/auth": "Account",
  "/cart": "Cart",
  "/policies": "Policies",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/refund-policy": "Refund Policy",
  "/shipping-policy": "Shipping Policy",
  "/seller-agreement": "Seller Agreement",
  "/marketplace-rules": "Marketplace Rules",
  "/dmca": "DMCA",
};

function badgeCount(value?: number | null) {
  if (!value || value <= 0) return null;
  return value > 99 ? "99+" : String(value);
}

function navClass(active: boolean) {
  return [
    "rounded-full px-3 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400/60",
    active ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20" : "text-gray-300 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

function isActiveLink(pathname: string, searchParams: URLSearchParams, href: string) {
  const [targetPath, query = ""] = href.split("?");
  if (pathname !== targetPath && !pathname.startsWith(`${targetPath}/`)) return false;
  if (!query) return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  const expected = new URLSearchParams(query);
  for (const key of Array.from(expected.keys())) {
    if (searchParams.get(key) !== expected.get(key)) return false;
  }
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

function getBreadcrumbs(pathname: string) {
  if (pathname === "/") return [];
  if (pathname.startsWith("/listings/")) return ["Home", "Browse", "Listing"];
  if (pathname.startsWith("/live/")) return ["Home", "Live Auctions", "Live Room"];
  if (pathname.startsWith("/messages/")) return ["Home", "Messages", "Conversation"];
  if (pathname.startsWith("/profile/")) return ["Home", "Community", "Profile"];
  if (pathname.startsWith("/sellers/")) return ["Home", "Community", "Seller Store"];
  if (pathname.startsWith("/dashboard/fees")) return ["Home", "Wallet", "Fees"];
  const base = `/${pathname.split("/")[1]}`;
  const label = routeLabels[base] ?? "Page";
  return ["Home", label];
}

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(0);
  const [messages, setMessages] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const client = createClient();
    let alive = true;

    client.auth.getUser().then(({ data: { user } }) => {
      if (!alive) return;
      setSignedIn(Boolean(user));
      setName(user?.email?.split("@")[0] ?? null);
    });

    client.auth.getSession().then(async ({ data: { session } }) => {
      if (!alive || !session?.user) return;
      const { data: profile } = await client.from("profiles").select("full_name, avatar_url").eq("id", session.user.id).maybeSingle();
      if (!alive) return;
      setAvatarUrl((profile as { avatar_url?: string | null } | null)?.avatar_url ?? null);
      setName((profile as { full_name?: string | null } | null)?.full_name ?? session.user.email?.split("@")[0] ?? null);

      const [{ count: notificationCount }, { count: messageCount }] = await Promise.all([
        client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", session.user.id).eq("read_status", false),
        client.from("messages").select("id", { count: "exact", head: true }).eq("read_status", false),
      ]);

      if (!alive) return;
      setNotifications(notificationCount ?? 0);
      setMessages(messageCount ?? 0);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setOpen(false);
      setAccountOpen(false);
    });
  }, [pathname, searchParams]);

  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    router.push(`/listings?query=${encodeURIComponent(term)}`);
    setOpen(false);
  };

  const handleSignOut = async () => {
    const client = createClient();
    await client.auth.signOut();
    setSignedIn(false);
    setAccountOpen(false);
    setOpen(false);
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0f1a]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
              <span className="text-2xl">⚡</span>
              <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
            </Link>

            <form onSubmit={handleSearch} className="hidden flex-1 items-center gap-2 px-6 xl:flex">
              <label className="sr-only" htmlFor="site-search">Search</label>
              <input
                id="site-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cards, sellers, auctions, orders"
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/50"
              />
            </form>

            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <Link href="/messages" className="relative rounded-full border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white">
                Messages{badgeCount(messages) ? <span className="ml-2 rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-black text-black">{badgeCount(messages)}</span> : null}
              </Link>
              <Link href="/dashboard" className="relative rounded-full border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white">
                Notifications{badgeCount(notifications) ? <span className="ml-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-black text-black">{badgeCount(notifications)}</span> : null}
              </Link>
              {signedIn ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((value) => !value)}
                    className="flex items-center gap-3 rounded-full border border-white/10 px-3 py-2 transition hover:border-yellow-400/40 hover:bg-white/5"
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                  >
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-yellow-400/15 text-sm font-black text-yellow-400">
                      {avatarUrl ? <img src={avatarUrl} alt={name ?? "User avatar"} className="h-full w-full object-cover" /> : (name?.[0] ?? "U")}
                    </span>
                    <span className="text-sm font-semibold text-white">{name ?? "Account"}</span>
                    <span className="text-gray-400">▾</span>
                  </button>

                  {accountOpen && (
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] w-64 overflow-hidden rounded-3xl border border-white/10 bg-[#121826] shadow-2xl shadow-black/30">
                      <div className="border-b border-white/10 px-4 py-3">
                        <div className="text-sm font-semibold text-white">{name ?? "Account"}</div>
                        <div className="text-xs text-gray-400">Marketplace profile</div>
                      </div>
                      <div className="max-h-80 overflow-auto p-2">
                        {userNav.map((item) => (
                          <Link key={item.href} href={item.href} className="block rounded-2xl px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white">
                            {item.label}
                          </Link>
                        ))}
                        <button type="button" onClick={handleSignOut} className="mt-1 block w-full rounded-2xl px-3 py-2 text-left text-sm text-gray-300 transition hover:bg-white/5 hover:text-white">
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/auth/signin" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5">Login</Link>
                  <Link href="/auth" className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300">Sign Up</Link>
                </div>
              )}
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
                aria-expanded={open}
                aria-controls="mobile-nav"
              >
                Menu
              </button>
            </div>
          </div>

          <div className="hidden flex-wrap gap-2 border-t border-white/10 py-3 xl:flex">
            {primaryNav.map((item) => (
              <Link key={item.href} href={item.href} scroll={false} className={navClass(isActiveLink(pathname, searchParams, item.href))}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {breadcrumbs.length > 0 && (
        <div className="border-b border-white/5 bg-white/[0.02] px-4 py-3">
          <div className="mx-auto max-w-7xl text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
            <span className="text-gray-500">Home</span>
            {breadcrumbs.slice(1).map((crumb) => (
              <span key={crumb}>
                <span className="mx-2 text-gray-600">/</span>
                <span className="text-gray-300">{crumb}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button aria-label="Close menu" type="button" onClick={() => setOpen(false)} className={`absolute inset-0 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
        <aside id="mobile-nav" className={`absolute right-0 top-0 h-full w-[88vw] max-w-sm overflow-y-auto border-l border-white/10 bg-[#0f0f1a] p-5 transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between">
            <div className="text-lg font-black">Menu</div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-3 py-2 text-sm">Close</button>
          </div>
          <form onSubmit={handleSearch} className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
            <label className="sr-only" htmlFor="mobile-search">Search</label>
            <input
              id="mobile-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search marketplace"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
            />
          </form>
          <nav className="mt-6 space-y-6">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.25em] text-gray-500">Primary</div>
              <div className="grid gap-2">
                {primaryNav.map((item) => (
                  <Link key={item.href} href={item.href} scroll={false} onClick={() => setOpen(false)} className={navClass(isActiveLink(pathname, searchParams, item.href))}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.25em] text-gray-500">Account</div>
              <div className="grid gap-2">
                {(signedIn ? userNav : [{ label: "Login", href: "/auth/signin" }, { label: "Sign Up", href: "/auth" }]).map((item) => (
                  <Link key={item.href} href={item.href} scroll={false} onClick={() => setOpen(false)} className={navClass(isActiveLink(pathname, searchParams, item.href))}>
                    {item.label}
                  </Link>
                ))}
                {signedIn && (
                  <button type="button" onClick={handleSignOut} className={navClass(false) + " text-left"}>
                    Logout
                  </button>
                )}
              </div>
            </div>
          </nav>
        </aside>
      </div>

      <main>{children}</main>
    </div>
  );
}
