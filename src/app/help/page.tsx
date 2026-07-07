import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Support for Pokémon Card Buyers and Sellers",
  description: "Support, shipping, returns, and FAQ information for TcgPoké Market’s Pokémon TCG marketplace.",
  keywords: ["Pokémon card help", "Pokémon card shipping", "Pokémon card returns", "marketplace FAQ"],
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/help",
  },
};

type FaqEntry = { q: string; a: string };

const FAQS = [
  {
    q: "How do I know a listing is accurate?",
    a: "Sellers are expected to provide clear titles, condition details, and photos that match the item being sold.",
  },
  {
    q: "What shipping should I expect?",
    a: "Most sellers use tracked shipping and protective packaging for cards and collectibles.",
  },
  {
    q: "Can I return an item?",
    a: "Return eligibility depends on the seller policy and item condition. Review the listing before buying.",
  },
  {
    q: "What if there is a problem with my order?",
    a: "Contact the seller first. If needed, use support to help with disputes, missing tracking, or order issues.",
  },
];

const SUPPORT_EMAIL = "tcgpokemarketadmin@gmail.com";

export default function HelpPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <div className="mx-auto max-w-5xl px-4 py-24">
        <div className="mb-8">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Help & Support</div>
          <h1 className="text-4xl font-black sm:text-5xl">Answers for buyers and sellers</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-300">
            Find the most common answers about shipping, returns, disputes, and marketplace expectations.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {FAQS.map((faq) => (
            <section key={faq.q} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-bold text-yellow-400">{faq.q}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">{faq.a}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-black">Contact options</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-300">
            Use the contact form, seller messages, or support channels provided at checkout and in your account area.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition-colors hover:bg-yellow-300">
              Email Support
            </a>
            <a href="/policies" className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/5">
              Review Policies
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-500">Support email: {SUPPORT_EMAIL}</p>
        </section>
        </div>
      </div>
    </>
  );
}
