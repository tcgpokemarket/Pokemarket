import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrivacySettings, getProfileByUsername, getSocialCounts } from "@/lib/social-network";
import { choosePrimaryImage, evaluateImageMatch } from "@/lib/image-verification";
import { VerifiedImage } from "@/components/listings/VerifiedImage";
import type { Listing } from "@/lib/supabase/types";
import ProfileActions from "./profile-actions";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { notFound as profileNotFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { cookies as nextCookies } from "next/headers";
import { NextResponse as ProfileNextResponse } from "next/server";
import { type as osType } from "os";
import { getUserFeed } from "@/lib/social-network";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams(): Array<{ username: string }> {
  return [];
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const profileRow = profile as { id: string; username: string | null; full_name: string | null; avatar_url: string | null; is_seller: boolean; seller_rating: number; total_sales: number; created_at: string };

  const [counts, privacy, supabase] = await Promise.all([
    getSocialCounts(profileRow.id),
    getPrivacySettings(profileRow.id).catch(() => null as null | import("@/lib/social-network").PrivacySettingsRow),
    createClient(),
  ]);

  type ProfileShowRow = { id: string; title: string; description: string | null; thumbnail: string | null; status: string; viewer_count: number; peak_viewers: number; created_at: string };

  const [listingsResult, showsResult, followersResult, followingResult, friendsResult] = await Promise.all([
    supabase.from("listings").select("*").eq("seller_id", profileRow.id).eq("status", "active").order("created_at", { ascending: false }).limit(8),
    supabase.from("live_shows").select("id, title, description, thumbnail, status, viewer_count, peak_viewers, created_at").eq("seller_id", profileRow.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("follows").select("follower_id, created_at").eq("following_id", profileRow.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("follows").select("following_id, created_at").eq("follower_id", profileRow.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("friendships").select("requester_id, receiver_id, status, created_at").or(`requester_id.eq.${profileRow.id},receiver_id.eq.${profileRow.id}`).eq("status", "accepted").limit(8),
  ]);

  const listings = (listingsResult.data ?? []) as Listing[];
  const shows = (showsResult.data ?? []) as ProfileShowRow[];
  const followers = followersResult.data ?? [];
  const following = followingResult.data ?? [];
  const friends = friendsResult.data ?? [];

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span>TCG</span>
            <span className="text-yellow-400">Poke</span>
            <span>Market</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <a href="/listings" className="text-gray-300 hover:text-white">Browse</a>
            <a href="/live" className="text-gray-300 hover:text-white">Live</a>
            <a href="/sell" className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300">Sell</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="h-56 bg-gradient-to-r from-yellow-400/25 via-[#ffab01]/20 to-[#e22400]/25" />
          <div className="px-6 pb-6 sm:px-8">
            <div className="-mt-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="flex items-end gap-5">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#13131f] text-4xl font-black text-yellow-400 shadow-2xl shadow-black/30">
                  {profileRow.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profileRow.avatar_url} alt={profileRow.full_name ?? profileRow.username ?? "Profile"} className="h-full w-full object-cover" />
                  ) : (
                    (profileRow.full_name?.[0] ?? profileRow.username?.[0] ?? "U").toUpperCase()
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-sm uppercase tracking-[0.3em] text-yellow-400">Collector profile</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black sm:text-4xl">{profileRow.full_name ?? profileRow.username ?? "Community member"}</h1>
                    {profileRow.is_seller && <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">Seller badge</span>}
                  </div>
                  <p className="mt-1 text-sm text-gray-400">@{profileRow.username ?? "unknown"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{counts.followers}</div>
                  <div className="text-xs text-gray-400">Followers</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{counts.following}</div>
                  <div className="text-xs text-gray-400">Following</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{counts.friends}</div>
                  <div className="text-xs text-gray-400">Friends</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                  <div className="text-2xl font-black text-yellow-400">{profileRow.total_sales}</div>
                  <div className="text-xs text-gray-400">Sales</div>
                </div>
              </div>
            </div>

            {profileRow.full_name && <p className="mt-6 max-w-3xl text-sm leading-6 text-gray-300">{profileRow.full_name}</p>}

            <ProfileActions userId={profileRow.id} />
            <div className="mt-3 text-xs text-gray-500">Social controls respect blocks and privacy settings.</div>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link href={`/messages?recipient=${profileRow.id}`} className="rounded-xl border border-white/15 px-4 py-2 font-semibold text-white">Message</Link>
              <Link href={`/messages?compose=${profileRow.id}`} className="rounded-xl border border-white/15 px-4 py-2 font-semibold text-white">Open Inbox</Link>
              <Link href="/social" className="rounded-xl border border-white/15 px-4 py-2 font-semibold text-white">View Feed</Link>
            </div>
            <div className="mt-3 text-xs text-gray-500">Seller stats and live activity stay visible when allowed by privacy settings.</div>
            <div className="mt-2 rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">Privacy: {privacy?.profile_visibility ?? "public"}</div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-black">Collections</h2>
                <p className="mt-2 text-sm text-gray-400">{privacy?.collection_visibility ?? "public"}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-black">Listings</h2>
                <p className="mt-2 text-sm text-gray-400">{listings.length} active items visible</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-black">Live shows</h2>
                <p className="mt-2 text-sm text-gray-400">{shows.length} recent shows</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Active listings</h2>
                  <p className="text-sm text-gray-400">Products from this profile.</p>
                </div>
              </div>

              {!listings.length ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">No active listings yet.</div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {listings.map((listing) => {
                    const primaryImage = choosePrimaryImage((listing.images ?? []).map((imageUrl) => evaluateImageMatch(
                      { name: listing.card_name, setName: listing.set_name, cardNumber: listing.card_number },
                      { imageUrl, source: "seller_unverified", setName: listing.set_name, cardNumber: listing.card_number },
                    )));

                    return (
                      <a key={listing.id} href={`/listings/${listing.id}`} className="block overflow-hidden rounded-2xl border border-white/10 bg-[#13131f] transition-all hover:border-yellow-400/40">
                        <div className="flex h-40 items-center justify-center overflow-hidden bg-white/5">
                          {primaryImage ? <VerifiedImage listing={listing} image={primaryImage} className="h-full w-full" /> : <span className="text-4xl">🃏</span>}
                        </div>
                        <div className="p-4">
                          <div className="text-sm font-bold">{listing.card_name}</div>
                          <div className="mt-1 text-xs text-gray-400">{listing.set_name}</div>
                          <div className="mt-3 text-lg font-black text-white">${listing.price.toFixed(2)}</div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black">Live shows</h2>
              <div className="mt-4 space-y-3">
                {shows.length ? shows.map((show) => (
                  <a key={show.id} href={`/live/${show.id}`} className="block rounded-2xl border border-white/10 bg-[#13131f] p-4 hover:border-yellow-400/30">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold">{show.title}</div>
                        <div className="text-sm text-gray-400">{show.description ?? "Live show"}</div>
                      </div>
                      <div className="text-right text-xs text-gray-400">
                        <div>{show.status}</div>
                        <div>{show.viewer_count} viewers</div>
                      </div>
                    </div>
                  </a>
                )) : <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No live shows yet.</div>}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-black">Follower network</h3>
              <div className="mt-4 space-y-3 text-sm text-gray-300">
                <div className="flex items-center justify-between"><span>Recent followers</span><span>{followers.length}</span></div>
                <div className="flex items-center justify-between"><span>Following</span><span>{following.length}</span></div>
                <div className="flex items-center justify-between"><span>Friends</span><span>{friends.length}</span></div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-black">Recent activity</h3>
              <div className="mt-4 space-y-3 text-sm text-gray-400">
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">Follower count updates in real time.</div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">Giveaway and live show alerts appear here.</div>
                <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4">Privacy settings control visibility.</div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
