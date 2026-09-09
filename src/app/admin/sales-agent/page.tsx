"use client";

import { useEffect, useState } from "react";

type Status = {
  aiReady: boolean;
  pricingReviewExpires: string;
  budget: { period: string; reservedFils: number; maximumFils: number };
  inquiries: Array<{ id: string; firstName: string; lastName: string; workEmail: string; useCase: string; createdAt: string; deliveryStatus: string }>;
};

export default function SalesAgentOwnerPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/sales-agent", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { ok: boolean; data: Status; error?: { message: string } };
        if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Unable to load sales status.");
        setStatus(body.data);
      }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);
  return (
    <section className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Sales pilot and enquiries</h1>
      {error && <p role="alert">{error}</p>}
      {!status && !error && <p role="status">Loading…</p>}
      {status && <>
        <p>AI: {status.aiReady ? "Ready" : "Disabled or awaiting configuration"}. Outbound discovery and automatic emails are not active.</p>
        <p>{status.budget.period}: AED {(status.budget.reservedFils / 100).toFixed(2)} reserved of AED {(status.budget.maximumFils / 100).toFixed(2)}. Reservations are conservative allowances, not billed usage.</p>
        <p>Pricing review required before {status.pricingReviewExpires.slice(0, 10)}.</p>
        <h2 className="text-xl font-semibold">Latest contact requests</h2>
        <p>These requests were stored by Quantara. Stored does not mean an email was delivered or a sale completed.</p>
        {!status.inquiries.length && <p>No stored enquiries.</p>}
        {status.inquiries.map((inquiry) => <article key={inquiry.id} className="rounded-xl border p-4">
          <h3 className="font-semibold">{inquiry.firstName} {inquiry.lastName}</h3>
          <p>{inquiry.workEmail} · {inquiry.createdAt.slice(0, 10)} · {inquiry.deliveryStatus}</p>
          <p className="mt-2 whitespace-pre-wrap break-words">{inquiry.useCase}</p>
        </article>)}
      </>}
    </section>
  );
}
