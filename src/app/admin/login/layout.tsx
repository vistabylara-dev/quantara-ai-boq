import type { ReactNode } from "react";
import { createPrivateUtilityMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPrivateUtilityMetadata(
  "Quantara Administration Sign In",
  "Private Quantara administration access utility.",
);

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
