import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Basic site information.",
  alternates: {
    canonical: "https://tcg-poke-market.sintra.site/about",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-3xl px-4 py-24">
        <h1 className="text-4xl font-black sm:text-5xl">About</h1>
        <p className="mt-4 text-base leading-7 text-gray-300">TcgPoké Market is a Pokémon card marketplace.</p>
      </div>
    </div>
  );
}
