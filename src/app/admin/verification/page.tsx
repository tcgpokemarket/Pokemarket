import Link from "next/link";
import { sellerVerificationLabel } from "@/lib/seller-verification";

export const revalidate = 0;

const verifications = [] as Array<any>;

export default function AdminVerificationPage() {

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
                    <Link href="/dashboard?tab=admin-verifications" className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-center font-bold text-black">Approve Verification</Link>
                    <Link href="/dashboard?tab=admin-verifications" className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-center font-semibold text-red-200">Reject Verification</Link>
                    <Link href="/dashboard?tab=admin-verifications" className="w-full rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-center font-semibold text-blue-200">Request More Information</Link>
                    <Link href="/dashboard?tab=admin-verifications" className="w-full rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-center font-semibold text-yellow-200">Suspend Verification</Link>
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
