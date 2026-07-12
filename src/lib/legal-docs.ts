export type LegalDocumentSlug = "terms" | "privacy" | "seller-policy";

export const LEGAL_DOCS: Record<LegalDocumentSlug, { slug: LegalDocumentSlug; version: string; title: string }> = {
  terms: { slug: "terms", version: "2026-07-10", title: "Terms of Service" },
  privacy: { slug: "privacy", version: "2026-07-10", title: "Privacy Policy" },
  "seller-policy": { slug: "seller-policy", version: "2026-07-10", title: "Seller Policy" },
};
