import ListingWizard from "@/components/listings/listing-wizard";

export default function SellPage() {
  return (
    <ListingWizard
      copy={{
        title: "Sell cards with a cleaner, guided workflow.",
        eyebrow: "Sell inventory",
        description: "Use a step-by-step seller flow with autosaved drafts, drag-and-drop image uploads, reorder controls, and a final validation pass before publishing.",
        backHref: "/dashboard",
        backLabel: "Dashboard",
        actionLabel: "Publish Listing",
        actionHint: "If you need more time, save the draft and come back later — your work stays in the browser until you publish it.",
      }}
      redirectTo="/sell"
    />
  );
}
