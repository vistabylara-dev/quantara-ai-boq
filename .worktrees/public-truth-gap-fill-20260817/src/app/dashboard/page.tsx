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
import ProjectIntelligencePanel from "@/components/dashboard/project-intelligence-panel";
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
import { useTranslations } from "@/lib/i18n/locale-provider";

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
const panel = "cyber-panel cyber-border p-6 sm:p-8 rounded-sm relative overflow-hidden group";
const panelAction =
  "terminal-text text-[10px] uppercase tracking-widest text-blue-600 dark:text-[#00F0FF] border border-blue-500/30 dark:border-[#00F0FF]/30 px-4 py-2 hover:bg-blue-500/10 dark:bg-[#00F0FF]/10 transition-colors bg-blue-500/5 dark:bg-[#00F0FF]/5 hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]";

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
  const t = useTranslations();
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
          <div className="h-4 w-40 rounded bg-[#EAF1F8] dark:bg-[#101D34]" />
          <div className="h-8 w-72 rounded bg-[#EAF1F8] dark:bg-[#101D34]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-24 rounded-3xl bg-[#EAF1F8] dark:bg-[#101D34]" />
            ))}
          </div>
        </div>
        <p className="sr-only">{t("dashboard.loadingWorkspace")}</p>
      </div>
    );
  }

  if (loadError || !metrics || !session?.user || !subscription) {
    return (
      <div className={panel}>
        <p className="terminal-text text-sm font-bold text-red-600 dark:text-[#FF0055] uppercase tracking-widest">{t("dashboard.systemFailure")}</p>
        <p className="mt-2 text-xs terminal-text text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400">{loadError ?? t("dashboard.linkageError")}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-6 border border-red-600 dark:border-[#FF0055]/50 bg-red-500/10 dark:bg-[#FF0055]/10 px-4 py-2 text-[10px] font-bold text-red-600 dark:text-[#FF0055] hover:bg-red-500/20 dark:bg-[#FF0055]/20 terminal-text uppercase tracking-widest transition-colors"
        >
          {t("dashboard.reinitialize")}
        </button>
      </div>
    );
  }

  const planLabel = subscription.planName
    ? `${subscription.planName} · ${formatLabel(subscription.status)}`
    : t("dashboard.noActivePlan");

  const currentProject = projects?.find((project) => project.status !== "ARCHIVED") ?? projects?.[0] ?? null;
  const recentUpdatesCount = (projects ?? []).filter(
    (project) => Date.now() - new Date(project.updatedAt).getTime() < SEVEN_DAYS_MS,
  ).length;

  const lockedBoqCount = (boqs ?? []).filter((boq) => boq.isLocked).length;
  const boqsSupport = boqs && boqs.length > 0 ? `${lockedBoqCount} of ${boqs.length} recent locked` : undefined;
  const completedFilesCount = (files ?? []).filter((file) => file.status === "COMPLETED").length;
  const filesSupport = files && files.length > 0 ? `${completedFilesCount} of ${files.length} recent completed` : undefined;
  const completedDocsCount = (documents ?? []).filter((document) => document.status === "COMPLETED").length;
  const documentsSupport = documents && documents.length > 0 ? `${completedDocsCount} of ${documents.length} recent completed` : undefined;

  const clientColumns: ResponsiveTableColumn<RecentClient>[] = [
    {
      key: "name",
      header: t("dashboard.client"),
      render: (client) => (
        <Link href={`/clients/${client.id}`} className="font-semibold text-[#08152E] hover:underline dark:text-slate-900 dark:text-white">
          {client.name}
        </Link>
      ),
    },
    { key: "contact", header: t("dashboard.contact"), render: (client) => client.contactName },
    { key: "projects", header: t("dashboard.projectsColumn"), render: (client) => client.projectCount },
    {
      key: "lastActivity",
      header: t("dashboard.lastActivity"),
      render: (client) => (client.lastActivityAt ? formatDate(client.lastActivityAt) : t("dashboard.noActivityYet")),
    },
  ];

  return (
    <div className="bg-slate-50 dark:bg-[#030508] text-blue-600 dark:text-[#00F0FF] font-mono flex flex-col relative w-full h-full pb-12 overflow-x-hidden">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00F0FF]/5 via-transparent to-transparent pointer-events-none z-0"></div>

      {/* --- TOP HUD HERO SECTION --- */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.5fr_1fr] gap-6 relative z-10 px-6 pt-6">
        
        {/* LEFT COLUMN: Metrics & Quick Actions */}
        <div className="space-y-6 flex flex-col">
          {/* AI CORE PANEL (Metrics) */}
          <div className="cyber-border cyber-panel p-5 flex flex-col relative overflow-hidden h-[250px]">
            <h2 className="text-blue-600 dark:text-[#00F0FF] text-[10px] uppercase tracking-[0.4em] mb-4 border-b border-blue-500/30 dark:border-[#00F0FF]/30 pb-2">{t("dashboard.coreMetrics")}</h2>
            <div className="grid grid-cols-2 gap-2 flex-1">
               <MetricCard variant="primary" icon={FolderKanban} label={t("dashboard.metricProjects")} value={metrics.activeProjects} />
               <MetricCard variant="primary" icon={FileCheck2} label={t("dashboard.metricBoqs")} value={metrics.totalBoqs} />
               <MetricCard icon={Users} label={t("dashboard.metricClients")} value={metrics.totalClients} />
               <MetricCard icon={UploadCloud} label={t("dashboard.metricFiles")} value={metrics.totalUploadedFiles} />
            </div>
          </div>
          
          {/* QUICK ACTIONS NAV */}
          <div className="cyber-border cyber-panel p-5">
            <h2 className="text-slate-900 dark:text-white text-[10px] uppercase tracking-widest font-bold mb-4 border-b border-blue-500/30 dark:border-[#00F0FF]/30 pb-2">{t("dashboard.systemDirectives")}</h2>
            <nav className="grid grid-cols-2 gap-2">
              <QuickActionButton href="/clients/new" label={t("dashboard.createClient")} icon={Users} />
              <QuickActionButton
                href="/catalogue"
                label={t("dashboard.catalogue")}
                icon={Layers}
                image="/images/dashboard/cyber_catalogue.jpg"
              />
              <QuickActionButton
                href="/suppliers"
                label={t("dashboard.manageSuppliers")}
                icon={Truck}
                image="/images/dashboard/cyber_suppliers.jpg"
              />
              <QuickActionButton href="/templates" label={t("dashboard.templates")} icon={BookOpen} />
            </nav>
          </div>
        </div>

        {/* CENTER COLUMN: The Upload Ring */}
        <div className="flex flex-col items-center justify-center relative py-12 xl:py-0">
          <div className="absolute top-0 text-center w-full z-20">
             <div className="inline-flex items-center gap-4 cyber-border border border-blue-500/30 dark:border-[#00F0FF]/30 bg-blue-500/5 dark:bg-[#00F0FF]/5 px-8 py-2">
                <span className="w-2 h-2 bg-blue-600 dark:bg-[#00F0FF] animate-pulse"></span>
                <h1 className="text-sm text-slate-900 dark:text-white tracking-[0.4em] font-bold uppercase">{t("dashboard.coreHud")}</h1>
                <span className="w-2 h-2 bg-blue-600 dark:bg-[#00F0FF] animate-pulse"></span>
             </div>
          </div>
          
          <Link href="/imports" className="relative group w-72 h-72 sm:w-80 sm:h-80 xl:w-[350px] xl:h-[350px] flex items-center justify-center cursor-pointer mt-12 xl:mt-0">
            <div className="absolute inset-0 rounded-full border-[6px] border-blue-600 dark:border-[#00F0FF]/10 border-t-[#00F0FF] border-b-[#00F0FF] animate-[spin_8s_linear_infinite] group-hover:border-t-[#FF0055] group-hover:border-b-[#FF0055] transition-colors shadow-[0_0_40px_rgba(0,240,255,0.2)] group-hover:shadow-[0_0_60px_rgba(255,0,85,0.4)] z-10"></div>
            <div className="absolute inset-6 rounded-full border-[3px] border-dashed border-blue-500/30 dark:border-[#00F0FF]/30 animate-[spin_15s_linear_infinite_reverse] group-hover:border-red-500/30 dark:border-[#FF0055]/30 z-10"></div>
            <div className="absolute inset-10 rounded-full bg-gradient-to-b from-[#00F0FF]/10 to-transparent blur-xl group-hover:from-[#FF0055]/10 z-0 transition-colors"></div>
            <div className="text-center z-20 relative flex flex-col items-center justify-center bg-slate-100 dark:bg-black/60 w-52 h-52 rounded-full border border-white/5 cyber-border backdrop-blur-sm">
               <Upload className="w-12 h-12 text-blue-600 dark:text-[#00F0FF] mb-3 group-hover:text-red-600 dark:text-[#FF0055] transition-colors group-hover:-translate-y-1 duration-300" />
               <p className="text-slate-900 dark:text-white text-sm font-bold uppercase tracking-widest group-hover:text-red-600 dark:text-[#FF0055] transition-colors">{t("dashboard.dataUplink")}</p>
               <p className="text-blue-600 dark:text-[#00F0FF] text-[9px] uppercase tracking-[0.2em] group-hover:text-slate-900 dark:text-white transition-colors mt-1">{t("dashboard.initializeImport")}</p>
            </div>
          </Link>
        </div>

        {/* RIGHT COLUMN: Terminal & Activity */}
        <div className="space-y-6 flex flex-col h-full">
          {/* TERMINAL LOGS */}
          <div className="cyber-border cyber-panel p-5 flex-1 flex flex-col h-[250px]">
            <div className="flex justify-between items-center border-b border-blue-500/30 dark:border-[#00F0FF]/30 pb-2 mb-4">
               <h2 className="text-blue-600 dark:text-[#00F0FF] text-[10px] uppercase tracking-[0.4em]">{t("dashboard.auditLogs")}</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[9px] text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 terminal-text pr-2">
              {activity && activity.length > 0 ? activity.map((event, i) => (
                <div key={event.id || i} className="flex gap-3 hover:bg-blue-500/10 dark:bg-[#00F0FF]/10 p-1 rounded-sm border-l border-transparent hover:border-blue-600 dark:border-[#00F0FF] transition-colors">
                  <span className="text-blue-600 dark:text-[#00F0FF] shrink-0">{formatDate(event.createdAt)}</span>
                  <span className="text-slate-900 dark:text-white truncate" title={event.action}>{event.action}</span>
                </div>
              )) : (
                <div className="space-y-1">
                  <p className="text-blue-600 dark:text-[#00F0FF]">{t("dashboard.initializeLogStream")}</p>
                  <p className="text-slate-900 dark:text-white">{t("dashboard.awaitingSystemData")}</p>
                </div>
              )}
            </div>
          </div>

          {/* USER ACCOUNT */}
          <div className="cyber-border cyber-panel p-5">
             <h2 className="text-blue-600 dark:text-[#00F0FF] text-[10px] uppercase tracking-[0.4em] mb-4 border-b border-blue-500/30 dark:border-[#00F0FF]/30 pb-2">{t("dashboard.authorization")}</h2>
             <div className="space-y-2 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400">
               <div className="flex justify-between">
                 <span>{t("dashboard.identity")}</span>
                 <span className="text-slate-900 dark:text-white font-bold">{session.user.fullName}</span>
               </div>
               <div className="flex justify-between">
                 <span>{t("dashboard.clearance")}</span>
                 <span className="text-blue-600 dark:text-[#00F0FF] font-bold">{formatLabel(session.user.role)}</span>
               </div>
               <div className="flex justify-between">
                 <span>{t("dashboard.gridAccess")}</span>
                 <span className="text-red-600 dark:text-[#FF0055] font-bold">{planLabel}</span>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* --- BOTTOM GRID SECTION (The actual functional cards) --- */}
      <div className="px-6 mt-12 space-y-8 relative z-10">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-widest border-b border-blue-500/30 dark:border-[#00F0FF]/30 pb-2 flex items-center gap-4">
          <span className="w-3 h-3 bg-blue-600 dark:bg-[#00F0FF]"></span>
          {t("dashboard.neuralWorkspaceData")}
        </h2>

        {/* 1. Active projects */}
        <section className={panel}>
          <SectionHeader
            title={t("dashboard.activeWorkspaces")}
            description={t("dashboard.activeWorkspacesDesc")}
            action={<Link href="/projects" className={panelAction}>{t("dashboard.allProjects")}</Link>}
          />
          {panelErrors.projects ? (
            <PanelError message={panelErrors.projects} />
          ) : !projects ? (
            <LoadingSkeleton rows={3} />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title={t("dashboard.noProjectsYet")}
              message={t("dashboard.createProjectPrompt")}
              action={<Link href="/projects/new" className="text-sm font-semibold text-blue-600 dark:text-[#00F0FF] hover:underline">{t("dashboard.createFirstProject")}</Link>}
            />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          )}
        </section>

        {/* 2. Recent BOQs */}
        <section className={panel}>
          <SectionHeader
            title={t("dashboard.processedBoqs")}
            description={t("dashboard.processedBoqsDesc")}
            action={<Link href="/projects" className={panelAction}>{t("dashboard.allProjects")}</Link>}
          />
          {panelErrors.boqs ? (
            <PanelError message={panelErrors.boqs} />
          ) : !boqs ? (
            <LoadingSkeleton rows={3} />
          ) : boqs.length === 0 ? (
            <EmptyState icon={FileCheck2} title={t("dashboard.noBoqsYet")} message={t("dashboard.openProjectPrompt")} />
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {boqs.map((boq) => <BOQSummaryCard key={boq.id} boq={boq} />)}
            </div>
          )}
        </section>

        {/* 3. Document workspace */}
        <section className={panel}>
          <SectionHeader title={t("dashboard.generatedExports")} description={t("dashboard.generatedExportsDesc")} />
          {panelErrors.documents ? (
            <PanelError message={panelErrors.documents} />
          ) : !documents ? (
            <LoadingSkeleton rows={3} />
          ) : documents.length === 0 ? (
            <EmptyState icon={FileCheck2} title={t("dashboard.noDocumentsYet")} message={t("dashboard.generateDocPrompt")} />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {documents.map((document) => <DocumentCard key={document.id} document={document} />)}
            </div>
          )}
        </section>

        {/* 4. Clients */}
        <section className={panel}>
          <SectionHeader
            title={t("dashboard.authorizedEntities")}
            description={t("dashboard.authorizedEntitiesDesc")}
            action={<Link href="/clients" className={panelAction}>{t("dashboard.allClients")}</Link>}
          />
          {panelErrors.clients ? (
            <PanelError message={panelErrors.clients} />
          ) : !clients ? (
            <LoadingSkeleton rows={3} />
          ) : clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t("dashboard.noClientsYet")}
              message={t("dashboard.addClientPrompt")}
              action={<Link href="/clients/new" className="text-sm font-semibold text-blue-600 dark:text-[#00F0FF] hover:underline">{t("dashboard.addFirstClient")}</Link>}
            />
          ) : (
            <div className="bg-white dark:bg-black/40 border border-blue-600 dark:border-[#00F0FF]/20 rounded-sm">
               <ResponsiveDataTable columns={clientColumns} rows={clients} />
            </div>
          )}
        </section>
      </div>

      {/* --- SUPPORT FOOTER --- */}
      <footer className="mt-16 px-6 relative z-10 w-full">
        <div className="cyber-border cyber-panel p-6 flex flex-col md:flex-row items-center justify-between text-[10px] uppercase tracking-widest text-slate-500 font-mono">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
             <div className="w-2 h-2 bg-blue-600 dark:bg-[#00F0FF] animate-pulse"></div>
             <span className="text-slate-900 dark:text-white font-bold">{t("dashboard.supportNetwork")}</span>
          </div>
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 text-center md:text-left">
            <a href="https://www.vistabylara.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-[#00F0FF] transition-colors">
              WEB: www.vistabylara.com
            </a>
            <a href="mailto:solution@vistabylara.com" className="hover:text-blue-600 dark:hover:text-[#00F0FF] transition-colors">
              COMMS: solution@vistabylara.com
            </a>
            <a href="tel:+971507994292" className="hover:text-blue-600 dark:hover:text-[#00F0FF] transition-colors">
              NODE: +971507994292
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  const t = useTranslations();
  return (
    <div className="mt-4 border border-red-500/30 dark:border-[#FF0055]/30 bg-red-600 dark:bg-[#FF0055]/5 p-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 dark:bg-[#FF0055]"></div>
      <p className="terminal-text text-[10px] text-red-600 dark:text-[#FF0055] uppercase tracking-widest flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        {t("dashboard.systemFailurePrefix", { message })}
      </p>
    </div>
  );
}
