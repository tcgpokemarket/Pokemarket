import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";

async function extendAuctionOrder(orderId: string) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) return;

  const admin = createAdminClient();
  const nextDeadline = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await (admin as any).from("auction_orders").update({ payment_deadline: nextDeadline, updated_at: new Date().toISOString() }).eq("id", orderId).eq("payment_status", "payment_pending");
}

async function cancelAuctionOrder(orderId: string) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) return;

  const admin = createAdminClient();
  await (admin as any).from("auction_orders").update({ payment_status: "cancelled", updated_at: new Date().toISOString() }).eq("id", orderId).eq("payment_status", "payment_pending");
}

const reviewHref = (orderId: string) => `/admin?tab=orders&orderId=${orderId}`;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Unpaid Auctions",
  description: "Review auctions awaiting buyer payment, extend windows, and cancel fraudulent orders.",
};

async function getUnpaidAuctions() {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("auction_orders")
    .select("*, show_products(title, subtitle, image_url), profiles:buyer_id(username)")
    .eq("payment_status", "payment_pending")
    .order("payment_deadline", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function UnpaidAuctionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    notFound();
  }

  let orders: Array<any> = [];
  try {
    orders = await getUnpaidAuctions();
  } catch {
    orders = [];
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Admin</p>
          <h1 className="mt-3 text-3xl font-black">Unpaid auctions</h1>
          <p className="mt-2 text-sm text-gray-400">Track pending buyer payments, extend deadlines, or cancel suspicious wins.</p>
        </div>

        <div className="grid gap-4">
          {orders.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-gray-400">No unpaid auctions right now.</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="rounded-3xl border border-white/10 bg-[#13131f] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-widest text-yellow-400">Payment pending</div>
                    <h2 className="mt-1 text-xl font-black">{order.show_products?.title ?? "Auction item"}</h2>
                    <p className="text-sm text-gray-400">Buyer: {order.profiles?.username ? `@${order.profiles.username}` : order.buyer_id}</p>
                    <p className="text-sm text-gray-400">Winning bid: ${Number(order.winning_bid).toFixed(2)}</p>
                    <p className="text-sm text-gray-400">Deadline: {new Date(order.payment_deadline).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={extendAuctionOrder.bind(null, order.id)}>
                      <button className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black" type="submit">Extend 15m</button>
                    </form>
                    <form action={cancelAuctionOrder.bind(null, order.id)}>
                      <button className="rounded-xl border border-red-400/30 px-4 py-2 font-semibold text-red-200" type="submit">Cancel</button>
                    </form>
                    <Link href={reviewHref(order.id)} className="rounded-xl border border-white/20 px-4 py-2 font-semibold text-white">
                      Review order
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
