import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Sales | Quantara",
  description: "Contact the Quantara team.",
  alternates: {
    canonical: "/contact-sales"
  }
};

export default function ContactSalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
