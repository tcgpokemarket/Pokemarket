import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EmailPreferencesForm from "./email-preferences-form";

export const dynamic = "force-dynamic";

export default async function EmailPreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?redirectTo=/account/email-preferences");

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
