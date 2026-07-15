import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { isSellerVerificationApproved, type SellerVerificationStatus } from "@/lib/seller-verification";
import type { Listing, LiveShow } from "@/lib/supabase/types";
import AuctionSetupClient from "./auction-setup-client";

type SellerProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  verification_status: SellerVerificationStatus | null;
  is_seller: boolean | null;
};

export const dynamic = "force-dynamic";

export default async function CreateAuctionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const [{ data: profile }, { data: listings }, { data: liveShows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, verification_status, is_seller")
      .eq("id", user.id)
      .maybeSingle<SellerProfile>(),
    supabase
      .from("listings")
      .select("id, seller_id, card_name, set_name, card_number, rarity, condition, grade_company, grade_score, price, quantity, images, description, shipping_profile_id, category, status, views, created_at, updated_at")
      .eq("seller_id", user.id)
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("live_shows")
      .select("id, seller_id, title, description, thumbnail, status, auction_state, scheduled_start, scheduled_end, viewer_count, peak_viewers, total_sales_amount, total_bidders, average_bid_value, engagement_score, host_permissions, auction_settings, created_at, updated_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const verificationStatus = profile?.verification_status ?? null;

  if (!isSellerVerificationApproved(verificationStatus)) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Seller access</p>
          <h1 className="mt-3 text-3xl font-black">Auction setup is locked until verification is approved.</h1>
          <p className="mt-3 text-sm text-gray-400">Finish seller verification first, then come back to build and launch your live auction.</p>
          <a href="/sell/verification" className="mt-6 inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300">
            Go to verification
          </a>
        </div>
      </div>
    );
  }

  return (
    <AuctionSetupClient
      sellerName={profile?.full_name ?? profile?.username ?? user.email ?? "Seller"}
      sellerUsername={profile?.username ?? null}
      listings={(listings ?? []) as Listing[]}
      existingShows={(liveShows ?? []) as LiveShow[]}
    />
  );
}
