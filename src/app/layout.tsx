import type { Metadata } from "next";
import type { ReactNode } from "react";
import ConditionalAppShell from "@/components/layout/conditional-app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantara AI BOQ",
  description: "Enterprise quantity intelligence dashboard foundation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#07111F] text-white">
        <ConditionalAppShell>{children}</ConditionalAppShell>
      </body>
    </html>
  );
}
