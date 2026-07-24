import type { Listing, Profile } from "@/lib/supabase/types";
import { notFound } from "next/navigation";
import { choosePrimaryImage, evaluateImageMatch } from "@/lib/image-verification";
import { VerifiedImage } from "@/components/listings/VerifiedImage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ProfileActions from "./profile-actions";
import type { Database } from "@/lib/supabase/types";

type PrivacyVisibility = Database["public"]["Tables"]["profile_privacy_settings"]["Row"]["profile_visibility"];

type PrivacySettings = Database["public"]["Tables"]["profile_privacy_settings"]["Row"];

const DEFAULT_PRIVACY: PrivacySettings = {
  user_id: "",
  who_can_follow: "everyone",
  who_can_friend_request: "everyone",
  profile_visibility: "public",
  collection_visibility: "public",
  activity_visibility: "public",
  message_visibility: "everyone",
  created_at: "",
  updated_at: "",
};

function normalizePrivacy(row: PrivacySettings | null | undefined) {
  return row ?? DEFAULT_PRIVACY;
}

async function getViewerState(profileId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isOwner: false, follows: false, friends: false };
  if (user.id === profileId) return { user, isOwner: true, follows: true, friends: true };

  const admin = createAdminClient();
  const [{ data: follow }, { data: friendship }] = await Promise.all([
    (admin as any).from("follows").select("id").eq("follower_id", user.id).eq("following_id", profileId).maybeSingle(),
    (admin as any)
      .from("friendships")
      .select("id, status")
      .or(`and(requester_id.eq.${user.id},receiver_id.eq.${profileId}),and(requester_id.eq.${profileId},receiver_id.eq.${user.id})`)
      .eq("status", "accepted")
      .maybeSingle(),
  ]);

  return { user, isOwner: false, follows: Boolean(follow), friends: Boolean(friendship) };
}

function canViewProfile(visibility: PrivacyVisibility, state: { isOwner: boolean; follows: boolean; friends: boolean }) {
  if (state.isOwner) return true;
  if (visibility === "public") return true;
  if (visibility === "followers_only") return state.follows || state.friends;
  if (visibility === "friends_only") return state.friends;
  return false;
}

function canViewCollections(visibility: PrivacyVisibility, state: { isOwner: boolean; follows: boolean; friends: boolean }) {
  return canViewProfile(visibility, state);
}

type ProfileWithListings = Profile & {
  listings?: Listing[];
};

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function buildRestUrl(table: string, select: string, filters: Array<[string, string]> = [], limit = 1000) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  url.searchParams.set("limit", String(limit));
  for (const [key, value] of filters) url.searchParams.set(key, value);
  return url;
}

async function fetchPublicRows<T>(table: string, select: string, filters: Array<[string, string]> = [], limit = 1000) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [] as T[];

  const response = await fetch(buildRestUrl(table, select, filters, limit).toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    cache: "force-cache",
  });

  if (!response.ok) return [] as T[];
  return (await response.json()) as T[];
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ username: string }>> {
  const rows = await fetchPublicRows<Pick<Profile, "username">>("profiles", "username", [["username", "not.is.null"]], 2000);
  return rows.filter((row): row is { username: string } => Boolean(row.username)).map((row) => ({ username: row.username })).slice(0, 500);
}



