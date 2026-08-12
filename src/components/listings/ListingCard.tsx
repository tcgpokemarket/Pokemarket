import Link from "next/link";
import type { Listing } from "@/lib/supabase/types";
import { VerifiedImage } from "./VerifiedImage";
import { choosePrimaryImage, evaluateImageMatch } from "@/lib/image-verification";

type ListingSellerProfile = {
  username: string | null;
  seller_rating: number;
  verification_status: "not_started" | "pending_review" | "approved" | "rejected" | "more_information_required" | "suspended" | null;
};

type ListingWithSeller = Listing & {
  profiles?: ListingSellerProfile | null;
};

// Supabase's generated Listing type does not guarantee the optional profiles relation.
// Keep the relation access behind this runtime-safe narrowing so Vercel's TypeScript build succeeds.
function getSellerProfile(listing: Listing): ListingSellerProfile | null {
  const value = (listing as unknown as { profiles?: ListingSellerProfile | null }).profiles;
  return value ?? null;
}

function getImageStatus(listing: Listing) {
  const images = listing.images ?? [];
  const identity = {
    name: listing.card_name,
    setName: listing.set_name,
    cardNumber: listing.card_number,
    variant: listing.grade_company ? `${listing.grade_company} ${listing.grade_score ?? ""}`.trim() : null,
  };

  const sellerIsVerified = getSellerProfile(listing)?.verification_status === "approved";
  const source = sellerIsVerified ? "seller_verified" : "seller_unverified";

  const scored = images.map((imageUrl) =>
    evaluateImageMatch(identity, {
      imageUrl,
      source,
      setName: listing.set_name,
      cardNumber: listing.card_number,
      variant: identity.variant,
    })
  );

  return choosePrimaryImage(scored);
}

interface ListingCardProps {
  listing: ListingWithSeller;
}

export default function ListingCard({ listing }: ListingCardProps) {
  const image = getImageStatus(listing);
  const sellerProfile = getSellerProfile(listing);
  const sellerIsVerified = sellerProfile?.verification_status === "approved";

  return (
    <div className="group block overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101724]">
      <Link href={`/listings/${listing.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-black/20">
          {image ? (
            <VerifiedImage listing={listing} image={image} className="absolute inset-0" />
          ) : (
            <div className="flex h-full items-center justify-center text-7xl">🃏</div>
          )}
          {sellerIsVerified && (
            <div className="absolute bottom-2 right-2 rounded-full border border-yellow-400/30 bg-black/70 px-2 py-1 text-[11px] font-semibold text-yellow-300 backdrop-blur">
              Verified Seller
            </div>
          )}
        </div>

        <div className="p-5">
          <h3 className="font-black text-white">{listing.card_name}</h3>
          <p className="text-sm text-gray-400">{listing.set_name}</p>
          <p className="mt-2 font-black text-white">${listing.price.toFixed(2)}</p>
          {sellerIsVerified && <p className="mt-1 text-xs font-semibold text-yellow-300">Verified Seller</p>}
        </div>
      </Link>

      <div className="flex flex-wrap gap-2 px-5 pb-5">
        <Link href={`/listings/${listing.id}`} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white">View</Link>
        <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white">Add to Cart</button>
        <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white">Make Offer</button>
        {sellerProfile?.username && <Link href={`/profile/${sellerProfile.username}`} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white">@{sellerProfile.username}</Link>}
      </div>
    </div>
  );
}
