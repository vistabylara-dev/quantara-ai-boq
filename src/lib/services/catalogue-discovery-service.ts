import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join, relative } from "node:path";
import { parseCsv } from "@/lib/imports/csv-parser";

/**
 * CATALOGUE-DISCOVERY — recursive, streaming, read-only audit of
 * data-imports/**. Never touches the database and never mutates anything;
 * it only reads files off disk to answer "what's actually here and what
 * does it look like." Registration/import is a separate, later, owner-
 * approved step (see master-catalogue-import-job-service.ts).
 *
 * Folder and filename are candidate metadata only — never trusted alone.
 * Every folder's classification is cross-checked against the CSV's own
 * `discipline` column values (row-content confirmation) and against the
 * caller-supplied list of MasterDiscipline keys that actually exist today,
 * so a folder can never resolve to a discipline that isn't real.
 */

export type CatalogueDatasetConfidence = "AUTO_VALIDATED" | "VALIDATED_WITH_WARNINGS" | "NEEDS_OWNER_REVIEW" | "REJECTED";

const EXPECTED_HEADER = ["itemCode", "discipline", "category", "description", "specification", "quantity", "unit", "supplier", "cost", "margin", "sellingRate", "manufacturer", "brand", "model"];

export type DiscoveredFile = {
  path: string;
  fileName: string;
  byteSize: number;
  rowCount: number;
  headers: string[];
  headerMatchesExpected: boolean;
  checksum: string;
  sampleRows: string[][];
  disciplineColumnValues: string[];
  categoryColumnValues: string[];
  blankRowCount: number;
};

export type DiscoveredFolder = {
  folderPath: string;
  files: DiscoveredFile[];
  totalFileCount: number;
  totalByteSize: number;
  totalRowCount: number;
  candidateIndustryCode: string;
  candidateDisciplineCode: string | null;
  candidatePackageCode: string;
  evidence: string[];
  warnings: string[];
  confidence: CatalogueDatasetConfidence;
};

