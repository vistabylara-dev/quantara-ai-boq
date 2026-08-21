"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api/client";

type SimulationStatus = {
  simulation: { mode: string; targetBoqId: string | null; startedAt: string } | null;
};

/**
 * ADMIN-DATA-ACCESS-1 follow-up — a real production incident traced back to
 * this exact gap: the only simulation-active indicator lived on one item
 * detail page, so a platform owner who started Customer Simulation days
 * earlier and forgot to exit it had no way to notice why they were suddenly
 * seeing customer-restricted views everywhere else in the app. This renders
 * globally, on every authenticated page, for as long as the owner's
 * PlatformSimulationSession row exists (it has no automatic expiry).
 *
 * Silently renders nothing for non-owner accounts (a 403 from the owner-only
 * status endpoint is the expected, normal response for every non-owner user
 * — not an error to surface) and for owners with no active simulation.
 */
export default function SimulationStatusBanner() {
  const [status, setStatus] = useState<SimulationStatus | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await apiClient.get<SimulationStatus>("/api/admin/simulation", signal);
      setStatus(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Not a platform owner, or not signed in yet — this banner has nothing to show.
      if (error instanceof ApiClientError) return;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const exitSimulation = useCallback(async () => {
    setIsExiting(true);
    try {
      await apiClient.delete("/api/admin/simulation");
      await load();
    } finally {
      setIsExiting(false);
    }
  }, [load]);

  if (!status?.simulation) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-700 bg-amber-950/60 px-4 py-2.5 text-sm text-amber-200 sm:px-6 xl:px-10">
      <span>
        <strong>CUSTOMER SIMULATION ACTIVE</strong> — viewing as: {status.simulation.mode.replace(/_/g, " ")}
        {status.simulation.startedAt && ` (started ${new Date(status.simulation.startedAt).toLocaleString()})`}
      </span>
      <button
        type="button"
        onClick={() => void exitSimulation()}
        disabled={isExiting}
        className="rounded-xl border border-amber-600 bg-amber-900/60 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
      >
        {isExiting ? "Exiting…" : "Exit Simulation"}
      </button>
    </div>
  );
}
