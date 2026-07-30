import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help",
  description: "Basic support information.",
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/help",
  },
};

const SUPPORT_EMAIL = "tcgpokemarketadmin@gmail.com";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-3xl px-4 py-24">
        <h1 className="text-4xl font-black sm:text-5xl">Help</h1>
        <p className="mt-4 text-base leading-7 text-gray-300">Email {SUPPORT_EMAIL} for account or order help.</p>
      </div>
    </div>
  );
}
