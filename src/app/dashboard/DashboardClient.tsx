"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Listing, Order, Profile, SellerWallet } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import SellerVerificationStatusCard from "@/components/seller/verification-status-card";
import { getEffectiveSellerVerificationStatus, isAdminVerifiedUser, isSellerVerificationApproved, type SellerVerificationStatus } from "@/lib/seller-verification";
import { buildSellerFeeConfig, calculateFeeBreakdown, formatPercent, summarizeSellerEarnings } from "@/lib/seller-fees";
import { calculateLiveShowInsights, createLiveShowSnapshot, getLiveShow } from "@/lib/live-commerce";
import type { LiveShowDirectoryItem } from "@/lib/live-shows-client";
import { listLiveShowsBySeller } from "@/lib/live-shows-client";
import { recordAuditEvent, recordSecurityEvent } from "@/lib/audit-log";
import { recordDeviceSession } from "@/lib/device-security";
import { deleteUploadedFile, parsePublicStorageUrl, uploadImageFile } from "@/lib/uploads";
import SupportInlineCard from "@/components/support/support-inline-card";


type BrandAssetField = "profileAvatar" | "storeLogo" | "storeBanner";

type BrandAssetDraft = {
  field: BrandAssetField;
  label: string;
  value: string | null;
  previewUrl: string | null;
  saving: boolean;
  error: string | null;
  success: string | null;
  originalUrl: string | null;
  currentPath: string | null;
  fileName: string | null;
  inputKey: number;
  file: File | null;
};

function createBrandAssetDraft(field: BrandAssetField, label: string, value: string | null): BrandAssetDraft {
  return {
    field,
    label,
    value,
    previewUrl: value,
    saving: false,
    error: null,
    success: null,
    originalUrl: value,
    currentPath: null,
    fileName: null,
    inputKey: 0,
    file: null,
  };
}

function createBrandAssetsState(profileRow: Profile | null, storeRecord: StoreRow | null) {
  return {
    profileAvatar: createBrandAssetDraft("profileAvatar", "Profile avatar", profileRow?.avatar_url ?? null),
    storeLogo: createBrandAssetDraft("storeLogo", "Store logo", storeRecord?.logo_url ?? null),
    storeBanner: createBrandAssetDraft("storeBanner", "Store banner", storeRecord?.banner_url ?? null),
  } satisfies Record<BrandAssetField, BrandAssetDraft>;
}

