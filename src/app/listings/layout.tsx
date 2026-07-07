import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Pokémon TCG Listings",
  description:
    "Shop thousands of Pokémon TCG singles, sealed booster boxes, graded PSA/BGS/CGC cards, and accessories. Filter by set, condition, price, and rarity.",
  keywords: [
    "buy Pokémon cards online",
    "Pokémon singles for sale",
    "sealed Pokémon booster box",
    "PSA graded Pokémon cards",
    "BGS graded Pokémon cards",
    "Pokémon card shop",
    "Pokémon card listings",
  ],
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/listings",
  },
  openGraph: {
    title: "Browse Pokémon TCG Listings | TCG Poke Market",
    description:
      "Shop thousands of Pokémon TCG singles, sealed products, and graded cards with real-time pricing.",
    url: "https://tcg-poke-market.sintra.site/listings",
  },
};

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
