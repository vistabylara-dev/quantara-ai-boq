import { Suspense } from "react";
import IntegrationsMarketplace from "./integrations-marketplace";

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsMarketplace />
    </Suspense>
  );
}
