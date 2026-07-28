"use client";

import { buildImageOverlayTag, type ImageVerificationResult } from "@/lib/image-verification";
import { getProfessionalFallbackImage } from "@/lib/uploads";

export function VerifiedImage({
  listing,
  image,
  className = "",
}: {
  listing: { card_name: string; set_name: string; card_number?: string | null };
  image: ImageVerificationResult | null;
  className?: string;
}) {
  const fallbackImage = getProfessionalFallbackImage();
  const label = buildImageOverlayTag(listing);
  const badgeClass =
    image?.confidence === "verified"
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-300"
      : image?.confidence === "high"
        ? "border-green-400/30 bg-green-400/15 text-green-300"
        : image?.confidence === "medium"
          ? "border-yellow-400/30 bg-yellow-400/15 text-yellow-300"
          : "border-red-400/30 bg-red-400/15 text-red-300";

  return (
    <div className={`relative h-full w-full bg-[#0f172a] ${className}`}>
      <img
        src={image?.imageUrl ?? fallbackImage}
        alt={listing.card_name}
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.src = fallbackImage;
          event.currentTarget.onerror = null;
        }}
      />
      {image ? (
        <>
          <div className="absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
            <div className={`rounded-full border px-2 py-1 text-[11px] font-semibold backdrop-blur ${badgeClass}`}>
              {image.confidence === "verified" ? "Verified image" : image.confidence === "high" ? "High confidence" : image.confidence === "medium" ? "Needs review" : "Unverified"}
            </div>
            <div className="rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {label}
            </div>
          </div>
          <div className="absolute bottom-2 left-2 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            Score {image.score}
          </div>
        </>
      ) : null}
    </div>
  );
}
