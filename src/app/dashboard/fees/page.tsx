import type { Metadata } from "next";
import SellerFeesClient from "./SellerFeesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seller Fee Management",
  description: "Configure seller fee tiers, free-sale limits, and seller overrides for TCG Poke Market.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SellerFeesPage() {
  return <SellerFeesClient />;
}
