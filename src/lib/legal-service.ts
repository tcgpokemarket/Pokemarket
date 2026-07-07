import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { LEGAL_DOCS, type LegalDocumentSlug } from "@/lib/legal-docs";

export type LegalAcceptanceInput = {
  slug: LegalDocumentSlug;
  source: string;
  acceptedIp?: string | null;
  acceptedUserAgent?: string | null;
};

export function getLegalDocument(slug: LegalDocumentSlug) {
  return LEGAL_DOCS[slug];
}

export async function recordLegalAcceptance({ slug, source, acceptedIp, acceptedUserAgent }: LegalAcceptanceInput) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User must be signed in to accept legal terms");
  }

  const doc = getLegalDocument(slug);
  const payload: Database["public"]["Tables"]["legal_acceptances"]["Insert"] = {
    user_id: user.id,
    document_slug: doc.slug,
    document_version: doc.version,
    source,
    accepted_ip: acceptedIp ?? null,
    accepted_user_agent: acceptedUserAgent ?? null,
  };

  const response = await (supabase as any).from("legal_acceptances").insert(payload as any);
  if (response.error) {
    throw new Error(response.error.message);
  }

  return payload;
}

export async function fetchLegalAcceptanceStatus() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("document_slug, document_version, accepted_at, source")
    .eq("user_id", user.id)
    .order("accepted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
