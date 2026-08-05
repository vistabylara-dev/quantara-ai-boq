import LegalPlaceholder from "@/components/legal/LegalPlaceholder";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Addendum",
};

export default function DataProcessingPage() {
  return <LegalPlaceholder title="Data Processing Addendum" />;
}
