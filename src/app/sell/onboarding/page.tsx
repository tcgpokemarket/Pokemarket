import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Onboarding",
  description: "Seller setup checklist for TCG Poke Market.",
};

const SECTIONS = [
  {
    title: "Setup",
    items: ["Account", "Email", "Payouts", "Profile", "Shipping"],
  },
  {
    title: "Listing",
    items: ["Title", "Set", "Condition", "Price", "Photos", "Inventory"],
  },
  {
    title: "Order flow",
    items: ["Confirm", "Pack", "Ship", "Track", "Reply"],
  },
  {
    title: "Rules",
    items: ["Accurate photos", "Honest condition", "Fast shipping", "Clear policies"],
  },
];

export default function SellerOnboardingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.12),_transparent_28%),linear-gradient(180deg,#0f0f1a_0%,#090b14_100%)] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-yellow-300">Seller onboarding</div>
              <h1 className="mt-2 text-4xl font-black sm:text-5xl">Checklist</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/sell" className="rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-300">Sell</a>
              <a href="/dashboard" className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/5">Dashboard</a>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-300">{section.title}</h2>
              <ul className="mt-4 space-y-2 text-sm text-gray-300">
                {section.items.map((item) => (
                  <li key={item} className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-3">{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
