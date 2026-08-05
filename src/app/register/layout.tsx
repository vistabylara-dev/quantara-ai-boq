import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register | Quantara",
  description: "Request early access to Quantara.",
  alternates: {
    canonical: "/register"
  }
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
