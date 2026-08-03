"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

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
    activeUsers: number;
    inactiveUsers: number;
    totalProjects: number;
    totalBoqRevisionRecords: number;
    totalClients: number;
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

const pageSize = 10;
const platformRoles: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "PLATFORM_SUPPORT",
];

export default function AdminDashboard() {
  const [viewerRole, setViewerRole] = useState<PlatformRole | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companies, setCompanies] = useState<Paginated<CompanySummary> | null>(null);
  const [users, setUsers] = useState<Paginated<UserSummary> | null>(null);
  const [subscriptions, setSubscriptions] = useState<Paginated<SubscriptionSummary> | null>(null);
  const [dataPackages, setDataPackages] = useState<Paginated<DataPackageSummary> | null>(null);
  const [auditEvents, setAuditEvents] = useState<Paginated<AuditEvent> | null>(null);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [subscriptionsPage, setSubscriptionsPage] = useState(1);
  const [packagesPage, setPackagesPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading platform administration</p>
        <p className="mt-2 text-sm text-slate-400">Reading protected platform records.</p>
      </div>
    );
  }

  if (loadError || !overview || !companies || !users || !subscriptions || !dataPackages || !viewerRole) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Platform administration unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "Protected platform data could not be loaded."}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Try again
        </button>
      </div>
    );
  }

  const isOwner = viewerRole === "PLATFORM_OWNER";
  const canChangeStatus = viewerRole === "PLATFORM_OWNER" || viewerRole === "PLATFORM_ADMIN";

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Platform Admin</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">SaaS operations overview</h1>
            <p className="mt-3 text-sm text-slate-400">
              Cross-company records are available only through protected platform APIs.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Access</p>
            <p className="mt-1 font-semibold text-white">{formatLabel(viewerRole)}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Companies" value={overview.metrics.totalCompanies} />
          <MetricCard label="Active users" value={overview.metrics.activeUsers} />
          <MetricCard label="Inactive users" value={overview.metrics.inactiveUsers} />
          <MetricCard label="Projects" value={overview.metrics.totalProjects} />
          <MetricCard label="BOQ revision records" value={overview.metrics.totalBoqRevisionRecords} />
          <MetricCard label="Clients" value={overview.metrics.totalClients} />
          <MetricCard label="Active software subscriptions" value={overview.metrics.activeSoftwareSubscriptionRecords} />
          <MetricCard label="Trial software subscriptions" value={overview.metrics.trialSoftwareSubscriptionRecords} />
          <MetricCard label="Suspended software subscriptions" value={overview.metrics.suspendedSoftwareSubscriptionRecords} />
          <MetricCard label="Active package entitlements" value={overview.metrics.activeDataPackageEntitlementRecords} />
          <MetricCard label="Trial package entitlements" value={overview.metrics.trialDataPackageEntitlementRecords} />
          <MetricCard label="Suspended package entitlements" value={overview.metrics.suspendedDataPackageEntitlementRecords} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard label="Database" value={overview.system.database} />
          <StatusCard label="Environment" value={overview.system.applicationEnvironment} />
          <StatusCard label="Failed email deliveries" value={String(overview.emailDelivery.failedCount)} />
          <StatusCard
            label="Blocked email deliveries"
            value={overview.emailDelivery.blockedStatusAvailable && overview.emailDelivery.blockedCount !== null
              ? String(overview.emailDelivery.blockedCount)
              : "Not tracked"}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NotImplementedCard label="Storage status" note="Durable object storage has not been implemented yet." />
          <NotImplementedCard label="Background jobs" note="A durable background job queue has not been implemented yet." />
        </div>
        <p className="mt-4 text-xs text-slate-500">Generated {formatDateTime(overview.generatedAt)}</p>
      </section>

      {(actionMessage || actionError) && (
        <div className={`rounded-2xl border p-4 text-sm ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
          {actionError ?? actionMessage}
        </div>
      )}

      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <SectionTitle title="Companies" description="Company-level usage and current entitlement records." />
        <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-5 py-4">Company</th>
                <th className="px-5 py-4">Users</th>
                <th className="px-5 py-4">Projects / BOQs / clients</th>
                <th className="px-5 py-4">Software subscription</th>
                <th className="px-5 py-4">Data packages</th>
              </tr>
            </thead>
            <tbody>
              {companies.items.map((company) => (
                <tr key={company.id} className="border-t border-slate-800">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-white">{company.tradeName || company.legalName}</p>
                    <p className="text-xs text-slate-500">{company.email} / {company.country ?? "Country not recorded"} / {company.defaultCurrency}</p>
                  </td>
                  <td className="px-5 py-4">{company.activeUserCount} active / {company.userCount} total</td>
                  <td className="px-5 py-4">{company.projectCount} / {company.boqRevisionCount} / {company.clientCount}</td>
                  <td className="px-5 py-4">
                    {company.currentSoftwareSubscription ? (
                      <>
                        <p className="text-white">{company.currentSoftwareSubscription.planName}</p>
                        <p className="text-xs text-slate-500">{formatLabel(company.currentSoftwareSubscription.status)}</p>
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

      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <SectionTitle title="Users" description="Company roles remain separate from platform access." />
        <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Company</th>
                <th className="px-5 py-4">Company role</th>
                <th className="px-5 py-4">Platform role</th>
                <th className="px-5 py-4">Status</th>
                {(canChangeStatus || isOwner) && <th className="px-5 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.items.map((user) => {
                const adminMayChangeStatus =
                  viewerRole === "PLATFORM_ADMIN" &&
                  user.platformRole !== "PLATFORM_OWNER" &&
                  user.platformRole !== "PLATFORM_ADMIN";
                return (
                  <tr key={user.id} className="border-t border-slate-800">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{user.fullName}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
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
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
                        >
                          <option value="">No platform role</option>
                          {platformRoles.map((role) => <option key={role} value={role}>{formatLabel(role)}</option>)}
                        </select>
                      ) : user.platformRole ? formatLabel(user.platformRole) : "None"}
                    </td>
                    <td className="px-5 py-4">
                      <p className={user.isActive ? "text-emerald-300" : "text-rose-300"}>{user.isActive ? "Active" : "Inactive"}</p>
                      <p className="text-xs text-slate-500">{user.emailVerifiedAt ? "Verified" : "Unverified"}</p>
                    </td>
                    {(canChangeStatus || isOwner) && (
                      <td className="px-5 py-4">
                        {(isOwner || adminMayChangeStatus) ? (
                          <button
                            type="button"
                            onClick={() => void updateUserStatus(user)}
                            disabled={actionKey === `status:${user.id}`}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        ) : <span className="text-xs text-slate-500">Owner access required</span>}
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

      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <SectionTitle title="Software subscriptions" description="Recorded software subscription history across companies." />
        <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400"><tr><th className="px-5 py-4">Company</th><th className="px-5 py-4">Plan</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Period</th><th className="px-5 py-4">Source</th></tr></thead>
            <tbody>
              {subscriptions.items.map((subscription) => (
                <tr key={subscription.id} className="border-t border-slate-800">
                  <td className="px-5 py-4 text-white">{subscription.company.tradeName || subscription.company.legalName}</td>
                  <td className="px-5 py-4"><p>{subscription.plan.name}</p><p className="text-xs text-slate-500">{formatLabel(subscription.plan.planType)}</p></td>
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

      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <SectionTitle title="Data packages" description="Configured packages and their entitlement record counts." />
        <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400"><tr><th className="px-5 py-4">Package</th><th className="px-5 py-4">Discipline</th><th className="px-5 py-4">Items</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Entitlements</th></tr></thead>
            <tbody>
              {dataPackages.items.map((pkg) => (
                <tr key={pkg.id} className="border-t border-slate-800">
                  <td className="px-5 py-4"><p className="font-semibold text-white">{pkg.name}</p><p className="text-xs text-slate-500">{formatLabel(pkg.packageType)} / version {pkg.version}</p></td>
                  <td className="px-5 py-4">{pkg.discipline.name}</td>
                  <td className="px-5 py-4">{pkg.linkedItemCount} linked / {pkg.configuredItemCount} configured</td>
                  <td className="px-5 py-4">{formatLabel(pkg.status)}</td>
                  <td className="px-5 py-4"><p>{pkg.entitlementRecords.active} active / {pkg.entitlementRecords.total} total</p><p className="text-xs text-slate-500">{pkg.entitlementRecords.trial} trial / {pkg.entitlementRecords.suspended} suspended</p></td>
                </tr>
              ))}
              {dataPackages.items.length === 0 && <EmptyRow columns={5} message="No data packages found." />}
            </tbody>
          </table>
        </div>
        <Pagination data={dataPackages} onPage={setPackagesPage} />
      </section>

      {isOwner && auditEvents && (
        <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <SectionTitle title="Recent platform audit events" description="Owner-only platform administration activity." />
          <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400"><tr><th className="px-5 py-4">Time</th><th className="px-5 py-4">Actor</th><th className="px-5 py-4">Action</th><th className="px-5 py-4">Target</th></tr></thead>
              <tbody>
                {auditEvents.items.map((event) => (
                  <tr key={event.id} className="border-t border-slate-800">
                    <td className="px-5 py-4">{formatDateTime(event.createdAt)}</td>
                    <td className="px-5 py-4"><p className="text-white">{event.actor?.fullName ?? "System"}</p><p className="text-xs text-slate-500">{event.actorPlatformRole ? formatLabel(event.actorPlatformRole) : "No platform role"}</p></td>
                    <td className="px-5 py-4">{formatLabel(event.action)}</td>
                    <td className="px-5 py-4"><p>{formatLabel(event.targetType)}</p><p className="text-xs text-slate-500">{event.targetId ? shortId(event.targetId) : "No target ID"}</p></td>
                  </tr>
                ))}
                {auditEvents.items.length === 0 && <EmptyRow columns={4} message="No platform audit events found." />}
              </tbody>
            </table>
          </div>
          <Pagination data={auditEvents} onPage={setAuditPage} />
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-white">{value}</p></div>;
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold text-white">{formatLabel(value)}</p></div>;
}

function NotImplementedCard({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-500">Not yet implemented</p>
      <p className="mt-1 text-xs text-slate-600">{note}</p>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-xl font-semibold text-white">{title}</h2><p className="mt-1 text-sm text-slate-400">{description}</p></div>;
}

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return <tr><td colSpan={columns} className="px-5 py-10 text-center text-slate-500">{message}</td></tr>;
}

function Pagination<T>({ data, onPage }: { data: Paginated<T>; onPage: (page: number) => void }) {
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <p>Page {data.page} of {lastPage} / {data.total} records</p>
      <div className="flex gap-2">
        <button type="button" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40">Previous</button>
        <button type="button" disabled={data.page >= lastPage} onClick={() => onPage(data.page + 1)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40">Next</button>
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
