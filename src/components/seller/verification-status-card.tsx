import Link from "next/link";
import { getAppRole } from "@/lib/security";
import { sellerVerificationLabel, type SellerVerificationStatus } from "@/lib/seller-verification";
import type { User } from "@supabase/supabase-js";

export default function SellerVerificationStatusCard({
  status,
  rejectionReason,
  moreInfo,
  verifiedAt,
  user,
}: {
  status?: SellerVerificationStatus | null;
  rejectionReason?: string | null;
  moreInfo?: string | null;
  verifiedAt?: string | null;
  user?: User | null;
}) {
  const label = sellerVerificationLabel(status ?? "not_started");
  const isAdmin = getAppRole(user) === "admin" || getAppRole(user) === "super_admin";
  const tone =
    status === "approved"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : status === "pending_review"
        ? "border-yellow-400/20 bg-yellow-400/10 text-yellow-300"
        : status === "more_information_required"
          ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
          : status === "suspended"
            ? "border-red-400/20 bg-red-400/10 text-red-300"
            : "border-white/10 bg-white/5 text-gray-300";

  return (
    <div className={`rounded-3xl border p-5 ${tone}`}>
      <div className="text-xs uppercase tracking-[0.3em] opacity-80">Identity verification</div>
      <div className="mt-2 text-xl font-black text-white">{label}</div>
      {verifiedAt && status === "approved" && <div className="mt-2 text-sm text-emerald-200">Approved {new Date(verifiedAt).toLocaleDateString()}</div>}
      {status === "rejected" && rejectionReason && <div className="mt-2 text-sm text-red-200">Reason: {rejectionReason}</div>}
      {status === "more_information_required" && moreInfo && <div className="mt-2 text-sm text-blue-200">Need: {moreInfo}</div>}
      {status !== "approved" && !isAdmin && (
        <Link href="/sell/verification" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-100">
          Complete verification
        </Link>
      )
      }
    </div>
  );
}
