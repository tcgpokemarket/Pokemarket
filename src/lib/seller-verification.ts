import { createAdminClient } from "@/lib/supabase/admin";
import { bypassVerificationFor, isAdmin } from "@/lib/security";
import type { User } from "@supabase/supabase-js";

export function isAdminVerifiedUser(user: User | null | undefined) {
  return bypassVerificationFor(user);
}

export function shouldRequireSellerVerification(user: User | null | undefined, status?: SellerVerificationStatus | null) {
  if (isAdmin(user)) return false;
  return !isSellerVerificationApproved(status);
}

export function getEffectiveSellerVerificationStatus(user: User | null | undefined, status?: SellerVerificationStatus | null) {
  if (isAdmin(user)) return "approved" as const;
  return status ?? "not_started";
}

type SellerVerificationStatus = "not_started" | "pending_review" | "approved" | "rejected" | "more_information_required" | "suspended";
export type { SellerVerificationStatus };
export type SellerVerificationDocumentType = string;

type SellerVerificationRow = {
  id: string;
  user_id: string;
  legal_name: string | null;
  date_of_birth: string | null;
  residential_address: string | null;
  phone_number: string | null;
  status: SellerVerificationStatus;
  verified_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_id: string | null;
  rejection_reason: string | null;
  more_information_request: string | null;
  suspension_reason: string | null;
  admin_notes: string | null;
}

type SellerVerificationInsert = {
  user_id: string;
  legal_name: string;
  date_of_birth: string;
  residential_address: string;
  phone_number: string;
  status: SellerVerificationStatus;
  submitted_at: string;
};

type SellerVerificationDocumentInsert = {
  verification_id: string;
  user_id: string;
  document_type: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_name: string | null;
};

type SellerVerificationHistoryInsert = {
  verification_id: string;
  actor_id: string | null;
  action: string;
  previous_status: SellerVerificationStatus | null;
  next_status: SellerVerificationStatus | null;
  notes: string | null;
};

export const SELLER_VERIFICATION_REQUIRED_FOR_SELLING = true;

export function isSellerVerificationApproved(status?: SellerVerificationStatus | null) {
  return status === "approved";
}

export function isSellerVerificationBlocked(status?: SellerVerificationStatus | null) {
  return status === "pending_review" || status === "rejected" || status === "more_information_required" || status === "suspended";
}

export function sellerVerificationLabel(status?: SellerVerificationStatus | null) {
  switch (status ?? "not_started") {
    case "approved":
      return "Verified Seller";
    case "pending_review":
      return "Identity Verification Pending";
    case "rejected":
      return "Verification Rejected";
    case "more_information_required":
      return "More Information Required";
    case "suspended":
      return "Verification Suspended";
    default:
      return "Identity Verification Not Started";
  }
}

