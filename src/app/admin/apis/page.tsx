import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API management",
  description: "Connected integrations overview for marketplace operations.",
  robots: { index: false, follow: false },
};

export default function ApiManagementPage() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-widest text-yellow-400">API management</p>
          <h1 className="mt-1 text-3xl font-black">Connected integrations</h1>
          <p className="mt-2 text-sm text-gray-400">This surface is reserved for internal operations. Live connections load after sign-in.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-300">
          Internal integration controls are available in the authenticated dashboard environment.
        </div>
      </div>
    </div>
  );
}
