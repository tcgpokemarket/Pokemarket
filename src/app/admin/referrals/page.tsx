import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin-access";
import { notFound } from "next/navigation";
import { canManuallyAssignReferral } from "@/lib/referrals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handleAssign(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) throw new Error("Unauthorized");

  const referredUserId = String(formData.get("referredUserId") ?? "").trim();
  const referrerUserId = String(formData.get("referrerUserId") ?? "").trim();
  const referralCode = String(formData.get("referralCode") ?? "").trim().toUpperCase();
  const signupSource = String(formData.get("signupSource") ?? "manual signup").trim() || "manual signup";
  if (!referredUserId || !referrerUserId || !referralCode) throw new Error("Missing referral data");

  const updatePayload = {
    referral_source_user_id: referrerUserId,
    referral_source: signupSource,
    referral_source_code: referralCode,
    referral_source_confirmed_at: new Date().toISOString(),
    referral_locked_at: new Date().toISOString(),
  } as any;
  const { error } = await (supabase as any).from("profiles").update(updatePayload).eq("id", referredUserId).is("referral_source_user_id", null);

  if (error) throw new Error(error.message);
}

export default async function AdminReferralsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) {
    notFound();
  }

  const [{ data: profiles }, { data: attributions }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, referral_code, referral_source, referral_source_user_id, referral_source_code, referral_source_confirmed_at, referral_locked_at, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("referral_attributions").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

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
              {(profiles ?? []).map((profile: any) => {
                const canAssign = canManuallyAssignReferral(profile.created_at, profile.referral_source_confirmed_at);
                return (
                  <div key={profile.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold text-white">{profile.full_name ?? profile.username ?? profile.id}</div>
                        <div className="text-xs text-gray-400">Code {profile.referral_code ?? "—"} · Source {profile.referral_source ?? "—"}</div>
                        <div className="text-xs text-gray-500">Locked {profile.referral_locked_at ?? "not yet"}</div>
                      </div>
                      <form action={handleAssign} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                        <input type="hidden" name="referredUserId" value={profile.id} />
                        <input name="referrerUserId" placeholder="Referrer user ID" disabled={!canAssign} className="rounded-xl border border-white/10 bg-[#0f0f1a] px-3 py-2 text-sm text-white disabled:opacity-50" />
                        <input name="referralCode" placeholder="Referral code" disabled={!canAssign} className="rounded-xl border border-white/10 bg-[#0f0f1a] px-3 py-2 text-sm text-white disabled:opacity-50" />
                        <input name="signupSource" placeholder="signup source" disabled={!canAssign} className="rounded-xl border border-white/10 bg-[#0f0f1a] px-3 py-2 text-sm text-white disabled:opacity-50" />
                        <button disabled={!canAssign} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Assign</button>
                      </form>
                    </div>
                  </div>
                );
              })}
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
