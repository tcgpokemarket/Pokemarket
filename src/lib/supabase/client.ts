import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

type ClientOptions = { rememberSession?: boolean };

// Keep one browser Supabase client and persist the auth session across navigation
// and reloads. rememberSession is retained for call-site compatibility, but the
// marketplace intentionally keeps users signed in until they explicitly sign out.
export function createClient(_options: ClientOptions = {}) {
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
      persistSession: true,
    },
    isSingleton: true,
  });
}
