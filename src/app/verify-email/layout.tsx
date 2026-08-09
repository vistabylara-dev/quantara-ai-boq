import { createPublicUtilityMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicUtilityMetadata(
  "/verify-email",
  "Verify a Quantara Email Address",
  "Verify an email address for an existing Quantara account.",
);

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
