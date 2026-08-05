import LegalPlaceholder from "@/components/legal/LegalPlaceholder";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
};

export default function AcceptableUsePage() {
  return <LegalPlaceholder title="Acceptable Use Policy" />;
}
