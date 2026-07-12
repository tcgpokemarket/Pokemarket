export type LegalDocumentSlug =
  | "terms"
  | "privacy"
  | "seller-policy"
  | "refund-policy"
  | "shipping-policy"
  | "seller-agreement"
  | "marketplace-rules"
  | "giveaway-rules"
  | "dmca";

export const LEGAL_DOCS: Record<LegalDocumentSlug, { slug: LegalDocumentSlug; version: string; title: string; jurisdictionNote: string; attorneyReviewNote: string; sections: { title: string; body: string[] }[] }> = {
  terms: {
    slug: "terms",
    version: "2026-07-10",
    title: "Terms of Service",
    jurisdictionNote: "Applies to marketplace usage worldwide unless a local law says otherwise.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Overview", body: ["These terms govern access to TcgPoké Market."] }],
  },
  privacy: {
    slug: "privacy",
    version: "2026-07-10",
    title: "Privacy Policy",
    jurisdictionNote: "Applies to collected data across the marketplace.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Overview", body: ["This policy describes how user data is handled."] }],
  },
  "seller-policy": {
    slug: "seller-policy",
    version: "2026-07-10",
    title: "Seller Policy",
    jurisdictionNote: "Applies to all seller accounts.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Seller standards", body: ["Sellers must keep listings accurate and fulfill orders promptly."] }],
  },
  "refund-policy": {
    slug: "refund-policy",
    version: "2026-07-10",
    title: "Refund Policy",
    jurisdictionNote: "Applies to refund eligibility and dispute handling.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Refunds", body: ["Refunds are processed according to order status and marketplace rules."] }],
  },
  "shipping-policy": {
    slug: "shipping-policy",
    version: "2026-07-10",
    title: "Shipping Policy",
    jurisdictionNote: "Applies to shipping methods and delivery expectations.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Shipping", body: ["Shipping rates, labels, and handling times follow the listing’s shipping setup."] }],
  },
  "seller-agreement": {
    slug: "seller-agreement",
    version: "2026-07-10",
    title: "Seller Agreement",
    jurisdictionNote: "Applies to approved sellers using marketplace tools.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Agreement", body: ["Approved sellers agree to marketplace rules, fees, and fulfillment standards."] }],
  },
  "marketplace-rules": {
    slug: "marketplace-rules",
    version: "2026-07-10",
    title: "Marketplace Rules",
    jurisdictionNote: "Applies to buyer and seller conduct on the marketplace.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Marketplace behavior", body: ["Users must follow fair trading, accurate listing, and respectful conduct rules."] }],
  },
  "giveaway-rules": {
    slug: "giveaway-rules",
    version: "2026-07-10",
    title: "Giveaway Rules",
    jurisdictionNote: "Applies to promotional giveaways and contests.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Giveaways", body: ["Giveaways must clearly disclose eligibility, timing, and winner selection."] }],
  },
  dmca: {
    slug: "dmca",
    version: "2026-07-10",
    title: "DMCA Policy",
    jurisdictionNote: "Applies to copyright complaints and takedown requests.",
    attorneyReviewNote: "Review with counsel before relying on this for production use.",
    sections: [{ title: "Copyright complaints", body: ["Send valid DMCA notices to the marketplace for review and action."] }],
  },
};

