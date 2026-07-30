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
  const imageUrl = getListingImageUrl(listing);

  return (
    <a
      href={`/listings/${listing.id}`}
      className="group block overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#13131f] shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-1 hover:border-yellow-400/40 hover:shadow-black/30"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
        <img
          src={imageUrl}
          alt={listing.card_name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          onError={(event) => {
            event.currentTarget.src = getProfessionalFallbackImage();
          }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-200">
                {CATEGORY_ICONS[listing.category] ?? "✦"} {listing.category}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${conditionColor}`}>
                {listing.condition}
              </span>
            </div>
            <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black shadow-lg shadow-yellow-400/20">
              ${listing.price.toFixed(2)}
            </span>
          </div>
        </div>
        {listing.grade_company && (
          <span className="absolute right-3 top-3 rounded-full border border-yellow-400/30 bg-yellow-400 px-2.5 py-1 text-xs font-black text-black shadow-lg shadow-black/20">
            {listing.grade_company} {listing.grade_score}
          </span>
        )}
      </div>
      {Boolean((listing as Listing & { image_pending_verification?: boolean }).image_pending_verification) && (
        <div className="border-b border-white/5 bg-red-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-red-300">
          Image pending verification
        </div>
      )}

      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-bold leading-tight text-white transition group-hover:text-yellow-300">
            {listing.card_name}
          </h3>
          <p className="mt-1 text-xs text-gray-400">
            {listing.set_name}{listing.card_number ? ` · ${listing.card_number}` : ""}
          </p>
          {listing.rarity && <p className="mt-1 text-xs text-gray-500">{listing.rarity}</p>}
        </div>

        {listing.profiles?.username && (
          <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs text-gray-400">
            <a href={`/profile/${listing.profiles.username}`} className="transition hover:text-yellow-300">
              by {listing.profiles.username}
            </a>
            {listing.profiles.seller_rating > 0 && <span className="font-semibold text-yellow-400">★ {listing.profiles.seller_rating.toFixed(1)}</span>}
          </div>
        )}
      </div>
    </a>
  );
}
