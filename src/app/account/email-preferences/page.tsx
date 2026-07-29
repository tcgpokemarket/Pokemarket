import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import EmailPreferencesForm from "./email-preferences-form";
import LogoutButton from "./logout-button";

export const dynamic = "force-dynamic";

export default async function EmailPreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?redirectTo=/account/email-preferences");

  const { data: preferences } = await supabase.from("email_preferences").select("*").eq("user_id", user.id).order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-8 text-white sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-black">Email preferences</h1>
            <p className="mt-2 text-sm text-gray-400">Choose which marketplace updates you want by email.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5">
              Back to dashboard
            </Link>
            <LogoutButton />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-[#13131f] p-4 sm:p-5">
          <EmailPreferencesForm initialPreferences={(preferences ?? []) as Array<{ notification_type: string; enabled: boolean }>} />
        </div>
      </main>
    </div>
  );
}
