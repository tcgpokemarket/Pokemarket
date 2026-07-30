import type { Metadata } from "next";
import AuctionSetupClient from "./auction-setup-client";

export const metadata: Metadata = {
  title: "Create auction",
  description: "Set up a live auction room, queue items, and launch when ready.",
  robots: { index: false, follow: false },
};

export default function CreateAuctionPage() {
  return <AuctionSetupClient sellerName="Seller" sellerUsername={null} listings={[]} existingShows={[]} />;
}
