import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Sales | Quantara BOQ",
  description: "Contact the Quantara team for information about the AI-assisted BOQ and construction-estimating platform.",
  alternates: {
    canonical: "/contact-sales"
  },
  openGraph: {
    title: "Contact Sales | Quantara BOQ",
    description: "Contact the Quantara team for information about the AI-assisted BOQ and construction-estimating platform.",
    url: "https://quantara.vistabylara.com/contact-sales",
    siteName: "Quantara",
  },
};

export default function ContactSalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
