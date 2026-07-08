"use client";

import { useRouter } from "next/navigation";

export default function MessageSellerButton({ sellerId, listingId, listingTitle }: { sellerId: string; listingId: string; listingTitle: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/messages?recipient=${sellerId}&contextType=listing&contextId=${listingId}&title=${encodeURIComponent(listingTitle)}`)}
      className="flex-1 rounded-xl border border-white/15 px-4 py-3 font-semibold text-white transition hover:border-yellow-400/60"
    >
      Message Seller
    </button>
  );
}
