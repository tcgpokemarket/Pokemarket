import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: show } = await (admin as any).from("live_shows").select("seller_id").eq("id", showId).maybeSingle();
  if (!show) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  const isSeller = show.seller_id === user.id;
  const participantOrders = await (admin as any)
    .from("auction_orders")
    .select("*, show_products(title, subtitle, image_url), profiles:buyer_id(username)")
    .eq("auction_id", showId)
    .order("created_at", { ascending: false });

  const orders = (participantOrders.data ?? []).filter((order: { buyer_id: string; seller_id: string }) => isSeller || order.buyer_id === user.id || order.seller_id === user.id);

  return NextResponse.json({ orders });
}
