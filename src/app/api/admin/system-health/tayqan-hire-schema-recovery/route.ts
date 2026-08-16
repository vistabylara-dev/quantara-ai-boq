import { createHash, randomUUID } from "node:crypto";
import { PlatformRole } from "@prisma/client";
import { Pool, type PoolClient } from "pg";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { AppError } from "@/lib/errors/app-error";
import { apiFailure, apiSuccess } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const REPO = "vistabylara-dev/quantara-ai-boq";
const PINNED_COMMIT = "4d990f526bd6b261d96f88a9a8ef6bba4c8e3386";
const TARGET_MIGRATION = "20260815102000_tayqan_hire_intake";
const EXPECTED_DATABASE = "quantara_staging";
const EXPECTED_SCHEMA = "public";

const PINNED_MIGRATION_MANIFEST: Readonly<Record<string, string>> = {
  "20260802142756_init": "7e2e24c75ad44d7036ff8bc6928ccb122e0bd777b7739faa1fd037f791a3d66a",
  "20260802145154_add_boq_verification_version": "52b36808098a35b420a4d0f0cffb5411b15c1d6898f0f529327523bdd49f7def",
  "20260802151316_add_auth_and_users": "3e9d6e0db880bb7cfa1b0956203204c752ddd2a72e9130a456abf2f8900d3f08",
  "20260802155914_extend_client_fields": "5289f0c11bff7a83fb1b3e9945dd33915790efcd2c5c47debe36f97612805224",
  "20260802165639_phase4_suppliers_catalogue_pricing": "4a1cd13321912b17f8a23a3cd774846f0b022581f3d2e27c0435bd66b4dc9ed2",
  "20260802181802_phase5_document_generation": "b5987d0d93c9276279d3c70d9aa0f4dedd9f7b98d02141a9bfd84207f0c7b920",
  "20260802195627_phase6_proposals_email": "838470b68ea45d13394145a187011c1549d585fc6a77812dd3b01316f7b88e1e",
  "20260802210923_phase7_commercial_and_master_data": "fb3d4de36180354f26211fd72b2186416321dcd6981ad713c8dc4489f5f1b5b3",
  "20260802212500_phase7_trial_terms_and_indexes": "e0f30592458846eaea5a2d5232776d614e3a54482034dcd27c5667128c0bb13c",
  "20260802214054_import_job_headers": "661b265069f19fa6e890aefa832b7d53e0342ea08b2c55f09984aac693637364",
  "20260803024610_phase8_project_file": "d9c8f1db92d0f5b57897deb6a3793df7c88bf618547f8c13b578c91cd2ec36aa",
  "20260803030709_phase8_extraction_job": "cbd6e9246d69aac85a219258d4390e57cf1cface561cdcbb96de93e2fbb0ad81",
  "20260803034559_phase8_extracted_tables": "faa4acbe4c3da0f88bb73bfd4e8a7de4ba4427115446423b0ba5cd52eea47962",
  "20260803042802_phase8_drawing_page": "0b38bf1a229204671c6fbf39637d5d7b347af78338b9c909831a8dd161862aa7",
  "20260803043755_phase8_scale_calibration": "5479591e98aadc8018b0cadb0074f2d60d468be4609740e98ac4dc1e95b61d2b",
  "20260803044343_phase8_entities_inspections": "107c8b99566ae5ef2347f33ddd1d5644f0a90e9c0196385ff43cd525a262d9d3",
  "20260803190000_add_platform_roles_and_admin_access": "2732ef4c904acb7408b11299e168c1d5988641d453af624a6e0b590bc190e42f",
  "20260803230559_admin_control_1_owner_simulation_master_import": "3f811fbededaff971b9a148932dd507ca9aa818035d3d3326565d79b39f8db00",
  "20260804000801_master_boq_1a_hierarchy_foundation": "409c7de4e6b668ee11d4b8682d011979202bf0eaa1ecb772c3fab1f156397813",
  "20260804012500_integrations_1a_foundation": "d4ebde9f3d7ef1965c914307b6dc7c4783dc1fbbed2b849c88910a5e9c7136e8",
  "20260804040000_phase8_technical_report_templates": "67764ed48ca262fa309be0796b19bcb6f1a19d7c81d9f7c195714d2349445387",
  "20260804062514_integrations_1a_history": "aa248a50d045670621340820d2340b5c46a2478f0a504e478a7147cdce9cc9cd",
  "20260804071557_master_scale_1a_foundation": "c755efb158106195c61951f09081ce59a580edd88e395b978222289693477bac",
  "20260804071718_master_scale_1a_search_indexes": "b43afc4d698e365fa3ef71ad277291386d31da0da92c130193c9e164371227d9",
  "20260804090000_technical_report_email_share_1b": "b7ccd5ae6fa1ebdd9e059db81c00bd6ff9a32b1e002b6717de72b20cc11a1a19",
  "20260804093000_email_template_categories": "8565c7685ace07680bdf45ad71ccedba035896ee70e456d157492abece5f0c8d",
  "20260804150000_catalogue_prod_activate_import_jobs": "b3407a2eb4979b03218d23e9dcb13d387d416a5a34f1867c43b5430eb40a3a3b",
  "20260804220000_template_link_1_versioning": "7b5621434d87f66adb73f7af146cd7206d380268df0c17996811e07ce184b749",
  "20260805025000_add_sales_inquiry": "3def2f3a0b9b6d97789929a80b0d851435a8f5800b4306e045d44607462408a5",
  "20260805040000_stripe_1b_commerce_catalogue": "7bde40a14bf4c1949ab2c9b11308b68f5913115e04a9b30b8761f495f6be61ec",
  "20260805090000_stripe_1c_provider_sync": "c642ebaad741f0aa997fef8afe059ca2ee71eb022b6b92d5369dc64b909a339e",
  "20260805100000_core_flow_1_upload_session": "56e9d54c5e7ba4684039b0ab734a5f38c0e2d084f1ae875c42477677dd03a149",
  "20260805110000_proposal_source_type_recovery": "d8df46265b4a3d4c4e34eac5376618ca34c53a10939fdd67a0f24081d31aa03f",
  "20260806155214_add_boq_locked_by_user": "ec496aa33bae6ec7df1cb1f876d2a7c9bfaac382848c188c878b059179506268",
  "20260808120000_add_catalogue_reference_disciplines": "5b8198a9200264ecbe97a6362c8e1f6b766e1a6c03d89f6751e93a3674497616",
  "20260810195100_stripe_commercial_checkout": "c25c4720ec81ac237547293ddb0a121ae98bf57e9317dc4f6a03b880e7e27c29",
  "20260812114554_add_table_page_resolution": "f5dbd624dc5420e3c0fb4546671066d18ce1e91967d29aeaa2aac2b255a18ab8",
  "20260813200000_evidence_retention": "778c362b283e8675d8ba99839766e51e7636c8e458e9eeddb39786958c69719a",
  "20260813213000_estimate_integrity_graph": "bc0c3738c819f842f5a081e8469107065301af47aa3750da42ec39d4d6198f3b",
  "20260814021631_worker_v0_review_existing_boq": "04080246878fe659635b71b36271a82fde1a0f0f674d61b2c132dbd612242da5",
  "20260814024355_worker_v1_durable_runner": "c41e7125f9c126239b789c98299d327b5ed8dc843a31305258e81eba02abc316",
  "20260814105935_refund_workflow": "5cc80c9e022ce5d567dc5c6583cce1d548002373aaf705e1aba2644e96f1d785",
  "20260814172326_tayqan_1_worker_run_brief": "8fef0ce992d26ccf53e3792cf2972bd0004ce5d525096b1fa9b251e693a1bee3",
  "20260815102000_tayqan_hire_intake": "7f83100a8dbaf3ac417222289192d1ce8422316b5a661531b76fe35b0dc4aacd",
};

