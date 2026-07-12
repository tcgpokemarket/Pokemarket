import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient(options: { rememberSession?: boolean } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured");
  }

  return createBrowserClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: options.rememberSession ?? true,
    } as any,
    isSingleton: false,
  });
}
