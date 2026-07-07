"use client";

import { useState } from "react";

const NAV_LINKS = [
  { label: "Shop Singles", href: "/listings?category=single" },
  { label: "Sealed", href: "/listings?category=sealed" },
  { label: "Graded", href: "/listings?category=graded" },
  { label: "Sell With Us", href: "/sell" },
  { label: "Live Auctions", href: "/live" },
  { label: "My Library", href: "/collection" },
  { label: "About", href: "/about" },
  { label: "Help", href: "/help" },
  { label: "Policies", href: "/policies" },
  { label: "FAQ", href: "#faq" },
];

const HERO_STATS = [
  { value: "Fast", label: "Secure dispatch" },
  { value: "Trusted", label: "Collector-focused" },
  { value: "Live", label: "Fresh inventory" },
  { value: "Easy", label: "Simple selling" },
];

const FEATURED_CATEGORIES = [
  {
    icon: "⚡",
    title: "Pokémon Singles",
    desc: "Chase cards, modern hits, and everyday staples sorted by set, rarity, and condition.",
    cta: "Browse Singles",
    href: "/listings?category=single",
  },
  {
    icon: "📦",
    title: "Sealed Products",
    desc: "Booster boxes, ETBs, and collector boxes for opening, holding, or displaying.",
    cta: "Shop Sealed",
    href: "/listings?category=sealed",
  },
  {
    icon: "🏆",
    title: "Graded Cards",
    desc: "Standout slabs with clear grading, strong presentation, and collector appeal.",
    cta: "View Graded",
    href: "/listings?category=graded",
  },
  {
    icon: "🔔",
    title: "Live Auctions",
    desc: "Bid on rotating drops and rare finds before they disappear from the market.",
    cta: "See Auctions",
    href: "/live",
  },
  {
    icon: "🛡️",
    title: "Accessories",
    desc: "Protective supplies, binders, sleeves, and storage essentials for every collection.",
    cta: "Shop Supplies",
    href: "/listings?category=accessory",
  },
  {
    icon: "🤝",
    title: "Sell Your Collection",
    desc: "List cards and sealed products for collectors who want a clean, fast selling flow.",
    cta: "Start Selling",
    href: "/sell",
  },
  {
    icon: "🔎",
    title: "Card Lookup",
    desc: "Check live Pokémon card pricing and save a market sample for later review.",
    cta: "Open Lookup",
    href: "/cards",
  },
];

const TRUST_POINTS = [
  "Collector-focused marketplace",
  "Clear product details and pricing",
  "Secure checkout experience",
  "Fast shipping and careful packing",
];

const FEATURED_ITEMS = [
  {
    name: "Charizard ex",
    set: "Obsidian Flames",
    number: "125/197",
    badge: "Hot Listing",
    condition: "Near Mint",
    price: "$189.99",
  },
  {
    name: "Umbreon V",
    set: "Evolving Skies",
    number: "188/203",
    badge: "Collector Favorite",
    condition: "Near Mint",
    price: "$124.50",
  },
  {
    name: "Charizard",
    set: "Base Set",
    number: "4/102",
    badge: "Graded",
    condition: "PSA 9",
    price: "$549.00",
  },
];

const SELLER_STEPS = [
  {
    title: "Submit your cards",
    desc: "Send in singles, sealed products, or a full collection with simple intake.",
  },
  {
    title: "Get reviewed",
    desc: "We check condition, pricing, and listing readiness before items go live.",
  },
  {
    title: "Sell with confidence",
    desc: "Reach collectors ready to buy, bid, and complete checkout quickly.",
  },
];

const SELLER_BENEFITS = [
  "Competitive seller fees that help you keep more of each sale",
  "Built for singles, sealed products, and graded cards",
  "Clear listing flow with less friction for first-time sellers",
];

const FOOTER_LINKS = [
  { label: "Browse Listings", href: "/listings" },
  { label: "Sell With Us", href: "/sell" },
  { label: "Live Auctions", href: "/live" },
  { label: "My Library", href: "/collection" },
  { label: "About", href: "/about" },
  { label: "Help", href: "/help" },
  { label: "Policies", href: "/policies" },
];

