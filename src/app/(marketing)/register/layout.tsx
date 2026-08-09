import { createPublicUtilityMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicUtilityMetadata(
  "/register",
  "Request Quantara Controlled Early Access",
  "Submit a request to evaluate Quantara's AI-assisted BOQ workflow software.",
);

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
