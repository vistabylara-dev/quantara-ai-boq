import { createPublicUtilityMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicUtilityMetadata(
  "/forgot-password",
  "Reset a Quantara Password",
  "Request a password reset for an existing Quantara account.",
);

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
