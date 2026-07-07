import type { Listing } from "@/lib/supabase/types";
import { VerifiedImage } from "./VerifiedImage";
import { choosePrimaryImage, evaluateImageMatch, type ImageVerificationResult } from "@/lib/image-verification";

function getVerifiedListingImage(listing: Listing) {
  const images = listing.images ?? [];
  const identity = {
    name: listing.card_name,
    setName: listing.set_name,
    cardNumber: listing.card_number,
    variant: listing.grade_company ? `${listing.grade_company} ${listing.grade_score ?? ""}`.trim() : null,
  };
  const scored = images.map((imageUrl) => evaluateImageMatch(identity, { imageUrl, source: "seller_unverified", setName: listing.set_name, cardNumber: listing.card_number, variant: identity.variant }));
  return choosePrimaryImage(scored);
}

function normalizeImageVerification(image: ImageVerificationResult | null | undefined): ImageVerificationResult | null {
  if (!image) return null;

  return {
    imageUrl: image.imageUrl,
    source: image.source,
    confidence: image.confidence,
    score: image.score,
    verified: image.verified,
    reason: image.reason,
    cardName: image.cardName,
    setName: image.setName,
    cardNumber: image.cardNumber ?? null,
    variant: image.variant ?? null,
    width: image.width ?? null,
    height: image.height ?? null,
  };
}

function getImageStatus(listing: Listing) {
  const verification = (listing as Listing & {
    image_verification?: {
      primary?: ImageVerificationResult | null;
    } | null;
  }).image_verification;

  return normalizeImageVerification(verification?.primary) ?? getVerifiedListingImage(listing);
}

interface ListingCardProps {
  listing: Listing & { profiles?: { username: string | null; seller_rating: number } | null };
}

const CONDITION_COLORS: Record<string, string> = {
  Mint: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  "Near Mint": "text-green-400 border-green-400/30 bg-green-400/10",
  "Lightly Played": "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  "Moderately Played": "text-orange-400 border-orange-400/30 bg-orange-400/10",
  "Heavily Played": "text-red-400 border-red-400/30 bg-red-400/10",
  Damaged: "text-gray-400 border-gray-400/30 bg-gray-400/10",
};

const CATEGORY_ICONS: Record<string, string> = {
  single: "🃏",
  sealed: "📦",
  graded: "🏆",
  accessory: "🛡️",
};

export default function ListingCard({ listing }: ListingCardProps) {
  const conditionColor = CONDITION_COLORS[listing.condition] ?? "text-gray-400 border-gray-400/30 bg-gray-400/10";

  return (
    <a
      href={`/listings/${listing.id}`}
      className="block bg-[#13131f] border border-white/10 rounded-2xl overflow-hidden hover:border-yellow-400/40 transition-all group"
    >
      <div className="relative bg-white/5 h-44 flex items-center justify-center border-b border-white/5 overflow-hidden">
        {getImageStatus(listing) ? (
          <VerifiedImage
            listing={listing}
            image={getImageStatus(listing)}
            className="absolute inset-0"
          />
        ) : (
          <span className="text-6xl">{CATEGORY_ICONS[listing.category] ?? "🃏"}</span>
        )}
        {listing.grade_company && (
          <span className="absolute top-3 right-3 bg-yellow-400 text-black text-xs font-black px-2 py-1 rounded-lg">
            {listing.grade_company} {listing.grade_score}
          </span>
        )}
      </div>
      {Boolean((listing as Listing & { image_pending_verification?: boolean }).image_pending_verification) && (
        <div className="border-b border-white/5 bg-red-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-red-300">
          Image pending verification
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-sm group-hover:text-yellow-400 transition-colors leading-tight">
            {listing.card_name}
          </h3>
        </div>
        <p className="text-gray-500 text-xs mb-2">{listing.set_name}{listing.card_number ? ` · ${listing.card_number}` : ""}</p>
        {listing.rarity && <p className="text-gray-400 text-xs mb-3">{listing.rarity}</p>}

        <div className="flex items-center justify-between">
          <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${conditionColor}`}>
            {listing.condition}
          </span>
          <span className="text-lg font-black text-white">${listing.price.toFixed(2)}</span>
        </div>

        {listing.profiles?.username && (
          <a href={`/profile/${listing.profiles.username}`} className="text-gray-500 text-xs mt-2 block hover:text-yellow-400 transition-colors">
            by {listing.profiles.username}
            {listing.profiles.seller_rating > 0 && (
              <span className="ml-1 text-yellow-400">★ {listing.profiles.seller_rating.toFixed(1)}</span>
            )}
          </a>
        )}
      </div>
    </a>
  );
}
