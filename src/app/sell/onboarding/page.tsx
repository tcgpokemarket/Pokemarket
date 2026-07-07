import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Onboarding for Pokémon Card Sellers",
  description: "New seller onboarding guide for TCG Poke Market’s Pokémon card marketplace.",
  keywords: ["sell Pokémon cards", "seller onboarding", "Pokémon card listing guide", "Pokémon seller tips"],
};

const legalChecklist = [
  "Terms of Service",
  "Privacy Policy",
  "Seller Agreement",
  "Marketplace Rules",
  "Giveaway Rules",
  "Refund Policy",
  "Shipping Policy",
  "DMCA Policy",
];

const legalLinks = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Seller Agreement", href: "/seller-agreement" },
  { label: "Marketplace Rules", href: "/marketplace-rules" },
  { label: "Giveaway Rules", href: "/giveaway-rules" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "DMCA Policy", href: "/dmca" },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Seller Onboarding for Pokémon Card Sellers",
  description: "Steps to create accurate Pokémon card listings and start selling on TCG Poke Market.",
};

const SECTIONS = [
  {
    title: "Getting Started",
    items: [
      "Create your seller account",
      "Verify your email and payment details",
      "Complete your seller profile",
      "Review marketplace policies and seller standards",
      "Set up shipping, return, and payout preferences",
    ],
  },
  {
    title: "Seller Setup Checklist",
    items: [
      "Display name",
      "Contact information",
      "Store logo or banner, if available",
      "Business or personal seller details",
      "Preferred payout method",
    ],
  },
  {
    title: "Verify Your Account",
    items: [
      "Confirm your email address",
      "Add a valid payout account",
      "Complete any required identity verification",
      "Enable two-factor authentication if available",
    ],
  },
  {
    title: "Learn Marketplace Standards",
    items: [
      "Item condition guidelines",
      "Authenticity requirements",
      "Prohibited items",
      "Shipping expectations",
      "Return and refund policies",
      "Communication and dispute rules",
    ],
  },
  {
    title: "Creating Your First Listing",
    items: [
      "Product name",
      "Brand or franchise",
      "Set or series",
      "Card number or item identifier",
      "Condition",
      "Quantity available",
      "Price",
      "Shipping method",
      "Return policy",
      "Any special notes or defects",
    ],
  },
  {
    title: "Listing Best Practices",
    items: [
      "Use clear, honest descriptions",
      "Match the title to the exact item being sold",
      "Disclose wear, damage, or missing parts",
      "Avoid misleading keywords or unrelated tags",
      "Keep pricing competitive and realistic",
    ],
  },
  {
    title: "Image Guidelines for Sellers",
    items: [
      "Show the exact item being sold",
      "Are clear, well-lit, and in focus",
      "Include front and back views when relevant",
      "Show any flaws, wear, or damage",
      "Reflect the correct variant, edition, or condition",
    ],
  },
  {
    title: "Avoid",
    items: [
      "Stock photos that do not match the item",
      "Blurry, cropped, or heavily edited images",
      "Images that hide defects",
      "Misleading artwork or incorrect product versions",
    ],
  },
  {
    title: "Pricing and Inventory",
    items: [
      "Price items based on condition, rarity, and market demand",
      "Update inventory regularly",
      "Remove sold or unavailable items promptly",
      "Use bulk tools if you have a large catalog",
      "Monitor competitor pricing when appropriate",
    ],
  },
  {
    title: "Shipping and Fulfillment",
    items: [
      "Choose packaging that protects collectibles during transit",
      "Use tracking whenever possible",
      "Ship within your stated handling time",
      "Combine orders when appropriate",
      "Communicate delays quickly and clearly",
    ],
  },
  {
    title: "Packaging Tips",
    items: [
      "Use sleeves, top loaders, or protective cases for cards",
      "Add padding for fragile or high-value items",
      "Seal packages securely",
      "Include order details or packing slips if needed",
    ],
  },
  {
    title: "Managing Orders",
    items: [
      "Confirm the order",
      "Package the item safely",
      "Mark it as shipped",
      "Upload tracking information",
      "Respond promptly to buyer questions",
      "Resolve issues professionally",
    ],
  },
  {
    title: "Customer Service Expectations",
    items: [
      "Respond to messages in a timely manner",
      "Be respectful and professional",
      "Honor your stated policies",
      "Resolve disputes fairly",
      "Keep buyers informed about order status",
    ],
  },
  {
    title: "Common Mistakes to Avoid",
    items: [
      "Listing items with incomplete details",
      "Using inaccurate or misleading photos",
      "Ignoring condition flaws",
      "Delaying shipment without notice",
      "Setting unclear return policies",
      "Overpromising item quality or authenticity",
    ],
  },
  {
    title: "Tips for a Strong Start",
    items: [
      "Start with a small number of listings",
      "Focus on accuracy over speed",
      "Build a reputation through honest service",
      "Keep your store organized by category or set",
      "Review performance and buyer feedback regularly",
    ],
  },
  {
    title: "Need Help?",
    items: [
      "Seller help articles",
      "Marketplace policy pages",
      "Support tickets or live chat, if available",
      "Community resources for new sellers",
    ],
  },
];

export default function SellerOnboardingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <div className="mx-auto max-w-5xl px-4 py-24">
        <div className="mb-8">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">New Seller Onboarding Prompt</div>
          <h1 className="text-4xl font-black sm:text-5xl">Welcome to TcgPoké Market!</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-300">
            This onboarding guide helps new sellers set up their account, create accurate listings, and start selling collectibles with confidence.
          </p>
        </div>

        <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Required legal review</div>
          <p className="text-sm leading-relaxed text-gray-300">
            Before selling, review and accept the current marketplace legal documents. The platform records acceptance dates, versions, and audit metadata for compliance.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {legalLinks.map((link) => (
              <a key={link.href} href={link.href} className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-gray-300 hover:border-yellow-400/40 hover:text-yellow-400">
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {legalChecklist.map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-gray-300">{item}</div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-bold text-yellow-400">{section.title}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-300">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 text-yellow-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-6">
          <h2 className="text-2xl font-black">Ready to Sell?</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
            You’re now ready to launch your store on TcgPoké Market. Create accurate listings, ship with care, and deliver a great buying experience from day one.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/sell" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition-colors hover:bg-yellow-300">
              Create a Listing
            </a>
            <a href="/dashboard" className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/5">
              Open Dashboard
            </a>
          </div>
        </section>
        </div>
      </div>
    </>
  );
}
