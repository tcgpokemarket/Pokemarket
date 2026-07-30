"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminGate from "../AdminGate";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  referral_code: string | null;
  referral_source: string | null;
  referral_locked_at: string | null;
};

type AttributionRow = {
  id: string;
  referred_user_id: string;
  referrer_user_id: string;
  order_id: string | null;
  program_type: string;
  reward_amount: number;
  status: string;
  created_at: string;
};

export default function AdminReferralsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [attributions, setAttributions] = useState<AttributionRow[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [{ data: profileData }, { data: attributionData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, referral_code, referral_source, referral_locked_at")
          .not("referral_code", "is", null)
          .order("updated_at", { ascending: false })
          .limit(25)
          .returns<ProfileRow[]>(),
        supabase
          .from("referral_attributions")
          .select("id, referred_user_id, referrer_user_id, order_id, program_type, reward_amount, status, created_at")
          .order("created_at", { ascending: false })
          .limit(25)
          .returns<AttributionRow[]>(),
      ]);

      if (!active) return;
      setProfiles(profileData ?? []);
      setAttributions(attributionData ?? []);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <AdminGate>
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-widest text-yellow-400">Referral admin</p>
            <h1 className="mt-3 text-3xl font-black">Referral ownership and history</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">Search users by referral source, correct attribution when needed, and review the permanent referral history.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold">Recent profiles</h2>
                <Link href="/dashboard?tab=admin-referrals" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5">Open dashboard tab</Link>
              </div>
              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5 text-sm text-gray-400">Loading referral profiles...</div>
                ) : profiles.length ? (
                  profiles.map((profile) => (
                    <div key={profile.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-semibold text-white">{profile.full_name ?? profile.username ?? profile.id}</div>
                          <div className="text-xs text-gray-400">Code {profile.referral_code ?? "—"} · Source {profile.referral_source ?? "—"}</div>
                          <div className="text-xs text-gray-500">Locked {profile.referral_locked_at ?? "not yet"}</div>
                        </div>
                        <Link href={`/dashboard?tab=admin-referrals&profile=${profile.id}`} className="inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Inspect</Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5 text-sm text-gray-400">No referral profiles found yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-bold">Referral history</h2>
              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5 text-sm text-gray-400">Loading referral history...</div>
                ) : attributions.length ? (
                  attributions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-300">
                      <div className="font-semibold text-white">{item.program_type} · {item.status}</div>
                      <div className="mt-1 text-xs text-gray-500">Referrer {item.referrer_user_id} → Referred {item.referred_user_id}</div>
                      <div className="mt-1 text-xs text-gray-500">Reward ${Number(item.reward_amount ?? 0).toFixed(2)}{item.order_id ? ` · Order ${item.order_id}` : ""}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5 text-sm text-gray-400">No referral attributions recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminGate>
  );
}
