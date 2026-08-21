import type { BOQTotals } from "@/types/boq";
import { formatCurrency } from "@/lib/formatting/currency";

type BoqSummaryProps = {
  totals: BOQTotals;
  currency: string;
};

export default function BoqSummary({ totals, currency }: BoqSummaryProps) {
  return (
    <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">BOQ summary</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Totals and pricing</h2>
        </div>
        <p className="rounded-3xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
          Currency: {currency}
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Subtotal</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totals.subtotal, currency)}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Discount</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totals.discountAmount, currency)}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Tax</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totals.taxAmount, currency)}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Grand total</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totals.grandTotal, currency)}</p>
        </div>
      </div>
    </section>
  );
}