/** sha256 of file content, computed via a piped stream — the file is never held whole in memory. */
function streamChecksum(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Streams a CSV file line by line (bounded memory — one buffered logical
 * row at a time, never the whole file), tracking quote parity across line
 * boundaries so a quoted field containing an embedded newline is still
 * treated as one logical row rather than being split incorrectly.
 */
async function streamCsvFile(absPath: string, sampleLimit = 3): Promise<Omit<DiscoveredFile, "path" | "fileName" | "byteSize" | "checksum">> {
  const rl = createInterface({ input: createReadStream(absPath, { encoding: "utf8" }), crlfDelay: Infinity });

  let headers: string[] = [];
  let isFirstLine = true;
  let rowCount = 0;
  let blankRowCount = 0;
  let buffer = "";
  let quoteParity = 0;
  const sampleRows: string[][] = [];
  let disciplineIdx = -1;
  let categoryIdx = -1;
  const disciplineValues = new Set<string>();
  const categoryValues = new Set<string>();

  const countQuotes = (s: string) => {
    let c = 0;
    for (let i = 0; i < s.length; i += 1) if (s[i] === '"') c += 1;
    return c;
  };

  for await (const line of rl) {
    buffer = buffer ? `${buffer}\n${line}` : line;
    quoteParity += countQuotes(line);
    if (quoteParity % 2 !== 0) continue; // still inside a quoted, multi-line field

    const parsed = parseCsv(buffer);
    buffer = "";
    quoteParity = 0;
    const fields = parsed[0] ?? [];

    if (isFirstLine) {
      headers = fields.map((h) => h.trim());
      disciplineIdx = headers.findIndex((h) => h.toLowerCase() === "discipline");
      categoryIdx = headers.findIndex((h) => h.toLowerCase() === "category");
      isFirstLine = false;
      continue;
    }

    if (fields.length === 0 || (fields.length === 1 && fields[0].trim() === "")) {
      blankRowCount += 1;
      continue;
    }

    rowCount += 1;
    if (sampleRows.length < sampleLimit) sampleRows.push(fields);
    if (disciplineIdx >= 0 && fields[disciplineIdx]?.trim()) disciplineValues.add(fields[disciplineIdx].trim());
    if (categoryIdx >= 0 && fields[categoryIdx]?.trim()) categoryValues.add(fields[categoryIdx].trim());
  }

  return {
    rowCount,
    headers,
    headerMatchesExpected: headers.length === EXPECTED_HEADER.length && EXPECTED_HEADER.every((h, i) => headers[i] === h),
    sampleRows,
    disciplineColumnValues: Array.from(disciplineValues).sort(),
    categoryColumnValues: Array.from(categoryValues).sort(),
    blankRowCount,
  };
}

function slugToPackageCode(folderName: string): string {
  return `${folderName}-library`;
}

/**
 * Deterministic classification — never AI, never guesses a discipline that
 * doesn't exist. A folder's candidate discipline is only accepted if every
 * file's own `discipline` column values resolve to exactly one entry in
 * `knownDisciplineKeys` (the real, currently-existing MasterDiscipline
 * rows). Anything else is NEEDS_OWNER_REVIEW, never silently imported.
 */
function classifyFolder(folderPath: string, files: DiscoveredFile[], knownDisciplineKeys: Set<string>): Pick<DiscoveredFolder, "candidateIndustryCode" | "candidateDisciplineCode" | "candidatePackageCode" | "evidence" | "warnings" | "confidence"> {
  const folderName = folderPath.split("/").pop() ?? folderPath;
  const evidence: string[] = [`folder token: "${folderName}"`];
  const warnings: string[] = [];

  if (files.length === 0) {
    return { candidateIndustryCode: "CONSTRUCTION", candidateDisciplineCode: null, candidatePackageCode: slugToPackageCode(folderName), evidence, warnings: ["no CSV files found in folder"], confidence: "REJECTED" };
  }

  const allDisciplineValues = new Set<string>();
  let anyHeaderMismatch = false;
  let anyEmptyFile = false;
  for (const file of files) {
    for (const v of file.disciplineColumnValues) allDisciplineValues.add(v);
    if (!file.headerMatchesExpected) anyHeaderMismatch = true;
    if (file.rowCount === 0) anyEmptyFile = true;
  }

  if (anyHeaderMismatch) {
    warnings.push("one or more files do not match the expected company-library-import header schema");
  }
  if (anyEmptyFile) {
    warnings.push("one or more files contain zero data rows");
  }

  if (allDisciplineValues.size === 0) {
    warnings.push("no discipline column values found to confirm folder-derived classification");
    return { candidateIndustryCode: "CONSTRUCTION", candidateDisciplineCode: null, candidatePackageCode: slugToPackageCode(folderName), evidence, warnings, confidence: "NEEDS_OWNER_REVIEW" };
  }

  evidence.push(`discipline column values found: ${Array.from(allDisciplineValues).join(", ")}`);

  const recognized = Array.from(allDisciplineValues).filter((v) => knownDisciplineKeys.has(v));
  const unrecognized = Array.from(allDisciplineValues).filter((v) => !knownDisciplineKeys.has(v));

  if (recognized.length === 0) {
    warnings.push(`none of the discipline column values (${Array.from(allDisciplineValues).join(", ")}) match an existing MasterDiscipline key`);
    return { candidateIndustryCode: "CONSTRUCTION", candidateDisciplineCode: null, candidatePackageCode: slugToPackageCode(folderName), evidence, warnings, confidence: "NEEDS_OWNER_REVIEW" };
  }

  if (unrecognized.length > 0) {
    warnings.push(`mixed discipline values in this folder — recognized: ${recognized.join(", ")}; unrecognized: ${unrecognized.join(", ")}`);
  }

  if (recognized.length > 1) {
    warnings.push(`folder contains more than one recognized discipline (${recognized.join(", ")}) — files may need to be split across datasets`);
    return { candidateIndustryCode: "CONSTRUCTION", candidateDisciplineCode: recognized[0], candidatePackageCode: slugToPackageCode(folderName), evidence, warnings, confidence: "NEEDS_OWNER_REVIEW" };
  }

  const candidateDisciplineCode = recognized[0];
  evidence.push(`resolved to existing MasterDiscipline key "${candidateDisciplineCode}"`);

  if (warnings.length > 0 || anyHeaderMismatch) {
    return { candidateIndustryCode: "CONSTRUCTION", candidateDisciplineCode, candidatePackageCode: slugToPackageCode(folderName), evidence, warnings, confidence: "VALIDATED_WITH_WARNINGS" };
  }

  return { candidateIndustryCode: "CONSTRUCTION", candidateDisciplineCode, candidatePackageCode: slugToPackageCode(folderName), evidence, warnings, confidence: "AUTO_VALIDATED" };
}

/**
 * Recursively discovers every CSV under `rootDir` (default data-imports),
 * grouped by its immediate subfolder. `knownDisciplineKeys` should come
 * from a live `prisma.masterDiscipline.findMany()` — passed in rather than
 * queried here so this module stays a pure filesystem/classification
 * function, independently testable with no database dependency.
 */
export async function discoverCatalogueDatasets(rootDir: string, knownDisciplineKeys: Set<string>): Promise<DiscoveredFolder[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  const results: DiscoveredFolder[] = [];
  for (const folderName of folders) {
    const folderAbsPath = join(rootDir, folderName);
    const folderRelPath = relative(process.cwd(), folderAbsPath).split("\\").join("/");
    const fileEntries = (await readdir(folderAbsPath, { withFileTypes: true })).filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".csv")).map((e) => e.name).sort();

    const files: DiscoveredFile[] = [];
    for (const fileName of fileEntries) {
      const absPath = join(folderAbsPath, fileName);
      const relPath = relative(process.cwd(), absPath).split("\\").join("/");
      const [stats, checksum, parsed] = await Promise.all([stat(absPath), streamChecksum(absPath), streamCsvFile(absPath)]);
      files.push({ path: relPath, fileName, byteSize: stats.size, checksum, ...parsed });
    }

    const classification = classifyFolder(folderRelPath, files, knownDisciplineKeys);
    results.push({
      folderPath: folderRelPath,
      files,
      totalFileCount: files.length,
      totalByteSize: files.reduce((sum, f) => sum + f.byteSize, 0),
      totalRowCount: files.reduce((sum, f) => sum + f.rowCount, 0),
      ...classification,
    });
  }

  return results;
}
