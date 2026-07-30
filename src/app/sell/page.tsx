"use client";

import ListingWizard from "@/components/listings/listing-wizard";

export default function SellPage() {
  return (
    <ListingWizard
      copy={{
        title: "Create a listing",
        eyebrow: "Sell",
        description: "Build a polished listing with guided steps, photo ordering, price checks, and draft autosave.",
        backHref: "/dashboard",
        backLabel: "Dashboard",
        actionLabel: "Publish",
        actionHint: "Your draft saves locally as you work, and you can save it to the marketplace anytime before publishing.",
      }}
      redirectTo="/sell"
    />
  );
}
