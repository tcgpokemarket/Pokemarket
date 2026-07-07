import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams(): Array<{ username: string }> {
  return [];
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  const sellerResult = await supabase
    .from("sellers")
    .select("storefront_slug")
    .eq("storefront_slug", username)
    .maybeSingle();
  const seller = sellerResult.data as { storefront_slug: string } | null;

  if (seller?.storefront_slug) {
    redirect(`/sellers/${seller.storefront_slug}`);
  }

  notFound();
}
