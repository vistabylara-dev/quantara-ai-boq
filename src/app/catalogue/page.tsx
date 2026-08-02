import Link from "next/link";
import { demoCatalogue } from "@/data/demo-catalogue";
import { formatCurrency } from "@/lib/formatting/currency";

export default function CataloguePage() {
  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Catalogue</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">BOQ catalogue reference</h1>
            <p className="mt-3 text-slate-400">Browse standard catalogue items and source details for project BOQs.</p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            New project
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950">
        <table className="min-w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-6 py-4">Code</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Cost</th>
            </tr>
          </thead>
          <tbody>
            {demoCatalogue.map((item) => (
              <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-900">
                <td className="px-6 py-4 text-white">{item.itemCode}</td>
                <td className="px-6 py-4 text-slate-300">{item.category}</td>
                <td className="px-6 py-4 text-slate-300">{item.description}</td>
                <td className="px-6 py-4 text-slate-300">{item.supplier}</td>
                <td className="px-6 py-4 text-slate-300">{formatCurrency(item.cost, item.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
