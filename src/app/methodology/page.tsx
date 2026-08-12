import Link from "next/link";
export const dynamic = "force-dynamic";

export default function Methodology() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#030508] text-slate-900 dark:text-slate-100 p-8 pt-24 max-w-4xl mx-auto">
      <Link href="/" className="text-blue-500 hover:underline mb-8 block">&larr; Back to Home</Link>
      <h1 className="text-4xl font-bold mb-8">Methodology</h1>
      <p className="text-sm text-slate-500 mb-8">Last reviewed: August 5, 2026</p>
      <div className="prose dark:prose-invert max-w-none">
        <p>This is a placeholder for the Quantara methodology page.</p>
        <h2>How Changes Are Calculated</h2>
        <p>We normalize reporting periods and calculate variances based strictly on the figures imported from your accounting software.</p>
      </div>
    </div>
  );
}
