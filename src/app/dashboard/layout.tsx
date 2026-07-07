import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Dashboard",
  description: "Manage your Pokémon TCG listings, track sales, and view payouts on TCG Poke Market.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
