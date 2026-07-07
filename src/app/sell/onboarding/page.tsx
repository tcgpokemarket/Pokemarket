import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Onboarding for Pokémon Card Sellers",
  description: "Seller onboarding guide for TCG Poke Market’s Pokémon card marketplace.",
  keywords: ["sell Pokémon cards", "seller onboarding", "Pokémon card listing guide", "Pokémon seller tips"],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Seller Onboarding for Pokémon Card Sellers",
  description: "Steps to create accurate Pokémon card listings and manage selling on TCG Poke Market.",
};

const SECTIONS = [
  {
    title: "Getting Started",
    items: [
      "Create your seller account",
      "Verify your email and payment details",
      "Complete your seller profile",
      "Review seller standards and best practices",
      "Set up shipping and payout preferences",
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
      "Community resources for sellers",
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
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-400">Seller onboarding</div>
          <h1 className="text-4xl font-black sm:text-5xl">Open your seller storefront</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-300">
            This guide walks sellers through account setup, listing quality standards, and day-to-day selling operations.
          </p>
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
          <h2 className="text-2xl font-black">Seller tools are ready</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
            Create accurate listings, keep your storefront current, and manage shipping, orders, and payouts from your dashboard.
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
