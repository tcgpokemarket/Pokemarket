import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { requireEnv } from "../env";

export async function createClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "Supabase URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon key");

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {}
      },
    },
  });
}
