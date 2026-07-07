import type { Metadata } from "next";
import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "Shipping Policy for TcgPoké Market.",
};

export default function ShippingPolicyPage() {
  return <LegalDocumentPage doc={LEGAL_DOCS["shipping-policy"]} />;
}
