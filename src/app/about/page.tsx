import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About TcgPoké Market | Pokémon Card Marketplace",
  description: "Learn what makes TcgPoké Market different for collectors and sellers in the Pokémon TCG space.",
  keywords: ["Pokémon card marketplace", "buy sell Pokémon cards", "collector marketplace"],
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/about",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About TcgPoké Market",
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <div className="mx-auto max-w-5xl px-4 py-24">
        <div className="mb-8">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">About Us</div>
          <h1 className="text-4xl font-black sm:text-5xl">Built for collectors, sellers, and the hobby community</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-300">
            TcgPoké Market is a collector-focused marketplace for Pokémon singles, sealed products, graded cards, and other collectibles.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Our mission",
              text: "Connect collectors through a fast, secure, and community-driven experience with competitive pricing and reliable shipping.",
            },
            {
              title: "What makes us different",
              text: "We focus on clear listings, trusted sellers, transparent fees, and a buying flow designed for confidence.",
            },
            {
              title: "For every stage",
              text: "Whether you are hunting rare cards, building a collection, or growing a business, the marketplace is built to help you move faster.",
            },
          ].map((card) => (
            <section key={card.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-bold text-yellow-400">{card.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">{card.text}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-black">Brand story</h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-gray-300">
            TcgPoké Market was created to give collectors a marketplace that feels simple, trustworthy, and made for the hobby. From modern singles to vintage grails, the goal is to make buying and selling easier without losing the excitement of the chase.
          </p>
        </section>
        </div>
      </div>
    </>
  );
}
