import type { Metadata } from "next";
import { getProfileByUsername, getSocialCounts, getUserFeed } from "@/lib/social-network";

export const metadata: Metadata = {
  title: "Social",
  description: "Social activity.",
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/social",
  },
};

const FEATURED_USERS = ["preview"];

export default async function SocialPage() {
  const featuredProfiles = await Promise.all(
    FEATURED_USERS.map(async (username) => {
      const profile = (await getProfileByUsername(username).catch(() => null)) as { id: string; username: string | null; full_name: string | null } | null;
      if (!profile) return null;
      const counts = await getSocialCounts(profile.id).catch(() => ({ followers: 0, following: 0, friends: 0 }));
      const feed = await getUserFeed(profile.id).catch(() => ({ follows: [], notifications: [], friends: [] }));
      return { profile, counts, feed };
    }),
  );

  const entries = featuredProfiles.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.12),_transparent_28%),linear-gradient(180deg,#0f0f1a_0%,#090b14_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.35em] text-yellow-300">Social</div>
              <h1 className="mt-2 text-4xl font-black sm:text-5xl">Social.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">Profiles and activity.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/listings" className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-400/20">Browse listings</a>
              <a href="/live" className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/5">Live auctions</a>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-300">Featured profiles</h2>
              <div className="mt-4 space-y-4">
                {entries.length ? entries.map(({ profile, counts }) => (
                  <a key={profile.id} href={`/profile/${profile.username}`} className="block rounded-2xl border border-white/10 bg-[#13131f] p-4 transition hover:border-yellow-400/40">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-lg font-black text-white">{profile.full_name ?? profile.username}</div>
                        <div className="text-sm text-gray-400">@{profile.username}</div>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.2em] text-gray-500">
                        <div>{counts.followers} followers</div>
                        <div>{counts.friends} friends</div>
                      </div>
                    </div>
                  </a>
                )) : (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">No featured profiles are available yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-300">Recent activity</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-300">
                {entries.length ? entries.flatMap(({ feed }) => feed.notifications.slice(0, 3)).length ? entries.flatMap(({ feed }) => feed.notifications.slice(0, 3)).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3">
                    <div className="font-semibold text-white">{item.type}</div>
                    <div className="mt-1 text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-gray-400">No recent activity yet.</div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-gray-400">No recent activity yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-300">Quick links</h2>
              <div className="mt-4 grid gap-3">
                <a href="/messages" className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-yellow-400/40">Messages</a>
                <a href="/collection" className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-yellow-400/40">Collection</a>
                <a href="/help" className="rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-yellow-400/40">Support</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
