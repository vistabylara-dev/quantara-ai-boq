import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Quantara workspace.",
  alternates: {
    canonical: "/login"
  }
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="dark" className="min-h-screen bg-[#030508] text-white">
      {children}
    </div>
  );
}
