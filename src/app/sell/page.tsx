import ListingWizard from "@/components/listings/listing-wizard";

export default function SellPage() {
  return (
    <ListingWizard
      copy={{
        title: "Create a listing",
        eyebrow: "Sell",
        description: "",
        backHref: "/dashboard",
        backLabel: "Dashboard",
        actionLabel: "Publish",
        actionHint: "",
      }}
      redirectTo="/sell"
      scannerHref="/sell/scan"
      scannerLabel="Scan Card"
    />
  );
}
