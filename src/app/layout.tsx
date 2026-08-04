import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import AppFrame from "@/components/app-frame";

// Use environment-driven site URL to avoid hard-coded domains in metadata and redirects.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const OG_IMAGE = process.env.NEXT_PUBLIC_OG_IMAGE || `${SITE_URL.replace(/\/$/, "")}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  authors: [{ name: "TCG Poke Market", url: SITE_URL }],
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
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
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
        <Suspense fallback={null}>
          <AppFrame>{children}</AppFrame>
        </Suspense>
      </body>
    </html>
  );
}
