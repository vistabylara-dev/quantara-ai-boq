import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveUploadDrawingHref, resolveBoqHref, type CurrentProject } from "../src/components/dashboard/workspace-header";

/**
 * Regression coverage for the production incident: the dashboard header's prominent
 * "Upload Drawing" button — the most visible upload action in the whole app — linked to
 * /imports (the CSV/XLSX spreadsheet importer) whenever there was no active project, which is
 * how a PDF ended up being processed as a spreadsheet import and returned "This XLSX file
 * couldn't be read."
 */
const project: CurrentProject = { id: "proj-abc", name: "Test Project", reference: "P-1", status: "ACTIVE", client: null };

describe("dashboard workspace header — navigation contract", () => {
  it("never points Upload Drawing at /imports, with or without an active project", () => {
    expect(resolveUploadDrawingHref(null)).not.toBe("/imports");
    expect(resolveUploadDrawingHref(project)).not.toBe("/imports");
  });

  it("never points Upload Drawing at the legacy /files extraction-preview page", () => {
    expect(resolveUploadDrawingHref(project)).not.toMatch(/\/files$/);
  });

  it("routes Upload Drawing to the real project drawing uploader when a project is active", () => {
    expect(resolveUploadDrawingHref(project)).toBe("/projects/proj-abc/drawings");
  });

  it("routes Upload Drawing to project creation when there is no active project", () => {
    expect(resolveUploadDrawingHref(null)).toBe("/projects/new");
  });

  it("keeps Create BOQ carrying the active project's ID", () => {
    expect(resolveBoqHref(project)).toBe("/projects/proj-abc/boq");
    expect(resolveBoqHref(null)).toBe("/projects/new");
  });

  it("routes the dashboard upload ring through the drawing resolver while preserving spreadsheet import separately", () => {
    const source = readFileSync(join(__dirname, "..", "src", "app", "dashboard", "page.tsx"), "utf8");
    expect(source).toContain("href={resolveUploadDrawingHref(currentProject)}");
    expect(source).toContain('href="/imports" label={t("dashboard.spreadsheetImport")}');
    expect(source).not.toContain('<Link href="/imports" className="relative group w-72 h-72');
  });
});
