import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SocialFeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?redirectTo=/social");

  try {
    const [{ data: notifications, error: notificationsError }, { data: follows, error: followsError }, { data: friendships, error: friendshipsError }] = await Promise.all([
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("follows").select("*").eq("follower_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("friendships").select("*").or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(50),
    ]);

    if (notificationsError) throw new Error(notificationsError.message);
    if (followsError) throw new Error(followsError.message);
    if (friendshipsError) throw new Error(friendshipsError.message);

    const notificationRows = (notifications ?? []) as Array<{ id: string; type: string; related_content: Record<string, unknown> | null }>;

    return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-3xl font-black">Your social feed</h1>
          <p className="mt-2 text-sm text-gray-400">Followed sellers, friends, giveaways, and community activity in one place.</p>

          <div className="mt-6 space-y-3">
            {notificationRows.length ? notificationRows.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                <div className="text-sm font-semibold text-white">{item.type}</div>
                <div className="mt-1 text-sm text-gray-400">{JSON.stringify(item.related_content ?? {})}</div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-10 text-center text-gray-400">No social activity yet.</div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-black">Following</h2>
            <p className="mt-2 text-sm text-gray-400">{follows?.length ?? 0} accounts followed</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-black">Friendships</h2>
            <p className="mt-2 text-sm text-gray-400">{friendships?.length ?? 0} connections</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-black">Notifications</h2>
            <p className="mt-2 text-sm text-gray-400">Live show, giveaway, and friend updates appear here.</p>
          </div>
        </aside>
      </main>
    </div>
  );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load social activity.";
    return <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white"><div className="mx-auto max-w-4xl rounded-3xl border border-red-400/20 bg-red-400/10 p-8 text-red-100">{message}</div></div>;
  }
}
