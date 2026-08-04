"use client";

import {
  Activity,
  AlertTriangle,
  Building2,
  Clock,
  Database,
  FileCheck2,
  FolderKanban,
  HardDrive,
  Mail,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import AdminTestPanel from "./admin-test-panel";

type PlatformRole = "PLATFORM_OWNER" | "PLATFORM_ADMIN" | "PLATFORM_SUPPORT";

type SessionData = {
  authenticated: boolean;
  user?: {
    fullName: string;
    email: string;
    role: string;
    platformRole: PlatformRole | null;
  };
};

type Overview = {
  generatedAt: string;
  metrics: {
    totalCompanies: number;
    activeCompanies: number;
    suspendedCompanies: number;
    trialCompanies: number;
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    platformRoleHolders: number;
    totalProjects: number;
    totalBoqRevisionRecords: number;
    totalClients: number;
    totalUploadedFiles: number;
    totalGeneratedDocuments: number;
    recentRegistrations: number;
    recentCompanies: number;
    activeSoftwareSubscriptionRecords: number;
    trialSoftwareSubscriptionRecords: number;
    suspendedSoftwareSubscriptionRecords: number;
    activeDataPackageEntitlementRecords: number;
    trialDataPackageEntitlementRecords: number;
    suspendedDataPackageEntitlementRecords: number;
  };
  emailDelivery: {
    failedCount: number;
    blockedCount: number | null;
    blockedStatusAvailable: boolean;
  };
  system: {
    database: "healthy";
    applicationEnvironment: "production" | "preview" | "development" | "test" | "unknown";
    storageProvider: "vercel-blob" | "local" | "unconfigured";
    emailProvider: "smtp" | "development";
    deployedVersion: string;
  };
};

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

type SoftwareSubscriptionSummary = {
  id: string;
  status: string;
  planKey: string;
  planName: string;
  planType: string;
  trialExpiresAt: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  source: string;
  updatedAt: string;
};

type CompanySummary = {
  id: string;
  legalName: string;
  tradeName: string | null;
  email: string;
  country: string | null;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  activeUserCount: number;
  projectCount: number;
  boqRevisionCount: number;
  clientCount: number;
  currentSoftwareSubscription: SoftwareSubscriptionSummary | null;
  activeDataPackageEntitlementCount: number;
};

type UserSummary = {
  id: string;
  email: string;
  fullName: string;
  companyRole: string;
  platformRole: PlatformRole | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    legalName: string;
    tradeName: string | null;
  };
};

type SubscriptionSummary = {
  id: string;
  status: string;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  company: { id: string; legalName: string; tradeName: string | null };
  plan: { id: string; key: string; name: string; planType: string; currency: string };
};

type DataPackageSummary = {
  id: string;
  key: string;
  name: string;
  description: string;
  packageType: string;
  version: number;
  configuredItemCount: number;
  linkedItemCount: number;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  status: string;
  isFeatured: boolean;
  discipline: { id: string; key: string; name: string };
  entitlementRecords: {
    total: number;
    active: number;
    trial: number;
    pastDue: number;
    cancelled: number;
    expired: number;
    suspended: number;
  };
  createdAt: string;
  updatedAt: string;
};

type AuditEvent = {
  id: string;
  actorUserId: string | null;
  actorPlatformRole: PlatformRole | null;
  action: string;
  targetType: string;
  targetId: string | null;
  requestMetadata: unknown;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor: { id: string; fullName: string; email: string } | null;
};

type RecentCompany = {
  id: string;
  name: string;
  owner: { fullName: string; email: string } | null;
  createdAt: string;
  status: string;
  userCount: number;
  projectCount: number;
};

type RecentUser = {
  id: string;
  email: string;
  fullName: string;
  companyRole: string;
  platformRole: PlatformRole | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  company: { id: string; legalName: string; tradeName: string | null };
};

type RecentProject = {
  id: string;
  name: string;
  reference: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  company: { id: string; legalName: string; tradeName: string | null };
  boqCount: number;
  fileCount: number;
};

const pageSize = 10;
const platformRoles: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "PLATFORM_SUPPORT",
];

const panel =
  "rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8";
const subtlePanel =
  "rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5";

