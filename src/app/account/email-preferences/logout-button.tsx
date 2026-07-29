"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/auth?message=logged_out");
  };

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className="inline-flex items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 hover:text-white"
    >
      Log Out
    </button>
  );
}
