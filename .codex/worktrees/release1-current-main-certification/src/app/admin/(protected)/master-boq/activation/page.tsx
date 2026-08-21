import DatasetActivationPanel from "../dataset-activation-panel";

export default function MasterBoqActivationPage() {
  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="rounded-[28px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426] sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">Quantara Platform Administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Catalogue Activation Centre</h1>
        <p className="mt-3 text-sm text-[#536078] dark:text-[#B8C4D8]">
          Owner-only activation pipeline for dataset dry-run, import execution, publication, package assignment, marketplace activation, entitlement testing, and BOQ-search downstream readiness.
        </p>
      </header>
      <DatasetActivationPanel />
    </main>
  );
}