export async function getSellerVerificationSummary(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seller_verifications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getSellerVerificationDocuments(verificationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seller_verification_documents")
    .select("*")
    .eq("verification_id", verificationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSellerVerificationHistory(verificationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seller_verification_history")
    .select("*")
    .eq("verification_id", verificationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPendingSellerVerifications() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seller_verifications")
    .select("*, profiles:user_id(id, username, full_name, avatar_url, created_at)")
    .in("status", ["pending_review", "more_information_required", "rejected", "suspended"])
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertSellerVerification(userId: string, payload: {
  legal_name: string;
  date_of_birth: string;
  residential_address: string;
  phone_number: string;
  status?: SellerVerificationStatus;
  submitted_at?: string | null;
}) {
  const admin = createAdminClient();
  const verificationPayload: SellerVerificationInsert = {
    user_id: userId,
    legal_name: payload.legal_name,
    date_of_birth: payload.date_of_birth,
    residential_address: payload.residential_address,
    phone_number: payload.phone_number,
    status: payload.status ?? "pending_review",
    submitted_at: payload.submitted_at ?? new Date().toISOString(),
  };
  const { data, error } = await admin
    .from("seller_verifications")
    .upsert(verificationPayload as never, { onConflict: "user_id" })
    .select("*")
    .single<SellerVerificationRow>();

  if (error) throw new Error(error.message);
  return data;
}

export async function addSellerVerificationDocument(input: {
  verificationId: string;
  userId: string;
  documentType: SellerVerificationDocumentType;
  storageBucket: string;
  storagePath: string;
  mimeType?: string | null;
  fileName?: string | null;
}) {
  const admin = createAdminClient();
  const documentPayload: SellerVerificationDocumentInsert = {
    verification_id: input.verificationId,
    user_id: input.userId,
    document_type: input.documentType,
    storage_bucket: input.storageBucket,
    storage_path: input.storagePath,
    mime_type: input.mimeType ?? null,
    file_name: input.fileName ?? null,
  };
  const { error } = await admin.from("seller_verification_documents").insert(documentPayload as never);

  if (error) throw new Error(error.message);
}

export async function addSellerVerificationHistory(input: {
  verificationId: string;
  actorId?: string | null;
  action: string;
  previousStatus?: SellerVerificationStatus | null;
  nextStatus?: SellerVerificationStatus | null;
  notes?: string | null;
}) {
  const admin = createAdminClient();
  const historyPayload: SellerVerificationHistoryInsert = {
    verification_id: input.verificationId,
    actor_id: input.actorId ?? null,
    action: input.action,
    previous_status: input.previousStatus ?? null,
    next_status: input.nextStatus ?? null,
    notes: input.notes ?? null,
  };
  const { error } = await admin.from("seller_verification_history").insert(historyPayload as never);

  if (error) throw new Error(error.message);
}

function slugifySeller(input: string, fallbackId: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `seller-${fallbackId.slice(0, 8)}`;
}

export async function ensureSellerStorefront(input: { sellerId: string; displayName: string; avatarUrl?: string | null; bannerUrl?: string | null; verified?: boolean }) {
  const admin = createAdminClient();
  const slugBase = slugifySeller(input.displayName, input.sellerId);
  const { data: existing } = await admin
    .from("seller_stores")
    .select("slug")
    .eq("seller_id", input.sellerId)
    .maybeSingle<{ slug: string }>();

  const slug = existing?.slug ?? slugBase;
  const { error } = await (admin as any).from("seller_stores").upsert({
    seller_id: input.sellerId,
    name: input.displayName,
    slug,
    description: null,
    banner_url: input.bannerUrl ?? null,
    logo_url: input.avatarUrl ?? null,
    theme: { accent: "#e22400", secondary: "#ffab01", highlight: "#fefb41" },
    verified: Boolean(input.verified),
    featured: Boolean(input.verified),
  }, { onConflict: "seller_id" });

  if (error) throw new Error(error.message);
  return { slug };
}

export async function reviewSellerVerification(input: {
  verificationId: string;
  reviewerId: string;
  status: Exclude<SellerVerificationStatus, "not_started">;
  rejectionReason?: string | null;
  moreInformationRequest?: string | null;
  suspensionReason?: string | null;
  adminNotes?: string | null;
}) {
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("seller_verifications")
    .select("*, profiles:user_id(id, username, full_name, avatar_url, created_at)")
    .eq("id", input.verificationId)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Verification request not found");
  const currentRow = current as SellerVerificationRow & { profiles?: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } | null };

  const displayName = currentRow.profiles?.full_name ?? currentRow.legal_name ?? currentRow.profiles?.username ?? currentRow.user_id;
  const storeSlug = slugifySeller(currentRow.profiles?.username ?? displayName, currentRow.user_id);

  const nextValue = {
    reviewed_at: new Date().toISOString(),
    reviewer_id: input.reviewerId,
    status: input.status,
    rejection_reason: input.rejectionReason ?? null,
    more_information_request: input.moreInformationRequest ?? null,
    suspension_reason: input.suspensionReason ?? null,
    admin_notes: input.adminNotes ?? null,
    verified_at: input.status === "approved" ? new Date().toISOString() : currentRow.verified_at,
    submitted_at: currentRow.submitted_at ?? new Date().toISOString(),
  };

  const currentStatus = currentRow.status;
  const { error } = await admin
    .from("seller_verifications")
    .update(nextValue as never)
    .eq("id", input.verificationId);

  if (error) throw new Error(error.message);

  if (input.status === "approved") {
    await (admin as any).from("profiles").update({ is_seller: true, verification_status: "approved", verified_at: nextValue.verified_at }).eq("id", currentRow.user_id);
    await ensureSellerStorefront({
      sellerId: currentRow.user_id,
      displayName,
      avatarUrl: currentRow.profiles?.avatar_url ?? null,
      verified: true,
    });
    await (admin as any).from("sellers").upsert({
      id: currentRow.user_id,
      display_name: displayName,
      storefront_slug: storeSlug,
      bio: currentRow.legal_name ? `Seller identity verified for ${currentRow.legal_name}.` : null,
      avatar_url: currentRow.profiles?.avatar_url ?? null,
      banner_url: null,
      verified: true,
      rating: 0,
      follower_count: 0,
      sales_count: 0,
      total_revenue: 0,
      total_listings: 0,
      total_live_shows: 0,
    }, { onConflict: "id" });
  }

  await addSellerVerificationHistory({
    verificationId: input.verificationId,
    actorId: input.reviewerId,
    action: `review.${input.status}`,
    previousStatus: currentStatus,
    nextStatus: input.status,
    notes: input.adminNotes ?? input.rejectionReason ?? input.moreInformationRequest ?? input.suspensionReason ?? null,
  });

  return nextValue;
}
