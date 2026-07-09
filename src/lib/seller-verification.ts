import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type SellerVerificationStatus = Database["public"]["Tables"]["seller_verifications"]["Row"]["status"];
export type SellerVerificationDocumentType = Database["public"]["Tables"]["seller_verification_documents"]["Row"]["document_type"];

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
  const { data, error } = await admin
    .from("seller_verifications")
    .upsert({
      user_id: userId,
      legal_name: payload.legal_name,
      date_of_birth: payload.date_of_birth,
      residential_address: payload.residential_address,
      phone_number: payload.phone_number,
      status: payload.status ?? "pending_review",
      submitted_at: payload.submitted_at ?? new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("*")
    .single();

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
  const { error } = await admin.from("seller_verification_documents").insert({
    verification_id: input.verificationId,
    user_id: input.userId,
    document_type: input.documentType,
    storage_bucket: input.storageBucket,
    storage_path: input.storagePath,
    mime_type: input.mimeType ?? null,
    file_name: input.fileName ?? null,
  });

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
  const { error } = await admin.from("seller_verification_history").insert({
    verification_id: input.verificationId,
    actor_id: input.actorId ?? null,
    action: input.action,
    previous_status: input.previousStatus ?? null,
    next_status: input.nextStatus ?? null,
    notes: input.notes ?? null,
  });

  if (error) throw new Error(error.message);
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
    .select("*")
    .eq("id", input.verificationId)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Verification request not found");

  const nextValue = {
    reviewed_at: new Date().toISOString(),
    reviewer_id: input.reviewerId,
    status: input.status,
    rejection_reason: input.rejectionReason ?? null,
    more_information_request: input.moreInformationRequest ?? null,
    suspension_reason: input.suspensionReason ?? null,
    admin_notes: input.adminNotes ?? null,
    verified_at: input.status === "approved" ? new Date().toISOString() : current.verified_at,
    submitted_at: current.submitted_at ?? new Date().toISOString(),
  };

  const { error } = await admin
    .from("seller_verifications")
    .update(nextValue)
    .eq("id", input.verificationId);

  if (error) throw new Error(error.message);

  await addSellerVerificationHistory({
    verificationId: input.verificationId,
    actorId: input.reviewerId,
    action: `review.${input.status}`,
    previousStatus: current.status,
    nextStatus: input.status,
    notes: input.adminNotes ?? input.rejectionReason ?? input.moreInformationRequest ?? input.suspensionReason ?? null,
  });

  return nextValue;
}
