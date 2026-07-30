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
  Mint: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  "Near Mint": "text-green-300 border-green-400/30 bg-green-400/10",
  "Lightly Played": "text-yellow-300 border-yellow-400/30 bg-yellow-400/10",
  "Moderately Played": "text-orange-300 border-orange-400/30 bg-orange-400/10",
  "Heavily Played": "text-red-300 border-red-400/30 bg-red-400/10",
  Damaged: "text-gray-300 border-gray-400/30 bg-gray-400/10",
};

const CATEGORY_LABELS: Record<string, string> = {
  single: "Singles",
  sealed: "Sealed",
  graded: "Graded",
  accessory: "Accessory",
};

const CATEGORY_ICONS: Record<string, string> = {
  single: "🃏",
  sealed: "📦",
  graded: "🏆",
  accessory: "🛡️",
};

export default function ListingCard({ listing }: ListingCardProps) {
  const conditionColor = CONDITION_COLORS[listing.condition] ?? "text-gray-300 border-gray-400/30 bg-gray-400/10";
  const image = getImageStatus(listing);

  return (
    <a
      href={`/listings/${listing.id}`}
      className="group block overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101724] shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-yellow-400/30 hover:shadow-black/30"
    >
      <div className="relative aspect-[4/5] overflow-hidden border-b border-white/5 bg-gradient-to-br from-white/5 to-black/20">
        {image ? (
          <VerifiedImage listing={listing} image={image} className="absolute inset-0" />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl">{CATEGORY_ICONS[listing.category] ?? "🃏"}</div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur">{CATEGORY_LABELS[listing.category] ?? listing.category}</span>
          {listing.grade_company && <span className="rounded-full bg-yellow-400 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-black">{listing.grade_company} {listing.grade_score}</span>}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-black leading-tight text-white transition group-hover:text-yellow-300">{listing.card_name}</h3>
            <p className="mt-1 text-sm text-gray-400">{listing.set_name}{listing.card_number ? ` · ${listing.card_number}` : ""}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-black text-white">${listing.price.toFixed(2)}</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{listing.quantity} available</div>
          </div>
        </div>

        {listing.rarity && <p className="line-clamp-2 text-sm text-gray-500">{listing.rarity}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${conditionColor}`}>{listing.condition}</span>
          {listing.profiles?.username && (
            <a href={`/profile/${listing.profiles.username}`} className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 transition hover:border-yellow-400/30 hover:text-yellow-300">
              @{listing.profiles.username}
            </a>
          )}
        </div>
      </div>
    </a>
  );
}
