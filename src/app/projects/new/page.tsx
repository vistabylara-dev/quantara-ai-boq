"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { nanoid } from "nanoid";
import { projectSchema, projectSchemaType } from "@/lib/validation/project-schema";
import { useProjectStore } from "@/store/project-store";
import { demoIndustries } from "@/config/industries";

export default function NewProjectPage() {
  const router = useRouter();
  const { saveProject } = useProjectStore();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<projectSchemaType>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      reference: "",
      name: "",
      clientName: "",
      clientEmail: "",
      location: "",
      industryId: demoIndustries[0]?.id ?? "construction",
      currency: "AED",
      taxRate: 5,
      language: "English",
      description: "",
    },
  });

  useEffect(() => {
    reset();
  }, [reset]);

  const onSubmit = (data: projectSchemaType) => {
    const project = {
      ...data,
      id: `project-${nanoid(8)}`,
      status: "draft" as const,
      currentRevision: "R01",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: data.description ?? "",
    };
    saveProject(project);
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Create project</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">New project workspace</h1>
          <p className="mt-2 text-slate-400">Create a new project using an industry engine and save it locally.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-[32px] border border-slate-800 bg-slate-950 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Project name</span>
              <input className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("name")} />
              {errors.name && <p className="mt-2 text-xs text-rose-400">{errors.name.message}</p>}
            </label>
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Project reference</span>
              <input className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("reference")} />
              {errors.reference && <p className="mt-2 text-xs text-rose-400">{errors.reference.message}</p>}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Client name</span>
              <input className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("clientName")} />
              {errors.clientName && <p className="mt-2 text-xs text-rose-400">{errors.clientName.message}</p>}
            </label>
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Client email</span>
              <input type="email" className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("clientEmail")} />
              {errors.clientEmail && <p className="mt-2 text-xs text-rose-400">{errors.clientEmail.message}</p>}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Location</span>
              <input className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("location")} />
              {errors.location && <p className="mt-2 text-xs text-rose-400">{errors.location.message}</p>}
            </label>
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Industry engine</span>
              <select className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("industryId")}> 
                {demoIndustries.map((industry) => (
                  <option key={industry.id} value={industry.id}>{industry.name}</option>
                ))}
              </select>
              {errors.industryId && <p className="mt-2 text-xs text-rose-400">{errors.industryId.message}</p>}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Currency</span>
              <input className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("currency")} />
              {errors.currency && <p className="mt-2 text-xs text-rose-400">{errors.currency.message}</p>}
            </label>
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Tax rate</span>
              <input type="number" step="0.1" className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("taxRate", { valueAsNumber: true })} />
              {errors.taxRate && <p className="mt-2 text-xs text-rose-400">{errors.taxRate.message}</p>}
            </label>
          </div>

          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">Project description</span>
            <textarea className="mt-2 min-h-[120px] w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("description")} />
            {errors.description && <p className="mt-2 text-xs text-rose-400">{errors.description.message}</p>}
          </label>

          <div className="flex justify-end">
            <button type="submit" className="inline-flex rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
              Save project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
