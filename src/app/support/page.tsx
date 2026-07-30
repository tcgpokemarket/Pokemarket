import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "Contact and support options for TcgPoké Market.",
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/support",
  },
};

const SUPPORT_EMAIL = "tcgpokemarketadmin@gmail.com";

const OPTIONS = [
  {
    title: "Order issues",
    text: "Use messages to contact the seller first, then email support if you need help escalating an order problem.",
  },
  {
    title: "Marketplace help",
    text: "Need help with selling, fees, or account access? Review the help center or contact support directly.",
  },
  {
    title: "Policy questions",
    text: "Policies cover shipping, returns, and seller standards across the marketplace.",
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-5xl px-4 py-24">
        <div className="mb-8">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Support</div>
          <h1 className="text-4xl font-black sm:text-5xl">Help when you need it</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-300">Use the options below to get help with orders, accounts, and marketplace rules.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {OPTIONS.map((option) => (
            <section key={option.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-bold text-yellow-400">{option.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">{option.text}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-black">Contact support</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-300">
            Email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-yellow-400">{SUPPORT_EMAIL}</a> for account, order, or marketplace help.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/help" className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/5">Help center</a>
            <a href="/policies" className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/5">Policies</a>
          </div>
        </section>
      </div>
    </div>
  );
}