export default function AdminDashboard() {
  const [viewerRole, setViewerRole] = useState<PlatformRole | null>(null);
  const [viewerName, setViewerName] = useState<string>("");
  const [viewerEmail, setViewerEmail] = useState<string>("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companies, setCompanies] = useState<Paginated<CompanySummary> | null>(null);
  const [users, setUsers] = useState<Paginated<UserSummary> | null>(null);
  const [subscriptions, setSubscriptions] = useState<Paginated<SubscriptionSummary> | null>(null);
  const [dataPackages, setDataPackages] = useState<Paginated<DataPackageSummary> | null>(null);
  const [auditEvents, setAuditEvents] = useState<Paginated<AuditEvent> | null>(null);
  const [recentCompanies, setRecentCompanies] = useState<RecentCompany[] | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[] | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[] | null>(null);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [subscriptionsPage, setSubscriptionsPage] = useState(1);
  const [packagesPage, setPackagesPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({});
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const session = await apiClient.get<SessionData>("/api/auth/session", signal);
      const platformRole = session.user?.platformRole ?? null;
      if (!session.authenticated || !platformRole) {
        throw new Error("Platform access could not be verified.");
      }
      setViewerName(session.user?.fullName ?? "");
      setViewerEmail(session.user?.email ?? "");

      // Core overview and the mandatory tenant/user tables must succeed for
      // the page to render at all; the newer "recent" summary panels are
      // fetched separately below so one failing panel never blanks the rest.
      const [overviewData, companyData, userData, subscriptionData, packageData, auditData] =
        await Promise.all([
          apiClient.get<Overview>("/api/admin/overview", signal),
          apiClient.get<Paginated<CompanySummary>>(
            `/api/admin/companies?page=${companiesPage}&pageSize=${pageSize}`,
            signal,
          ),
          apiClient.get<Paginated<UserSummary>>(
            `/api/admin/users?page=${usersPage}&pageSize=${pageSize}`,
            signal,
          ),
          apiClient.get<Paginated<SubscriptionSummary>>(
            `/api/admin/subscriptions?page=${subscriptionsPage}&pageSize=${pageSize}`,
            signal,
          ),
          apiClient.get<Paginated<DataPackageSummary>>(
            `/api/admin/data-packages?page=${packagesPage}&pageSize=${pageSize}`,
            signal,
          ),
          platformRole === "PLATFORM_OWNER"
            ? apiClient.get<Paginated<AuditEvent>>(
                `/api/admin/audit?page=${auditPage}&pageSize=${pageSize}`,
                signal,
              )
            : Promise.resolve(null),
        ]);

      setViewerRole(platformRole);
      setOverview(overviewData);
      setCompanies(companyData);
      setUsers(userData);
      setSubscriptions(subscriptionData);
      setDataPackages(packageData);
      setAuditEvents(auditData);

      const nextPanelErrors: Record<string, string> = {};
      const [recentCompaniesResult, recentUsersResult, recentProjectsResult] =
        await Promise.allSettled([
          apiClient.get<RecentCompany[]>("/api/admin/recent-companies", signal),
          apiClient.get<RecentUser[]>("/api/admin/recent-users", signal),
          apiClient.get<RecentProject[]>("/api/admin/recent-projects", signal),
        ]);

      if (recentCompaniesResult.status === "fulfilled") {
        setRecentCompanies(recentCompaniesResult.value);
      } else {
        nextPanelErrors.recentCompanies = getApiErrorMessage(recentCompaniesResult.reason);
      }
      if (recentUsersResult.status === "fulfilled") {
        setRecentUsers(recentUsersResult.value);
      } else {
        nextPanelErrors.recentUsers = getApiErrorMessage(recentUsersResult.reason);
      }
      if (recentProjectsResult.status === "fulfilled") {
        setRecentProjects(recentProjectsResult.value);
      } else {
        nextPanelErrors.recentProjects = getApiErrorMessage(recentProjectsResult.reason);
      }
      setPanelErrors(nextPanelErrors);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [auditPage, companiesPage, packagesPage, subscriptionsPage, usersPage]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const updateUserStatus = useCallback(async (user: UserSummary) => {
    const nextStatus = !user.isActive;
    const verb = nextStatus ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${verb} ${user.fullName}?`)) return;

    setActionKey(`status:${user.id}`);
    setActionError(null);
    setActionMessage(null);
    try {
      await patchAdmin(`/api/admin/users/${user.id}/status`, { isActive: nextStatus });
      setActionMessage(`${user.fullName} was ${nextStatus ? "activated" : "deactivated"}.`);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setActionKey(null);
    }
  }, [load]);

  const updatePlatformRole = useCallback(async (user: UserSummary, role: PlatformRole | null) => {
    const roleLabel = role ? formatLabel(role) : "no platform role";
    if (!window.confirm(`Set ${user.fullName} to ${roleLabel}?`)) return;

    setActionKey(`role:${user.id}`);
    setActionError(null);
    setActionMessage(null);
    try {
      await patchAdmin(`/api/admin/users/${user.id}/platform-role`, { platformRole: role });
      setActionMessage(`${user.fullName}'s platform role was updated.`);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setActionKey(null);
    }
  }, [load]);

  if (isLoading && !overview) {
    return (
      <div className={panel}>
        <div className="animate-pulse space-y-4" aria-live="polite" aria-busy="true">
          <div className="h-4 w-40 rounded bg-[#EEF3F8] dark:bg-[#111D33]" />
          <div className="h-8 w-72 rounded bg-[#EEF3F8] dark:bg-[#111D33]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-24 rounded-3xl bg-[#EEF3F8] dark:bg-[#111D33]" />
            ))}
          </div>
        </div>
        <p className="sr-only">Loading platform administration dashboard.</p>
      </div>
    );
  }

  if (loadError || !overview || !companies || !users || !subscriptions || !dataPackages || !viewerRole) {
    return (
      <div className={panel}>
        <p className="text-lg font-semibold text-[#0B1630] dark:text-white">Platform administration unavailable</p>
        <p className="mt-2 text-sm text-[#D84A4A] dark:text-rose-300">{loadError ?? "Protected platform data could not be loaded."}</p>
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

  const isOwner = viewerRole === "PLATFORM_OWNER";
  const canChangeStatus = viewerRole === "PLATFORM_OWNER" || viewerRole === "PLATFORM_ADMIN";
  const companyTotal = Math.max(overview.metrics.totalCompanies, 1);

  return (
    <div className="space-y-6">
      {/* Command header */}
      <header className="rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white/90 dark:bg-[#0B1426]/90 backdrop-blur-sm p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 dark:border-[#22D3EE]/40 bg-[#0EA5E9]/10 dark:bg-[#22D3EE]/10">
              <ShieldCheck className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">Quantara Platform Administration</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Command Center</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Environment" value={formatLabel(overview.system.applicationEnvironment)} tone="info" />
            <StatusPill label="Database" value="Healthy" tone="success" pulse />
            <StatusPill label="Blob" value={overview.system.storageProvider === "vercel-blob" ? "Configured" : "Not configured"} tone={overview.system.storageProvider === "vercel-blob" ? "success" : "warning"} />
            <StatusPill label="Email" value={overview.system.emailProvider === "smtp" ? "SMTP" : "Dev mode"} tone={overview.system.emailProvider === "smtp" ? "success" : "warning"} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#D9E2EC] dark:border-[#1E2A42] pt-4 text-sm">
          <p className="text-[#536078] dark:text-[#B8C4D8]">
            Signed in as <span className="font-semibold text-[#0B1630] dark:text-white">{viewerName || viewerEmail}</span>
            <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{formatLabel(viewerRole)}</span>
          </p>
          <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
            <QuickActionLink href="#companies-panel" label="Companies" />
            <QuickActionLink href="#users-panel" label="Users" />
            <QuickActionLink href="#projects-panel" label="Projects" />
            {isOwner && <QuickActionLink href="#audit-panel" label="Audit" />}
            <QuickActionLink href="#system-health-panel" label="System status" />
            {isOwner && <QuickActionLink href="#test-panel" label="Test panel" />}
            {isOwner && <QuickActionLink href="/admin/master-boq" label="Master BOQ" />}
            {isOwner && <QuickActionLink href="/integrations" label="Integrations" />}
          </nav>
        </div>
        <p className="mt-3 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
          Build {overview.system.deployedVersion} · Generated {formatDateTime(overview.generatedAt)}
        </p>
      </header>

      {(actionMessage || actionError) && (
        <div className={`rounded-2xl border p-4 text-sm ${actionError ? "border-[#D84A4A]/40 bg-[#D84A4A]/10 text-[#D84A4A] dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300" : "border-[#159A6A]/40 bg-[#159A6A]/10 text-[#159A6A] dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
          {actionError ?? actionMessage}
        </div>
      )}

      {isOwner && <AdminTestPanel />}

      {/* KPI cards */}
      <section aria-label="Platform key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Building2} label="Companies" value={overview.metrics.totalCompanies} support={`${overview.metrics.activeCompanies} active`} />
        <KpiCard icon={Users} label="Users" value={overview.metrics.totalUsers} support={`${overview.metrics.activeUsers} active`} />
        <KpiCard icon={FolderKanban} label="Projects" value={overview.metrics.totalProjects} support={`${overview.metrics.totalClients} clients`} />
        <KpiCard icon={FileCheck2} label="BOQs" value={overview.metrics.totalBoqRevisionRecords} support="revision records" />
        <KpiCard icon={UploadCloud} label="Uploaded files" value={overview.metrics.totalUploadedFiles} support="project files" />
        <KpiCard icon={FileCheck2} label="Generated documents" value={overview.metrics.totalGeneratedDocuments} support="all companies" />
        <KpiCard icon={Clock} label="Trials" value={overview.metrics.trialCompanies} support="companies on trial" />
        <KpiCard icon={AlertTriangle} label="Failed operations" value={overview.emailDelivery.failedCount} support="failed email deliveries" tone={overview.emailDelivery.failedCount > 0 ? "warning" : "default"} />
      </section>

      {/* Platform overview + system health */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className={`${panel} lg:col-span-2`}>
          <SectionTitle title="Platform overview" description="Real aggregates across every company." />
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <ProportionMeter
              title="Company status"
              segments={[
                { label: "Active", value: overview.metrics.activeCompanies, colorClass: "bg-[#14B8A6] dark:bg-[#2DD4BF]" },
                { label: "Trial", value: overview.metrics.trialCompanies, colorClass: "bg-[#D6A84B] dark:bg-[#E0B25C]" },
                { label: "Suspended", value: overview.metrics.suspendedCompanies, colorClass: "bg-[#D84A4A] dark:bg-[#F87171]" },
              ]}
              total={companyTotal}
            />
            <ProportionMeter
              title="User activity"
              segments={[
                { label: "Active", value: overview.metrics.activeUsers, colorClass: "bg-[#0EA5E9] dark:bg-[#22D3EE]" },
                { label: "Inactive", value: overview.metrics.inactiveUsers, colorClass: "bg-[#7B879C] dark:bg-[#7F8DA6]" },
              ]}
              total={Math.max(overview.metrics.totalUsers, 1)}
            />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <MiniStat label="Platform administrators" value={overview.metrics.platformRoleHolders} />
            <MiniStat label="New companies (7d)" value={overview.metrics.recentCompanies} />
            <MiniStat label="New registrations (7d)" value={overview.metrics.recentRegistrations} />
          </div>
        </div>
        <div id="system-health-panel" className={panel}>
          <SectionTitle title="System health" description="Live configuration status, never a connectivity probe." />
          <div className="mt-6 space-y-3">
            <HealthRow icon={Database} label="Database" status="Healthy" tone="success" />
            <HealthRow icon={Activity} label="Readiness" status="Ready" tone="success" />
            <HealthRow
              icon={HardDrive}
              label="Storage"
              status={overview.system.storageProvider === "vercel-blob" ? "Configured" : overview.system.storageProvider === "local" ? "Local (dev only)" : "Not configured"}
              tone={overview.system.storageProvider === "vercel-blob" ? "success" : "warning"}
            />
            <HealthRow
              icon={Mail}
              label="Email provider"
              status={overview.system.emailProvider === "smtp" ? "SMTP configured" : "Development mode"}
              tone={overview.system.emailProvider === "smtp" ? "success" : "warning"}
            />
            <HealthRow icon={ShieldCheck} label="Environment" status={formatLabel(overview.system.applicationEnvironment)} tone="info" />
          </div>
        </div>
      </section>

      {/* Storage + email truthful panels */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className={subtlePanel}>
          <SectionTitle title="Storage" description="Private Vercel Blob infrastructure." />
          <dl className="mt-4 space-y-2 text-sm">
            <DetailRow term="Selected provider" detail={overview.system.storageProvider === "vercel-blob" ? "Vercel Blob" : overview.system.storageProvider === "local" ? "Local filesystem (dev)" : "Not configured"} />
            <DetailRow term="Uploaded project files" detail={String(overview.metrics.totalUploadedFiles)} />
            <DetailRow term="Generated documents" detail={String(overview.metrics.totalGeneratedDocuments)} />
            <DetailRow
              term="Route integration"
              detail={overview.system.storageProvider === "vercel-blob"
                ? "Blob infrastructure connected. Application route migration pending."
                : "Not yet available"}
            />
          </dl>
        </div>
        <div className={subtlePanel}>
          <SectionTitle title="Email delivery" description="Transactional email, verification and reset flows." />
          <dl className="mt-4 space-y-2 text-sm">
            <DetailRow term="Provider" detail={overview.system.emailProvider === "smtp" ? "SMTP" : "Development (console log only)"} />
            <DetailRow term="Verification email" detail="Operational (routed through the active provider)" />
            <DetailRow term="Password-reset email" detail="Operational (routed through the active provider)" />
            <DetailRow term="Failed proposal-email deliveries" detail={String(overview.emailDelivery.failedCount)} />
            <DetailRow
              term="Blocked deliveries"
              detail={overview.emailDelivery.blockedStatusAvailable && overview.emailDelivery.blockedCount !== null
                ? String(overview.emailDelivery.blockedCount)
                : "Not yet available"}
            />
          </dl>
        </div>
      </section>

      {/* Recent companies / users */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className={panel}>
          <SectionTitle title="Recent companies" description="Newest registrations, most recent first." />
          {panelErrors.recentCompanies ? (
            <PanelError message={panelErrors.recentCompanies} />
          ) : !recentCompanies ? (
            <SkeletonRows count={5} />
          ) : recentCompanies.length === 0 ? (
            <EmptyPanel message="No companies found." />
          ) : (
            <ul className="mt-4 divide-y divide-[#D9E2EC] dark:divide-[#1E2A42]">
              {recentCompanies.map((company) => (
                <li key={company.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-[#0B1630] dark:text-white">{company.name}</p>
                    <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">
                      {company.owner ? `${company.owner.fullName} · ${company.owner.email}` : "No owner on record"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[#536078] dark:text-[#B8C4D8]">
                    <p>{formatLabel(company.status)} · {formatDate(company.createdAt)}</p>
                    <p className="text-[#7B879C] dark:text-[#7F8DA6]">{company.userCount} users · {company.projectCount} projects</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={panel}>
          <SectionTitle title="Recent users" description="Newest accounts, most recent first." />
          {panelErrors.recentUsers ? (
            <PanelError message={panelErrors.recentUsers} />
          ) : !recentUsers ? (
            <SkeletonRows count={5} />
          ) : recentUsers.length === 0 ? (
            <EmptyPanel message="No users found." />
          ) : (
            <ul className="mt-4 divide-y divide-[#D9E2EC] dark:divide-[#1E2A42]">
              {recentUsers.map((user) => (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-[#0B1630] dark:text-white">{user.fullName}</p>
                    <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{user.email} · {user.company.tradeName || user.company.legalName}</p>
                  </div>
                  <div className="text-right text-xs text-[#536078] dark:text-[#B8C4D8]">
                    <p>{formatLabel(user.companyRole)}{user.platformRole ? ` · ${formatLabel(user.platformRole)}` : ""}</p>
                    <p className={user.isActive ? "text-[#159A6A] dark:text-emerald-300" : "text-[#D84A4A] dark:text-rose-300"}>
                      {user.isActive ? "Active" : "Inactive"} · {user.emailVerifiedAt ? "Verified" : "Unverified"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Recent projects */}
      <section id="projects-panel" className={panel}>
        <SectionTitle title="Recent projects" description="Newest projects across every company." />
        {panelErrors.recentProjects ? (
          <PanelError message={panelErrors.recentProjects} />
        ) : !recentProjects ? (
          <SkeletonRows count={5} />
        ) : recentProjects.length === 0 ? (
          <EmptyPanel message="No projects found." />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#EEF3F8] dark:bg-[#111D33] text-[#536078] dark:text-[#7F8DA6]">
                <tr>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">BOQs / files</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
                {recentProjects.map((project) => (
                  <tr key={project.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                    <td className="px-5 py-3">
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{project.reference}</p>
                    </td>
                    <td className="px-5 py-3 text-[#536078] dark:text-[#B8C4D8]">{project.company.tradeName || project.company.legalName}</td>
                    <td className="px-5 py-3">{formatLabel(project.status)}</td>
                    <td className="px-5 py-3">{project.boqCount} / {project.fileCount}</td>
                    <td className="px-5 py-3 text-[#7B879C] dark:text-[#7F8DA6]">{formatDate(project.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Existing full management tables */}
      <section id="companies-panel" className={panel}>
        <SectionTitle title="Companies" description="Company-level usage and current entitlement records." />
        <div className="mt-6 overflow-x-auto rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#EEF3F8] dark:bg-[#111D33] text-[#536078] dark:text-[#7F8DA6]">
              <tr>
                <th className="px-5 py-4">Company</th>
                <th className="px-5 py-4">Users</th>
                <th className="px-5 py-4">Projects / BOQs / clients</th>
                <th className="px-5 py-4">Software subscription</th>
                <th className="px-5 py-4">Data packages</th>
              </tr>
            </thead>
            <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
              {companies.items.map((company) => (
                <tr key={company.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                  <td className="px-5 py-4">
                    <p className="font-semibold">{company.tradeName || company.legalName}</p>
                    <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{company.email} / {company.country ?? "Country not recorded"} / {company.defaultCurrency}</p>
                  </td>
                  <td className="px-5 py-4">{company.activeUserCount} active / {company.userCount} total</td>
                  <td className="px-5 py-4">{company.projectCount} / {company.boqRevisionCount} / {company.clientCount}</td>
                  <td className="px-5 py-4">
                    {company.currentSoftwareSubscription ? (
                      <>
                        <p>{company.currentSoftwareSubscription.planName}</p>
                        <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{formatLabel(company.currentSoftwareSubscription.status)}</p>
                      </>
                    ) : "None"}
                  </td>
                  <td className="px-5 py-4">{company.activeDataPackageEntitlementCount} active</td>
                </tr>
              ))}
              {companies.items.length === 0 && <EmptyRow columns={5} message="No companies found." />}
            </tbody>
          </table>
        </div>
        <Pagination data={companies} onPage={setCompaniesPage} />
      </section>

      <section id="users-panel" className={panel}>
        <SectionTitle title="Users" description="Company roles remain separate from platform access." />
        <div className="mt-6 overflow-x-auto rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#EEF3F8] dark:bg-[#111D33] text-[#536078] dark:text-[#7F8DA6]">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Company</th>
                <th className="px-5 py-4">Company role</th>
                <th className="px-5 py-4">Platform role</th>
                <th className="px-5 py-4">Status</th>
                {(canChangeStatus || isOwner) && <th className="px-5 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
              {users.items.map((user) => {
                const adminMayChangeStatus =
                  viewerRole === "PLATFORM_ADMIN" &&
                  user.platformRole !== "PLATFORM_OWNER" &&
                  user.platformRole !== "PLATFORM_ADMIN";
                return (
                  <tr key={user.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{user.fullName}</p>
                      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{user.email}</p>
                    </td>
                    <td className="px-5 py-4">{user.company.tradeName || user.company.legalName}</td>
                    <td className="px-5 py-4">{formatLabel(user.companyRole)}</td>
                    <td className="px-5 py-4">
                      {isOwner ? (
                        <select
                          aria-label={`Platform role for ${user.fullName}`}
                          value={user.platformRole ?? ""}
                          onChange={(event) => void updatePlatformRole(user, (event.target.value || null) as PlatformRole | null)}
                          disabled={actionKey === `role:${user.id}`}
                          className="rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-2 text-xs text-[#0B1630] dark:text-[#F7FAFC] disabled:opacity-60"
                        >
                          <option value="">No platform role</option>
                          {platformRoles.map((role) => <option key={role} value={role}>{formatLabel(role)}</option>)}
                        </select>
                      ) : user.platformRole ? formatLabel(user.platformRole) : "None"}
                    </td>
                    <td className="px-5 py-4">
                      <p className={user.isActive ? "text-[#159A6A] dark:text-emerald-300" : "text-[#D84A4A] dark:text-rose-300"}>{user.isActive ? "Active" : "Inactive"}</p>
                      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{user.emailVerifiedAt ? "Verified" : "Unverified"}</p>
                    </td>
                    {(canChangeStatus || isOwner) && (
                      <td className="px-5 py-4">
                        {(isOwner || adminMayChangeStatus) ? (
                          <button
                            type="button"
                            onClick={() => void updateUserStatus(user)}
                            disabled={actionKey === `status:${user.id}`}
                            className="rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-2 text-xs font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33] disabled:opacity-60"
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        ) : <span className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Owner access required</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
              {users.items.length === 0 && <EmptyRow columns={canChangeStatus || isOwner ? 6 : 5} message="No users found." />}
            </tbody>
          </table>
        </div>
        <Pagination data={users} onPage={setUsersPage} />
      </section>

      <section className={panel}>
        <SectionTitle title="Software subscriptions" description="Recorded software subscription history across companies." />
        <div className="mt-6 overflow-x-auto rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#EEF3F8] dark:bg-[#111D33] text-[#536078] dark:text-[#7F8DA6]"><tr><th className="px-5 py-4">Company</th><th className="px-5 py-4">Plan</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Period</th><th className="px-5 py-4">Source</th></tr></thead>
            <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
              {subscriptions.items.map((subscription) => (
                <tr key={subscription.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                  <td className="px-5 py-4">{subscription.company.tradeName || subscription.company.legalName}</td>
                  <td className="px-5 py-4"><p>{subscription.plan.name}</p><p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{formatLabel(subscription.plan.planType)}</p></td>
                  <td className="px-5 py-4">{formatLabel(subscription.status)}</td>
                  <td className="px-5 py-4">{dateRange(subscription.startsAt ?? subscription.trialStartedAt, subscription.expiresAt ?? subscription.trialExpiresAt)}</td>
                  <td className="px-5 py-4">{subscription.source}</td>
                </tr>
              ))}
              {subscriptions.items.length === 0 && <EmptyRow columns={5} message="No software subscription records found." />}
            </tbody>
          </table>
        </div>
        <Pagination data={subscriptions} onPage={setSubscriptionsPage} />
      </section>

      <section className={panel}>
        <SectionTitle title="Data packages" description="Configured packages and their entitlement record counts." />
        <div className="mt-6 overflow-x-auto rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#EEF3F8] dark:bg-[#111D33] text-[#536078] dark:text-[#7F8DA6]"><tr><th className="px-5 py-4">Package</th><th className="px-5 py-4">Discipline</th><th className="px-5 py-4">Items</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Entitlements</th></tr></thead>
            <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
              {dataPackages.items.map((pkg) => (
                <tr key={pkg.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                  <td className="px-5 py-4"><p className="font-semibold">{pkg.name}</p><p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{formatLabel(pkg.packageType)} / version {pkg.version}</p></td>
                  <td className="px-5 py-4">{pkg.discipline.name}</td>
                  <td className="px-5 py-4">{pkg.linkedItemCount} linked / {pkg.configuredItemCount} configured</td>
                  <td className="px-5 py-4">{formatLabel(pkg.status)}</td>
                  <td className="px-5 py-4"><p>{pkg.entitlementRecords.active} active / {pkg.entitlementRecords.total} total</p><p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{pkg.entitlementRecords.trial} trial / {pkg.entitlementRecords.suspended} suspended</p></td>
                </tr>
              ))}
              {dataPackages.items.length === 0 && <EmptyRow columns={5} message="No data packages found." />}
            </tbody>
          </table>
        </div>
        <Pagination data={dataPackages} onPage={setPackagesPage} />
      </section>

      {isOwner && auditEvents && (
        <section id="audit-panel" className={panel}>
          <SectionTitle title="Audit timeline" description="Owner-only platform administration activity, newest first." />
          <ol className="mt-6 space-y-4">
            {auditEvents.items.map((event) => (
              <li key={event.id} className="relative border-l-2 border-[#0EA5E9]/30 dark:border-[#22D3EE]/30 pl-5">
                <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#0EA5E9] dark:bg-[#22D3EE]" aria-hidden="true" />
                <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{formatDateTime(event.createdAt)}</p>
                <p className="text-sm font-semibold text-[#0B1630] dark:text-white">{formatLabel(event.action)}</p>
                <p className="text-xs text-[#536078] dark:text-[#B8C4D8]">
                  {event.actor?.fullName ?? "System"}{event.actorPlatformRole ? ` (${formatLabel(event.actorPlatformRole)})` : ""} · {formatLabel(event.targetType)}{event.targetId ? ` ${shortId(event.targetId)}` : ""}
                </p>
              </li>
            ))}
            {auditEvents.items.length === 0 && (
              <li className="py-6 text-center text-sm text-[#7B879C] dark:text-[#7F8DA6]">No platform audit events found.</li>
            )}
          </ol>
          <Pagination data={auditEvents} onPage={setAuditPage} />
        </section>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  support,
  tone = "default",
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  support: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="group rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-5 transition-shadow hover:shadow-[0_0_0_1px_rgba(14,165,233,0.25)] dark:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25)]">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{label}</p>
        <Icon
          className={`h-4 w-4 ${tone === "warning" ? "text-[#D98A16] dark:text-[#FBBF24]" : "text-[#0284C7] dark:text-[#22D3EE]"}`}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 text-3xl font-semibold text-[#0B1630] dark:text-white">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">{support}</p>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
  pulse = false,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "info";
  pulse?: boolean;
}) {
  const toneClasses = {
    success: "border-[#159A6A]/30 bg-[#159A6A]/10 text-[#159A6A] dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
    warning: "border-[#D98A16]/30 bg-[#D98A16]/10 text-[#D98A16] dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
    info: "border-[#0EA5E9]/30 bg-[#0EA5E9]/10 text-[#0284C7] dark:border-[#22D3EE]/30 dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]",
  } as const;
  const dotClasses = {
    success: "bg-[#159A6A] dark:bg-emerald-400",
    warning: "bg-[#D98A16] dark:bg-amber-400",
    info: "bg-[#0EA5E9] dark:bg-[#22D3EE]",
  } as const;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClasses[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]} ${pulse ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
      {label}: {value}
    </span>
  );
}

function HealthRow({
  icon: Icon,
  label,
  status,
  tone,
}: {
  icon: typeof Database;
  label: string;
  status: string;
  tone: "success" | "warning" | "info";
}) {
  const textTone = {
    success: "text-[#159A6A] dark:text-emerald-300",
    warning: "text-[#D98A16] dark:text-amber-300",
    info: "text-[#0284C7] dark:text-[#22D3EE]",
  } as const;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] px-4 py-3 text-sm">
      <span className="flex items-center gap-2 text-[#0B1630] dark:text-[#F7FAFC]">
        <Icon className="h-4 w-4 text-[#536078] dark:text-[#7F8DA6]" aria-hidden="true" />
        {label}
      </span>
      <span className={`font-semibold ${textTone[tone]}`}>{status}</span>
    </div>
  );
}

function ProportionMeter({
  title,
  segments,
  total,
}: {
  title: string;
  segments: Array<{ label: string; value: number; colorClass: string }>;
  total: number;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#0B1630] dark:text-white">{title}</p>
      <div
        className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[#EEF3F8] dark:bg-[#111D33]"
        role="img"
        aria-label={segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")}
      >
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={segment.colorClass}
            style={{ width: `${Math.min(100, (segment.value / total) * 100)}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-xs text-[#536078] dark:text-[#B8C4D8]">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${segment.colorClass}`} aria-hidden="true" />
              {segment.label}
            </span>
            <span className="font-medium text-[#0B1630] dark:text-white">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[#7B879C] dark:text-[#7F8DA6]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#0B1630] dark:text-white">{value}</p>
    </div>
  );
}

function DetailRow({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#536078] dark:text-[#B8C4D8]">{term}</dt>
      <dd className="text-right font-medium text-[#0B1630] dark:text-white">{detail}</dd>
    </div>
  );
}

function QuickActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-full border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-1.5 text-xs font-medium text-[#0B1630] dark:text-[#F7FAFC] transition hover:border-[#0EA5E9] dark:hover:border-[#22D3EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#22D3EE]"
    >
      {label}
    </a>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="mt-4 animate-pulse space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-10 rounded-xl bg-[#EEF3F8] dark:bg-[#111D33]" />
      ))}
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <p className="mt-6 py-6 text-center text-sm text-[#7B879C] dark:text-[#7F8DA6]">{message}</p>;
}

function PanelError({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-2xl border border-[#D84A4A]/30 bg-[#D84A4A]/5 px-4 py-3 text-sm text-[#D84A4A] dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
      This panel could not load: {message}
    </p>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-xl font-semibold text-[#0B1630] dark:text-white">{title}</h2><p className="mt-1 text-sm text-[#536078] dark:text-[#B8C4D8]">{description}</p></div>;
}

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return <tr><td colSpan={columns} className="px-5 py-10 text-center text-[#7B879C] dark:text-[#7F8DA6]">{message}</td></tr>;
}

function Pagination<T>({ data, onPage }: { data: Paginated<T>; onPage: (page: number) => void }) {
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
      <p>Page {data.page} of {lastPage} / {data.total} records</p>
      <div className="flex gap-2">
        <button type="button" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)} className="rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-2 text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33] disabled:opacity-40">Previous</button>
        <button type="button" disabled={data.page >= lastPage} onClick={() => onPage(data.page + 1)} className="rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-2 text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33] disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

async function patchAdmin(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; error?: { message?: string } } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? "The platform update could not be completed.");
  }
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "No dates recorded";
  return `${start ? formatDate(start) : "No start"} - ${end ? formatDate(end) : "No expiry"}`;
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}
