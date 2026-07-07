import type { Metadata } from "next";
import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "DMCA Policy",
  description: "DMCA and copyright policy for TcgPoké Market.",
};

export default function DmcaPage() {
  return <LegalDocumentPage doc={LEGAL_DOCS.dmca} />;
}
