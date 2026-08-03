import type { ReactNode } from "react";

export default function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[#D9E2EC] dark:border-[#1E2A42] px-6 py-8 text-center">
      <p className="text-sm text-[#7B879C] dark:text-[#7F8DA6]">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
