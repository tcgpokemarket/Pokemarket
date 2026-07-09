import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiveShowDetails } from "@/lib/live-shows";
import LiveShowClient from "./show-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ showId: string }> }): Promise<Metadata> {
  const { showId } = await params;
  try {
    const { show } = await getLiveShowDetails(showId);
    return {
      title: `${show.title} | Live Auction`,
      description: show.description ?? "Live auction show on TcgPoké Market.",
    };
  } catch {
    return {
      title: "Live Auction",
      description: "Live auction show on TcgPoké Market.",
    };
  }
}

export default async function LiveShowPage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;

  let data;
  try {
    data = await getLiveShowDetails(showId);
  } catch {
    notFound();
  }

  return <LiveShowClient initialData={data} />;
}
