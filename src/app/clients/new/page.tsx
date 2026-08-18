"use client";

import { useRouter } from "next/navigation";
import ClientForm from "@/components/clients/client-form";
import type { Client } from "@/types/client";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function NewClientPage() {
  const router = useRouter();
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{t("clients.create.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{t("clients.create.title")}</h1>
          <p className="mt-2 text-slate-400">{t("clients.create.subtitle")}</p>
        </div>

        <ClientForm onCreated={(client: Client) => router.push(`/clients/${client.id}`)} />
      </div>
    </div>
  );
}
