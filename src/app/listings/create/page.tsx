"use client";

import ListingWizard from "@/components/listings/listing-wizard";

export default function CreateListingPage() {
  return (
    <ListingWizard
      copy={{
        title: "Create a listing.",
        eyebrow: "Sell",
        description: "Add details, photos, and price.",
        backHref: "/dashboard",
        backLabel: "Dashboard",
        actionLabel: "Publish Listing",
        actionHint: "Draft saves locally",
      }}
      redirectTo="/listings/create"
    />
  );
}
