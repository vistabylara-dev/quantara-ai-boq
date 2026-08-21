import type { ReactNode } from "react";

export type ResponsiveTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

export default function ResponsiveDataTable<T extends { id: string }>({
  columns,
  rows,
}: {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
}) {
  return (
    <>
      <div className="mt-4 hidden overflow-x-auto rounded-3xl border border-[#D5E0EC] dark:border-[#20304D] md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#EAF1F8] dark:bg-[#101D34] text-[#536078] dark:text-[#7F8DA6]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-5 py-3">{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[#08152E] dark:text-[#F4F8FF]">
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[#D5E0EC] dark:border-[#20304D]">
                {columns.map((column) => (
                  <td key={column.key} className="px-5 py-3">{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] p-4">
            <dl className="space-y-2 text-sm">
              {columns.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-3">
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#7B879C] dark:text-[#7F8DA6]">{column.header}</dt>
                  <dd className="text-right font-medium text-[#08152E] dark:text-[#F4F8FF]">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