function brandAssetPrefix(field: BrandAssetField) {
  return field === "profileAvatar" ? "profile-avatar" : field === "storeLogo" ? "store-logo" : "store-banner";
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function toUploadFields() {
  return ["profileAvatar", "storeLogo", "storeBanner"] as const;
}

function hasPendingBrandChanges(assets: Record<BrandAssetField, BrandAssetDraft>) {
  return Object.values(assets).some((asset) => Boolean(asset.file));
}

function brandAssetPath(url: string | null) {
  return parsePublicStorageUrl(url ?? "")?.path ?? null;
}

function clearStoragePath(url: string | null) {
  return brandAssetPath(url);
}

function compareBrandAssetUrls(left: string | null, right: string | null) {
  return (left ?? null) === (right ?? null);
}

type SellerRow = {
  avatar_url?: string | null;
  banner_url?: string | null;
};

type StoreRow = {
  logo_url?: string | null;
  banner_url?: string | null;
};

const BRAND_ASSET_FIELDS: Array<Pick<BrandAssetDraft, "field" | "label">> = [
  { field: "profileAvatar", label: "Profile avatar" },
  { field: "storeLogo", label: "Store logo" },
  { field: "storeBanner", label: "Store banner" },
];

const BRAND_SAVE_SUCCESS = "Profile updated successfully";
const BRAND_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function makeBrandAssetDraft(field: BrandAssetField, label: string, value: string | null): BrandAssetDraft {
  return {
    field,
    label,
    value,
    previewUrl: value,
    saving: false,
    error: null,
    success: null,
    originalUrl: value,
    currentPath: null,
    fileName: null,
    inputKey: 0,
    file: null,
  };
}

function brandAssetUrlForField(field: BrandAssetField, sellerRecord: SellerRow | null, storeRecord: StoreRow | null) {
  if (field === "profileAvatar") return sellerRecord?.avatar_url ?? null;
  if (field === "storeLogo") return storeRecord?.logo_url ?? null;
  return storeRecord?.banner_url ?? null;
}

function fieldToTarget(field: BrandAssetField) {
  if (field === "profileAvatar") return "profile" as const;
  return "store" as const;
}

function fieldToBodyKey(field: BrandAssetField) {
  if (field === "profileAvatar") return "avatar_url" as const;
  if (field === "storeLogo") return "logo_url" as const;
  return "banner_url" as const;
}

function fieldToUploadPrefix(field: BrandAssetField) {
  if (field === "profileAvatar") return "profile-avatar";
  if (field === "storeLogo") return "store-logo";
  return "store-banner";
}

function fieldToPreviewStyles(field: BrandAssetField) {
  if (field === "profileAvatar") return "aspect-square rounded-2xl";
  if (field === "storeLogo") return "aspect-square rounded-2xl";
  return "aspect-[16/9] rounded-3xl";
}

function getBrandAssetAlt(field: BrandAssetField, label: string) {
  if (field === "profileAvatar") return `${label} preview`;
  if (field === "storeLogo") return `${label} preview`;
  return `${label} preview`;
}


type VerificationRow = {
  status?: SellerVerificationStatus | null;
  rejection_reason?: string | null;
  more_information_request?: string | null;
  verified_at?: string | null;
};

const SUPPORT_CARD = (
  <SupportInlineCard title="Need seller support?" description="Get help with listings, fees, payouts, live shows, or seller tools." href="/support" />
);

type Tab = "overview" | "listings" | "purchases" | "sales" | "fees" | "live";

type DashboardOrder = Order & {
  listings?: { card_name?: string; images?: string[] } | null;
  profiles?: { username?: string | null } | null;
};

function formatTimeRemaining(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "00:00";
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function paymentStatusLabel(status: string) {
  if (status === "paid") return "🟢 Paid — Ready to Ship";
  if (status === "expired") return "🔴 Payment Failed";
  if (status === "failed") return "🔴 Payment Failed";
  if (status === "cancelled") return "⚪ Cancelled";
  return "🟡 Awaiting Payment";
}

function groupByTracking(orders: DashboardOrder[]) {
  const groups = new Map<string, DashboardOrder[]>();
  for (const order of orders) {
    const key = order.tracking_number ? `tracking:${order.tracking_number}` : `order:${order.id}`;
    const current = groups.get(key) ?? [];
    current.push(order);
    groups.set(key, current);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
}

function formatGroupTitle(items: DashboardOrder[]) {
  const count = items.length;
  const total = items.reduce((sum, item) => sum + (item.total_amount ?? 0), 0);
  return `${count} order${count === 1 ? "" : "s"} · $${total.toFixed(2)}`;
}

export default function DashboardClient({ orderSuccess }: { orderSuccess: boolean }) {
  const searchParams = useSearchParams();
  const orderTab = searchParams.get("tab");

  const [supabase] = useState(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  });

  const router = useRouter();

  const [tab, setTab] = useState<Tab>(orderTab === "sales" ? "sales" : "overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<SellerVerificationStatus | null>(null);
  const [verificationDetails, setVerificationDetails] = useState<VerificationRow | null>(null);
  const [sellerRecord, setSellerRecord] = useState<SellerRow | null>(null);
  const [storeRecord, setStoreRecord] = useState<StoreRow | null>(null);
  const [brandAssets, setBrandAssets] = useState<Record<BrandAssetField, BrandAssetDraft>>({
    profileAvatar: createBrandAssetDraft("profileAvatar", "Profile avatar", null),
    storeLogo: createBrandAssetDraft("storeLogo", "Store logo", null),
    storeBanner: createBrandAssetDraft("storeBanner", "Store banner", null),
  });
  const [brandSaveStatus, setBrandSaveStatus] = useState<string | null>(null);
  const [brandSaveError, setBrandSaveError] = useState<string | null>(null);
  const [brandSavePending, setBrandSavePending] = useState(false);
  const [brandAssetBusy, setBrandAssetBusy] = useState<BrandAssetField | null>(null);
  const [wallet, setWallet] = useState<SellerWallet | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [purchases, setPurchases] = useState<DashboardOrder[]>([]);
  const [sales, setSales] = useState<DashboardOrder[]>([]);
  const [sellerLiveShows, setSellerLiveShows] = useState<LiveShowDirectoryItem[]>([]);
  const liveShowCount = sellerLiveShows.length;
  const notificationCount = liveShowCount;
  const [loading, setLoading] = useState(true);
  const [brainCopied, setBrainCopied] = useState(false);
  const [isAdminAccount, setIsAdminAccount] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth?redirectTo=/dashboard");
        return;
      }

      const [{ data: profileData }, { data: walletData }, { data: verificationData }, { data: listingData }, { data: purchaseData }, { data: salesData }, { data: storeData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("seller_wallets").select("*").eq("seller_id", user.id).single(),
        supabase.from("seller_verifications").select("status, rejection_reason, more_information_request, verified_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("listings").select("*").eq("seller_id", user.id).neq("status", "removed").order("created_at", { ascending: false }),
        supabase.from("orders").select("*, listings(card_name, set_name, images)").eq("buyer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("orders").select("*, listings(card_name, set_name, images), profiles!buyer_id(username)").eq("seller_id", user.id).order("created_at", { ascending: false }),
        supabase.from("seller_stores").select("*").eq("seller_id", user.id).maybeSingle(),
      ]);

      const sellerLiveShowsData = await listLiveShowsBySeller(user.id);

      const profileRow = profileData as Profile | null;
      const storeRow = storeData as StoreRow | null;
      const verificationRow = verificationData as VerificationRow | null;

      setProfile(profileRow);
      setIsAdminAccount(Boolean(user?.app_metadata?.role === "admin" || user?.app_metadata?.role === "super_admin" || user?.user_metadata?.role === "admin" || user?.user_metadata?.role === "super_admin"));
      setVerificationStatus(getEffectiveSellerVerificationStatus(user, verificationRow?.status ?? profileRow?.verification_status ?? "not_started"));
      setVerificationDetails(verificationRow ? {
        rejection_reason: verificationRow.rejection_reason,
        more_information_request: verificationRow.more_information_request,
        verified_at: verificationRow.verified_at,
      } : null);
      setSellerRecord({ avatar_url: profileRow?.avatar_url ?? null, banner_url: null });
      setStoreRecord(storeRow);
      setBrandAssets(createBrandAssetsState(profileRow, storeRow));
      setBrandSaveStatus(null);
      setBrandSaveError(null);
      setBrandSavePending(false);
      setWallet(walletData ?? null);
      setListings(listingData ?? []);
      setPurchases((purchaseData ?? []) as DashboardOrder[]);
      setSales((salesData ?? []) as DashboardOrder[]);
      setSellerLiveShows((sellerLiveShowsData ?? []) as LiveShowDirectoryItem[]);
      setLoading(false);
    };

    init();

    if (orderSuccess) {
      setTimeout(() => router.replace("/dashboard"), 100);
    }
  }, [orderSuccess, router, supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      recordAuditEvent({
        event_type: "auth.logout",
        actor_id: user.id,
        action: "sign_out",
        resource_type: "auth",
        resource_id: user.id,
        previous_value: null,
        new_value: null,
        ip_address: null,
        user_agent: typeof window === "undefined" ? null : window.navigator.userAgent,
      });
      recordSecurityEvent({ event_type: "auth.logout", severity: "low", actor_id: user.id, details: { source: "dashboard" } });
      recordDeviceSession({
        user_id: user.id,
        device_name: "Signed out device",
        device_hash: typeof window === "undefined" ? null : btoa(`${window.navigator.userAgent}|${window.location.hostname}`).slice(0, 64),
        ip_address: null,
        user_agent: typeof window === "undefined" ? null : window.navigator.userAgent,
        last_seen_at: new Date().toISOString(),
        active: false,
      });
    }
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const handleDeleteListing = async (id: string, cardName: string) => {
    const confirmed = typeof window !== "undefined" ? window.confirm(`Delete ${cardName}? This will remove it from your store.`) : false;
    if (!confirmed) return;

    const res = await fetch(`/api/listings/${id}`, { method: "DELETE" });
    const payload = await res.json().catch(() => ({} as { error?: string; mode?: string }));
    if (!res.ok) {
      alert(payload.error ?? "Failed to remove listing.");
      return;
    }

    setListings((current) => current.filter((listing) => listing.id !== id));
    setSales((current) => current.filter((order) => order.listing_id !== id));
    window.dispatchEvent(new Event("tcg-listings-updated"));
    router.refresh();
  };

  const [labelStatus, setLabelStatus] = useState<string | null>(null);
  const [manualReferralLookup, setManualReferralLookup] = useState("");
  const [referralStatus, setReferralStatus] = useState<string | null>(null);
  const referralCode = profile?.referral_code ?? null;
  const referralLink = typeof window === "undefined" || !referralCode ? "" : `${window.location.origin}/auth?mode=signup&ref=${encodeURIComponent(referralCode)}`;
  const referralQrUrl = referralLink ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(referralLink)}` : "";

  const copyReferralValue = async (value: string, label: string) => {
    if (!value || typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(value);
    setReferralStatus(`${label} copied.`);
  };

  const handleManualReferralConfirm = async () => {
    if (!supabase || !profile || !manualReferralLookup.trim()) return;
    const code = manualReferralLookup.trim().toUpperCase();
    const { data: referrer } = await supabase.from("profiles").select("id, referral_code, referral_locked_at").eq("referral_code", code).maybeSingle() as { data: { id: string; referral_code: string | null; referral_locked_at: string | null } | null };
    if (!referrer?.id) {
      setReferralStatus("No referral code matched that entry.");
      return;
    }
    const { error } = await (supabase as any).from("profiles").update({ referral_source_user_id: referrer.id, referral_source: "manual signup", referral_source_code: code, referral_source_confirmed_at: new Date().toISOString(), referral_locked_at: new Date().toISOString() }).eq("id", profile.id).is("referral_source_user_id", null);
    setReferralStatus(error ? error.message : "Referral source locked.");
  };

  const handleCreateUSPSLabel = async (orderId: string) => {
    setLabelStatus(null);
    const res = await fetch(`/api/orders/${orderId}/label`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageWeight: 1, mailClass: "USPS_GROUND_ADVANTAGE" }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLabelStatus(data.error ?? "Unable to create USPS label.");
      return;
    }
    setLabelStatus(data.label?.trackingNumber ? `Label created: ${data.label.trackingNumber}` : "Label created.");
  };

  const refreshOrders = async () => {
    if (!supabase || !profile) return;
    const [{ data: freshSales }, freshAuctionOrders] = await Promise.all([
      supabase.from("orders").select("*, listings(card_name, set_name, images), profiles!buyer_id(username)").eq("seller_id", profile.id).order("created_at", { ascending: false }),
      listLiveShowsBySeller(profile.id),
    ]);
    setSales((freshSales ?? []) as DashboardOrder[]);
    setSellerLiveShows((freshAuctionOrders ?? []) as LiveShowDirectoryItem[]);
  };

  const completedSales = useMemo(() => sales.filter((o) => ["paid", "shipped", "delivered", "completed"].includes(o.status)), [sales]);
  const feeConfig = useMemo(() => buildSellerFeeConfig({}), []);
  const sellerSummary = useMemo(() => summarizeSellerEarnings({ orders: completedSales, config: feeConfig }), [completedSales, feeConfig]);
  const freeSalesUsed = sellerSummary.freeSalesUsed;
  const freeSalesRemaining = sellerSummary.freeSalesRemaining;
  const upcomingFeeExample = calculateFeeBreakdown({ itemSubtotal: 100, shipping: 0, salesTax: 0, orders: completedSales, config: feeConfig });

  const liveInsights = calculateLiveShowInsights(createLiveShowSnapshot(getLiveShow()));
  const [liveShowsLoading, setLiveShowsLoading] = useState(false);
  const [liveShowTitle, setLiveShowTitle] = useState("New live show");
  const [liveShowDescription, setLiveShowDescription] = useState("Run a separate live room for this drop.");
  const [liveShowStatusMessage, setLiveShowStatusMessage] = useState<string | null>(null);
  const [liveShowStartTime, setLiveShowStartTime] = useState(() => new Date(Date.now() + 1000 * 60 * 30).toISOString().slice(0, 16));
  const [liveShowFeatured, setLiveShowFeatured] = useState(false);
  const [liveShowProductsCount, setLiveShowProductsCount] = useState(0);
  const [liveShowFilter, setLiveShowFilter] = useState("all");
  const [liveShowSearch, setLiveShowSearch] = useState("");
  const [activeLiveShowId, setActiveLiveShowId] = useState<string | null>(null);
  const [liveShowBoost, setLiveShowBoost] = useState(false);
  const [liveShowModerators, setLiveShowModerators] = useState<string[]>([]);
  const [liveShowAnalyticsOpen, setLiveShowAnalyticsOpen] = useState(false);
  const [liveShowQueueMode, setLiveShowQueueMode] = useState("standard");
  const [liveShowCategory, setLiveShowCategory] = useState("Pokémon");
  const [liveShowPriceFloor, setLiveShowPriceFloor] = useState(0);
  const [liveShowPriceCeiling, setLiveShowPriceCeiling] = useState(0);
  const [liveShowProductType, setLiveShowProductType] = useState("Singles");
  const [liveShowScheduledOnly, setLiveShowScheduledOnly] = useState(false);
  const [liveShowAutoModeration, setLiveShowAutoModeration] = useState(true);
  const [liveShowSummaryText, setLiveShowSummaryText] = useState("");
  const [liveShowRoomMessage, setLiveShowRoomMessage] = useState<string | null>(null);
  const [liveShowAnalyticsMode, setLiveShowAnalyticsMode] = useState("viewer_count");
  const [liveShowThumbnailUrl, setLiveShowThumbnailUrl] = useState<string | null>(null);
  const [liveShowThumbnailUploading, setLiveShowThumbnailUploading] = useState(false);
  const [liveShowThumbnailError, setLiveShowThumbnailError] = useState<string | null>(null);

  const handleLiveShowThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !supabase || !profile?.id) return;

    setLiveShowThumbnailUploading(true);
    setLiveShowThumbnailError(null);

    try {
      const uploaded = await uploadImageFile({
        supabase,
        target: "live-show",
        ownerId: profile.id,
        file,
      });
      setLiveShowThumbnailUrl(uploaded.publicUrl);
    } catch (error) {
      setLiveShowThumbnailError(error instanceof Error ? error.message : "Unable to upload live show thumbnail.");
    } finally {
      setLiveShowThumbnailUploading(false);
    }
  };
  const shippingPerformance = useMemo(() => {
    const shipped = sales.filter((order) => order.status === "shipped").length;
    const delivered = sales.filter((order) => order.status === "delivered").length;
    return shipped > 0 ? Math.round((delivered / shipped) * 100) : 100;
  }, [sales]);
  const buyerRetention = useMemo(() => {
    const buyerCounts = new Map<string, number>();
    for (const order of sales) {
      buyerCounts.set(order.buyer_id, (buyerCounts.get(order.buyer_id) ?? 0) + 1);
    }
    const repeatBuyers = Array.from(buyerCounts.values()).filter((count) => count > 1).length;
    return sales.length > 0 ? Math.round((repeatBuyers / buyerCounts.size) * 100) || 0 : 0;
  }, [sales]);
  const avgBidValue = liveInsights.averageBidValue;
  const revenuePerShow = liveInsights.revenuePerShow;
  const conversionRate = liveInsights.conversionRate;
  const earningsBreakdown = sellerSummary.netEarnings;
  const showTrustScore = 100;
  const notificationsEnabled = false;
  const totalLiveShowSales = sellerLiveShows.reduce((sum) => sum, 0);
  const showQueueSize = sellerLiveShows.length;
  const auctionHealth = Math.max(0, 100 - Math.max(0, 100 - shippingPerformance));
  const giveawaySummary = { activeGiveaways: 0, eligibleUsers: 0, claimedWinners: 0, totalCost: 0, platformRevenueProtected: true };
  const giveaway = null;
  const giveawaySecondsLeft = 0;
  const giveawayMinutes = 0;
  const giveawaySeconds = 0;
  const giveawayCost = 0;
  const giveawayProgress = 0;

  useEffect(() => {
    if (!supabase || !profile?.id) return;
    let alive = true;
    Promise.resolve().then(() => setLiveShowsLoading(true));
    listLiveShowsBySeller(profile.id)
      .then((rows: LiveShowDirectoryItem[]) => {
        if (!alive) return;
        setSellerLiveShows(rows);
        setActiveLiveShowId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setSellerLiveShows([]);
      })
      .finally(() => {
        if (!alive) return;
        setLiveShowsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [profile?.id, supabase]);

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-6 text-center text-gray-300">
        <div className="max-w-md space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
          <div className="text-xl font-black text-white">Dashboard unavailable</div>
          <p className="text-sm text-gray-400">The seller dashboard could not start on this device. Please reload or sign in again.</p>
          <a href="/auth?redirectTo=/dashboard" className="inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black">Sign in again</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a]">
        <div className="text-lg animate-pulse text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  const activeListings = listings.filter((l) => l.status === "active").length;
  const totalRevenue = completedSales.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const ordersToVerified = Math.max(0, 1000 - (wallet?.completed_orders_count ?? sellerSummary.lifetimeSales));
  const payoutTier = wallet?.completed_orders_count && wallet.completed_orders_count >= 1000 ? "Verified Seller (Instant Eligible)" : "Standard Payout";
  const nextPayout = wallet?.next_payout_at ? new Date(wallet.next_payout_at).toLocaleDateString() : "Daily at 12:00 AM PST";
  const availableBalance = wallet?.available_balance ?? 0;
  const pendingBalance = wallet?.pending_balance ?? sellerSummary.upcomingPayouts;
  const frozenBalance = (wallet as { frozen_balance?: number | null } | null)?.frozen_balance ?? 0;
  const escrowBalance = pendingBalance;
  const instantEligible = Boolean(wallet?.instant_payout_enabled && (wallet?.completed_orders_count ?? 0) >= 1000 && !wallet?.fraud_flag);
  const payoutStatus = wallet?.fraud_flag ? "Frozen for review" : instantEligible ? "Instant payout enabled" : "Escrow hold active";
  const payoutProgress = Math.min(100, ((wallet?.completed_orders_count ?? sellerSummary.lifetimeSales) / 1000) * 100);
  const fraudRiskScore = wallet?.fraud_flag ? 80 : instantEligible ? 0 : 20;
  const disputeCount = 0;
  const releaseStatus = pendingBalance > 0 ? "Awaiting escrow release" : "No funds in escrow";
  const statusSummary = [payoutStatus, releaseStatus].join(" · ");
  const brainSummary = [
    `TcgPoké Market dashboard summary for ${profile?.full_name ?? "user"}`,
    `Active listings: ${activeListings}`,
    `Total sales: ${profile?.total_sales ?? 0}`,
    `Revenue: $${totalRevenue.toFixed(2)}`,
    `Purchases: ${purchases.length}`,
    `Sales: ${sales.length}`,
    `Current seller tier: ${sellerSummary.tierName}`,
  ].join("\n");

  const handleCopyBrainSummary = async () => {
    try {
      await navigator.clipboard.writeText(brainSummary);
      setBrainCopied(true);
      setTimeout(() => setBrainCopied(false), 2000);
    } catch {
      setBrainCopied(false);
    }
  };

  const refreshBrandAssets = async () => {
    if (!supabase || !profile?.id) return;
    const [{ data: freshProfile }, { data: freshStore }] = await Promise.all([
      supabase.from("profiles").select("avatar_url").eq("id", profile.id).maybeSingle(),
      supabase.from("seller_stores").select("logo_url, banner_url").eq("seller_id", profile.id).maybeSingle(),
    ]);

    const freshProfileRow = freshProfile as Profile | null;
    const freshStoreRow = freshStore as StoreRow | null;
    setProfile((current) => (current ? { ...current, avatar_url: freshProfileRow?.avatar_url ?? current.avatar_url ?? null } : current));
    setStoreRecord(freshStoreRow ?? null);
    setBrandAssets(createBrandAssetsState(freshProfileRow ?? profile, freshStoreRow));
  };


  const updateBrandAssetDraft = (field: BrandAssetField, next: Partial<BrandAssetDraft>) => {
    setBrandAssets((current) => ({
      ...current,
      [field]: { ...current[field], ...next },
    }));
  };

  const handleBrandAssetFile = async (field: BrandAssetField, file: File | null) => {
    if (!file || !isImageFile(file)) return;
    updateBrandAssetDraft(field, {
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      error: null,
      success: null,
      inputKey: brandAssets[field].inputKey + 1,
      currentPath: null,
    });
  };

  const saveBrandAssets = async () => {
    if (!supabase || !profile) return;
    setBrandSavePending(true);
    setBrandSaveStatus(null);
    setBrandSaveError(null);

    const draftFields = toUploadFields().filter((field) => brandAssets[field].file) as BrandAssetField[];

    try {
      const uploadResults: Partial<Record<BrandAssetField, { publicUrl: string; path: string }>> = {};
      for (const field of draftFields) {
        updateBrandAssetDraft(field, { saving: true, error: null, success: null });
        const draft = brandAssets[field];
        const uploaded = await uploadImageFile({
          supabase,
          target: "seller-store",
          ownerId: profile.id,
          file: draft.file as File,
          prefix: brandAssetPrefix(field),
        });
        uploadResults[field] = { publicUrl: uploaded.publicUrl, path: uploaded.path };
      }

      const updates: Array<Promise<Response>> = [];
      const profilePayload: Record<string, string | null> = {};
      const storePayload: Record<string, string | null> = {};

      for (const field of toUploadFields()) {
        const uploaded = uploadResults[field];
        if (!uploaded) continue;
        if (field === "profileAvatar") profilePayload.avatar_url = uploaded.publicUrl;
        if (field === "storeLogo") storePayload.logo_url = uploaded.publicUrl;
        if (field === "storeBanner") storePayload.banner_url = uploaded.publicUrl;
      }

      if (Object.keys(profilePayload).length) {
        updates.push(fetch("/api/profile-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "profile", ...profilePayload }),
        }));
      }
      if (Object.keys(storePayload).length) {
        updates.push(fetch("/api/profile-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "store", ...storePayload }),
        }));
      }

      const responses = await Promise.all(updates);
      for (const response of responses) {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({} as { error?: string }));
          throw new Error(payload.error ?? "Unable to save brand assets.");
        }
      }

      await refreshBrandAssets();

      for (const field of draftFields) {
        const draft = brandAssets[field];
        if (draft.originalUrl && draft.originalUrl !== draft.previewUrl) {
          await deleteUploadedFile({ supabase, target: "seller-store", path: clearStoragePath(draft.originalUrl) ?? "" }).catch(() => null);
        }
        updateBrandAssetDraft(field, {
          file: null,
          saving: false,
          success: "Saved",
          originalUrl: uploadResults[field]?.publicUrl ?? draft.previewUrl,
          previewUrl: uploadResults[field]?.publicUrl ?? draft.previewUrl,
          currentPath: uploadResults[field]?.path ?? null,
          fileName: null,
          inputKey: draft.inputKey + 1,
        });
      }

      setBrandSaveStatus(BRAND_SAVE_SUCCESS);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save brand assets.";
      setBrandSaveError(message);
      for (const field of draftFields) updateBrandAssetDraft(field, { saving: false, error: message });
    } finally {
      setBrandSavePending(false);
    }
  };

  const brandAssetsList = [brandAssets.profileAvatar, brandAssets.storeLogo, brandAssets.storeBanner] as BrandAssetDraft[];

  const brandAssetPreview = (asset: BrandAssetDraft) => asset.previewUrl ?? asset.originalUrl;

  const resetBrandAsset = (field: BrandAssetField) => {
    const originalUrl = brandAssets[field].originalUrl;
    updateBrandAssetDraft(field, {
      file: null,
      previewUrl: originalUrl,
      error: null,
      success: null,
      fileName: null,
      currentPath: null,
      inputKey: brandAssets[field].inputKey + 1,
    });
  };

  const renderBrandAssetCard = (field: BrandAssetField) => {
    const asset = brandAssets[field];
    const previewUrl = brandAssetPreview(asset);
    const isBusy = brandAssetBusy === field || asset.saving;
    return (
      <div key={field} className="rounded-3xl border border-white/10 bg-[#11111c] p-4 shadow-xl shadow-black/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">{asset.label}</div>
            <div className="mt-1 text-xs text-gray-400">{asset.file ? asset.file.name : asset.originalUrl ? "Saved image" : "No image uploaded yet"}</div>
          </div>
          <button
            type="button"
            onClick={() => resetBrandAsset(field)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-gray-300 hover:border-white/20 hover:text-white"
          >
            Reset
          </button>
        </div>

        <div className={`mt-4 overflow-hidden border border-white/10 bg-black/20 ${fieldToPreviewStyles(field)}`}>
          {previewUrl ? <img src={previewUrl} alt={getBrandAssetAlt(field, asset.label)} className="h-full w-full object-cover" /> : <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-gray-500">Preview will appear here</div>}
        </div>

        <div className="mt-4 space-y-3">
          <input
            key={asset.inputKey}
            type="file"
            accept={BRAND_IMAGE_ACCEPT}
            disabled={isBusy}
            onChange={(e) => void handleBrandAssetFile(field, e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
            <span>{asset.file ? "Ready to save" : "Changes save from the main button"}</span>
            {asset.success && <span className="font-semibold text-green-400">{BRAND_SAVE_SUCCESS}</span>}
          </div>
          {asset.error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{asset.error}</div>}
          {isBusy && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">Uploading {asset.label.toLowerCase()}...</div>}
        </div>
      </div>
    );
  };

  const brandDraftCount = brandAssetsList.filter((asset) => asset.file).length;

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "listings", label: `Listings (${listings.length})` },
    { key: "purchases", label: `Purchases (${purchases.length})` },
    { key: "sales", label: `Sales (${sales.length})` },
    { key: "fees", label: "Seller Fees" },
    { key: "live", label: "Live Studio" },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0f0f1a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-xl font-black">
            <span className="text-2xl">⚡</span>
            <span className="text-white">TCG</span><span className="text-yellow-400">Poke</span><span className="text-white">Market</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/listings" className="text-sm text-gray-300 hover:text-white">Browse</a>
            <a href="/dashboard/fees" className="text-sm text-gray-300 hover:text-white">Fees</a>
            <a href="/listings/create" className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">+ New Listing</a>
            <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
              <span>Seller dashboard</span>
              <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black tracking-normal text-black">{notificationCount} pending</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/20 text-xl font-black text-yellow-400">
                {profile?.username?.[0]?.toUpperCase() ?? profile?.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <h1 className="text-3xl font-black sm:text-4xl">{profile?.full_name ?? "My Dashboard"}</h1>
                {profile?.username && <p className="text-sm text-gray-400">@{profile.username}</p>}
              </div>
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-gray-300">
              Manage listings, review sales, track seller fees, and keep your live auctions moving with a polished control center.
            </p>
            <div className="max-w-2xl">
              {!isAdminAccount && (
                <>
                  <SellerVerificationStatusCard
                    status={verificationStatus}
                    rejectionReason={verificationDetails?.rejection_reason}
                    moreInfo={verificationDetails?.more_information_request}
                    verifiedAt={verificationDetails?.verified_at}
                  />
                  {!isSellerVerificationApproved(verificationStatus) && (
                    <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
                      Identity verification is required before you can create listings or start live auctions.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            {SUPPORT_CARD}
            <div className="text-xs text-gray-500">Support questions can also be sent from orders, live shows, or the help center.</div>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-widest text-yellow-400">Store Branding</p>
                <h2 className="mt-2 text-xl font-black">Update your profile avatar and storefront visuals</h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">Choose images, preview them instantly, then save once to update your public profile and store branding.</p>
              </div>
              <button
                type="button"
                onClick={() => void saveBrandAssets()}
                disabled={!hasPendingBrandChanges(brandAssets) || brandSavePending}
                className="inline-flex items-center justify-center rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {brandSavePending ? "Saving..." : `Save Changes${brandDraftCount > 0 ? ` (${brandDraftCount})` : ""}`}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                {renderBrandAssetCard("profileAvatar")}
                {renderBrandAssetCard("storeLogo")}
              </div>
              <div className="space-y-4">
                {renderBrandAssetCard("storeBanner")}
                <div className="rounded-3xl border border-white/10 bg-[#11111c] p-4 text-sm text-gray-300">
                  <div className="font-semibold text-white">Saved instantly on load</div>
                  <p className="mt-2 text-gray-400">Current database values are loaded as soon as the dashboard opens so the editor always starts with the latest saved images.</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                    <span className="rounded-full border border-white/10 px-3 py-1">Refreshes after save</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Owner-only updates</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">No placeholder cards</span>
                  </div>
                </div>
              </div>
            </div>

            {brandSaveStatus && <div className="rounded-xl border border-green-400/20 bg-green-400/10 px-4 py-3 text-sm text-green-300">✓ {brandSaveStatus}</div>}
            {brandSaveError && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{brandSaveError}</div>}
            {brandSavePending && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">Saving your branding updates...</div>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyBrainSummary}
                className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-400 transition-colors hover:bg-yellow-400/20"
              >
                {brainCopied ? "Copied" : "Copy dashboard summary"}
              </button>
            </div>
          </div>
        </div>


        <div className="mb-8 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all ${tab === t.key ? "bg-yellow-400 text-black" : "text-gray-400 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Active Listings", value: activeListings, icon: "🃏" },
                { label: "Total Sales", value: profile?.total_sales ?? 0, icon: "✅" },
                { label: "Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: "💰" },
                { label: "Purchases", value: purchases.length, icon: "🛒" },
                { label: "Live Show Revenue", value: `$${revenuePerShow.toFixed(2)}`, icon: "🎥" },
                { label: "Conversion Rate", value: `${conversionRate.toFixed(1)}%`, icon: "📈" },
                { label: "Avg Bid", value: `$${avgBidValue.toFixed(2)}`, icon: "🏷️" },
                { label: "Buyer Retention", value: `${Math.max(buyerRetention, liveInsights.buyerRetention).toFixed(0)}%`, icon: "🔁" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                  <div className="mb-2 text-3xl">{stat.icon}</div>
                  <div className="text-2xl font-black text-white">{stat.value}</div>
                  <div className="mt-1 text-sm text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Payout tier</div>
                <h3 className="mt-2 text-xl font-black">{payoutTier}</h3>
                <p className="mt-2 text-sm text-gray-400">Orders completed: {wallet?.completed_orders_count ?? sellerSummary.lifetimeSales} / 1,000</p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${payoutProgress}%` }} />
                </div>
                <p className="mt-3 text-sm text-gray-400">{instantEligible ? "Instant payout is available." : `Instant payout unlocks in ${ordersToVerified} completed orders.`}</p>
                <p className="mt-2 text-xs text-gray-500">{statusSummary}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Wallet</div>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Available balance</span><span>${availableBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Escrow balance</span><span>${escrowBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Frozen balance</span><span>${frozenBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Lifetime earnings</span><span>${(wallet?.lifetime_earnings ?? totalRevenue).toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Next payout</span><span>{nextPayout}</span></div>
                </div>
                <button className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-400/20" disabled={!instantEligible}>
                  {instantEligible ? "Request instant payout" : "Instant payout locked"}
                </button>
              </div>

              <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Referral rewards</div>
                <h3 className="mt-2 text-xl font-black">Share your invite link</h3>
                <p className="mt-2 text-sm text-gray-300">Invite buyers, sellers, or creators to TcgPoké Market and track rewards tied to their activity.</p>
                <div className="mt-4 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Buyer reward</span><span>{formatPercent(10)}</span></div>
                  <div className="flex items-center justify-between"><span>Seller reward</span><span>{formatPercent(15)}</span></div>
                  <div className="flex items-center justify-between"><span>Creator reward</span><span>{formatPercent(20)}</span></div>
                  <div className="flex items-center justify-between"><span>Minimum profit margin</span><span>60%</span></div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button onClick={() => copyReferralValue(referralLink, "Referral link")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white hover:border-yellow-400/40">Copy referral link</button>
                  <button onClick={() => copyReferralValue(referralCode ?? "", "Referral code")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white hover:border-yellow-400/40">Copy referral code</button>
                </div>
                {referralQrUrl && (
                  <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-[#13131f] p-4">
                    <img src={referralQrUrl} alt="Referral QR code" className="h-24 w-24 rounded-lg bg-white p-2" />
                    <div className="text-sm text-gray-300">
                      <div className="font-semibold text-white">QR code</div>
                      <p className="mt-1 text-gray-400">Share this code when someone wants to scan and sign up fast.</p>
                    </div>
                  </div>
                )}
                <div className="mt-4 rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 text-xs text-gray-400">
                  Rewards are held until the order clears and are only approved when the margin stays healthy.
                </div>
                <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-[#11111c] p-4">
                  <div className="text-sm font-semibold text-white">Fallback referral lookup</div>
                  <p className="text-xs text-gray-400">If tracking fails, enter the referred user’s code here within 30 days of signup to lock the source permanently.</p>
                  <div className="flex gap-2">
                    <input value={manualReferralLookup} onChange={(e) => setManualReferralLookup(e.target.value)} placeholder="Enter referral code" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none" />
                    <button onClick={handleManualReferralConfirm} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black">Confirm</button>
                  </div>
                  {referralStatus && <div className="text-xs text-gray-300">{referralStatus}</div>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-yellow-400/20 bg-[#13131f] p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Rewards prompt</div>
                  <h3 className="mt-2 text-xl font-black">Earn more when your referrals start buying and selling</h3>
                  <p className="mt-2 max-w-2xl text-sm text-gray-300">Your referral activity is tracked automatically so eligible rewards can be held, reviewed, and released without cutting into marketplace profit.</p>
                </div>
                <Link href="/auth?mode=signup" className="inline-flex items-center justify-center rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-yellow-300">
                  Invite or sign up
                </Link>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3 text-sm text-gray-300">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="font-semibold text-white">1. Sign up</div>
                  <p className="mt-1 text-gray-400">Add a referral code during signup if you were invited.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="font-semibold text-white">2. Track rewards</div>
                  <p className="mt-1 text-gray-400">Buyer, seller, and creator rewards stay visible in your account.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="font-semibold text-white">3. Release safely</div>
                  <p className="mt-1 text-gray-400">Rewards only clear when profit protection and hold rules are met.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Risk & disputes</div>
                <h3 className="mt-2 text-xl font-black">Score {fraudRiskScore}</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Open disputes</span><span>{disputeCount}</span></div>
                  <div className="flex items-center justify-between"><span>Pending release</span><span>{pendingBalance > 0 ? "Yes" : "No"}</span></div>
                  <div className="flex items-center justify-between"><span>Notifications</span><span>{notificationsEnabled ? "On" : "Off"}</span></div>
                  <div className="flex items-center justify-between"><span>Auction health</span><span>{auctionHealth}%</span></div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/10 via-red-500/10 to-blue-500/10 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Seller room summary</div>
                <h3 className="mt-2 text-xl font-black">{sellerLiveShows.length} rooms in your storefront</h3>
                <div className="mt-3 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3"><span>Active rooms</span><span>{sellerLiveShows.filter((room) => room.status === "live").length}</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3"><span>Scheduled rooms</span><span>{sellerLiveShows.filter((room) => room.status === "scheduled").length}</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3"><span>Featured rooms</span><span>{sellerLiveShows.filter((room) => Boolean((room.auction_settings as any)?.featured)).length}</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3"><span>Total viewers</span><span>{sellerLiveShows.reduce((sum, room) => sum + (room.viewer_count ?? 0), 0)}</span></div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.min(100, sellerLiveShows.length * 10)}%` }} />
                </div>
                <p className="mt-3 text-sm text-gray-300">Each room keeps its own bids, chat, viewers, and auction queue isolated by seller_id and show_id.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Wallet impact</div>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Active room revenue</span><span>${totalLiveShowSales.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Seller balance</span><span>${availableBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Pending balance</span><span>${pendingBalance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Total rooms</span><span>{sellerLiveShows.length}</span></div>
                  <div className="flex items-center justify-between"><span>Platform fee model</span><span>{sellerSummary.tierName}</span></div>
                </div>
                <p className="mt-3 text-sm text-gray-400">Seller payouts, fees, refunds, and disputes are tracked per seller_id instead of one shared owner account.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold">What to do next</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-300">
                  <a href="/listings/create" className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 hover:border-yellow-400/40">
                    <span>Add a new listing</span>
                    <span className="text-yellow-400">→</span>
                  </a>
                  <a href="/dashboard/fees" className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 hover:border-yellow-400/40">
                    <span>Review fee settings</span>
                    <span className="text-yellow-400">→</span>
                  </a>
                  <a href="/live" className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 hover:border-yellow-400/40">
                    <span>Check live show tools</span>
                    <span className="text-yellow-400">→</span>
                  </a>
                  <a href="/dashboard/live-auctions/create" className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3 hover:border-yellow-400/40">
                    <span>Create auction</span>
                    <span className="text-yellow-400">→</span>
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold">Show earnings breakdown</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Revenue per show</span><span>${revenuePerShow.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Average bid value</span><span>${avgBidValue.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between"><span>Buyer retention</span><span>{Math.max(buyerRetention, liveInsights.buyerRetention).toFixed(0)}%</span></div>
                  <div className="flex items-center justify-between"><span>Earnings breakdown</span><span>${earningsBreakdown.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold">Shipping performance</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between"><span>Delivered / shipped</span><span>{shippingPerformance}%</span></div>
                  <div className="flex items-center justify-between"><span>Auto label readiness</span><span>{liveInsights.shippingPerformance}%</span></div>
                  <div className="flex items-center justify-between"><span>Combined shipping</span><span>Enabled</span></div>
                  <div className="flex items-center justify-between"><span>Fraud/trust monitoring</span><span>{showTrustScore >= 80 ? "Healthy" : "Watch"}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "fees" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">Fees & Earnings</div>
                  <h2 className="text-2xl font-black">Your seller fee summary</h2>
                  <p className="mt-2 text-sm text-gray-400">The first {sellerSummary.freeSalesRemaining > 0 ? freeSalesUsed + freeSalesRemaining : sellerSummary.lifetimeSales} completed sales are tracked automatically and fee tiers update as you grow.</p>
                </div>
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-400">
                  Current tier: <span className="font-bold">{sellerSummary.tierName}</span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  { label: "Current marketplace fee", value: formatPercent(sellerSummary.marketplaceFeePercent) },
                  { label: "Free sales remaining", value: sellerSummary.freeSalesRemaining.toString() },
                  { label: "Lifetime sales", value: sellerSummary.lifetimeSales.toString() },
                  { label: "Monthly sales", value: sellerSummary.monthlySales.toString() },
                  { label: "Gross revenue", value: `$${sellerSummary.grossRevenue.toFixed(2)}` },
                  { label: "Marketplace fees paid", value: `$${sellerSummary.marketplaceFeesPaid.toFixed(2)}` },
                  { label: "Payment processing fees", value: `$${sellerSummary.paymentProcessingFees.toFixed(2)}` },
                  { label: "Net earnings", value: `$${sellerSummary.netEarnings.toFixed(2)}` },
                  { label: "Upcoming payouts", value: `$${sellerSummary.upcomingPayouts.toFixed(2)}` },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-[#13131f] p-4">
                    <div className="text-xs uppercase tracking-widest text-gray-500">{metric.label}</div>
                    <div className="mt-2 text-xl font-black">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">Free sales progress</h3>
                  <p className="text-sm text-gray-400">X of 1,000 free sales used</p>
                </div>
                <div className="text-right text-sm text-gray-300">
                  {freeSalesUsed} of {feeConfig.freeSalesLimit} free sales used
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-yellow-400"
                  style={{ width: `${Math.min(100, feeConfig.freeSalesLimit > 0 ? (freeSalesUsed / feeConfig.freeSalesLimit) * 100 : 0)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-gray-400">
                Marketplace fee: 0% for the first {feeConfig.freeSalesLimit} completed sales, then {feeConfig.standardMarketplaceFeePercent}% unless a power seller tier applies.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-bold">Checkout fee preview</h3>
              <p className="mt-1 text-sm text-gray-400">Example on a $100 item sale.</p>
              <div className="mt-4 space-y-2 text-sm">
                {[
                  ["Item subtotal", `$${upcomingFeeExample.itemSubtotal.toFixed(2)}`],
                  ["Shipping", `$${upcomingFeeExample.shipping.toFixed(2)}`],
                  ["Sales tax", `$${upcomingFeeExample.salesTax.toFixed(2)}`],
                  ["Payment processing fee", `$${upcomingFeeExample.paymentProcessingFee.toFixed(2)}`],
                  ["Marketplace fee", `$${upcomingFeeExample.marketplaceFee.toFixed(2)}`],
                  ["Seller payout", `$${upcomingFeeExample.sellerPayout.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#13131f] px-4 py-3">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "listings" && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">My Listings</h2>
              <a href="/listings/create" className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300">+ New Listing</a>
            </div>
            {listings.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <div className="mb-3 text-5xl">🃏</div>
                <p>No listings yet. <a href="/listings/create" className="text-yellow-400 hover:underline">Create your first one.</a></p>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((l) => (
                  <div key={l.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
                      {l.images?.[0] ? <img src={l.images[0]} alt="" className="h-full w-full rounded-xl object-cover" /> : "🃏"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{l.card_name}</p>
                      <p className="text-xs text-gray-400">{l.set_name} · {l.condition}</p>
                    </div>
                    <span className={`rounded-lg border px-2 py-1 text-xs font-medium capitalize`}>{l.status}</span>
                    <span className="font-black text-white">${l.price.toFixed(2)}</span>
                    <div className="flex gap-2">
                      <a href={`/listings/${l.id}`} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white">View</a>
                      <button onClick={() => handleDeleteListing(l.id, l.card_name)} className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:text-red-300">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "purchases" && (
          <div>
            <h2 className="mb-5 text-xl font-bold">My Purchases</h2>
            {purchases.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <div className="mb-3 text-5xl">🛒</div>
                <p>No purchases yet. <a href="/listings" className="text-yellow-400 hover:underline">Browse listings.</a></p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map((o) => (
                  <div key={o.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{o.listings?.card_name ?? "Card"}</p>
                      <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</p>
                      {o.tracking_number && <p className="mt-1 text-xs text-blue-400">Tracking: {o.tracking_number}</p>}
                    </div>
                    <span className={`rounded-lg border px-2 py-1 text-xs font-medium capitalize`}>{o.status}</span>
                    <span className="font-black">${o.total_amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "sales" && (
          <div className="space-y-8">
            <div>
              <h2 className="mb-5 text-xl font-bold">Live Shows ({liveShowCount})</h2>
              {sellerLiveShows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
                  <div className="mb-3 text-4xl">🔔</div>
                  <p>No live shows right now.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sellerLiveShows.map((show) => (
                    <div key={show.id} className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-white">{show.title}</p>
                          <p className="text-xs text-yellow-100">Status: {show.status}</p>
                          <p className="mt-1 text-xs text-yellow-100">Viewers: {show.viewer_count ?? 0}</p>
                          <p className="text-xs text-yellow-100">Show ID: {show.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black" onClick={() => router.push(`/live/${show.id}`)}>
                            Open Room
                          </button>
                          <button className="rounded-xl border border-white/20 px-4 py-2 font-semibold text-white" onClick={() => router.push(`/messages`)}>
                            Message Team
                          </button>
                          <button className="rounded-xl border border-red-400/30 px-4 py-2 font-semibold text-red-200" onClick={() => router.push(`/support`)}>
                            Report Issue
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-5 text-xl font-bold">My Sales</h2>
              {sales.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <div className="mb-3 text-5xl">💰</div>
                  <p>No sales yet. <a href="/listings/create" className="text-yellow-400 hover:underline">Create a listing.</a></p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupByTracking(sales).map((group) => {
                    const first = group.items[0];
                    const total = group.items.reduce((sum, item) => sum + (item.total_amount ?? 0), 0);
                    const tracking = first.tracking_number;
                    return (
                      <div key={group.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{formatGroupTitle(group.items)}</p>
                            <p className="text-xs text-gray-400">
                              {first.profiles?.username ? `Buyer @${first.profiles.username}` : "Buyer"} · {new Date(first.created_at).toLocaleDateString()}
                            </p>
                            {tracking && <p className="mt-1 text-xs text-blue-400">Tracking: {tracking}</p>}
                          </div>
                          <div className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <span className={`rounded-lg border px-2 py-1 text-xs font-medium capitalize`}>{first.status}</span>
                              <span className={`rounded-lg border px-2 py-1 text-xs font-medium capitalize`}>payout {first.payout_status ?? "pending"}</span>
                            </div>
                            <div className="mt-2 font-black text-green-400">+${total.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {group.items.map((item) => (
                            <div key={item.id} className="rounded-xl border border-white/10 bg-[#13131f] p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg">
                                  {item.listings?.images?.[0] ? <img src={item.listings.images[0]} alt="" className="h-full w-full rounded-lg object-cover" /> : "🃏"}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">{item.listings?.card_name ?? "Card"}</p>
                                  <p className="text-xs text-gray-400">${item.total_amount.toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>Shipping, payout, and fulfillment actions are handled through the operations team.</span>
                          <button type="button" onClick={() => void handleCreateUSPSLabel(first.id)} className="rounded-full border border-yellow-400/40 px-3 py-1.5 font-semibold text-yellow-300 transition hover:bg-yellow-400/10 hover:text-yellow-200">
                            Create USPS label
                          </button>
                          <button type="button" onClick={() => void refreshOrders()} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white">
                            Refresh
                          </button>
                        </div>
                        {labelStatus && <div className="mt-2 text-xs text-gray-400">{labelStatus}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-5 text-xl font-bold">Live Show Status</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {sellerLiveShows.slice(0, 3).map((show) => (
                  <div key={show.id} className="rounded-2xl border border-green-400/20 bg-green-400/10 p-4 text-sm text-green-100">
                    <div className="font-black">{show.title}</div>
                    <div>{show.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "live" && (
          <div className="space-y-6 rounded-3xl border border-white/10 bg-[#13131f] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-widest text-yellow-400">Seller live rooms</p>
                <h2 className="mt-1 text-2xl font-black">Manage multiple live shows</h2>
                <p className="mt-2 text-sm text-gray-400">Each show is its own room with its own bids, chat, product queue, and viewers.</p>
              </div>
              <a href="/dashboard/live-auctions/create" className="inline-flex rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300">
                Create Auction
              </a>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <label className="mb-2 block text-sm text-gray-300">Room thumbnail</label>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleLiveShowThumbnailUpload} className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300" />
                    <div className="mt-3 aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f1a]">
                      {liveShowThumbnailUrl ? (
                                      <img src={liveShowThumbnailUrl} alt="Live show thumbnail preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">Upload a thumbnail to show in the room preview</div>
                      )}
                    </div>
                    {liveShowThumbnailUploading && <p className="mt-2 text-xs text-gray-500">Uploading thumbnail...</p>}
                    {liveShowThumbnailError && <p className="mt-2 text-xs text-red-400">{liveShowThumbnailError}</p>}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">Show title</label>
                    <input value={liveShowTitle} onChange={(e) => setLiveShowTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">Start time</label>
                    <input type="datetime-local" value={liveShowStartTime} onChange={(e) => setLiveShowStartTime(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm text-gray-300">Description</label>
                    <textarea value={liveShowDescription} onChange={(e) => setLiveShowDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gray-300"><input type="checkbox" checked={liveShowFeatured} onChange={(e) => setLiveShowFeatured(e.target.checked)} /> Feature room</label>
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gray-300"><input type="checkbox" checked={liveShowAutoModeration} onChange={(e) => setLiveShowAutoModeration(e.target.checked)} /> Auto moderation</label>
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gray-300"><input type="checkbox" checked={liveShowScheduledOnly} onChange={(e) => setLiveShowScheduledOnly(e.target.checked)} /> Scheduled only</label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input value={liveShowCategory} onChange={(e) => setLiveShowCategory(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Category" />
                  <input value={liveShowProductType} onChange={(e) => setLiveShowProductType(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Product type" />
                  <input type="number" min="0" value={liveShowProductsCount} onChange={(e) => setLiveShowProductsCount(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Products" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="number" min="0" value={liveShowPriceFloor} onChange={(e) => setLiveShowPriceFloor(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Price floor" />
                  <input type="number" min="0" value={liveShowPriceCeiling} onChange={(e) => setLiveShowPriceCeiling(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Price ceiling" />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!supabase || !profile || !isSellerVerificationApproved(verificationStatus)) return;
                      const payload = {
                        seller_id: profile.id,
                        title: liveShowTitle,
                        description: liveShowDescription,
                        status: liveShowScheduledOnly ? "scheduled" : "live",
                        auction_state: liveShowScheduledOnly ? "upcoming" : "live",
                        scheduled_start: new Date(liveShowStartTime).toISOString(),
                        viewer_count: 0,
                        host_permissions: ["host", "moderate_chat", "start_auction", "end_auction"],
                        thumbnail: liveShowThumbnailUrl,
                        auction_settings: {
                          category: liveShowCategory,
                          product_type: liveShowProductType,
                          price_floor: liveShowPriceFloor,
                          price_ceiling: liveShowPriceCeiling,
                          featured: liveShowFeatured,
                          auto_moderation: liveShowAutoModeration,
                          queue_mode: liveShowQueueMode,
                          boost: liveShowBoost,
                        },
                      };
                      const { data, error } = await supabase.from("live_shows").insert(payload as any).select("*").single();
                      const createdRoom = data as { id: string; title: string } | null;
                      if (error) {
                        setLiveShowStatusMessage(error.message);
                        return;
                      }
                      setLiveShowStatusMessage(`Created ${createdRoom?.title ?? "live room"}`);
                      const rows = await listLiveShowsBySeller(profile.id);
                      setSellerLiveShows(rows);
                      setActiveLiveShowId(createdRoom?.id ?? rows[0]?.id ?? null);
                    }}
                    disabled={!isSellerVerificationApproved(verificationStatus)}
                    className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black disabled:opacity-50"
                  >
                    {isSellerVerificationApproved(verificationStatus) ? "Create live room" : "Verification required"}
                  </button>
                  <button type="button" onClick={() => setLiveShowStatusMessage("Seller rooms load independently by show_id.")} className="rounded-xl border border-white/20 px-4 py-3 text-gray-300 hover:bg-white/5">
                    Room isolation note
                  </button>
                </div>

                {liveShowStatusMessage && <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">{liveShowStatusMessage}</div>}
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm uppercase tracking-widest text-gray-500">Your rooms</div>
                    <div className="text-lg font-black">{sellerLiveShows.length} total</div>
                  </div>
                  <div className="text-xs text-gray-500">{liveShowsLoading ? "Refreshing..." : "Realtime-ready"}</div>
                </div>

                <input value={liveShowSearch} onChange={(e) => setLiveShowSearch(e.target.value)} placeholder="Search rooms" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />

                <div className="flex flex-wrap gap-2 text-xs">
                  {["all", "live", "scheduled", "ended"].map((state) => (
                    <button key={state} type="button" onClick={() => setLiveShowFilter(state)} className={`rounded-full border px-3 py-1 ${liveShowFilter === state ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-white/10 bg-white/5 text-gray-300"}`}>
                      {state}
                    </button>
                  ))}
                </div>

                <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                  {sellerLiveShows
                    .filter((room) => (liveShowFilter === "all" ? true : room.status === liveShowFilter))
                    .filter((room) => !liveShowSearch || room.title.toLowerCase().includes(liveShowSearch.toLowerCase()) || (room.description ?? "").toLowerCase().includes(liveShowSearch.toLowerCase()))
                    .map((room) => (
                      <div key={room.id} className={`rounded-2xl border p-4 ${activeLiveShowId === room.id ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-[#13131f]"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{room.title}</div>
                            <div className="text-xs text-gray-400">{room.description ?? "No description"}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span>{room.status}</span>
                              <span>•</span>
                              <span>{room.viewer_count} viewers</span>
                              <span>•</span>
                              <span>Peak {room.viewer_count ?? 0}</span>
                            </div>
                          </div>
                          <a href={`/live/${room.id}`} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/5">Open room</a>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button type="button" onClick={() => setActiveLiveShowId(room.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Select</button>
                          <button type="button" onClick={() => setLiveShowRoomMessage(`Room ${room.id} is isolated by show_id and does not share bids, chat, or viewers.`)} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/5">Verify isolation</button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                <div className="font-bold text-white">Room analytics</div>
                <div className="mt-2 space-y-2">
                  <div>Mode: {liveShowAnalyticsMode}</div>
                  <div>Featured rooms: {sellerLiveShows.filter((room) => Boolean((room.auction_settings as any)?.featured)).length}</div>
                  <div>Scheduled rooms: {sellerLiveShows.filter((room) => room.status === "scheduled").length}</div>
                  <div>Live rooms: {sellerLiveShows.filter((room) => room.status === "live").length}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                <div className="font-bold text-white">Moderator management</div>
                <div className="mt-2 space-y-2">
                  <div>Moderators assigned: {liveShowModerators.length}</div>
                  <div>Queue mode: {liveShowQueueMode}</div>
                  <div>Boost enabled: {liveShowBoost ? "Yes" : "No"}</div>
                  <div>Auto moderation: {liveShowAutoModeration ? "On" : "Off"}</div>
                </div>
              </div>
            </div>

            {liveShowRoomMessage && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">{liveShowRoomMessage}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
