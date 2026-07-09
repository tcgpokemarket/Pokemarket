import type { Metadata } from "next";
import "./globals.css";
import SiteShell from "@/components/site-shell";

const BASE_URL = "https://tcg-poke-market.sintra.site";
const OG_IMAGE = "https://cdn.sintra.ai/img/pGq7RIJGMDuiejauByatqWc9HGCgpqvSJyf9_1fzpMA/f:jpg/rs:fit:800/czM6Ly9zaW50cmEtYnJhaW5haS1tZWRpYS9rbm93bGVkZ2UtcHJvZmlsZXMvZTE4YTEyMGUtMjk0Yy00N2UyLWIyZTctNTBjMzI3ZjY4YjY1L2Fzc2V0cy8wN2FkYmJhOC0xNWY5LTRkYzEtYjk1OS03MzczMmJkNzgzN2QvNDMucG5n";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "TCG Poke Market | Buy, Sell & Trade Pokémon Cards",
    template: "%s | TCG Poke Market",
  },
  description:
    "Your trusted marketplace for Pokémon TCG singles, sealed products, graded cards, and market insights. Buy, sell, and invest with confidence.",
  keywords: [
    "Pokémon cards",
    "Pokémon TCG",
    "buy Pokémon cards",
    "sell Pokémon cards",
    "Pokémon singles",
    "sealed Pokémon products",
    "graded Pokémon cards",
    "PSA graded cards",
    "Pokémon marketplace",
    "TCG marketplace",
    "rare Pokémon cards",
    "Pokémon card prices",
    "Pokémon card value",
    "booster box",
    "elite trainer box",
  ],
  authors: [{ name: "TCG Poke Market", url: BASE_URL }],
  creator: "TCG Poke Market",
  publisher: "TCG Poke Market",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "TCG Poke Market",
    title: "TCG Poke Market | Buy, Sell & Trade Pokémon Cards",
    description:
      "Your trusted marketplace for Pokémon TCG singles, sealed products, graded cards, and market insights. Buy, sell, and invest with confidence.",
    images: [
      {
        url: OG_IMAGE,
        width: 800,
        height: 800,
        alt: "TCG Poke Market — Pokémon TCG Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TCG Poke Market | Buy, Sell & Trade Pokémon Cards",
    description:
      "Your trusted marketplace for Pokémon TCG singles, sealed products, graded cards, and market insights.",
    images: [OG_IMAGE],
    creator: "@tcgpokemarket",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
