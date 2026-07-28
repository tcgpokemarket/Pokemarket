import type { Listing } from "@/lib/supabase/types";
import { getListingPrimaryImage, getProfessionalFallbackImage } from "@/lib/uploads";

function getListingImageUrl(listing: Listing) {
  return getListingPrimaryImage(listing.images ?? []) ?? getProfessionalFallbackImage();
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
      <div className="relative h-44 overflow-hidden border-b border-white/5 bg-white/5">
        <img
          src={getListingImageUrl(listing)}
          alt={listing.card_name}
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = getProfessionalFallbackImage();
          }}
        />
        {listing.grade_company && (
          <span className="absolute right-3 top-3 rounded-lg bg-yellow-400 px-2 py-1 text-xs font-black text-black">
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