const CONTACT_DETAILS = [
  "Support email: tcgpokemarketadmin@gmail.com",
  "Shipping and returns guidance on policy pages",
  "Seller help built into onboarding and dashboard flows",
];

const MARKETPLACE_FEATURES = [
  "Secure checkout",
  "Verified seller flow",
  "Tracked shipping support",
  "Collector-friendly categories",
];

const BUYER_SELLER_POINTS = [
  "Search and filter listings by category, condition, and price",
  "Create listings with clear product details and honest photos",
  "Review seller fees, payouts, and onboarding guidance before you list",
];


const FAQS = [
  {
    q: "What do you sell?",
    a: "We focus on Pokémon singles, sealed products, graded cards, and collector accessories.",
  },
  {
    q: "How do I find the right product?",
    a: "Use the category pages to browse by product type, then filter by set, condition, and price.",
  },
  {
    q: "Can I sell my cards here?",
    a: "Yes — use the sell page to start the process and submit your collection.",
  },
  {
    q: "How do auctions work?",
    a: "Live auctions show the current bid, timing, and listing details so buyers can act fast.",
  },
];

const TESTIMONIALS = [
  {
    quote: "The layout makes it easy to find what I want fast, and the listings feel collector-first.",
    author: "Jordan M.",
    role: "Collector",
  },
  {
    quote: "Selling was simple and the process felt clear from the start.",
    author: "Alex R.",
    role: "Seller",
  },
  {
    quote: "Great place to browse sealed and graded cards without feeling overwhelmed.",
    author: "Sam T.",
    role: "Collector",
  },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      await fetch("https://alluring-encouragement-production.up.railway.app/public/lead_v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "tcg-poke-market-homepage" }),
      });
    } catch {
      // silent
    }

    setSubmitted(true);
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-yellow-400/15 bg-[#08111f]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
            <span className="text-2xl">⚡</span>
            <span>TCG</span>
            <span className="text-yellow-400">Poke</span>
            <span>Market</span>
          </a>

          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-gray-300 transition-colors hover:text-yellow-400"
              >
                {link.label}
              </a>
            ))}
            <a
              href="/listings"
              className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-yellow-300"
            >
              Shop Now
            </a>
          </div>

          <button
            className="text-gray-300 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <div className="flex flex-col gap-4 border-t border-white/10 bg-[#0f0f1a] px-4 py-4 md:hidden">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-gray-300"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/listings"
              className="rounded-lg bg-yellow-400 px-4 py-2 text-center text-sm font-bold text-black"
              onClick={() => setMenuOpen(false)}
            >
              Shop Now
            </a>
          </div>
        )}
      </nav>

      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-0 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.18),_rgba(255,255,255,0)_65%)] blur-3xl" />
            <div className="absolute left-1/2 top-20 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,203,5,0.24),_rgba(255,203,5,0)_70%)] blur-3xl" />
            <div className="absolute -left-20 top-40 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.25),_rgba(239,68,68,0)_70%)] blur-3xl" />
            <div className="absolute right-[-60px] top-44 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.2),_rgba(59,130,246,0)_70%)] blur-3xl" />
            <div className="absolute left-1/2 top-24 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full border border-white/10 opacity-25" />
            <div className="absolute left-1/2 top-24 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full border border-yellow-400/20 opacity-50" />
            <div className="absolute left-1/2 top-40 h-24 w-24 -translate-x-1/2 rounded-full border-[18px] border-white/10" />
            <div className="absolute left-1/2 top-[calc(10rem+4.25rem)] h-3 w-[28rem] -translate-x-1/2 bg-white/10" />
          </div>

          <div className="relative z-10 mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-1.5 text-sm font-semibold text-yellow-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
              Trusted marketplace for collectors
            </div>

            <h1 className="mb-6 text-4xl font-black leading-tight sm:text-6xl md:text-7xl">
              Buy, sell, and bid on <span className="text-yellow-400">Pokémon cards</span> with confidence.
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-300 sm:text-xl">
              TCG Poke Market is built for collectors who want clear listings, secure checkout,
              fast shipping, and a smooth way to sell their collection.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="/listings"
                className="w-full rounded-xl bg-yellow-400 px-8 py-4 text-lg font-bold text-black transition-all hover:bg-yellow-300 hover:scale-105 sm:w-auto"
              >
                Shop Now
              </a>
              <a
                href="/sell"
                className="w-full rounded-xl border border-white/20 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/5 sm:w-auto"
              >
                Sell Your Cards
              </a>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
                  <div className="text-2xl font-black text-yellow-400">{stat.value}</div>
                  <div className="mt-1 text-sm text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-yellow-400/15 bg-gradient-to-r from-red-500/10 via-yellow-400/10 to-blue-500/10 px-4 py-8 sm:px-6">
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-4">
            {TRUST_POINTS.map((point) => (
              <div key={point} className="rounded-2xl border border-white/10 bg-[#13131f] px-5 py-4 text-sm text-gray-300">
                {point}
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
                <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">How it works</div>
                <h2 className="text-3xl font-black">A simple path for buyers and sellers</h2>
                <div className="mt-8 space-y-4">
                  {BUYER_SELLER_POINTS.map((point, index) => (
                    <div key={point} className="flex gap-4 rounded-2xl border border-white/10 bg-[#13131f] p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400/10 text-sm font-black text-yellow-400">
                        0{index + 1}
                      </div>
                      <div className="text-sm text-gray-300">{point}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-yellow-400/10 to-purple-600/10 p-8">
                <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Marketplace features</div>
                <h2 className="text-3xl font-black">Trust signals that help visitors buy with confidence</h2>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {MARKETPLACE_FEATURES.map((feature) => (
                    <div key={feature} className="rounded-2xl border border-white/10 bg-[#13131f]/70 px-4 py-4 text-sm text-gray-300">
                      {feature}
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-gray-200">
                  Secure payment messaging, clear shipping expectations, and visible seller standards help the marketplace feel legitimate and ready for launch.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Shop by category</div>
              <h2 className="text-3xl font-black sm:text-4xl">Everything Pokémon TCG in one place</h2>
              <p className="mx-auto mt-3 max-w-2xl text-gray-400">
                Give visitors a clean path to the right product type so they can shop faster and convert sooner.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURED_CATEGORIES.map((cat) => (
                <a
                  key={cat.title}
                  href={cat.href}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:border-yellow-400/40 hover:bg-white/[0.08]"
                >
                  <div className="mb-4 text-4xl">{cat.icon}</div>
                  <h3 className="mb-2 text-lg font-bold transition-colors group-hover:text-yellow-400">{cat.title}</h3>
                  <p className="mb-4 text-sm leading-relaxed text-gray-400">{cat.desc}</p>
                  <span className="text-sm font-semibold text-yellow-400 group-hover:underline">{cat.cta} →</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/3 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">Featured items</div>
                <h2 className="text-3xl font-black sm:text-4xl">High-interest listings that drive clicks</h2>
              </div>
              <a href="/listings" className="text-sm font-semibold text-yellow-400 hover:underline">
                Browse all listings →
              </a>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {FEATURED_ITEMS.map((item) => (
                <a
                  key={item.name}
                  href="/listings"
                  className="rounded-2xl border border-white/10 bg-[#13131f] p-5 transition-all hover:border-yellow-400/40"
                >
                  <div className="mb-4 flex h-36 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-5xl">
                    🃏
                  </div>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <h3 className="font-bold transition-colors hover:text-yellow-400">{item.name}</h3>
                    <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                      {item.badge}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{item.set} · {item.number}</div>
                  <div className="mt-1 text-xs text-gray-400">{item.condition}</div>
                  <div className="mt-4 text-2xl font-black">{item.price}</div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Sell with us</div>
              <h2 className="text-3xl font-black sm:text-4xl">Turn your collection into cash</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-300">
                Make selling feel simple. Use a clean intake flow, reach collectors, and get your inventory in front of buyers who already know what they want.
              </p>

              <div className="mt-8 space-y-4">
                {SELLER_STEPS.map((step, index) => (
                  <div key={step.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400/10 text-sm font-black text-yellow-400">
                      0{index + 1}
                    </div>
                    <div>
                      <div className="font-bold">{step.title}</div>
                      <div className="mt-1 text-sm text-gray-400">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                <div className="text-sm font-semibold text-yellow-400">Competitive seller fees</div>
                <ul className="mt-2 space-y-2 text-sm text-gray-300">
                  {SELLER_BENEFITS.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2">
                      <span className="mt-0.5 text-yellow-400">✓</span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <a
                  href="/sell"
                  className="inline-block rounded-xl bg-yellow-400 px-7 py-3.5 font-bold text-black transition-colors hover:bg-yellow-300"
                >
                  Start Selling
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-yellow-400/10 to-purple-600/10 p-8 text-center">
              <div className="mb-4 text-6xl">🎯</div>
              <div className="text-2xl font-black">Built for buyer intent</div>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-300">
                Showcase the right products, remove friction, and keep every page focused on getting visitors to the next click.
              </p>
              <a
                href="/dashboard"
                className="mt-6 block rounded-xl border border-yellow-400/50 px-6 py-3 font-bold text-yellow-400 transition-colors hover:bg-yellow-400/10"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/3 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Social proof</div>
              <h2 className="text-3xl font-black sm:text-4xl">Trusted by collectors and sellers</h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div key={t.author} className="rounded-2xl border border-white/10 bg-[#13131f] p-6">
                  <div className="mb-4 text-2xl text-yellow-400">★★★★★</div>
                  <p className="mb-4 text-sm leading-relaxed text-gray-300 italic">“{t.quote}”</p>
                  <div className="font-bold text-sm">{t.author}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6" id="faq">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">FAQ</div>
              <h2 className="text-3xl font-black sm:text-4xl">Answer the questions that stop people from buying</h2>
            </div>

            <div className="mt-12 space-y-4">
              {FAQS.map((faq) => (
                <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div className="font-bold">{faq.q}</div>
                  <div className="mt-2 text-sm leading-relaxed text-gray-400">{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-gradient-to-b from-yellow-400/10 to-transparent px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 text-5xl">⚡</div>
            <h2 className="text-3xl font-black sm:text-4xl">Stay ahead of new drops</h2>
            <p className="mb-8 mt-4 text-lg text-gray-300">
              Get early access to listings, price updates, and seller opportunities.
            </p>

            {submitted ? (
              <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-8">
                <div className="mb-3 text-4xl">🎉</div>
                <div className="mb-2 text-xl font-bold text-yellow-400">You&apos;re on the list!</div>
                <p className="text-gray-400">We&apos;ll send updates as new inventory and opportunities go live.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="flex-1 rounded-xl border border-white/20 bg-white/10 px-5 py-3.5 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-yellow-400 px-6 py-3.5 font-bold text-black transition-colors hover:bg-yellow-300"
                >
                  Join Now
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 text-xl font-black">
                <span className="text-2xl">⚡</span>
                <span>TCG</span>
                <span className="text-yellow-400">Poke</span>
                <span>Market</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-400">
                A collector-focused marketplace for buying and selling Pokémon cards with confidence.
              </p>
            </div>

            <div>
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Explore</div>
              <div className="mt-4 flex flex-col gap-3 text-sm text-gray-400">
                {FOOTER_LINKS.map((link) => (
                  <a key={link.label} href={link.href} className="transition-colors hover:text-yellow-400">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Support</div>
              <div className="mt-4 space-y-3 text-sm text-gray-400">
                {CONTACT_DETAILS.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} TCG Poke Market. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
