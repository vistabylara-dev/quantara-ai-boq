import Link from "next/link";
export const dynamic = "force-dynamic";

export default function Limitations() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#030508] text-slate-900 dark:text-slate-100 p-8 pt-24 max-w-4xl mx-auto">
      <Link href="/" className="text-blue-500 hover:underline mb-8 block">&larr; Back to Home</Link>
      <h1 className="text-4xl font-bold mb-8">Accuracy & Limitations</h1>
      <p className="text-sm text-slate-500 mb-8">Last reviewed: August 5, 2026</p>
      <div className="prose dark:prose-invert max-w-none">
        <p>This is a placeholder for the Accuracy & Limitations page.</p>
        <h2>Source Data Dependency</h2>
        <p>Quantara is an interpretation layer. If your accounting data contains delayed transactions or missing invoices, Quantara's analysis will reflect those limitations.</p>
      </div>
    </div>
  );
}
