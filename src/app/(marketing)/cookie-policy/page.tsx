import LegalPlaceholder from "@/components/legal/LegalPlaceholder";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
};

export default function CookiePolicyPage() {
  return <LegalPlaceholder title="Cookie Policy" />;
}
