import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sell Pokémon Cards",
  description:
    "List your Pokémon TCG singles, sealed products, and graded cards on TCG Poke Market. Low fees, fast payouts, and thousands of active buyers.",
  keywords: [
    "sell Pokémon cards",
    "Pokémon card marketplace seller",
    "list Pokémon cards for sale",
    "sell graded Pokémon cards",
    "Pokémon TCG seller platform",
  ],
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/sell",
  },
  openGraph: {
    title: "Sell Pokémon Cards | TCG Poke Market",
    description:
      "Turn your collection into cash. List Pokémon TCG cards and sealed products to thousands of buyers. Low fees, fast payouts.",
    url: "https://tcg-poke-market.sintra.site/sell",
  },
};

export default function SellLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
