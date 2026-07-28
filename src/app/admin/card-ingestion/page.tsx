import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";
import CardIngestionClient from "./CardIngestionClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Card Ingestion",
  description: "Admin review queue for AI-generated Pokémon card listings.",
};

async function loadData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) return null;

  const admin = createAdminClient();
  const [{ data: batches }, { data: items }] = await Promise.all([
    admin.from("card_ingestion_batches").select("*").order("created_at", { ascending: false }).limit(20),
    admin.from("card_ingestion_items").select("*, card_ingestion_item_images(*)").order("created_at", { ascending: false }).limit(100),
  ]);

  return { batches: batches ?? [], items: items ?? [] };
}

export default async function CardIngestionPage() {
  const data = await loadData();
  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8">Admin access required.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-7xl">
        <CardIngestionClient batches={data.batches as never[]} items={data.items as never[]} />
      </div>
    </div>
  );
}
