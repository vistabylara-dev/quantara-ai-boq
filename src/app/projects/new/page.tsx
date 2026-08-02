"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, projectSchemaType } from "@/lib/validation/project-schema";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";
import ClientPicker from "@/components/projects/client-picker";
import type { Client } from "@/types/client";

type IndustryOption = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
};

type ProjectCreateResult = {
  project: { id: string };
  boq: { id: string };
};

export default function NewProjectPage() {
  const router = useRouter();
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [industriesError, setIndustriesError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<projectSchemaType>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      reference: "",
      name: "",
      clientId: "",
      location: "",
      industryEngineId: "",
      currency: "AED",
      taxRate: 5,
      language: "English",
      description: "",
    },
  });

  useEffect(() => {
    apiClient
      .get<IndustryOption[]>("/api/industries")
      .then((data) => {
        const enabled = data.filter((industry) => industry.enabled);
        setIndustries(enabled);
        if (enabled[0]) setValue("industryEngineId", enabled[0].key);
      })
      .catch((error) => setIndustriesError(getApiErrorMessage(error)));
  }, [setValue]);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setValue("clientId", client.id, { shouldValidate: true });
  };

  const onSubmit = async (data: projectSchemaType) => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await apiClient.post<ProjectCreateResult>("/api/projects", {
        name: data.name,
        reference: data.reference,
        clientId: data.clientId,
        industryId: data.industryEngineId,
        description: data.description ?? "",
        location: data.location,
        currency: data.currency,
        taxRate: data.taxRate,
        language: data.language,
      });
      router.push(`/projects/${result.project.id}`);
    } catch (submitError) {
      setFormError(getApiErrorMessage(submitError));
      if (submitError instanceof ApiClientError && submitError.code === "PROJECT_REFERENCE_EXISTS") {
        setFormError("A project with this reference already exists. Choose a different reference.");
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Create project</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">New project workspace</h1>
          <p className="mt-2 text-slate-400">
            Create a project against an enabled industry engine. A default R01 BOQ with the
            engine&apos;s standard sections is created automatically.
          </p>
        </div>

        {industriesError && (
          <div className="mb-6 rounded-2xl border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
            {industriesError}
          </div>
        )}
        {!industriesError && industries.length === 0 && (
          <div className="mb-6 rounded-2xl border border-amber-900 bg-amber-950/50 px-4 py-3 text-sm text-amber-300">
            No industry engines are enabled for this company yet. Enable at least one from Industries before creating a project.
          </div>
        )}

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
            <div>
              <ClientPicker selectedClient={selectedClient} onSelect={handleClientSelect} />
              {errors.clientId && <p className="mt-2 text-xs text-rose-400">{errors.clientId.message}</p>}
            </div>
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Industry engine</span>
              <Controller
                control={control}
                name="industryEngineId"
                render={({ field }) => (
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    {...field}
                  >
                    <option value="" disabled>Select an industry engine</option>
                    {industries.map((industry) => (
                      <option key={industry.id} value={industry.key}>{industry.name}</option>
                    ))}
                  </select>
                )}
              />
              {errors.industryEngineId && <p className="mt-2 text-xs text-rose-400">{errors.industryEngineId.message}</p>}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Location</span>
              <input className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("location")} />
              {errors.location && <p className="mt-2 text-xs text-rose-400">{errors.location.message}</p>}
            </label>
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Currency</span>
              <input className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("currency")} />
              {errors.currency && <p className="mt-2 text-xs text-rose-400">{errors.currency.message}</p>}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Tax rate (%)</span>
              <input type="number" step="0.1" className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("taxRate", { valueAsNumber: true })} />
              {errors.taxRate && <p className="mt-2 text-xs text-rose-400">{errors.taxRate.message}</p>}
            </label>
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Language</span>
              <input className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("language")} />
              {errors.language && <p className="mt-2 text-xs text-rose-400">{errors.language.message}</p>}
            </label>
          </div>

          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">Project description</span>
            <textarea className="mt-2 min-h-[120px] w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" {...register("description")} />
          </label>

          {formError && (
            <div className="rounded-2xl border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
              {formError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || industries.length === 0}
              className="inline-flex rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {isSubmitting ? "Creating project..." : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
