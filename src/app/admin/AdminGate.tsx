"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdminUser } from "@/lib/admin-access";

export default function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!active) return;

      if (!user || !isAdminUser(user)) {
        router.replace("/dashboard");
        return;
      }

      setReady(true);
    };

    void verify();

    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] text-white">
        <div className="text-sm uppercase tracking-[0.3em] text-yellow-400">Checking admin access</div>
      </div>
    );
  }

  return <>{children}</>;
}
