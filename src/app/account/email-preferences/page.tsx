import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const options = [
  "marketing",
  "live_alerts",
  "seller_updates",
  "auction_alerts",
  "giveaway_alerts",
  "community_notifications",
];

export default async function EmailPreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-3xl font-black">Email preferences</h1>
          <p className="mt-3 text-gray-400">Sign in to manage marketplace email notifications.</p>
          <a href="/auth/signin" className="mt-6 inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">Sign in</a>
        </div>
      </div>
    );
  }

  const { data: preferences } = await supabase.from("email_preferences").select("*").eq("user_id", user.id);
  const enabled = new Map((preferences ?? []).map((row: any) => [row.notification_type, row.enabled]));

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-black">Email preferences</h1>
        <p className="mt-2 text-sm text-gray-400">Choose which marketplace updates you want by email.</p>
        <div className="mt-6 grid gap-3">
          {options.map((option) => (
            <label key={option} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm">
              <span className="capitalize text-white">{option.replace(/_/g, " ")}</span>
              <input type="checkbox" defaultChecked={enabled.get(option) ?? true} className="h-5 w-5 rounded border-white/20 bg-transparent text-yellow-400" />
            </label>
          ))}
        </div>
      </main>
    </div>
  );
}
