import { Suspense } from "react";
import IntegrationsHistoryContent from "./history-content";

export default function IntegrationsHistoryPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-[32px] bg-[#EEF3F8] dark:bg-[#111D33]" aria-hidden="true" />}>
      <IntegrationsHistoryContent />
    </Suspense>
  );
}
