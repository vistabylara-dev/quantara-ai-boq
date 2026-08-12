import Link from "next/link";
export const dynamic = "force-dynamic";

export default function Security() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#030508] text-slate-900 dark:text-slate-100 p-8 pt-24 max-w-4xl mx-auto">
      <Link href="/" className="text-blue-500 hover:underline mb-8 block">&larr; Back to Home</Link>
      <h1 className="text-4xl font-bold mb-8">Security & Compliance</h1>
      <p className="text-sm text-slate-500 mb-8">Last reviewed: August 5, 2026</p>
      <div className="prose dark:prose-invert max-w-none">
        <p>Quantara is in Early Access.</p>
        <p>Access to authenticated areas requires user authentication.</p>
        <p>Quantara is designed around least-privilege and read-only integration principles.</p>
        <p>Accounting integrations are not yet available in production.</p>
        <p>Security controls and data-processing documentation will be updated as the product progresses toward general availability.</p>
        <p>Security questions may be submitted through the published contact channel.</p>
      </div>
    </div>
  );
}
