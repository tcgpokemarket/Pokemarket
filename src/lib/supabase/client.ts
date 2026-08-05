import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient(options: { rememberSession?: boolean } = {}) {
  // Accept multiple possible env var names so staging/provisioning scripts that use
  // different names (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY)
  // will still work without changing app code.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLIC_KEY ??
    "";

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