export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const admin = createAdminClient();
  const [{ data: profile }, { data: privacy }] = await Promise.all([
    (admin as any).from("profiles").select("id, username, full_name, avatar_url, is_seller, seller_rating, total_sales, created_at, seller_state, verification_status").eq("username", username).maybeSingle(),
    (admin as any).from("profile_privacy_settings").select("*").eq("user_id", (await (admin as any).from("profiles").select("id").eq("username", username).maybeSingle()).data?.id ?? "").maybeSingle(),
  ]);
  if (!profile) {
    notFound();
  }

  const viewerState = await getViewerState(profile.id);
  const privacySettings = normalizePrivacy(privacy as PrivacySettings | null);
  const profileVisible = canViewProfile(privacySettings.profile_visibility, viewerState);
  const collectionsVisible = canViewCollections(privacySettings.collection_visibility, viewerState);
  const canSeeActivity = viewerState.isOwner || privacySettings.activity_visibility === "public" || (privacySettings.activity_visibility === "followers_only" && (viewerState.follows || viewerState.friends)) || (privacySettings.activity_visibility === "friends_only" && viewerState.friends);
  const activityVisibilityChip = privacySettings.activity_visibility === "public" ? "Public" : privacySettings.activity_visibility === "followers_only" ? "Followers only" : privacySettings.activity_visibility === "friends_only" ? "Friends only" : "Private";
  const messageVisibilityChip = privacySettings.message_visibility === "everyone" ? "Everyone" : privacySettings.message_visibility === "followers_only" ? "Followers only" : privacySettings.message_visibility === "friends_only" ? "Friends only" : "No one";
  const followVisibilityChip = privacySettings.who_can_follow === "everyone" ? "Everyone" : privacySettings.who_can_follow === "followers_only" ? "Followers only" : "No one";
  const friendRequestVisibilityChip = privacySettings.who_can_friend_request === "everyone" ? "Everyone" : privacySettings.who_can_friend_request === "followers_only" ? "Followers only" : "No one";
  const profileData = profile as Profile;
  const sellerVerificationText = profileVisible ? (profileData.verification_status === "approved" ? "Verified Seller" : "Seller verification pending") : "Private profile";
  const activityStatusCopy = canSeeActivity ? "Recent activity available" : "Recent activity hidden";



  const listings = collectionsVisible ? await fetchPublicRows<Listing>("listings", "*", [["seller_id", `eq.${profileData.id}`], ["status", "eq.active"]], 2000) : [];
  const publicProfile = profileData as ProfileWithListings;
  publicProfile.listings = listings ?? [];
  const profileHeaderName = profileVisible ? (profileData.full_name ?? profileData.username ?? "Seller") : "Private profile";
  const profileHeaderHandle = profileVisible && profileData.username ? `@${profileData.username}` : null;
  const profileHeaderAvatar = profileVisible ? profileData.avatar_url : null;
  const profileHeaderInitial = profileHeaderAvatar ? null : profileVisible ? (profileData.username?.[0]?.toUpperCase() ?? profileData.full_name?.[0]?.toUpperCase() ?? "?") : "🔒";
  const profileStatsLocked = !profileVisible;
  const sellerRating = profileVisible ? profileData.seller_rating ?? 0 : 0;
  const totalSales = profileVisible ? profileData.total_sales ?? 0 : 0;
  const activeListingCount = collectionsVisible ? publicProfile.listings?.length ?? 0 : 0;
  const profileStatusCopy = profileVisible ? (profileData.verification_status === "approved" ? "Verified Seller" : "Seller verification pending") : "Private profile";
  const viewerLabel = viewerState.isOwner ? "You" : viewerState.follows ? "Following" : viewerState.friends ? "Friends" : "Visitor";
  const viewMessage = profileVisible ? "This profile is visible based on the seller’s privacy settings." : "This profile is private. Follow or connect to view more, if allowed.";
  const listingMessage = collectionsVisible ? "Browse items currently available from this seller." : "This seller has restricted collection visibility.";
  const activityMessage = canSeeActivity ? "Recent activity is visible to your account." : "Recent activity is private.";
  const profileViewStatus = profileVisible ? profileStatusCopy : "Private profile";
  const hasProfileImage = profileHeaderAvatar !== null;
  const headerInitial = profileHeaderInitial ?? "?";
  const profileVisibilityChip = privacySettings.profile_visibility === "public" ? "Public" : privacySettings.profile_visibility === "followers_only" ? "Followers only" : privacySettings.profile_visibility === "friends_only" ? "Friends only" : "Private";
  const collectionVisibilityChip = privacySettings.collection_visibility === "public" ? "Public" : privacySettings.collection_visibility === "followers_only" ? "Followers only" : privacySettings.collection_visibility === "friends_only" ? "Friends only" : "Private";

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
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-yellow-400/20 text-3xl font-black text-yellow-400">
                {hasProfileImage ? <img src={profileHeaderAvatar ?? ""} alt={profileHeaderName} className="h-full w-full object-cover" /> : headerInitial}
              </div>
              <div>
                <p className="text-sm uppercase tracking-widest text-yellow-400">{profileViewStatus}</p>
                <h1 className="text-3xl font-black">{profileHeaderName}</h1>
                {profileHeaderHandle && <p className="mt-1 text-gray-400">{profileHeaderHandle}</p>}
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-gray-500">Viewer status · {viewerLabel}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-gray-300">
                  <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1">Profile: {profileVisibilityChip}</span>
                  <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-1">Collections: {collectionVisibilityChip}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                <div className="text-2xl font-black text-yellow-400">{profileStatsLocked ? "—" : totalSales}</div>
                <div className="text-xs text-gray-400">Total sales</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                <div className="text-2xl font-black text-yellow-400">{profileStatsLocked ? "—" : sellerRating.toFixed(1)}</div>
                <div className="text-xs text-gray-400">Seller rating</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                <div className="text-2xl font-black text-yellow-400">{activeListingCount}</div>
                <div className="text-xs text-gray-400">Active listings</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                <div className="text-2xl font-black text-yellow-400">{viewerState.isOwner || profileVisible ? "Trusted" : "Private"}</div>
                <div className="text-xs text-gray-400">Marketplace member</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-gray-300">
              <div className="font-semibold text-yellow-400">Profile access</div>
              <p className="mt-1">{viewMessage}</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4 text-xs font-semibold uppercase tracking-[0.15em] text-gray-300">
              <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-2">Activity: {activityVisibilityChip}</span>
              <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-2">Messages: {messageVisibilityChip}</span>
              <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-2">Follows: {followVisibilityChip}</span>
              <span className="rounded-full border border-white/10 bg-[#13131f] px-3 py-2">Friends: {friendRequestVisibilityChip}</span>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
              <div className="font-semibold text-white">Activity</div>
              <p className="mt-1 text-gray-400">{activityStatusCopy}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <a href={`/messages?recipient=${profileData.id}`} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">Message</a>
              <a href="/dashboard" className="rounded-xl border border-white/15 px-4 py-2 font-semibold text-white">Manage profile</a>
            </div>


















































            <ProfileActions userId={profileData.id} />
            {viewerState.isOwner && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
                <div className="font-semibold text-white">Your privacy controls</div>
                <p className="mt-1 text-gray-400">Open the dashboard to change profile, collection, activity, and message visibility.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Active listings</h2>
              <p className="text-sm text-gray-400">{listingMessage}</p>
            </div>
          </div>

          {!collectionsVisible ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">
              Collection visibility is restricted for this profile.
            </div>
          ) : !publicProfile.listings?.length ? (
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
