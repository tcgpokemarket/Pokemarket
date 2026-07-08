import { createClient } from "@/lib/supabase/server";
import EmailPreferencesForm from "./email-preferences-form";

export const dynamic = "force-dynamic";

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

  const { data: preferences } = await supabase.from("email_preferences").select("*").eq("user_id", user.id).order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <main className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-black">Email preferences</h1>
        <p className="mt-2 text-sm text-gray-400">Choose which marketplace updates you want by email.</p>
        <EmailPreferencesForm initialPreferences={(preferences ?? []) as Array<{ notification_type: string; enabled: boolean }>} />
      </main>
    </div>
  );
}
