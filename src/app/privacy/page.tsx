import type { Metadata } from "next";
import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for TcgPoké Market.",
};

export default function PrivacyPage() {
  return <LegalDocumentPage doc={LEGAL_DOCS.privacy} />;
}
