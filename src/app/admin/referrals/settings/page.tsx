import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import ReferralSettingsClient from "./ReferralSettingsClient";
import type { ReferralProgramSettings } from "@/lib/referral-types";

export const dynamic = "force-dynamic";

export default async function AdminReferralSettingsPage() {
  // ── Auth ─────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    redirect("/dashboard");
  }

  const adminClient = createAdminClient();

  const { data: settings, error } = await adminClient
    .from("referral_program_settings")
    .select("*")
    .limit(1)
    .single();

  if (error || !settings) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-red-400">Failed to load settings: {error?.message ?? "Not found"}</p>
          <Link href="/admin/referrals" className="mt-4 inline-block text-yellow-400 underline">
            Back to referrals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-yellow-400">Admin</p>
              <h1 className="mt-2 text-3xl font-black">Referral settings</h1>
              <p className="mt-2 text-sm text-gray-400">
                Configure the referral program. All changes are audit-logged.
              </p>
            </div>
            <Link
              href="/admin/referrals"
              className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition hover:border-white/30"
            >
              Back
            </Link>
          </div>
        </div>

        <ReferralSettingsClient settings={settings as ReferralProgramSettings} />
      </div>
    </div>
  );
}
