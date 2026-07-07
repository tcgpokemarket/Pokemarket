import type { Metadata } from "next";
import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "Giveaway Rules",
  description: "Giveaway Rules for TcgPoké Market.",
};

export default function GiveawayRulesPage() {
  return <LegalDocumentPage doc={LEGAL_DOCS["giveaway-rules"]} />;
}