const LEGACY_CHECKSUM_ALLOWLIST: Readonly<Record<string, {
  recordedChecksum: string;
  expectedChecksum: string;
}>> = {
  "20260804071557_master_scale_1a_foundation": {
    recordedChecksum: "ee83571781341215f53a4ec11359b2afb8a04b6529bbb4aef803bd554685270b",
    expectedChecksum: "c755efb158106195c61951f09081ce59a580edd88e395b978222289693477bac",
  },
  "20260804071718_master_scale_1a_search_indexes": {
    recordedChecksum: "122d743a0403e77ad7e0ed9447f5b8826f2fbdbc55612d936eff004dd13c2eec",
    expectedChecksum: "b43afc4d698e365fa3ef71ad277291386d31da0da92c130193c9e164371227d9",
  },
  "20260805025000_add_sales_inquiry": {
    recordedChecksum: "e844c9dfb791b910a2b86c4a5f6821710a103c49609e3265519dd4598cde58d2",
    expectedChecksum: "3def2f3a0b9b6d97789929a80b0d851435a8f5800b4306e045d44607462408a5",
  },
  "20260805110000_proposal_source_type_recovery": {
    recordedChecksum: "580a4f53fdbf78bce61000227116b4819a828bbaad3efefd7a6c874ae5946f59",
    expectedChecksum: "d8df46265b4a3d4c4e34eac5376618ca34c53a10939fdd67a0f24081d31aa03f",
  },
  "20260806155214_add_boq_locked_by_user": {
    recordedChecksum: "3f9cac6bc067d8ffd91d4606925288f02eba0355443ab5a9bfcbb349b31daa1b",
    expectedChecksum: "ec496aa33bae6ec7df1cb1f876d2a7c9bfaac382848c188c878b059179506268",
  },
};

