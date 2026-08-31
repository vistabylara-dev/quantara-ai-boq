"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, projectSchemaType } from "@/lib/validation/project-schema";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";
import ClientPicker from "@/components/projects/client-picker";
import type { Client } from "@/types/client";
import { emitOnboardingActionComplete } from "@/lib/onboarding/onboarding-state";
import { trackFirstConversionEvent } from "@/lib/marketing/conversion-events";
import {
  FURNITURE_DISCIPLINES,
  FURNITURE_JOINERY_INDUSTRY_KEY,
} from "@/lib/furniture/types";

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
  const [industriesLoading, setIndustriesLoading] = useState(true);
  const [industriesError, setIndustriesError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
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
      discipline: undefined,
    },
  });

  const selectedIndustryKey = watch("industryEngineId");
  const requiresFurnitureDiscipline = selectedIndustryKey === FURNITURE_JOINERY_INDUSTRY_KEY;

  // Extracted so the retry button can re-run exactly this without resetting any field the
  // user has already typed (react-hook-form state is untouched by calling this again).
  const loadIndustries = useCallback(() => {
    setIndustriesLoading(true);
    setIndustriesError(null);
    apiClient
      .get<IndustryOption[]>("/api/industries")
      .then((data) => {
        const enabled = data.filter((industry) => industry.enabled);
        setIndustries(enabled);
      })
      .catch((error) => setIndustriesError(getApiErrorMessage(error)))
      .finally(() => setIndustriesLoading(false));
  }, []);

  useEffect(() => {
    loadIndustries();
  }, [loadIndustries]);

  // Default the select to the first available industry only once, the first time the list
  // successfully loads with at least one option — never on a retry, so a value the user already
  // picked (or is mid-typing around) is never silently overwritten.
  const hasDefaultedIndustryRef = useRef(false);
  useEffect(() => {
    if (!hasDefaultedIndustryRef.current && industries[0]) {
      setValue("industryEngineId", industries[0].key);
      hasDefaultedIndustryRef.current = true;
    }
  }, [industries, setValue]);

  useEffect(() => {
    if (!requiresFurnitureDiscipline) {
      setValue("discipline", undefined);
    }
  }, [requiresFurnitureDiscipline, setValue]);

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
        discipline: data.discipline,
        description: data.description ?? "",
        location: data.location,
        currency: data.currency,
        taxRate: data.taxRate,
        language: data.language,
      });
      emitOnboardingActionComplete("PROJECT_CREATED", { projectId: result.project.id });
      emitOnboardingActionComplete("BOQ_PREPARED", { projectId: result.project.id });
      trackFirstConversionEvent("first_project_created", { industry: data.industryEngineId });
      trackFirstConversionEvent("first_boq_created", { source: "project_creation" });
      router.push(`/projects/${encodeURIComponent(result.project.id)}/boq`);
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

        {industriesLoading && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
            Loading industries…
          </div>
        )}
        {!industriesLoading && industriesError && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
            <span>{industriesError}</span>
            <button
              type="button"
              onClick={loadIndustries}
              className="shrink-0 rounded-xl border border-rose-800 bg-rose-950 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900"
            >
              Retry
            </button>
          </div>
        )}
        {!industriesLoading && !industriesError && industries.length === 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-900 bg-amber-950/50 px-4 py-3 text-sm text-amber-300">
            <span>No industry engines are enabled for this company yet. Enable at least one from Industries before creating a project.</span>
            <button
              type="button"
              onClick={loadIndustries}
              className="shrink-0 rounded-xl border border-amber-800 bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900"
            >
              Retry
            </button>
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

          {requiresFurnitureDiscipline && (
            <label className="block text-sm text-slate-300">
              <span className="text-slate-400">Discipline</span>
              <Controller
                control={control}
                name="discipline"
                render={({ field }) => (
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    value={field.value ?? ""}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.value || undefined)}
                    ref={field.ref}
                  >
                    <option value="" disabled>Select a discipline</option>
                    {FURNITURE_DISCIPLINES.map((discipline) => (
                      <option key={discipline.id} value={discipline.id}>{discipline.name}</option>
                    ))}
                  </select>
                )}
              />
              {errors.discipline && <p className="mt-2 text-xs text-rose-400">{errors.discipline.message}</p>}
            </label>
          )}

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
