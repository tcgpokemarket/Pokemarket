import type { Metadata } from "next";
import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "Marketplace Rules",
  description: "Marketplace Rules for TcgPoké Market.",
};

export default function MarketplaceRulesPage() {
  return <LegalDocumentPage doc={LEGAL_DOCS["marketplace-rules"]} />;
}
