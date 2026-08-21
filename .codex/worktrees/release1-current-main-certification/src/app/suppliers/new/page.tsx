"use client";

import { useRouter } from "next/navigation";
import SupplierForm from "@/components/suppliers/supplier-form";
import type { Supplier } from "@/types/supplier";

export default function NewSupplierPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Create supplier</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">New supplier</h1>
        <p className="mt-2 text-slate-400">Add a supplier to attach to catalogue rates.</p>
      </div>

      <SupplierForm onSaved={(supplier: Supplier) => router.push(`/suppliers/${supplier.id}`)} />
    </div>
  );
}
