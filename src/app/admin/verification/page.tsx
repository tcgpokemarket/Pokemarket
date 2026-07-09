import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin-access";
import { notFound } from "next/navigation";
import { getPendingSellerVerifications, reviewSellerVerification, sellerVerificationLabel } from "@/lib/seller-verification";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handleReview(formData: FormData) {
  "use server";
  const action = String(formData.get("action") ?? "");
  const verificationId = String(formData.get("verificationId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user) || !verificationId) throw new Error("Unauthorized");

  if (action === "approve") {
    await reviewSellerVerification({ verificationId, reviewerId: user.id, status: "approved", adminNotes: notes });
  }
  if (action === "reject") {
    await reviewSellerVerification({ verificationId, reviewerId: user.id, status: "rejected", rejectionReason: reason ?? "Verification rejected.", adminNotes: notes });
  }
  if (action === "more_info") {
    await reviewSellerVerification({ verificationId, reviewerId: user.id, status: "more_information_required", moreInformationRequest: reason ?? "Additional documents required.", adminNotes: notes });
  }
  if (action === "suspend") {
    await reviewSellerVerification({ verificationId, reviewerId: user.id, status: "suspended", suspensionReason: reason ?? "Suspended pending review.", adminNotes: notes });
  }
}

export default async function AdminVerificationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    notFound();
  }

  const verifications = await getPendingSellerVerifications();

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Admin verification review</p>
          <h1 className="mt-3 text-3xl font-black">Seller identity approvals</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">Review seller identity documents, add notes, and approve or reject access to selling tools, live auctions, and payouts.</p>

          <div className="mt-8 space-y-4">
            {verifications.length ? verifications.map((verification: any) => (
              <div key={verification.id} className="rounded-3xl border border-white/10 bg-[#13131f] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="text-lg font-bold text-white">{verification.legal_name}</div>
                    <div className="text-sm text-gray-400">@{verification.profiles?.username ?? "unknown"} · {verification.profiles?.id ?? verification.user_id}</div>
                    <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">{sellerVerificationLabel(verification.status)}</div>
                    <div className="text-sm text-gray-300">Submitted {verification.submitted_at ? new Date(verification.submitted_at).toLocaleString() : "not submitted yet"}</div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                      <div><span className="text-gray-500">DOB:</span> {verification.date_of_birth}</div>
                      <div className="mt-1"><span className="text-gray-500">Address:</span> {verification.residential_address}</div>
                      <div className="mt-1"><span className="text-gray-500">Phone:</span> {verification.phone_number}</div>
                      <div className="mt-1"><span className="text-gray-500">Notes:</span> {verification.admin_notes ?? "None"}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm lg:w-[28rem]">
                    <form action={handleReview} className="space-y-3">
                      <input type="hidden" name="verificationId" value={verification.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-black">Approve Verification</button>
                    </form>
                    <form action={handleReview} className="space-y-3">
                      <input type="hidden" name="verificationId" value={verification.id} />
                      <input type="hidden" name="action" value="reject" />
                      <textarea name="reason" placeholder="Rejection reason" className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-white outline-none" />
                      <button className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 font-semibold text-red-200">Reject Verification</button>
                    </form>
                    <form action={handleReview} className="space-y-3">
                      <input type="hidden" name="verificationId" value={verification.id} />
                      <input type="hidden" name="action" value="more_info" />
                      <textarea name="reason" placeholder="What more is needed?" className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-white outline-none" />
                      <button className="w-full rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 font-semibold text-blue-200">Request More Information</button>
                    </form>
                    <form action={handleReview} className="space-y-3">
                      <input type="hidden" name="verificationId" value={verification.id} />
                      <input type="hidden" name="action" value="suspend" />
                      <textarea name="reason" placeholder="Suspension reason" className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-white outline-none" />
                      <button className="w-full rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 font-semibold text-yellow-200">Suspend Verification</button>
                    </form>
                  </div>
                </div>
              </div>
            )) : <div className="rounded-3xl border border-white/10 bg-[#13131f] p-8 text-center text-gray-400">No verification requests waiting for review.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
