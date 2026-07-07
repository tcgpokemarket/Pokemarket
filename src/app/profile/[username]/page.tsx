import { createClient } from "@/lib/supabase/server";
import type { Listing, Profile } from "@/lib/supabase/types";
import { notFound } from "next/navigation";
import { choosePrimaryImage, evaluateImageMatch } from "@/lib/image-verification";
import { VerifiedImage } from "@/components/listings/VerifiedImage";

type ProfileWithListings = Profile & {
  listings?: Listing[];
};

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams(): Array<{ username: string }> {
  return [];
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) {
    notFound();
  }

  const profileData = profile as Profile;
  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_id", profileData.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const publicProfile = profileData as ProfileWithListings;
  publicProfile.listings = listings ?? [];

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span>TCG</span>
            <span className="text-yellow-400">Poke</span>
            <span>Market</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <a href="/listings" className="text-gray-300 hover:text-white">Browse</a>
            <a href="/auth" className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300">Sign In</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-400/20 text-3xl font-black text-yellow-400">
                {profileData.username?.[0]?.toUpperCase() ?? profileData.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="text-sm uppercase tracking-widest text-yellow-400">Public profile</p>
                <h1 className="text-3xl font-black">{profileData.full_name ?? profileData.username ?? "Seller"}</h1>
                {profileData.username && <p className="mt-1 text-gray-400">@{profileData.username}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                <div className="text-2xl font-black text-yellow-400">{profileData.total_sales}</div>
                <div className="text-xs text-gray-400">Total sales</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                <div className="text-2xl font-black text-yellow-400">{profileData.seller_rating.toFixed(1)}</div>
                <div className="text-xs text-gray-400">Seller rating</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                <div className="text-2xl font-black text-yellow-400">{publicProfile.listings?.length ?? 0}</div>
                <div className="text-xs text-gray-400">Active listings</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                <div className="text-2xl font-black text-yellow-400">Trusted</div>
                <div className="text-xs text-gray-400">Marketplace member</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-gray-300">
              <div className="font-semibold text-yellow-400">Seller trust signals</div>
              <p className="mt-1">
                Verified listings, clear shipping choices, and seller ratings help buyers shop with confidence.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Active listings</h2>
              <p className="text-sm text-gray-400">Browse items currently available from this seller.</p>
            </div>
          </div>

          {!publicProfile.listings?.length ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">
              No active listings yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {publicProfile.listings.map((listing) => (
                <a
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="block overflow-hidden rounded-2xl border border-white/10 bg-[#13131f] transition-all hover:border-yellow-400/40"
                >
                  <div className="flex h-40 items-center justify-center bg-white/5 overflow-hidden">
                    {choosePrimaryImage((listing.images ?? []).map((imageUrl) => evaluateImageMatch({ name: listing.card_name, setName: listing.set_name, cardNumber: listing.card_number }, { imageUrl, source: "seller_unverified", setName: listing.set_name, cardNumber: listing.card_number }))) ? (
                      <VerifiedImage
                        listing={listing}
                        image={choosePrimaryImage((listing.images ?? []).map((imageUrl) => evaluateImageMatch({ name: listing.card_name, setName: listing.set_name, cardNumber: listing.card_number }, { imageUrl, source: "seller_unverified", setName: listing.set_name, cardNumber: listing.card_number }))) }
                        className="h-full w-full"
                      />
                    ) : (
                      <span className="text-4xl">🃏</span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-bold">{listing.card_name}</div>
                    <div className="mt-1 text-xs text-gray-400">{listing.set_name}</div>
                    <div className="mt-3 text-lg font-black text-white">${listing.price.toFixed(2)}</div>
                  </div>
                  {(listing as Listing & { image_pending_verification?: boolean }).image_pending_verification && (
                    <div className="border-t border-white/10 bg-red-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-red-300">
                      Image pending verification
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
