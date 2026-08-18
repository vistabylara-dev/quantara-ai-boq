"use client";

import { useRouter } from "next/navigation";
import SupplierForm from "@/components/suppliers/supplier-form";
import type { Supplier } from "@/types/supplier";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function NewSupplierPage() {
  const router = useRouter();
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{t("suppliers.create.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{t("suppliers.create.title")}</h1>
        <p className="mt-2 text-slate-400">{t("suppliers.create.subtitle")}</p>
      </div>

      <SupplierForm onSaved={(supplier: Supplier) => router.push(`/suppliers/${supplier.id}`)} />
    </div>
  );
}
