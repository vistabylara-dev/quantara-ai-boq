import type { ReactNode } from "react";
import { createPrivateUtilityMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPrivateUtilityMetadata(
  "Shared Quantara Technical Report",
  "Private token-based technical-report review utility.",
);

export default function TechnicalReportLayout({ children }: { children: ReactNode }) {
  return children;
}
