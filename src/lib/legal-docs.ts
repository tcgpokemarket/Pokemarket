export type LegalDocumentSlug =
  | "terms"
  | "privacy"
  | "seller-agreement"
  | "marketplace-rules"
  | "giveaway-rules"
  | "refund-policy"
  | "shipping-policy"
  | "dmca";

export type LegalDocSection = {
  title: string;
  body: string[];
};

export type LegalDoc = {
  slug: LegalDocumentSlug;
  title: string;
  version: string;
  jurisdictionNote: string;
  attorneyReviewNote: string;
  sections: LegalDocSection[];
};

const COMMON_NOTICE =
  "This template is for product implementation and should be reviewed by qualified counsel for each jurisdiction where the marketplace operates.";

export const LEGAL_DOCS: Record<LegalDocumentSlug, LegalDoc> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    version: "2026.07.07",
    jurisdictionNote: "Customize governing law, venue, and consumer rights disclosures by jurisdiction.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Marketplace usage", body: ["Users may browse, buy, sell, bid, and participate in platform features only in accordance with these Terms and applicable law.", "The platform may modify features, restrict access, or refuse service to protect marketplace integrity."] },
      { title: "Accounts", body: ["Users are responsible for account security, accurate information, and activity that occurs under their credentials.", "Sellers may be subject to additional verification, onboarding, and compliance requirements."] },
      { title: "Live auctions and bidding", body: ["Bids may be binding when submitted and may not be withdrawn except where required by law or platform policy.", "The platform may set increment rules, bidder limits, and moderation controls."] },
      { title: "Purchases, cancellations, disputes", body: ["Orders, cancellations, refunds, chargebacks, and disputes are handled under the marketplace rules, seller agreement, and payment policies.", "The platform may hold funds in escrow during processing and review periods."] },
      { title: "Prohibited activities", body: ["No fraud, bots, fake accounts, manipulation, harassment, counterfeit listings, or abuse of platform systems.", "Any attempted circumvention of fees, payouts, moderation, or compliance controls is prohibited."] },
      { title: "Liability and arbitration", body: ["To the fullest extent allowed by law, liability is limited and class action waiver/arbitration provisions may apply where enforceable.", "Add jurisdiction-specific consumer protections and carve-outs as required for each jurisdiction."] },
      { title: "Acceptance tracking", body: ["Users must affirmatively accept the current version of these Terms before using protected features.", "The platform should record the accepted version, timestamp, and user metadata for audit purposes."] },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    version: "2026.07.07",
    jurisdictionNote: "Add required notices for GDPR, UK GDPR, CCPA/CPRA, and other applicable privacy laws.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Information collected", body: ["Account details, purchase activity, seller listings, wallet activity, device data, and support interactions may be collected.", "Payment data is processed by payment partners; the platform should avoid storing unnecessary sensitive payment details."] },
      { title: "Cookies and analytics", body: ["Cookies, local storage, and analytics may be used for login persistence, security, and product improvement.", "Users should be informed about opt-out or consent controls where required."] },
      { title: "Third parties and storage", body: ["Hosting, payment, shipping, analytics, and messaging vendors may receive data necessary to provide the service.", "Data retention and storage locations should be documented and jurisdictionally configurable."] },
      { title: "User rights", body: ["Users may request access, correction, deletion, or data portability where legally available.", "Identity verification may be required before honoring certain requests."] },
      { title: "Security", body: ["The platform should use reasonable safeguards, access controls, logging, and monitoring to protect user information.", "No system can be fully secure, so the policy should include transparent risk disclosure."] },
    ],
  },
  "seller-agreement": {
    slug: "seller-agreement",
    title: "Seller Agreement",
    version: "2026.07.07",
    jurisdictionNote: "Align seller tax, consumer rights, and marketplace liability language with local law.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Seller responsibilities", body: ["Sellers must provide accurate listings, disclose condition, and ship on time.", "Counterfeit, stolen, restricted, or misleading items are prohibited."] },
      { title: "Fees and payouts", body: ["Seller fees, payout schedules, reserves, escrow periods, and reserve holds may be applied according to published terms.", "Giveaway-related costs are charged separately to sellers and do not reduce marketplace revenue."] },
      { title: "Authenticity and condition", body: ["Listings must match the item photographed and described.", "Grading claims, sealed product status, and authenticity disclosures must be truthful."] },
      { title: "Penalties", body: ["Violations may result in removal, payout holds, refunds, disputes, suspension, or termination.", "Repeat or severe violations may trigger additional fraud review and law enforcement cooperation where appropriate."] },
    ],
  },
  "marketplace-rules": {
    slug: "marketplace-rules",
    title: "Marketplace Rules",
    version: "2026.07.07",
    jurisdictionNote: "Customize prohibited goods, product safety, and consumer disclosure standards by region.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Acceptable listings", body: ["Listings must be genuine Pokémon-related products or permitted accessories.", "Pricing manipulation, shill activity, and misleading inventory practices are prohibited."] },
      { title: "Condition and grading", body: ["Condition must be disclosed consistently, with clear grading and sealed-product standards.", "Images should show the exact item and known flaws."] },
      { title: "Counterfeit prevention", body: ["Counterfeit cards, altered cards, and deceptive replicas are prohibited.", "The platform may request additional proof, hold listings, or remove suspicious items."] },
    ],
  },
  "giveaway-rules": {
    slug: "giveaway-rules",
    title: "Giveaway Rules",
    version: "2026.07.07",
    jurisdictionNote: "Add jurisdiction-specific sweepstakes, contest, and no-purchase-required language where necessary.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Seller-funded giveaways", body: ["Giveaways are seller-funded and may include prize item value, shipping, and processing costs.", "The marketplace can require separate seller budget allocation before a giveaway goes live."] },
      { title: "Eligibility and verification", body: ["Account age, purchase verification, live participation, and fraud scoring may be used for entry eligibility.", "Multiple-entry abuse, fake accounts, and bot activity are prohibited."] },
      { title: "Winner selection", body: ["Winners may be selected using platform-controlled randomization or eligibility-based selection.", "The platform may verify identity, shipping details, and compliance before prize fulfillment."] },
    ],
  },
  "refund-policy": {
    slug: "refund-policy",
    title: "Refund Policy",
    version: "2026.07.07",
    jurisdictionNote: "Customize refund rights, cancellation windows, and statutory consumer protections by jurisdiction.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Eligible refunds", body: ["Refunds may be issued for platform-approved cancellations, non-delivery, confirmed misrepresentation, or other valid disputes.", "Certain live auction and custom-order sales may be final except where required by law."] },
      { title: "Chargebacks and disputes", body: ["Chargeback activity may trigger account review and payout holds.", "The platform may request supporting evidence from buyers and sellers."] },
      { title: "Processing", body: ["Approved refunds are processed back to the original payment method when possible.", "Escrow, wallet balances, and seller payouts may be adjusted to reflect the refund."] },
    ],
  },
  "shipping-policy": {
    slug: "shipping-policy",
    title: "Shipping Policy",
    version: "2026.07.07",
    jurisdictionNote: "Update carrier, tax, customs, and delivery risk disclosures per destination market.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Fulfillment", body: ["Sellers must ship within the stated handling time and provide tracking when available.", "Combined shipping may be supported where the seller and platform allow it."] },
      { title: "Risk and delivery", body: ["Delivery risk and transfer timing should be clearly disclosed.", "Shipping claims may be reviewed if packages are delayed, lost, or damaged."] },
      { title: "Giveaway shipping", body: ["Giveaway prize shipping is seller-funded unless a specific campaign states otherwise.", "Prize claims may require shipping address verification."] },
    ],
  },
  dmca: {
    slug: "dmca",
    title: "DMCA Policy",
    version: "2026.07.07",
    jurisdictionNote: "Adapt for local copyright notice-and-takedown requirements outside the United States.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Copyright complaints", body: ["Rights holders may submit copyright complaints with the required identification and sworn statements.", "The platform may remove or disable access to allegedly infringing content after review."] },
      { title: "Counter-notice", body: ["Users may submit a counter-notice where allowed by law.", "Repeat infringement policies may apply to accounts with multiple valid notices."] },
      { title: "Trademark and fan content", body: ["Pokémon trademarks and copyrighted content must not be misused in ways that confuse buyers or infringe rights.", "Fan art and transformative content may still be subject to takedown if rights issues arise."] },
    ],
  },
};
