import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request Early Access | Quantara BOQ",
  description: "Request Early Access to Quantara's AI-assisted BOQ and construction-estimating platform.",
  alternates: {
    canonical: "/register"
  },
  openGraph: {
    title: "Request Early Access | Quantara BOQ",
    description: "Request Early Access to Quantara's AI-assisted BOQ and construction-estimating platform.",
    url: "https://quantara.vistabylara.com/register",
    siteName: "Quantara",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
