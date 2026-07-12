import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const categories = ["Pokémon", "Sealed", "Singles", "Graded", "Accessories"];

function formatState(state?: string | null) {
  return (state ?? "upcoming").replaceAll("_", " ");
}

type LiveShowRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  seller_id: string;
  viewer_count: number | null;
  scheduled_start: string | null;
  auction_settings: Record<string, unknown> | null;
};

export default function LivePage() {
  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Live auctions
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Watch live drops, bid in real time, and follow the action.</h1>
            <p className="mt-4 max-w-2xl text-lg text-gray-300">
              Browse active shows, upcoming streams, and featured sellers across Pokémon singles, sealed products, and graded cards.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Verified sellers only
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">Support</div>
            <div className="mt-2 text-lg font-black text-white">Need live auction help?</div>
            <p className="mt-2 text-sm leading-6 text-gray-300">Ask about bidding rules, giveaways, or live show issues anytime.</p>
            <Link href="/support" className="mt-4 inline-flex text-sm font-semibold text-yellow-400">Open support →</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => (
            <div key={category} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
              {category}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-gray-300">
          Live show listings will load in the dashboard when dynamic rendering is enabled.
        </div>
      </section>
    </div>
  );
}
