"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SellerVerificationStatusCard from "@/components/seller/verification-status-card";
import { sellerVerificationLabel, type SellerVerificationStatus } from "@/lib/seller-verification";
import { uploadVerificationDocumentFile } from "@/lib/uploads";

type VerificationForm = {
  legal_name: string;
  date_of_birth: string;
  residential_address: string;
  phone_number: string;
  rejectionReason?: string | null;
  moreInfo?: string | null;
  verifiedAt?: string | null;
};

type UploadField = "id-front" | "id-back" | "selfie" | "address-proof";

const DOCUMENT_FIELDS: Array<{ key: UploadField; label: string; helper: string; required?: boolean }> = [
  { key: "id-front", label: "Government ID front", helper: "Upload a clear photo of the front of your ID.", required: true },
  { key: "id-back", label: "Government ID back", helper: "If your ID has information on the back, upload that too." },
  { key: "selfie", label: "Selfie holding the ID", helper: "Face and ID should both be visible in the same photo.", required: true },
  { key: "address-proof", label: "Proof of address", helper: "Utility bill or bank statement, if requested." },
];

export default function SellerVerificationPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [status, setStatus] = useState<SellerVerificationStatus | null>(null);
  const [form, setForm] = useState<VerificationForm>({
    legal_name: "",
    date_of_birth: "",
    residential_address: "",
    phone_number: "",
    rejectionReason: null,
    moreInfo: null,
    verifiedAt: null,
  });
  const [uploads, setUploads] = useState<Record<UploadField, string | null>>({
    "id-front": null,
    "id-back": null,
    selfie: null,
    "address-proof": null,
  });

  useEffect(() => {
    const client = createClient();
    setSupabase(client);

    const init = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        router.push("/auth?redirectTo=/sell/verification");
        return;
      }

      const [{ data: verification }, { data: profileData }] = await Promise.all([
        client.from("seller_verifications").select("*").eq("user_id", user.id).maybeSingle(),
        client.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      const profile = profileData as { full_name?: string | null } | null;

      const currentVerification = verification as {
        id: string;
        status: SellerVerificationStatus;
        legal_name: string | null;
        date_of_birth: string | null;
        residential_address: string | null;
        phone_number: string | null;
        rejection_reason: string | null;
        more_information_request: string | null;
        verified_at: string | null;
      } | null;

      if (currentVerification) {
        setVerificationId(currentVerification.id);
        setStatus(currentVerification.status);
        setForm((current) => ({
          ...current,
          legal_name: currentVerification.legal_name ?? profile?.full_name ?? "",
          date_of_birth: currentVerification.date_of_birth ?? "",
          residential_address: currentVerification.residential_address ?? "",
          phone_number: currentVerification.phone_number ?? "",
          rejectionReason: currentVerification.rejection_reason,
          moreInfo: currentVerification.more_information_request,
          verifiedAt: currentVerification.verified_at,
        }));

        const { data: docs } = await client
          .from("seller_verification_documents")
          .select("document_type, storage_path")
          .eq("verification_id", currentVerification.id);
        const verificationDocs = (docs ?? []) as Array<{ document_type: UploadField; storage_path: string }>;

        const nextUploads = { ...uploads };
        for (const doc of verificationDocs) {
          nextUploads[doc.document_type] = doc.storage_path;
        }
        setUploads(nextUploads);
      } else if (profile?.full_name) {
        setForm((current) => ({ ...current, legal_name: profile.full_name ?? "" }));
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const label = useMemo(() => sellerVerificationLabel(status ?? "not_started"), [status]);

  const updateField = (field: keyof VerificationForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleUpload = async (field: UploadField, file?: File | null) => {
    if (!file || !supabase) return;
    setUploadingField(field);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");

      const uploaded = await uploadVerificationDocumentFile({
        supabase,
        ownerId: user.id,
        file,
        prefix: field,
      });

      const verification = verificationId ?? (await (async () => {
        const verificationPayload = {
          user_id: user.id,
          legal_name: form.legal_name || user.user_metadata?.full_name || "",
          date_of_birth: form.date_of_birth || "2000-01-01",
          residential_address: form.residential_address || "",
          phone_number: form.phone_number || "",
          status: status ?? "not_started",
        };
        const { data, error } = await supabase
          .from("seller_verifications")
          .upsert(verificationPayload as never, { onConflict: "user_id" })
          .select("id")
          .single<{ id: string }>();
        if (error) throw error;
        return data?.id as string;
      })());

      setVerificationId(verification);
      const documentPayload = {
        verification_id: verification,
        user_id: user.id,
        document_type: field,
        storage_bucket: uploaded.bucket,
        storage_path: uploaded.path,
        mime_type: uploaded.mimeType,
        file_name: uploaded.fileName,
      };
      const { error } = await supabase.from("seller_verification_documents").upsert(documentPayload as never, { onConflict: "verification_id,document_type" });
      if (error) throw error;

      setUploads((current) => ({ ...current, [field]: uploaded.path }));
      setMessage({ type: "success", text: `${DOCUMENT_FIELDS.find((item) => item.key === field)?.label ?? "File"} uploaded.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to upload file." });
    } finally {
      setUploadingField(null);
    }
  };

  const submitVerification = async () => {
    if (!supabase) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");

      const requiredFiles = [uploads["id-front"], uploads.selfie];
      if (requiredFiles.some((item) => !item)) {
        throw new Error("Please upload the required identity documents.");
      }

      const submitPayload = {
        user_id: user.id,
        legal_name: form.legal_name,
        date_of_birth: form.date_of_birth,
        residential_address: form.residential_address,
        phone_number: form.phone_number,
        status: "pending_review",
        submitted_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("seller_verifications").upsert(submitPayload as never, { onConflict: "user_id" }).select("id, status").single<{ id: string; status: SellerVerificationStatus }>();
      if (error) throw error;

      setVerificationId(data?.id ?? verificationId);
      setStatus("pending_review");
      setMessage({ type: "success", text: "Verification submitted for review." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to submit verification." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-center text-gray-400">Loading verification...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Seller identity verification</p>
          <h1 className="mt-3 text-3xl font-black">Complete verification to unlock selling</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">Anyone can buy. Selling, live auctions, payouts, and seller tools open after an admin approves your identity check.</p>

          <div className="mt-6">
            <SellerVerificationStatusCard status={status} rejectionReason={form.rejectionReason} moreInfo={form.moreInfo} verifiedAt={form.verifiedAt} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4 rounded-3xl border border-white/10 bg-[#13131f] p-5">
              <h2 className="text-lg font-bold">Your details</h2>
              <label className="block text-sm text-gray-300">
                Full legal name
                <input value={form.legal_name} onChange={(e) => updateField("legal_name", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
              </label>
              <label className="block text-sm text-gray-300">
                Date of birth
                <input type="date" value={form.date_of_birth} onChange={(e) => updateField("date_of_birth", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
              </label>
              <label className="block text-sm text-gray-300">
                Residential address
                <textarea value={form.residential_address} onChange={(e) => updateField("residential_address", e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
              </label>
              <label className="block text-sm text-gray-300">
                Phone number
                <input value={form.phone_number} onChange={(e) => updateField("phone_number", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" />
              </label>
            </div>

            <div className="space-y-4 rounded-3xl border border-white/10 bg-[#13131f] p-5">
              <h2 className="text-lg font-bold">Upload documents</h2>
              <div className="space-y-4">
                {DOCUMENT_FIELDS.map((field) => (
                  <label key={field.key} className="block rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                    <div className="font-semibold text-white">{field.label}{field.required ? " *" : ""}</div>
                    <p className="mt-1 text-xs text-gray-400">{field.helper}</p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => void handleUpload(field.key, e.target.files?.[0] ?? null)}
                      className="mt-3 block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-yellow-300"
                    />
                    {uploads[field.key] && <div className="mt-2 text-xs text-emerald-300">Uploaded</div>}
                    {uploadingField === field.key && <div className="mt-2 text-xs text-gray-500">Uploading...</div>}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {message && <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`}>{message.text}</div>}

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={submitVerification} disabled={submitting || status === "approved"} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black disabled:opacity-50">
              {submitting ? "Submitting..." : status === "rejected" || status === "more_information_required" ? "Resubmit for review" : "Submit for admin review"}
            </button>
            <button onClick={() => router.push("/sell")} className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-white hover:bg-white/5">
              Back to sell page
            </button>
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.3em] text-gray-500">Current state · {label}</div>
        </div>
      </div>
    </div>
  );
}
