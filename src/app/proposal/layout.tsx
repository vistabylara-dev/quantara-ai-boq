import type { ReactNode } from "react";
import { createPrivateUtilityMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPrivateUtilityMetadata(
  "Shared Quantara Proposal",
  "Private token-based proposal review utility.",
);

export default function ProposalLayout({ children }: { children: ReactNode }) {
  return children;
}
