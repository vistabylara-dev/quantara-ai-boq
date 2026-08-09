import { createPublicUtilityMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicUtilityMetadata(
  "/reset-password",
  "Set a New Quantara Password",
  "Use a valid reset token to set a new password for an existing Quantara account.",
);

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
