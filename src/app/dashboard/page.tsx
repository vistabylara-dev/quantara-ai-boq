"use client";

import {
  AlertTriangle,
  BookOpen,
  Clock,
  FileCheck2,
  FolderKanban,
  Layers,
  ListChecks,
  Truck,
  Upload,
  UploadCloud,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import TrialBanner from "@/components/dashboard/trial-banner";
import WorkspaceHeader from "@/components/dashboard/workspace-header";
import QuickStartWorkspace from "@/components/dashboard/quick-start-workspace";
import ConstructionTimeline from "@/components/dashboard/construction-timeline";
import AIAssistantPanel from "@/components/dashboard/ai-assistant-panel";
import MetricCard from "@/components/dashboard/metric-card";
import SectionHeader from "@/components/dashboard/section-header";
import QuickActionButton from "@/components/dashboard/quick-action-button";
import EmptyState from "@/components/dashboard/empty-state";
import LoadingSkeleton from "@/components/dashboard/loading-skeleton";
import ProjectCard, { type RecentProject } from "@/components/dashboard/project-card";
import BOQSummaryCard, { type RecentBoq } from "@/components/dashboard/boq-summary-card";
import FileStatusCard, { type RecentFile } from "@/components/dashboard/file-status-card";
import DocumentCard, { type RecentDocument } from "@/components/dashboard/document-card";
import ActivityTimeline, { type ActivityEvent } from "@/components/dashboard/activity-timeline";
import ResponsiveDataTable, { type ResponsiveTableColumn } from "@/components/dashboard/responsive-data-table";
import type { StatusTone } from "@/components/dashboard/status-badge";

type SessionData = {
  authenticated: boolean;
  user?: { fullName: string; email: string; role: string };
};

type DashboardMetrics = {
  activeProjects: number;
  totalClients: number;
  totalBoqs: number;
  totalUploadedFiles: number;
  totalGeneratedDocuments: number;
  catalogueItems: number;
  pendingApprovals: number;
  failedOperations: number;
};

type RecentClient = {
  id: string;
  name: string;
  contactName: string;
  email: string | null;
  createdAt: string;
  projectCount: number;
  lastActivityAt: string | null;
};

type SubscriptionSummary = {
  companyName: string | null;
  planName: string | null;
  planType: string | null;
  status: string;
  trialExpiresAt: string | null;
  startsAt: string | null;
  expiresAt: string | null;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const panel = "rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8";

const SUBSCRIPTION_STATUS_TONE: Record<string, StatusTone> = {
  TRIAL: "warning",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "error",
  EXPIRED: "error",
  SUSPENDED: "error",
  NONE: "default",
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DashboardPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [projects, setProjects] = useState<RecentProject[] | null>(null);
  const [boqs, setBoqs] = useState<RecentBoq[] | null>(null);
  const [files, setFiles] = useState<RecentFile[] | null>(null);
  const [documents, setDocuments] = useState<RecentDocument[] | null>(null);
  const [clients, setClients] = useState<RecentClient[] | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sessionData, metricsData, subscriptionData] = await Promise.all([
        apiClient.get<SessionData>("/api/auth/session", signal),
        apiClient.get<DashboardMetrics>("/api/dashboard/metrics", signal),
        apiClient.get<SubscriptionSummary>("/api/dashboard/subscription-summary", signal),
      ]);

      if (!sessionData.authenticated) {
        throw new Error("Your session could not be verified.");
      }

      setSession(sessionData);
      setMetrics(metricsData);
      setSubscription(subscriptionData);

      const nextPanelErrors: Record<string, string> = {};
      const [projectsResult, boqsResult, filesResult, documentsResult, clientsResult, activityResult] =
        await Promise.allSettled([
          apiClient.get<RecentProject[]>("/api/dashboard/recent-projects", signal),
          apiClient.get<RecentBoq[]>("/api/dashboard/recent-boqs", signal),
          apiClient.get<RecentFile[]>("/api/dashboard/recent-files", signal),
          apiClient.get<RecentDocument[]>("/api/dashboard/recent-documents", signal),
          apiClient.get<RecentClient[]>("/api/dashboard/recent-clients", signal),
          apiClient.get<ActivityEvent[]>("/api/dashboard/activity", signal),
        ]);

      if (projectsResult.status === "fulfilled") setProjects(projectsResult.value);
      else nextPanelErrors.projects = getApiErrorMessage(projectsResult.reason);

      if (boqsResult.status === "fulfilled") setBoqs(boqsResult.value);
      else nextPanelErrors.boqs = getApiErrorMessage(boqsResult.reason);

      if (filesResult.status === "fulfilled") setFiles(filesResult.value);
      else nextPanelErrors.files = getApiErrorMessage(filesResult.reason);

      if (documentsResult.status === "fulfilled") setDocuments(documentsResult.value);
      else nextPanelErrors.documents = getApiErrorMessage(documentsResult.reason);

      if (clientsResult.status === "fulfilled") setClients(clientsResult.value);
      else nextPanelErrors.clients = getApiErrorMessage(clientsResult.reason);

      if (activityResult.status === "fulfilled") setActivity(activityResult.value);
      else nextPanelErrors.activity = getApiErrorMessage(activityResult.reason);

      setPanelErrors(nextPanelErrors);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (isLoading && !metrics) {
    return (
      <div className={panel}>
        <div className="animate-pulse space-y-4 motion-reduce:animate-none" aria-live="polite" aria-busy="true">
          <div className="h-4 w-40 rounded bg-[#EEF3F8] dark:bg-[#111D33]" />
          <div className="h-8 w-72 rounded bg-[#EEF3F8] dark:bg-[#111D33]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-24 rounded-3xl bg-[#EEF3F8] dark:bg-[#111D33]" />
            ))}
          </div>
        </div>
        <p className="sr-only">Loading your workspace dashboard.</p>
      </div>
    );
  }

  if (loadError || !metrics || !session?.user || !subscription) {
    return (
      <div className={panel}>
        <p className="text-lg font-semibold text-[#0B1630] dark:text-white">Dashboard unavailable</p>
        <p className="mt-2 text-sm text-[#D84A4A] dark:text-rose-300">{loadError ?? "Your workspace data could not be loaded."}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-6 rounded-2xl border border-[#0EA5E9] dark:border-[#22D3EE] bg-[#0EA5E9] dark:bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-white dark:text-[#050B18] hover:opacity-90"
        >
          Try again
        </button>
      </div>
    );
  }

  const planLabel = subscription.planName
    ? `${subscription.planName} · ${formatLabel(subscription.status)}`
    : "No active plan";

  const currentProject = projects?.find((project) => project.status !== "ARCHIVED") ?? projects?.[0] ?? null;
  const recentUpdatesCount = (projects ?? []).filter(
    (project) => Date.now() - new Date(project.updatedAt).getTime() < SEVEN_DAYS_MS,
  ).length;

  const clientColumns: ResponsiveTableColumn<RecentClient>[] = [
    {
      key: "name",
      header: "Client",
      render: (client) => (
        <Link href={`/clients/${client.id}`} className="font-semibold text-[#0B1630] hover:underline dark:text-white">
          {client.name}
        </Link>
      ),
    },
    { key: "contact", header: "Contact", render: (client) => client.contactName },
    { key: "projects", header: "Projects", render: (client) => client.projectCount },
    {
      key: "lastActivity",
      header: "Last activity",
      render: (client) => (client.lastActivityAt ? formatDate(client.lastActivityAt) : "No activity yet"),
    },
  ];

  return (
    <div className="space-y-6">
      <TrialBanner />

      {/* 1. AI Workspace hero */}
      <WorkspaceHeader
        companyName={subscription.companyName ?? "Your workspace"}
        userName={session.user.fullName}
        userEmail={session.user.email}
        userRole={formatLabel(session.user.role)}
        planLabel={planLabel}
        planTone={SUBSCRIPTION_STATUS_TONE[subscription.status] ?? "default"}
        currentProject={currentProject}
        recentUpdatesCount={recentUpdatesCount}
      />

      {/* KPI cards */}
      <section aria-label="Workspace key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={FolderKanban} label="Active projects" value={metrics.activeProjects} />
        <MetricCard icon={Users} label="Clients" value={metrics.totalClients} />
        <MetricCard icon={FileCheck2} label="BOQs" value={metrics.totalBoqs} />
        <MetricCard icon={UploadCloud} label="Uploaded files" value={metrics.totalUploadedFiles} />
        <MetricCard icon={FileCheck2} label="Generated documents" value={metrics.totalGeneratedDocuments} />
        <MetricCard icon={Layers} label="Catalogue items" value={metrics.catalogueItems} />
        <MetricCard icon={Clock} label="Pending approvals" value={metrics.pendingApprovals} tone={metrics.pendingApprovals > 0 ? "warning" : "default"} />
        <MetricCard icon={AlertTriangle} label="Failed operations" value={metrics.failedOperations} tone={metrics.failedOperations > 0 ? "error" : "default"} />
      </section>

      {/* 2. Quick start workspace */}
      <QuickStartWorkspace currentProjectId={currentProject?.id ?? null} />

      {/* Quick actions */}
      <section aria-label="Quick actions" className={panel}>
        <SectionHeader title="Quick actions" description="Jump straight into common workspace tasks." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionButton href="/clients/new" label="Create Client" icon={Users} />
          <QuickActionButton href="/catalogue" label="Open Catalogue" icon={Layers} />
          <QuickActionButton href="/suppliers" label="Manage Suppliers" icon={Truck} />
          <QuickActionButton href="/templates" label="Browse Templates" icon={BookOpen} />
        </div>
      </section>

      {/* 3. Active projects */}
      <section className={panel}>
        <SectionHeader
          title="My active projects"
          description="Your most recently updated project workspaces."
          action={<Link href="/projects" className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] px-4 py-2 text-sm font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-white dark:hover:bg-[#0B1426]">All projects</Link>}
        />
        {panelErrors.projects ? (
          <PanelError message={panelErrors.projects} />
        ) : !projects ? (
          <LoadingSkeleton rows={3} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            message="Create a project to begin building a BOQ workspace."
            action={<Link href="/projects/new" className="text-sm font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]">Create your first project</Link>}
          />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
        )}
      </section>

      {/* 4. Recent BOQs */}
      <section className={panel}>
        <SectionHeader
          title="Recent BOQs"
          description="Recent bills of quantities and their calculated totals."
          action={<Link href="/projects" className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] px-4 py-2 text-sm font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-white dark:hover:bg-[#0B1426]">All projects</Link>}
        />
        {panelErrors.boqs ? (
          <PanelError message={panelErrors.boqs} />
        ) : !boqs ? (
          <LoadingSkeleton rows={3} />
        ) : boqs.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No BOQs yet" message="Open a project to start building a bill of quantities." />
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {boqs.map((boq) => <BOQSummaryCard key={boq.id} boq={boq} />)}
          </div>
        )}
      </section>

      {/* 5. Document workspace */}
      <section className={panel}>
        <SectionHeader title="Document workspace" description="Recent exports across every project." />
        {panelErrors.documents ? (
          <PanelError message={panelErrors.documents} />
        ) : !documents ? (
          <LoadingSkeleton rows={3} />
        ) : documents.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No documents generated yet" message="Generate a document from a project's BOQ to see it here." />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => <DocumentCard key={document.id} document={document} />)}
          </div>
        )}
      </section>

      {/* 6. Upload center */}
      <section className={panel}>
        <SectionHeader title="Upload center" description="Drawings and source files, ready for extraction." />
        <Link
          href="/imports"
          className="mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#D9E2EC] dark:border-[#1E2A42] px-6 py-10 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0EA5E9]/50 hover:bg-[#EEF3F8] hover:shadow-md dark:hover:border-[#22D3EE]/50 dark:hover:bg-[#111D33] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <Upload className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Drag and drop files, or click to upload</p>
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Drawings, spreadsheets, and specification documents</p>
        </Link>

        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">Recent uploads</p>
        {panelErrors.files ? (
          <PanelError message={panelErrors.files} />
        ) : !files ? (
          <LoadingSkeleton rows={3} />
        ) : files.length === 0 ? (
          <EmptyState icon={UploadCloud} title="No files uploaded yet" message="Upload a drawing or source file to see its processing status here." />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {files.map((file) => <FileStatusCard key={file.id} file={file} />)}
          </div>
        )}
      </section>

      {/* 7. Construction timeline */}
      <ConstructionTimeline
        project={
          currentProject
            ? {
                name: currentProject.name,
                status: currentProject.status,
                fileCount: currentProject.fileCount,
                boqCount: currentProject.boqCount,
                documentCount: currentProject.documentCount,
              }
            : null
        }
      />

      {/* 8. AI workspace (reserved) */}
      <AIAssistantPanel />

      {/* Clients */}
      <section className={panel}>
        <SectionHeader
          title="Clients"
          description="Recently active clients across your projects."
          action={<Link href="/clients" className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] px-4 py-2 text-sm font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-white dark:hover:bg-[#0B1426]">All clients</Link>}
        />
        {panelErrors.clients ? (
          <PanelError message={panelErrors.clients} />
        ) : !clients ? (
          <LoadingSkeleton rows={3} />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clients yet"
            message="Add a client to start a new project."
            action={<Link href="/clients/new" className="text-sm font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]">Add your first client</Link>}
          />
        ) : (
          <ResponsiveDataTable columns={clientColumns} rows={clients} />
        )}
      </section>

      {/* Recent activity + account/subscription */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className={`${panel} lg:col-span-2`}>
          <SectionHeader title="Recent activity" description="Real audit events for your workspace, newest first." />
          {panelErrors.activity ? (
            <PanelError message={panelErrors.activity} />
          ) : !activity ? (
            <LoadingSkeleton rows={4} />
          ) : activity.length === 0 ? (
            <EmptyState icon={ListChecks} title="No recent activity" message="Actions across your workspace will appear here as they happen." />
          ) : (
            <ActivityTimeline events={activity} />
          )}
        </div>
        <div className={panel}>
          <SectionHeader title="Account" description="Your subscription and plan." />
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#536078] dark:text-[#B8C4D8]">Plan</dt>
              <dd className="text-right font-medium text-[#0B1630] dark:text-white">{subscription.planName ?? "None"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#536078] dark:text-[#B8C4D8]">Status</dt>
              <dd className="text-right font-medium text-[#0B1630] dark:text-white">{formatLabel(subscription.status)}</dd>
            </div>
            {subscription.trialExpiresAt && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#536078] dark:text-[#B8C4D8]">Trial ends</dt>
                <dd className="text-right font-medium text-[#0B1630] dark:text-white">{formatDate(subscription.trialExpiresAt)}</dd>
              </div>
            )}
            {subscription.expiresAt && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#536078] dark:text-[#B8C4D8]">Renews / expires</dt>
                <dd className="text-right font-medium text-[#0B1630] dark:text-white">{formatDate(subscription.expiresAt)}</dd>
              </div>
            )}
          </dl>
          <Link
            href="/settings/subscription"
            className="mt-5 inline-flex rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] px-4 py-2 text-sm font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-white dark:hover:bg-[#0B1426]"
          >
            Manage subscription
          </Link>
        </div>
      </section>
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-2xl border border-[#D84A4A]/30 bg-[#D84A4A]/5 px-4 py-3 text-sm text-[#D84A4A] dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
      This panel could not load: {message}
    </p>
  );
}
