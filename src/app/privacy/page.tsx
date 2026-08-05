import LegalPlaceholder from "@/components/legal/LegalPlaceholder";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return <LegalPlaceholder title="Privacy Policy" />;
}
