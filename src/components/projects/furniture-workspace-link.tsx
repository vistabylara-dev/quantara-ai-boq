"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { FURNITURE_JOINERY_INDUSTRY_KEY } from "@/lib/furniture/types";

export default function FurnitureWorkspaceLink({ projectId }: { projectId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get<{ industryId: string }>(`/api/projects/${encodeURIComponent(projectId)}`, controller.signal)
      .then((project) => setVisible(project.industryId === FURNITURE_JOINERY_INDUSTRY_KEY))
      .catch(() => setVisible(false));
    return () => controller.abort();
  }, [projectId]);

  if (!visible) return null;
  return (
    <Link
      href={`/projects/${encodeURIComponent(projectId)}/furniture`}
      className="rounded-full border border-amber-700 bg-amber-950/40 px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-900/50"
    >
      Furniture / Joinery
    </Link>
  );
}
