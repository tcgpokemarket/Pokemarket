import type { Metadata } from "next";
import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "Seller Agreement",
  description: "Seller Agreement for TcgPoké Market.",
};

export default function SellerAgreementPage() {
  return <LegalDocumentPage doc={LEGAL_DOCS["seller-agreement"]} />;
}
