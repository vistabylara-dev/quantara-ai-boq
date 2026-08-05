import LegalPlaceholder from "@/components/legal/LegalPlaceholder";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return <LegalPlaceholder title="Terms of Service" />;
}
