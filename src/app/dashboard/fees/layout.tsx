import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Fee Management",
  description: "Manage seller fee tiers and overrides for TCG Poke Market.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FeesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
