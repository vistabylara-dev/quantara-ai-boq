"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Construction } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type ProviderDetail = { id: string; displayName: string; familyDisplayName: string; status: string; connectionType: string };

const STATUS_EXPLANATION: Record<string, string> = {
  COMING_SOON: "Cloud connection is planned but not built yet. No credentials can be entered here — there is nothing to configure.",
  REQUIRES_PLUGIN: "This provider connects through a desktop add-on, not a browser login. The signed connector download will appear here once it ships.",
  FILE_IMPORT_ONLY: "This provider connects through file upload rather than a live account link. File import is not yet available in this phase.",
};

type PageProps = { params: Promise<{ providerId: string }> };

/**
 * Truthful stub so a "Connect" link never 404s or fakes a working OAuth
 * form — every provider in this phase is COMING_SOON, REQUIRES_PLUGIN, or
 * FILE_IMPORT_ONLY, so this always explains why there is nothing to
 * configure yet rather than pretending a connection can be made.
 */
export default function ConnectProviderPage(props: PageProps) {
  const params = use(props.params);
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await apiClient.get<ProviderDetail>(`/api/integrations/providers/${params.providerId}`, signal);
      setProvider(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, [params.providerId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-6">
      <Link href={`/integrations/${params.providerId}`} className="inline-flex items-center gap-1 text-xs text-[#7B879C] hover:text-[#0B1630] dark:text-[#7F8DA6] dark:hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to provider details
      </Link>

      <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 text-center dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <Construction className="mx-auto h-8 w-8 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
        {loadError && <p className="mt-4 text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>}
        {provider && (
          <>
            <h1 className="mt-4 text-xl font-semibold text-[#0B1630] dark:text-white">
              {provider.displayName} connection is not yet available
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-[#536078] dark:text-[#B8C4D8]">
              {STATUS_EXPLANATION[provider.status] ?? "This connection is not yet available."}
            </p>
          </>
        )}
        <Link
          href="/integrations"
          className="mt-6 inline-flex rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
        >
          Back to Integrations
        </Link>
      </div>
    </div>
  );
}
