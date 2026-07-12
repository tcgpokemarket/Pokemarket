import Link from "next/link";

export const revalidate = 0;

const profiles = [] as Array<any>;
const attributions = [] as Array<any>;

export default function AdminReferralsPage() {
  const canAssign = false;
  void canAssign;

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Referral admin</p>
          <h1 className="mt-3 text-3xl font-black">Referral ownership and history</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">Search users by referral source, correct attribution when needed, and review the permanent referral history.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">Recent profiles</h2>
            <div className="mt-4 space-y-3">
              {(profiles ?? []).map((profile: any) => (
                <div key={profile.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold text-white">{profile.full_name ?? profile.username ?? profile.id}</div>
                      <div className="text-xs text-gray-400">Code {profile.referral_code ?? "—"} · Source {profile.referral_source ?? "—"}</div>
                      <div className="text-xs text-gray-500">Locked {profile.referral_locked_at ?? "not yet"}</div>
                    </div>
                    <Link href="/dashboard?tab=admin-referrals" className="inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Assign in dashboard</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">Referral history</h2>
            <div className="mt-4 space-y-3">
              {(attributions ?? []).map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
                  <div className="font-semibold text-white">{item.referral_code} · {item.signup_source}</div>
                  <div className="mt-1 text-xs text-gray-500">Referrer {item.referrer_user_id} → Referred {item.referred_user_id}</div>
                  <div className="mt-1 text-xs text-gray-500">Revenue ${Number(item.total_revenue_generated ?? 0).toFixed(2)} · Rewards ${Number(item.total_rewards_earned ?? 0).toFixed(2)} · {item.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
