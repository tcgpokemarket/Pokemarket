export type LegalDocumentSlug =
  | "terms"
  | "privacy"
  | "seller-agreement"
  | "buyer-agreement"
  | "marketplace-rules"
  | "live-auction-rules"
  | "live-break-rules"
  | "escrow-agreement"
  | "payment-payout-policy"
  | "refund-policy"
  | "shipping-policy"
  | "chargeback-policy"
  | "counterfeit-authenticity-policy"
  | "prohibited-items-policy"
  | "community-guidelines"
  | "acceptable-use-policy"
  | "dmca"
  | "cookie-policy"
  | "data-retention-policy"
  | "security-fraud-policy"
  | "account-suspension-policy"
  | "arbitration-agreement"
  | "limitation-of-liability"
  | "warranty-disclaimer"
  | "indemnification-clause"
  | "electronic-communications-consent"
  | "tax-responsibility-notice"
  | "california-privacy-rights"
  | "accessibility-statement"
  | "contact-information"
  | "giveaway-rules"
  | "shipping-expectations"
  | "live-show-rules";

export type LegalDocSection = {
  title: string;
  body: string[];
  attorneyReview?: boolean;
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

const ATTORNEY = true;

export const LEGAL_DOCS: Record<LegalDocumentSlug, LegalDoc> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    version: "2026.07.08",
    jurisdictionNote: "Customize governing law, venue, consumer rights disclosures, and arbitration carve-outs by jurisdiction.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Marketplace usage", body: ["Users may browse, buy, sell, bid, and participate in platform features only in accordance with these Terms and applicable law.", "The platform may modify features, restrict access, or refuse service to protect marketplace integrity."] },
      { title: "Accounts", body: ["Users are responsible for account security, accurate information, and activity that occurs under their credentials.", "Sellers may be subject to additional verification, onboarding, and compliance requirements."] },
      { title: "Live auctions and bidding", body: ["Bids may be binding when submitted and may not be withdrawn except where required by law or platform policy.", "The platform may set increment rules, bidder limits, anti-sniping controls, and moderation controls."] },
      { title: "Purchases, cancellations, disputes", body: ["Orders, cancellations, refunds, chargebacks, and disputes are handled under the marketplace rules, seller agreement, and payment policies.", "The platform may hold funds in escrow during processing and review periods."] },
      { title: "Prohibited activities", body: ["No fraud, bots, fake accounts, manipulation, harassment, counterfeit listings, or abuse of platform systems.", "Any attempted circumvention of fees, payouts, moderation, or compliance controls is prohibited."] },
      { title: "Liability and arbitration", body: ["To the fullest extent allowed by law, liability is limited and class action waiver/arbitration provisions may apply where enforceable.", "Add jurisdiction-specific consumer protections and carve-outs as required for each jurisdiction."], attorneyReview: ATTORNEY },
      { title: "Acceptance tracking", body: ["Users must affirmatively accept the current version of these Terms before using protected features.", "The platform should record the accepted version, timestamp, and user metadata for audit purposes."] },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    version: "2026.07.08",
    jurisdictionNote: "Add required notices for GDPR, UK GDPR, CCPA/CPRA, and other applicable privacy laws.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Information collected", body: ["Account details, purchase activity, seller listings, wallet activity, device data, and support interactions may be collected.", "Payment data is processed by payment partners; the platform should avoid storing unnecessary sensitive payment details."] },
      { title: "Cookies and analytics", body: ["Cookies, local storage, and analytics may be used for login persistence, security, and product improvement.", "Users should be informed about opt-out or consent controls where required."], attorneyReview: ATTORNEY },
      { title: "Third parties and storage", body: ["Hosting, payment, shipping, analytics, and messaging vendors may receive data necessary to provide the service.", "Data retention and storage locations should be documented and jurisdictionally configurable."] },
      { title: "User rights", body: ["Users may request access, correction, deletion, or data portability where legally available.", "Identity verification may be required before honoring certain requests."], attorneyReview: ATTORNEY },
      { title: "Security", body: ["The platform should use reasonable safeguards, access controls, logging, and monitoring to protect user information.", "No system can be fully secure, so the policy should include transparent risk disclosure."] },
    ],
  },
  "seller-agreement": {
    slug: "seller-agreement",
    title: "Seller Agreement",
    version: "2026.07.08",
    jurisdictionNote: "Align seller tax, consumer rights, and marketplace liability language with local law.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Seller responsibilities", body: ["Sellers must provide accurate listings, disclose condition, and ship on time.", "Counterfeit, stolen, restricted, or misleading items are prohibited."] },
      { title: "Fees and payouts", body: ["Seller fees, payout schedules, reserves, escrow periods, and reserve holds may be applied according to published terms.", "Giveaway-related costs are charged separately to sellers and do not reduce marketplace revenue."] },
      { title: "Authenticity and condition", body: ["Listings must match the item photographed and described.", "Grading claims, sealed product status, and authenticity disclosures must be truthful."] },
      { title: "Penalties", body: ["Violations may result in removal, payout holds, refunds, disputes, suspension, or termination.", "Repeat or severe violations may trigger additional fraud review and law enforcement cooperation where appropriate."], attorneyReview: ATTORNEY },
    ],
  },
  "buyer-agreement": {
    slug: "buyer-agreement",
    title: "Buyer Agreement",
    version: "2026.07.08",
    jurisdictionNote: "Confirm binding bid, cancellation, and consumer notice language with local law.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Buyer responsibilities", body: ["Buyers must provide accurate contact and shipping information and pay completed orders promptly.", "Buyers must cooperate with verification and dispute processes when reasonably requested."] },
      { title: "Binding bids and purchases", body: ["Winning bids, accepted offers, and checkout commitments may be binding once placed or accepted.", "Non-payment may result in cancellation, fees, account limits, or loss of bidding privileges."] },
      { title: "Buyer restrictions", body: ["Buyers may not harass sellers, abuse refunds, manipulate bidding, or file fraudulent chargebacks.", "Reviews and messages must be truthful and compliant with community rules."], attorneyReview: ATTORNEY },
    ],
  },
  "marketplace-rules": {
    slug: "marketplace-rules",
    title: "Marketplace Rules",
    version: "2026.07.08",
    jurisdictionNote: "Customize prohibited goods, product safety, and consumer disclosure standards by region.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Acceptable listings", body: ["Listings must be genuine Pokémon-related products or permitted accessories.", "Pricing manipulation, shill activity, and misleading inventory practices are prohibited."] },
      { title: "Condition and grading", body: ["Condition must be disclosed consistently, with clear grading and sealed-product standards.", "Images should show the exact item and known flaws."] },
      { title: "Counterfeit prevention", body: ["Counterfeit cards, altered cards, and deceptive replicas are prohibited.", "The platform may request additional proof, hold listings, or remove suspicious items."], attorneyReview: ATTORNEY },
    ],
  },
  "live-auction-rules": {
    slug: "live-auction-rules",
    title: "Live Auction Rules",
    version: "2026.07.08",
    jurisdictionNote: "Auction enforceability, bid treatment, and consumer protections vary by jurisdiction.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Auction format", body: ["Live auctions may include reserve prices, bid increments, time extensions, anti-sniping windows, and proxy bidding.", "The platform may reject malformed, suspicious, or unauthorized bids."] },
      { title: "Winning and payment", body: ["The highest valid bid at close may create a binding order.", "The winning bidder must complete payment within the stated deadline unless otherwise disclosed."] },
      { title: "Non-payment", body: ["If payment is not completed by the deadline, the order may expire and inventory may be released.", "The seller and buyer may receive notices and the account may be reviewed for abuse."], attorneyReview: ATTORNEY },
    ],
  },
  "live-break-rules": {
    slug: "live-break-rules",
    title: "Live Break Rules",
    version: "2026.07.08",
    jurisdictionNote: "Sweepstakes, contest, gambling, and promotional law should be reviewed before launch.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Break structure", body: ["Live breaks may involve random allocation, case breaks, team breaks, box breaks, mystery breaks, or other formats.", "Allocation rules must be disclosed before purchase or participation."] },
      { title: "Fairness", body: ["No packing manipulation, hidden allocations, or undisclosed substitution of product.", "The platform may verify identity, shipping details, and compliance before fulfillment."] },
      { title: "Prizes and shipping", body: ["Participants receive items according to the disclosed break rules.", "Combined shipping or consolidation may be used where disclosed."], attorneyReview: ATTORNEY },
    ],
  },
  "escrow-agreement": {
    slug: "escrow-agreement",
    title: "Escrow Agreement",
    version: "2026.07.08",
    jurisdictionNote: "Escrow law is regulated in some jurisdictions; confirm whether a separate licensed escrow provider is required.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Escrow use", body: ["When the Platform uses escrow or a similar holding arrangement, funds may be held until payment confirmation, dispute resolution, or shipment milestones occur.", "The Platform may extend holds, reverse credits, or freeze release if fraud or policy violations are suspected."] },
      { title: "Release conditions", body: ["Release may occur when payment is confirmed and applicable non-dispute, shipping, and review conditions are met.", "Any funds released before final settlement remain subject to lawful reversal or adjustment where required."], attorneyReview: ATTORNEY },
    ],
  },
  "payment-payout-policy": {
    slug: "payment-payout-policy",
    title: "Payment & Payout Policy",
    version: "2026.07.08",
    jurisdictionNote: "Add local money transmission, settlement, and tax-disclosure review where needed.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Payment processing", body: ["Payments are processed through third-party providers such as Stripe.", "Wallet balances may reflect pending, available, reserved, or reversed amounts."] },
      { title: "Payout timing", body: ["Payout timing depends on verification, risk review, shipping status, disputes, and processor availability.", "We may offset amounts owed against wallet balances or future payouts where legally allowed."], attorneyReview: ATTORNEY },
      { title: "Taxes", body: ["Taxes may be collected, reported, or remitted as required by law.", "The Platform may request tax forms or taxpayer information."], attorneyReview: ATTORNEY },
    ],
  },
  "refund-policy": {
    slug: "refund-policy",
    title: "Refund Policy",
    version: "2026.07.08",
    jurisdictionNote: "Customize refund rights, cancellation windows, and statutory consumer protections by jurisdiction.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Eligible refunds", body: ["Refunds may be issued for platform-approved cancellations, non-delivery, confirmed misrepresentation, or other valid disputes.", "Certain live auction and custom-order sales may be final except where required by law."] },
      { title: "Chargebacks and disputes", body: ["Chargeback activity may trigger account review and payout holds.", "The platform may request supporting evidence from buyers and sellers."], attorneyReview: ATTORNEY },
      { title: "Processing", body: ["Approved refunds are processed back to the original payment method when possible.", "Escrow, wallet balances, and seller payouts may be adjusted to reflect the refund."], attorneyReview: ATTORNEY },
    ],
  },
  "shipping-policy": {
    slug: "shipping-policy",
    title: "Shipping Policy",
    version: "2026.07.08",
    jurisdictionNote: "Update carrier, tax, customs, and delivery risk disclosures per destination market.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Fulfillment", body: ["Sellers must ship within the stated handling time and provide tracking when available.", "Combined shipping may be supported where the seller and platform allow it."] },
      { title: "Risk and delivery", body: ["Delivery risk and transfer timing should be clearly disclosed.", "Shipping claims may be reviewed if packages are delayed, lost, or damaged."], attorneyReview: ATTORNEY },
      { title: "Giveaway shipping", body: ["Giveaway prize shipping is seller-funded unless a specific campaign states otherwise.", "Prize claims may require shipping address verification."], attorneyReview: ATTORNEY },
    ],
  },
  "chargeback-policy": {
    slug: "chargeback-policy",
    title: "Chargeback Policy",
    version: "2026.07.08",
    jurisdictionNote: "Align evidence handling, fee recovery, and consumer dispute notices with applicable payment network rules.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Chargeback notice", body: ["Initiating an unwarranted chargeback may result in account suspension, payout holds, additional fees, and dispute escalation.", "We may submit order records, messages, tracking, and delivery evidence to payment processors."] },
      { title: "Recovery", body: ["If a chargeback is lost, the Platform may recover the amount from wallet balances or future payouts where legally allowed.", "Buyers should contact support before initiating a chargeback whenever possible."], attorneyReview: ATTORNEY },
    ],
  },
  "counterfeit-authenticity-policy": {
    slug: "counterfeit-authenticity-policy",
    title: "Counterfeit & Authenticity Policy",
    version: "2026.07.08",
    jurisdictionNote: "Confirm product-specific authentication language with counsel.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "No counterfeit items", body: ["Counterfeit, altered, stolen, or unauthorized goods are prohibited.", "Sellers must not make misleading claims about authenticity, grading, sealing, or provenance."] },
      { title: "Review and verification", body: ["We may require authentication documentation, additional images, serials, tamper-proofing, or third-party verification.", "Suspected counterfeit activity may lead to removal, refund, hold, suspension, and reports to authorities."], attorneyReview: ATTORNEY },
    ],
  },
  "prohibited-items-policy": {
    slug: "prohibited-items-policy",
    title: "Prohibited Items Policy",
    version: "2026.07.08",
    jurisdictionNote: "Update for jurisdiction-specific regulated goods and shipping restrictions.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Prohibited goods", body: ["Counterfeit or infringing goods, stolen or fraudulently obtained items, weapons, illegal drugs, hazardous materials, and prohibited digital credentials are not allowed.", "Any item banned by law, carrier rules, or platform safety standards may be removed."] },
      { title: "Deceptive items", body: ["Undisclosed repacks, deceptive substitutes, or items that misrepresent origin or contents are prohibited.", "We may remove any item we reasonably determine poses legal, safety, or fraud risk."], attorneyReview: ATTORNEY },
    ],
  },
  "community-guidelines": {
    slug: "community-guidelines",
    title: "Community Guidelines",
    version: "2026.07.08",
    jurisdictionNote: "Keep moderation language consistent with user conduct rules and local harassment law.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Respectful conduct", body: ["Users must avoid harassment, hate, threats, doxxing, spam, and abusive behavior.", "Messages and reviews must be civil and relevant."] },
      { title: "Moderation", body: ["We may remove content, limit messaging, or suspend accounts for guideline violations.", "The platform may apply automated and manual moderation tools to protect users."], attorneyReview: ATTORNEY },
    ],
  },
  "acceptable-use-policy": {
    slug: "acceptable-use-policy",
    title: "Acceptable Use Policy",
    version: "2026.07.08",
    jurisdictionNote: "Tailor automation, scraping, and security-bypass restrictions to the specific platform architecture.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "No abuse", body: ["Users may not interfere with or reverse engineer the Platform, scrape data without authorization, use bots to manipulate the marketplace, upload malware, or bypass security.", "The Platform may rate limit or block suspicious activity."] },
      { title: "No impersonation", body: ["Users may not impersonate another person or entity or use the Platform for illegal activity.", "Violations may lead to account restrictions or termination."], attorneyReview: ATTORNEY },
    ],
  },
  dmca: {
    slug: "dmca",
    title: "DMCA Policy",
    version: "2026.07.08",
    jurisdictionNote: "Adapt for local copyright notice-and-takedown requirements outside the United States.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Copyright complaints", body: ["Rights holders may submit copyright complaints with the required identification and sworn statements.", "The platform may remove or disable access to allegedly infringing content after review."] },
      { title: "Counter-notice", body: ["Users may submit a counter-notice where allowed by law.", "Repeat infringement policies may apply to accounts with multiple valid notices."], attorneyReview: ATTORNEY },
      { title: "Trademark and fan content", body: ["Pokémon trademarks and copyrighted content must not be misused in ways that confuse buyers or infringe rights.", "Fan art and transformative content may still be subject to takedown if rights issues arise."], attorneyReview: ATTORNEY },
    ],
  },
  "cookie-policy": {
    slug: "cookie-policy",
    title: "Cookie Policy",
    version: "2026.07.08",
    jurisdictionNote: "Add consent-management language for regions that require opt-in cookies.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Cookie uses", body: ["Cookies and similar technologies are used for authentication, preferences, security, analytics, and marketing where permitted.", "Browser settings or site controls may allow certain cookie choices."], attorneyReview: ATTORNEY },
    ],
  },
  "data-retention-policy": {
    slug: "data-retention-policy",
    title: "Data Retention Policy",
    version: "2026.07.08",
    jurisdictionNote: "Retention schedules should be mapped to legal, tax, accounting, and privacy requirements.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Retention basis", body: ["We retain data based on business necessity, legal compliance, dispute resolution, fraud detection, accounting, tax, and security requirements.", "When data is no longer needed, we may delete, anonymize, or archive it."], attorneyReview: ATTORNEY },
    ],
  },
  "security-fraud-policy": {
    slug: "security-fraud-policy",
    title: "Security & Fraud Prevention Policy",
    version: "2026.07.08",
    jurisdictionNote: "Ensure monitoring and account action language matches actual platform practice.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Monitoring and controls", body: ["We may monitor for suspicious behavior, use device and transaction risk signals, restrict high-risk activity, require verification, and freeze payouts or wallets during review.", "Users must cooperate with investigations and provide requested evidence."], attorneyReview: ATTORNEY },
    ],
  },
  "account-suspension-policy": {
    slug: "account-suspension-policy",
    title: "Account Suspension & Termination Policy",
    version: "2026.07.08",
    jurisdictionNote: "Check notice, appeal, and funds-hold language for local consumer and platform-regulation rules.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Suspension reasons", body: ["We may suspend or terminate accounts for fraud, policy violations, chargebacks, unpaid orders, counterfeit or prohibited items, abuse, legal or compliance reasons, or security concerns.", "Users may lose access to certain features, held funds, or seller privileges pending review."], attorneyReview: ATTORNEY },
      { title: "Appeals", body: ["Where available, users may appeal by contacting support and may be asked to verify identity and provide additional evidence.", "Appeals do not guarantee reinstatement."], attorneyReview: ATTORNEY },
    ],
  },
  "arbitration-agreement": {
    slug: "arbitration-agreement",
    title: "Dispute Resolution & Arbitration Agreement",
    version: "2026.07.08",
    jurisdictionNote: "This must be localized to governing law, venue, opt-out rights, and consumer law limitations.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Informal resolution", body: ["Before arbitration or litigation, users should first contact support and attempt good-faith informal resolution.", "Disputes may be resolved by binding individual arbitration where enforceable and not prohibited by law."], attorneyReview: ATTORNEY },
      { title: "Class action waiver", body: ["To the fullest extent permitted by law, users waive the right to participate in class, collective, or representative actions.", "Add any required opt-out process or consumer-law carve-outs here."], attorneyReview: ATTORNEY },
    ],
  },
  "limitation-of-liability": {
    slug: "limitation-of-liability",
    title: "Limitation of Liability",
    version: "2026.07.08",
    jurisdictionNote: "Adjust caps and exclusions to comply with applicable law.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Liability cap", body: ["To the fullest extent permitted by law, liability is limited to the amount paid to us in the preceding 12 months or another lawful cap.", "We are not liable for indirect, incidental, special, consequential, or punitive damages."], attorneyReview: ATTORNEY },
    ],
  },
  "warranty-disclaimer": {
    slug: "warranty-disclaimer",
    title: "Disclaimer of Warranties",
    version: "2026.07.08",
    jurisdictionNote: "Confirm implied warranty disclaimers are enforceable in the target markets.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "As-is service", body: ["The Platform and all related services are provided as is and as available.", "We disclaim warranties to the fullest extent allowed by law, including implied warranties of merchantability, fitness, title, and non-infringement."], attorneyReview: ATTORNEY },
    ],
  },
  "indemnification-clause": {
    slug: "indemnification-clause",
    title: "Indemnification",
    version: "2026.07.08",
    jurisdictionNote: "Check local enforceability and any consumer-law limitations on indemnity clauses.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Indemnity", body: ["You agree to defend, indemnify, and hold harmless TcgPoké Market and its affiliates from claims, losses, liabilities, damages, expenses, and fees arising from your use of the Platform, your content, your transactions, your violations of these policies, or your violation of law or third-party rights."], attorneyReview: ATTORNEY },
    ],
  },
  "electronic-communications-consent": {
    slug: "electronic-communications-consent",
    title: "Electronic Communications Consent",
    version: "2026.07.08",
    jurisdictionNote: "Confirm ESIGN and local electronic-records requirements for the target regions.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Consent", body: ["You consent to receive electronic communications, notices, agreements, disclosures, receipts, statements, and policy updates from us by email, in-app messaging, push notifications, website notices, or other electronic means.", "Electronic records satisfy any legal requirement that communications be in writing to the extent permitted by law."], attorneyReview: ATTORNEY },
    ],
  },
  "tax-responsibility-notice": {
    slug: "tax-responsibility-notice",
    title: "Tax Responsibility Notice",
    version: "2026.07.08",
    jurisdictionNote: "Update marketplace tax collection and reporting statements for each jurisdiction.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "User responsibility", body: ["Users are responsible for determining and paying any taxes, duties, or reporting obligations associated with their transactions, payouts, referrals, or business activity, except where the Platform is legally required to collect or remit taxes.", "We may request tax forms, taxpayer identification, or related documentation."], attorneyReview: ATTORNEY },
    ],
  },
  "california-privacy-rights": {
    slug: "california-privacy-rights",
    title: "California Consumer Privacy Rights",
    version: "2026.07.08",
    jurisdictionNote: "This section must match actual data practices and California law.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "California rights", body: ["California residents may have rights to know, access, correct, delete, and limit certain data uses, and to opt out of sale or sharing of personal information where applicable.", "We will not discriminate against you for exercising your rights."], attorneyReview: ATTORNEY },
      { title: "Verification", body: ["Verification may be required for certain requests, and authorized agents may submit requests where allowed by law and with appropriate proof.", "Do not publish this section until it matches actual data collection, sharing, and retention behavior."], attorneyReview: ATTORNEY },
    ],
  },
  "accessibility-statement": {
    slug: "accessibility-statement",
    title: "Accessibility Statement",
    version: "2026.07.08",
    jurisdictionNote: "Confirm the statement matches actual accessibility support and remediation processes.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Accessibility commitment", body: ["We are committed to providing a website and mobile experience that is accessible to users with disabilities.", "If you encounter accessibility barriers, contact support so we can assist and improve the experience."], attorneyReview: ATTORNEY },
    ],
  },
  "contact-information": {
    slug: "contact-information",
    title: "Contact Information",
    version: "2026.07.08",
    jurisdictionNote: "Fill in all business and compliance contact placeholders before publication.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Business contacts", body: ["Business Legal Name: [INSERT BUSINESS LEGAL NAME]", "Registered Address: [INSERT REGISTERED ADDRESS]", "Contact Email: [INSERT CONTACT EMAIL]", "Support Email: [INSERT SUPPORT EMAIL]", "Privacy Contact: [INSERT PRIVACY CONTACT]", "DMCA Agent: [INSERT DMCA EMAIL / MAILING ADDRESS]"], attorneyReview: ATTORNEY },
    ],
  },
  "giveaway-rules": {
    slug: "giveaway-rules",
    title: "Giveaway Rules",
    version: "2026.07.08",
    jurisdictionNote: "Add jurisdiction-specific sweepstakes, contest, and no-purchase-required language where necessary.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Seller-funded giveaways", body: ["Giveaways are seller-funded and may include prize item value, shipping, and processing costs.", "The marketplace can require separate seller budget allocation before a giveaway goes live."] },
      { title: "Eligibility and verification", body: ["Account age, purchase verification, live participation, and fraud scoring may be used for entry eligibility.", "Multiple-entry abuse, fake accounts, and bot activity are prohibited."] },
      { title: "Winner selection", body: ["Winners may be selected using platform-controlled randomization or eligibility-based selection.", "The platform may verify identity, shipping details, and compliance before prize fulfillment."], attorneyReview: ATTORNEY },
    ],
  },
  "shipping-expectations": {
    slug: "shipping-expectations",
    title: "Shipping Expectations",
    version: "2026.07.08",
    jurisdictionNote: "Use this as a simplified buyer-facing shipping summary alongside the full Shipping Policy.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Buyer-facing summary", body: ["Sellers are expected to package collectibles carefully, use tracking when available, and communicate delays promptly.", "High-value items should be shipped with insurance and signature confirmation when appropriate."], attorneyReview: ATTORNEY },
    ],
  },
  "live-show-rules": {
    slug: "live-show-rules",
    title: "Live Show Rules",
    version: "2026.07.08",
    jurisdictionNote: "Tailor this for livestream moderation, seller permissions, and interactive commerce features.",
    attorneyReviewNote: COMMON_NOTICE,
    sections: [
      { title: "Live participation", body: ["Live rooms may include chat, bidding, giveaways, and seller moderation tools.", "The host may remove disruptive users or restrict participation to preserve safety and fairness."], attorneyReview: ATTORNEY },
    ],
  },
};