type MigrationRow = {
  migration_name: string;
  checksum: string;
  started_at: Date;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

type RepoMigration = {
  name: string;
  checksum: string;
};

type RepoMigrationSource = RepoMigration & {
  sql: string;
};

type ObjectKind = "table" | "type" | "index" | "constraint";

type RecoveryObject =
  | { kind: "table"; name: string }
  | { kind: "type"; name: string }
  | { kind: "index"; name: string }
  | { kind: "constraint"; table: string; name: string };

type PreflightEvidence = {
  databaseProvider: "postgresql";
  databaseName: string;
  schemaName: string;
  currentUser: string;
  migrationHistory: {
    totalRecords: number;
    cleanRecords: number;
    unfinishedRecords: number;
    rolledBackRecords: number;
    unknownRecordedMigrations: string[];
    checksumMismatches: string[];
    allowedLegacyChecksumMismatches: string[];
    blockingChecksumMismatches: string[];
    pendingMigrations: string[];
  };
  coreTables: Record<string, boolean>;
  protectedCounts: Record<string, number>;
  checksumMismatchDetails: Array<{
    name: string;
    recordedChecksum: string;
    expectedChecksum: string;
    startedAt: Date;
    finishedAt: Date | null;
    rolledBackAt: Date | null;
    appliedStepsCount: number;
    allowedLegacy: boolean;
  }>;
  targetMigration: {
    name: string;
    checksum: string;
    records: number;
    cleanRecords: number;
    status: "ABSENT" | "CLEAN" | "UNFINISHED" | "ROLLED_BACK" | "CHECKSUM_MISMATCH";
  };
  targetObjects: Record<string, boolean>;
  verdict:
    | "ALREADY_APPLIED"
    | "SAFE_TO_APPLY"
    | "IDENTITY_MISMATCH"
    | "MIGRATION_TABLE_MISSING"
    | "CORE_TABLE_MISSING"
    | "HISTORY_DIRTY"
    | "HISTORY_DIVERGED"
    | "CHECKSUM_MISMATCH"
    | "RECORDED_BUT_OBJECTS_MISSING"
    | "UNRECORDED_OBJECTS_PRESENT"
    | "UNEXPECTED_PENDING_MIGRATIONS";
};

const CORE_TABLES = [
  "Company",
  "User",
  "Project",
  "BOQ",
  "BOQItem",
  "MasterItem",
  "MasterDiscipline",
  "IndustryDataPackage",
  "_prisma_migrations",
] as const;

const PROTECTED_COUNT_TABLES = [
  "Company",
  "User",
  "Project",
  "BOQ",
  "BOQItem",
  "MasterItem",
  "IndustryDataPackage",
  "IndustryDataPackageItem",
  "CompanySoftwareSubscription",
  "StripeWebhookEvent",
  "RefundRequest",
] as const;

const TARGET_OBJECTS: readonly RecoveryObject[] = [
  { kind: "table", name: "TayqanHireEntitlement" },
  { kind: "table", name: "TayqanIntakeSession" },
  { kind: "table", name: "TayqanIntakeMessage" },
  { kind: "table", name: "TayqanWorkOrder" },
  { kind: "table", name: "TayqanWorkEvent" },
  { kind: "type", name: "TayqanHirePlan" },
  { kind: "type", name: "TayqanHireStatus" },
  { kind: "type", name: "TayqanIntakeStatus" },
  { kind: "type", name: "TayqanIntakeMessageRole" },
  { kind: "type", name: "TayqanWorkStatus" },
  { kind: "type", name: "TayqanWorkStage" },
  { kind: "index", name: "TayqanHireEntitlement_stripeCheckoutSessionId_key" },
  { kind: "index", name: "TayqanHireEntitlement_stripePaymentIntentId_key" },
  { kind: "index", name: "TayqanHireEntitlement_stripeSubscriptionId_key" },
  { kind: "index", name: "TayqanHireEntitlement_companyId_idx" },
  { kind: "index", name: "TayqanHireEntitlement_companyId_status_idx" },
  { kind: "index", name: "TayqanHireEntitlement_expiresAt_idx" },
  { kind: "index", name: "TayqanHireEntitlement_purchasedByUserId_idx" },
  { kind: "index", name: "TayqanIntakeSession_workerRunId_key" },
  { kind: "index", name: "TayqanIntakeSession_companyId_idx" },
  { kind: "index", name: "TayqanIntakeSession_companyId_projectId_idx" },
  { kind: "index", name: "TayqanIntakeSession_hireEntitlementId_idx" },
  { kind: "index", name: "TayqanIntakeSession_status_idx" },
  { kind: "index", name: "TayqanIntakeMessage_companyId_idx" },
  { kind: "index", name: "TayqanIntakeMessage_companyId_sessionId_createdAt_idx" },
  { kind: "index", name: "TayqanWorkOrder_intakeSessionId_key" },
  { kind: "index", name: "TayqanWorkOrder_qaWorkerRunId_key" },
  { kind: "index", name: "TayqanWorkOrder_companyId_idx" },
  { kind: "index", name: "TayqanWorkOrder_companyId_projectId_idx" },
  { kind: "index", name: "TayqanWorkOrder_companyId_status_idx" },
  { kind: "index", name: "TayqanWorkOrder_stage_idx" },
  { kind: "index", name: "TayqanWorkOrder_hireEntitlementId_idx" },
  { kind: "index", name: "TayqanWorkEvent_companyId_idx" },
  { kind: "index", name: "TayqanWorkEvent_workOrderId_createdAt_idx" },
  { kind: "index", name: "TayqanWorkEvent_stage_idx" },
  { kind: "constraint", table: "TayqanHireEntitlement", name: "TayqanHireEntitlement_pkey" },
  { kind: "constraint", table: "TayqanIntakeSession", name: "TayqanIntakeSession_pkey" },
  { kind: "constraint", table: "TayqanIntakeMessage", name: "TayqanIntakeMessage_pkey" },
  { kind: "constraint", table: "TayqanWorkOrder", name: "TayqanWorkOrder_pkey" },
  { kind: "constraint", table: "TayqanWorkEvent", name: "TayqanWorkEvent_pkey" },
  { kind: "constraint", table: "TayqanWorkEvent", name: "TayqanWorkEvent_workOrderId_fkey" },
] as const;

function failure(error: unknown) {
  if (error instanceof AppError) {
    return apiFailure(error.code, error.message, error.status, error.fieldErrors);
  }

  console.error(
    "[tayqan-hire-schema-recovery] unexpected failure",
    error instanceof Error ? error.message : error,
  );
  return apiFailure(
    "TAYQAN_HIRE_SCHEMA_RECOVERY_FAILED",
    "The Tayqan hire schema recovery failed. Review server logs before retrying.",
    500,
  );
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL ?? "";
  if (!/^postgres(?:ql)?:\/\//.test(value)) {
    throw new AppError(
      "TAYQAN_HIRE_SCHEMA_RECOVERY_DATABASE_URL_UNAVAILABLE",
      "The production database connection is unavailable to the recovery runtime.",
      503,
    );
  }
  return value;
}

async function fetchGithubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "quantara-tayqan-hire-schema-recovery",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new AppError(
      "TAYQAN_HIRE_SCHEMA_RECOVERY_SOURCE_UNAVAILABLE",
      `The pinned GitHub source could not be retrieved from ${url}.`,
      503,
    );
  }

  return (await response.json()) as T;
}

