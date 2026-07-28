import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { requireEnv } from "../env";

export function createAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "Supabase URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", "Supabase service role key");

  return createSupabaseClient<Database>(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
