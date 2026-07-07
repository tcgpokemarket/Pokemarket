import type { Metadata } from "next";
import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for TcgPoké Market.",
};

export default function TermsPage() {
  return <LegalDocumentPage doc={LEGAL_DOCS.terms} />;
}
