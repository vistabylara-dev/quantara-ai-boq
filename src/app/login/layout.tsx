import { createPublicUtilityMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicUtilityMetadata(
  "/login",
  "Sign In to Quantara",
  "Sign in to an existing Quantara workspace.",
);

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main data-theme="dark" className="min-h-screen bg-[#030508] text-white">
      {children}
    </main>
  );
}
