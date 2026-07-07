import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace Policies for Pokémon Card Buyers and Sellers",
  description: "Terms, privacy, seller standards, returns, and shipping expectations for TcgPoké Market.",
  keywords: ["Pokémon card policies", "marketplace terms", "seller standards", "return policy"],
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/policies",
  },
};

type Policy = { title: string; text: string };

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Marketplace Policies",
  description: "Terms, privacy, seller standards, returns, and shipping expectations for TcgPoké Market.",
};

const POLICIES = [
  {
    title: "Terms of service",
    text: "Use the marketplace responsibly, follow platform rules, and only list items you are authorized to sell. We may moderate listings that do not meet marketplace standards.",
  },
  {
    title: "Privacy policy",
    text: "We collect the information needed to process orders, support accounts, and improve the marketplace experience. Payment details are handled through secure checkout providers.",
  },
  {
    title: "Seller standards",
    text: "Listings must be accurate, images must match the item, condition issues must be disclosed clearly, and prohibited items may be removed.",
  },
  {
    title: "Return and refund policy",
    text: "Return and refund handling depends on the listing terms, item condition, and the reason for the request. Buyers should review seller notes before purchase.",
  },
  {
    title: "Shipping expectations",
    text: "Sellers are expected to package collectibles carefully, use tracking when available, and communicate delays promptly.",
  },
];

export default function PoliciesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <div className="mx-auto max-w-5xl px-4 py-24">
        <div className="mb-8">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Policies</div>
          <h1 className="text-4xl font-black sm:text-5xl">Clear rules for a safe marketplace</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-300">
            These policies help keep the marketplace trustworthy for collectors, buyers, and sellers.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {POLICIES.map((policy) => (
            <section key={policy.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-bold text-yellow-400">{policy.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">{policy.text}</p>
            </section>
          ))}
        </div>
        </div>
      </div>
    </>
  );
}
