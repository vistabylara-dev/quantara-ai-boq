import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-[#08152E] dark:text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#536078] dark:text-[#B8C4D8]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
