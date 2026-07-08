import Link from "next/link";

export const metadata = {
  title: "Marketing system",
  description: "Lifecycle marketing, ads, SEO, referrals, and tracking for TcgPoké Market.",
};

const sections = [
  {
    title: "Email automation",
    body: "Welcome series, live auction reminders, cart recovery, seller onboarding, VIP updates, and reactivation flows.",
  },
  {
    title: "Conversion tools",
    body: "Homepage hero copy, popups, referral prompts, and category-specific CTAs that push users deeper into the funnel.",
  },
  {
    title: "Paid acquisition",
    body: "Facebook, Instagram, TikTok, and YouTube ads focused on collectors, sellers, and live auction traffic.",
  },
  {
    title: "SEO and content",
    body: "Landing pages, collector guides, category pages, and blog topics designed to capture search demand.",
  },
  {
    title: "Analytics",
    body: "Track signup, browse, cart, bid, checkout, seller, and referral events so every campaign can be improved.",
  },
  {
    title: "Referrals",
    body: "Reward collectors for inviting collectors with credits, VIP access, and early drop access.",
  },
];

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[#08111f] px-4 py-16 text-white sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-[#13131f] p-6 sm:p-10">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-yellow-400">Marketing system</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">A complete growth stack for TcgPoké Market</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-300">
          This system turns the marketplace into a repeatable acquisition and retention engine for collectors, sellers, and live auction viewers.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="rounded-2xl border border-white/10 bg-[#08111f] p-5">
              <div className="text-lg font-bold text-white">{section.title}</div>
              <p className="mt-2 text-sm leading-6 text-gray-300">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-sm text-gray-200 sm:grid-cols-2">
          <div>Primary KPIs: signup rate, email CTR, auction attendance, conversion rate, seller activation, and referral share rate.</div>
          <div>Primary audiences: new collectors, high-value collectors, sellers, live bidders, and VIP members.</div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/account/email-preferences" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300">
            Manage email preferences
          </Link>
          <Link href="/referrals" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
            View referrals
          </Link>
          <Link href="/" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
            Back to homepage
          </Link>
        </div>
      </main>
    </div>
  );
}
