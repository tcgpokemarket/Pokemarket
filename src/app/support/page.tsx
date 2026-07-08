import type { Metadata } from "next";
import SupportLauncher from "@/components/support/support-launcher";

export const metadata: Metadata = {
  title: "Support Assistant",
  description: "Open an AI support ticket for orders, seller help, live shows, and marketplace safety.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-black">Support Assistant</h1>
        <p className="mt-3 max-w-2xl text-gray-300">Use the AI support assistant to get help fast. Sensitive issues will be escalated for human review.</p>
        <div className="mt-8">
          <SupportLauncher contextLabel="Marketplace Support" />
        </div>
      </div>
    </div>
  );
}
