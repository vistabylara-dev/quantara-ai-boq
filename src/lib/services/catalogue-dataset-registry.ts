import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { dryRunHvacMasterImport, executeHvacMasterImport } from "@/lib/services/hvac-master-import-service";
import { dryRunPlumbingImport, executePlumbingImport } from "@/lib/services/plumbing-master-import-service";

/**
 * CATALOGUE-CLOSE — registry of owner-triggerable catalogue import datasets.
 * Exists so the platform owner can activate a validated dataset against
 * PRODUCTION by uploading the CSV through an authenticated admin session,
 * without ever handing the production DATABASE_URL to an agent or CI job.
 * The dry-run/execute CLI scripts under prisma/ remain the fast path for
 * local development; this registry is the production path.
 */

export type DatasetImportInput = { uploadedFileName: string; csvText: string };

type DatasetEntry = {
  key: string;
  label: string;
  disciplineKey: string;
  expectedFiles: string[];
  dryRun: (owner: PlatformActor, input: DatasetImportInput) => Promise<unknown>;
  execute: (owner: PlatformActor, input: DatasetImportInput) => Promise<unknown>;
};

const DATASETS: DatasetEntry[] = [
  {
    key: "hvac",
    label: "HVAC / Mechanical",
    disciplineKey: "mechanical",
    expectedFiles: ["hvac-company-library-import.csv", "hvac-air-distribution-company-library-import.csv"],
    dryRun: dryRunHvacMasterImport,
    execute: executeHvacMasterImport,
  },
  {
    key: "plumbing",
    label: "Plumbing",
    disciplineKey: "plumbing",
    expectedFiles: [
      "plumbing-common-plumbing-work-results-company-library-import.csv",
      "plumbing-drainage-specialties-company-library-import.csv",
      "plumbing-fixture-fittings-and-accessories-company-library-import.csv",
      "plumbing-instrumentation-and-controls-company-library-import.csv",
      "plumbing-medical-and-laboratory-systems-company-library-import.csv",
      "plumbing-piping-systems-part1-company-library-import.csv",
      "plumbing-piping-systems-part2-company-library-import.csv",
      "plumbing-piping-systems-part3-company-library-import.csv",
      "plumbing-piping-systems-part4-company-library-import.csv",
      "plumbing-plumbing-equipment-company-library-import.csv",
      "plumbing-plumbing-fixtures-company-library-import.csv",
      "plumbing-pool-and-fountain-plumbing-company-library-import.csv",
      "plumbing-valves-and-piping-specialties-company-library-import.csv",
    ],
    dryRun: dryRunPlumbingImport,
    execute: executePlumbingImport,
  },
];

export function listCatalogueDatasets() {
  return DATASETS.map(({ key, label, disciplineKey, expectedFiles }) => ({ key, label, disciplineKey, expectedFiles }));
}

export function getCatalogueDataset(key: string): DatasetEntry | null {
  return DATASETS.find((d) => d.key === key) ?? null;
}
