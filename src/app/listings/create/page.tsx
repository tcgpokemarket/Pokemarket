import ListingWizard from "@/components/listings/listing-wizard";

export default function CreateListingPage() {
  return (
    <ListingWizard
      copy={{
        title: "Create a polished listing in a few guided steps.",
        eyebrow: "Seller onboarding",
        description: "Build a clean, collector-friendly listing with autosaved drafts, drag-and-drop photos, reorder controls, and a final publish review that matches the real marketplace fields.",
        backHref: "/dashboard",
        backLabel: "Dashboard",
        actionLabel: "Publish Listing",
        actionHint: "Your draft saves locally as you work, and you can save it to the marketplace anytime before publishing it.",
      }}
      redirectTo="/listings/create"
    />
  );
}
