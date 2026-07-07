import type { Metadata } from "next";
import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund Policy for TcgPoké Market.",
};

export default function RefundPolicyPage() {
  return <LegalDocumentPage doc={LEGAL_DOCS["refund-policy"]} />;
}
