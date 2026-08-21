"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import GoogleDriveConnectPanel from "./google-drive-connect-panel";

type GoogleDriveRuntimeStatus = {
  configured: boolean;
  redirectUri: string | null;
  missingConfiguration: string[];
  connectionStatus: "NOT_CONFIGURED" | "NOT_CONNECTED" | "CONNECTED" | "REAUTH_REQUIRED" | "UNAVAILABLE";
};

export default function GoogleDriveConnectPage() {
  const [runtimeStatus, setRuntimeStatus] = useState<GoogleDriveRuntimeStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await apiClient.get<GoogleDriveRuntimeStatus>("/api/integrations/google-drive/status", signal);
      setRuntimeStatus(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-6">
      <Link href="/integrations/google-drive" className="inline-flex items-center gap-1 text-xs text-[#7B879C] hover:text-[#0B1630] dark:text-[#7F8DA6] dark:hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to provider details
      </Link>

      {loadError && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 text-center dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <p className="text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>
        </div>
      )}

      {runtimeStatus && (
        <Suspense fallback={null}>
          <GoogleDriveConnectPanel runtimeStatus={runtimeStatus} />
        </Suspense>
      )}
    </div>
  );
}