function pinnedMigrationHistory(): RepoMigration[] {
  return Object.entries(PINNED_MIGRATION_MANIFEST)
    .map(([name, checksum]) => ({ name, checksum }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function fetchTargetMigrationSource(): Promise<RepoMigrationSource> {
  const url = `https://api.github.com/repos/${REPO}/contents/prisma/migrations/${TARGET_MIGRATION}/migration.sql?ref=${PINNED_COMMIT}`;
  const payload = await fetchGithubJson<{ type?: string; encoding?: string; content?: string }>(url);

  if (payload.type !== "file" || payload.encoding !== "base64" || !payload.content) {
    throw new AppError(
      "TAYQAN_HIRE_SCHEMA_RECOVERY_SOURCE_INVALID",
      `The pinned migration source was not a valid file for ${TARGET_MIGRATION}.`,
      503,
    );
  }

  const sqlBytes = Buffer.from(payload.content.replace(/\s+/g, ""), "base64");
  const sql = sqlBytes.toString("utf8");
  if (!sql.trim()) {
    throw new AppError(
      "TAYQAN_HIRE_SCHEMA_RECOVERY_SOURCE_EMPTY",
      `The pinned migration source was empty for ${TARGET_MIGRATION}.`,
      503,
    );
  }

  const checksum = createHash("sha256").update(sqlBytes).digest("hex");
  const expectedChecksum = PINNED_MIGRATION_MANIFEST[TARGET_MIGRATION];
  if (!expectedChecksum || checksum !== expectedChecksum) {
    throw new AppError(
      "TAYQAN_HIRE_SCHEMA_RECOVERY_TARGET_CHECKSUM_MISMATCH",
      `The fetched pinned migration checksum did not match the embedded manifest for ${TARGET_MIGRATION}.`,
      503,
    );
  }

  return {
    name: TARGET_MIGRATION,
    sql,
    checksum,
  };
}

async function loadVerifiedMigrationSource(): Promise<{
  migrations: RepoMigration[];
  targetMigration: RepoMigrationSource;
}> {
  const targetMigration = await fetchTargetMigrationSource();
  return {
    migrations: pinnedMigrationHistory(),
    targetMigration,
  };
}

function sqlRegClass(name: string): string {
  return `public."${name}"`;
}

function sqlRegType(name: string): string {
  return `public."${name}"`;
}

async function objectPresent(client: PoolClient, object: RecoveryObject): Promise<boolean> {
  if (object.kind === "table" || object.kind === "index") {
    const result = await client.query<{ present: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS present`,
      [sqlRegClass(object.name)],
    );
    return result.rows[0]?.present === true;
  }

  if (object.kind === "type") {
    const result = await client.query<{ present: boolean }>(
      `SELECT to_regtype($1) IS NOT NULL AS present`,
      [sqlRegType(object.name)],
    );
    return result.rows[0]?.present === true;
  }

  const result = await client.query<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = $1
         AND c.conname = $2
     ) AS present`,
    [object.table, object.name],
  );
  return result.rows[0]?.present === true;
}

async function objectMap(client: PoolClient, objects: readonly RecoveryObject[]) {
  const entries = await Promise.all(
    objects.map(async (object) => {
      const key = object.kind === "constraint" ? `${object.table}.${object.name}` : object.name;
      return [key, await objectPresent(client, object)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<string, boolean>;
}

async function countTableRows(client: PoolClient, tableName: string): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${sqlRegClass(tableName)}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function snapshotCounts(client: PoolClient, tableNames: readonly string[]) {
  const entries = await Promise.all(
    tableNames.map(async (tableName) => [tableName, await countTableRows(client, tableName)] as const),
  );
  return Object.fromEntries(entries) as Record<string, number>;
}

function isCleanRow(row: MigrationRow): boolean {
  return row.finished_at !== null && row.rolled_back_at === null && row.applied_steps_count > 0;
}

function isDirtyRow(row: MigrationRow): boolean {
  return row.finished_at === null || row.rolled_back_at !== null;
}

function isAllowedLegacyChecksumMismatch(
  name: string,
  recordedChecksum: string,
  expectedChecksum: string,
): boolean {
  const allowed = LEGACY_CHECKSUM_ALLOWLIST[name];
  return (
    allowed !== undefined &&
    allowed.recordedChecksum === recordedChecksum &&
    allowed.expectedChecksum === expectedChecksum
  );
}

async function readMigrationRows(client: PoolClient): Promise<MigrationRow[]> {
  const migrationTable = await client.query<{ present: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS present`,
    [sqlRegClass("_prisma_migrations")],
  );

  if (migrationTable.rows[0]?.present !== true) {
    throw new AppError(
      "TAYQAN_HIRE_SCHEMA_RECOVERY_MIGRATION_TABLE_MISSING",
      "The production database is missing _prisma_migrations.",
      409,
    );
  }

  const result = await client.query<MigrationRow>(
    `SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count
     FROM "_prisma_migrations"
     ORDER BY started_at ASC`,
  );
  return result.rows;
}

function summarizePreflight(
  migrations: RepoMigration[],
  rows: MigrationRow[],
  coreTables: Record<string, boolean>,
  protectedCounts: Record<string, number>,
  objectState: Record<string, boolean>,
  databaseName: string,
  schemaName: string,
  currentUser: string,
): PreflightEvidence {
  const rowByName = new Map<string, MigrationRow[]>();
  for (const row of rows) {
    const bucket = rowByName.get(row.migration_name) ?? [];
    bucket.push(row);
    rowByName.set(row.migration_name, bucket);
  }

  const cleanRows = rows.filter(isCleanRow);
  const dirtyRows = rows.filter(isDirtyRow);
  const cleanNames = new Set(cleanRows.map((row) => row.migration_name));
  const repoNames = new Set(migrations.map((migration) => migration.name));
  const unexpectedRecordedMigrations = [...new Set(rows.map((row) => row.migration_name))]
    .filter((name) => !repoNames.has(name));
  const duplicateRecordedMigrations = [...rowByName.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([name]) => name);

  const checksumMismatches = migrations
    .filter((migration) => {
      const records = rowByName.get(migration.name) ?? [];
      return records.some((row) => row.checksum !== migration.checksum);
    })
    .map((migration) => migration.name);

  const checksumMismatchDetails = checksumMismatches.flatMap((name) => {
    const expectedChecksum =
      migrations.find((migration) => migration.name === name)?.checksum ?? "";

    return (rowByName.get(name) ?? [])
      .filter((row) => row.checksum !== expectedChecksum)
      .map((row) => ({
        name,
        recordedChecksum: row.checksum,
        expectedChecksum,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        rolledBackAt: row.rolled_back_at,
        appliedStepsCount: row.applied_steps_count,
        allowedLegacy: isAllowedLegacyChecksumMismatch(
          name,
          row.checksum,
          expectedChecksum,
        ),
      }));
  });

  const allowedLegacyChecksumMismatches = [
    ...new Set(
      checksumMismatchDetails
        .filter((detail) => detail.allowedLegacy)
        .map((detail) => detail.name),
    ),
  ];

  const blockingChecksumMismatches = [
    ...new Set(
      checksumMismatchDetails
        .filter((detail) => !detail.allowedLegacy)
        .map((detail) => detail.name),
    ),
  ];

  const pendingMigrations = migrations
    .filter((migration) => !cleanNames.has(migration.name))
    .map((migration) => migration.name);

  const targetRows = rowByName.get(TARGET_MIGRATION) ?? [];
  const targetCleanRows = targetRows.filter(isCleanRow);
  const targetDirtyRows = targetRows.filter(isDirtyRow);
  const targetChecksumMismatch = targetRows.some((row) => {
    const expected = migrations.find((migration) => migration.name === TARGET_MIGRATION);
    return expected ? row.checksum !== expected.checksum : false;
  });

  const targetRecordedObjectsPresent = TARGET_OBJECTS.every((object) => {
    const key = object.kind === "constraint" ? `${object.table}.${object.name}` : object.name;
    return objectState[key] === true;
  });
  const targetRecordedObjectsMissing = TARGET_OBJECTS.some((object) => {
    const key = object.kind === "constraint" ? `${object.table}.${object.name}` : object.name;
    return objectState[key] !== true;
  });

  let verdict: PreflightEvidence["verdict"] = "SAFE_TO_APPLY";
  if (databaseName !== EXPECTED_DATABASE || schemaName !== EXPECTED_SCHEMA) {
    verdict = "IDENTITY_MISMATCH";
  } else if (!coreTables["_prisma_migrations"]) {
    verdict = "MIGRATION_TABLE_MISSING";
  } else if (Object.values(coreTables).some((present) => !present)) {
    verdict = "CORE_TABLE_MISSING";
  } else if (dirtyRows.length > 0) {
    verdict = "HISTORY_DIRTY";
  } else if (unexpectedRecordedMigrations.length > 0 || duplicateRecordedMigrations.length > 0) {
    verdict = "HISTORY_DIVERGED";
  } else if (blockingChecksumMismatches.length > 0 || targetChecksumMismatch) {
    verdict = "CHECKSUM_MISMATCH";
  } else if (targetRows.length > 0 && targetCleanRows.length === 0) {
    verdict = "HISTORY_DIRTY";
  } else if (targetRows.length > 1) {
    verdict = "HISTORY_DIVERGED";
  } else if (targetRows.length > 0 && targetCleanRows.length > 0 && targetRecordedObjectsMissing) {
    verdict = "RECORDED_BUT_OBJECTS_MISSING";
  } else if (targetRows.length === 0 && TARGET_OBJECTS.some((object) => {
    const key = object.kind === "constraint" ? `${object.table}.${object.name}` : object.name;
    return objectState[key] === true;
  })) {
    verdict = "UNRECORDED_OBJECTS_PRESENT";
  } else if (pendingMigrations.length > 1) {
    verdict = "UNEXPECTED_PENDING_MIGRATIONS";
  } else if (pendingMigrations.length === 1 && pendingMigrations[0] !== TARGET_MIGRATION) {
    verdict = "UNEXPECTED_PENDING_MIGRATIONS";
  } else if (targetRows.length > 0 && targetCleanRows.length > 0 && targetRecordedObjectsPresent) {
    verdict = "ALREADY_APPLIED";
  } else if (targetRows.length === 0 && pendingMigrations.length === 1 && pendingMigrations[0] === TARGET_MIGRATION) {
    verdict = "SAFE_TO_APPLY";
  } else if (targetRows.length === 0 && pendingMigrations.length === 0) {
    verdict = "ALREADY_APPLIED";
  } else if (targetRows.length === 0) {
    verdict = "UNEXPECTED_PENDING_MIGRATIONS";
  }

  const targetStatus: PreflightEvidence["targetMigration"]["status"] =
    targetRows.length === 0
      ? "ABSENT"
      : targetDirtyRows.length > 0
        ? targetRows.some((row) => row.rolled_back_at !== null)
          ? "ROLLED_BACK"
          : "UNFINISHED"
        : targetChecksumMismatch
          ? "CHECKSUM_MISMATCH"
          : "CLEAN";

  return {
    databaseProvider: "postgresql",
    databaseName,
    schemaName,
    currentUser,
    migrationHistory: {
      totalRecords: rows.length,
      cleanRecords: cleanRows.length,
      unfinishedRecords: rows.filter((row) => row.finished_at === null && row.rolled_back_at === null).length,
      rolledBackRecords: rows.filter((row) => row.rolled_back_at !== null).length,
      unknownRecordedMigrations: unexpectedRecordedMigrations,
      checksumMismatches,
      allowedLegacyChecksumMismatches,
      blockingChecksumMismatches,
      pendingMigrations,
    },
    coreTables,
    protectedCounts,
    checksumMismatchDetails,
    targetMigration: {
      name: TARGET_MIGRATION,
      checksum: migrations.find((migration) => migration.name === TARGET_MIGRATION)?.checksum ?? "",
      records: targetRows.length,
      cleanRecords: targetCleanRows.length,
      status: targetStatus,
    },
    targetObjects: objectState,
    verdict,
  };
}

async function collectPreflight(client: PoolClient, migrations: RepoMigration[]): Promise<PreflightEvidence> {
  const [identity] = (
    await client.query<{ current_database: string; current_schema: string; current_user: string }>(
      `SELECT current_database()::text AS current_database,
              current_schema()::text AS current_schema,
              current_user::text AS current_user`,
    )
  ).rows;

  const coreTables = Object.fromEntries(
    await Promise.all(
      CORE_TABLES.map(async (tableName) => {
        const result = await client.query<{ present: boolean }>(
          `SELECT to_regclass($1) IS NOT NULL AS present`,
          [sqlRegClass(tableName)],
        );
        return [tableName, result.rows[0]?.present === true] as const;
      }),
    ),
  ) as Record<string, boolean>;

  const protectedCounts = await snapshotCounts(client, PROTECTED_COUNT_TABLES);
  const rows = await readMigrationRows(client);
  const targetObjects = await objectMap(client, TARGET_OBJECTS);

  return summarizePreflight(
    migrations,
    rows,
    coreTables,
    protectedCounts,
    targetObjects,
    identity?.current_database ?? "",
    identity?.current_schema ?? "",
    identity?.current_user ?? "",
  );
}

function responseFromPreflight(preflight: PreflightEvidence) {
  return apiSuccess({
    ...preflight,
    migrationSource: {
      repository: REPO,
      pinnedCommit: PINNED_COMMIT,
      targetMigration: TARGET_MIGRATION,
    },
  });
}

async function ensureSafeToApply(client: PoolClient, migrations: RepoMigration[]) {
  const preflight = await collectPreflight(client, migrations);
  if (preflight.verdict !== "SAFE_TO_APPLY") {
    throw new AppError(
      `TAYQAN_HIRE_SCHEMA_RECOVERY_${preflight.verdict}`,
      `The Tayqan hire schema recovery is not safe to apply: ${preflight.verdict}.`,
      409,
    );
  }
  return preflight;
}

async function applyPinnedMigration(client: PoolClient, migration: RepoMigrationSource) {
  await client.query(migration.sql);

  const objectState = await objectMap(client, TARGET_OBJECTS);
  const missingObjects = Object.entries(objectState)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  if (missingObjects.length > 0) {
    throw new AppError(
      "TAYQAN_HIRE_SCHEMA_RECOVERY_OBJECT_VERIFICATION_FAILED",
      `The pinned Tayqan migration executed but did not create all expected objects: ${missingObjects.join(", ")}.`,
      500,
    );
  }
}

export async function GET() {
  let pool: Pool | undefined;
  let client: PoolClient | undefined;
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);

    const { migrations } = await loadVerifiedMigrationSource();
    pool = new Pool({ connectionString: databaseUrl(), max: 1, connectionTimeoutMillis: 5_000 });
    client = await pool.connect();

    const preflight = await collectPreflight(client, migrations);
    return responseFromPreflight(preflight);
  } catch (error) {
    return failure(error);
  } finally {
    client?.release();
    if (pool) await pool.end().catch(() => undefined);
  }
}

async function executeRecoveryMutation() {
  let pool: Pool | undefined;
  let client: PoolClient | undefined;
  let transactionOpen = false;

  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);

    const { migrations, targetMigration } = await loadVerifiedMigrationSource();

    pool = new Pool({ connectionString: databaseUrl(), max: 1, connectionTimeoutMillis: 5_000 });
    client = await pool.connect();

    await client.query("BEGIN");
    transactionOpen = true;
    await client.query(`LOCK TABLE "_prisma_migrations" IN EXCLUSIVE MODE`);

    const preflight = await ensureSafeToApply(client, migrations);

    const protectedBefore = preflight.protectedCounts;
    await applyPinnedMigration(client, targetMigration);

    const preRecordObjects = await objectMap(client, TARGET_OBJECTS);
    if (Object.values(preRecordObjects).some((present) => !present)) {
      throw new AppError(
        "TAYQAN_HIRE_SCHEMA_RECOVERY_OBJECT_VERIFICATION_FAILED",
        "The pinned Tayqan migration did not leave every required object present.",
        500,
      );
    }

    const protectedAfterApply = await snapshotCounts(client, PROTECTED_COUNT_TABLES);
    if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfterApply)) {
      throw new AppError(
        "TAYQAN_HIRE_SCHEMA_RECOVERY_PROTECTED_COUNTS_CHANGED",
        "The pinned Tayqan migration unexpectedly changed protected Quantara row counts.",
        500,
      );
    }

    await client.query(
      `INSERT INTO "_prisma_migrations" (
         id, checksum, migration_name, started_at, finished_at, applied_steps_count
       ) VALUES ($1, $2, $3, now(), now(), 1)`,
      [randomUUID(), targetMigration.checksum, targetMigration.name],
    );

    const finalState = await collectPreflight(client, migrations);
    if (finalState.verdict !== "ALREADY_APPLIED") {
      throw new AppError(
        `TAYQAN_HIRE_SCHEMA_RECOVERY_${finalState.verdict}`,
        "The Tayqan hire schema recovery did not reach a clean applied state.",
        500,
      );
    }

    await client.query("COMMIT");
    transactionOpen = false;

    return apiSuccess({
      recovered: true,
      preflight,
      finalState,
      migrationSource: {
        repository: REPO,
        pinnedCommit: PINNED_COMMIT,
        targetMigration: TARGET_MIGRATION,
        checksum: targetMigration.checksum,
      },
    });
  } catch (error) {
    if (transactionOpen && client) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error(
          "[tayqan-hire-schema-recovery] rollback failed",
          rollbackError instanceof Error ? rollbackError.message : rollbackError,
        );
      });
    }
    return failure(error);
  } finally {
    client?.release();
    if (pool) await pool.end().catch(() => undefined);
  }
}

export async function POST() {
  return apiFailure(
    "TAYQAN_HIRE_SCHEMA_RECOVERY_POST_DISABLED",
    "Production mutation is disabled during Stage 1 read-only preflight.",
    409,
  );
}
