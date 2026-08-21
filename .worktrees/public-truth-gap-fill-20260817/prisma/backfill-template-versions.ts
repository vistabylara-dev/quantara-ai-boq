import { createDirectPrismaClient } from "../src/lib/db/direct-prisma-client";
/**
 * TEMPLATE-LINK-1 — every DocumentTemplate/TechnicalReportTemplate/EmailTemplate
 * row that existed before versioning gets a version 1 PUBLISHED using its own
 * current content (no fabrication — it's exactly what the row already had),
 * and every existing GeneratedDocument/GeneratedTechnicalReport/EmailDispatch
 * row gets its new templateVersionId/emailTemplateVersionId pointed at that
 * version 1, so historical output stays truthfully attributable. Idempotent:
 * a template that already has a version 1 is skipped, an already-linked
 * generated row is left alone.
 *
 * Usage:
 *   npx tsx prisma/backfill-template-versions.ts --dry-run
 *   npx tsx prisma/backfill-template-versions.ts
 */
import { PlatformRole } from "@prisma/client";

const prisma = createDirectPrismaClient();

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`TEMPLATE-LINK-1 version backfill — ${dryRun ? "DRY RUN" : "EXECUTE"}`);

  const owner = await prisma.user.findFirst({ where: { platformRole: PlatformRole.PLATFORM_OWNER }, select: { id: true, email: true } });
  if (!owner) {
    console.error("No PLATFORM_OWNER user found — cannot attribute this backfill to an actor. Aborting.");
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`Acting as platform owner: ${owner.email}`);

  // --- DocumentTemplate ---
  const documentTemplates = await prisma.documentTemplate.findMany({ where: { versions: { none: {} } } });
  console.log(`\nDocumentTemplate: ${documentTemplates.length} template(s) with no version yet.`);
  const documentTemplateVersionByTemplateId = new Map<string, string>();
  if (!dryRun) {
    for (const t of documentTemplates) {
      const v = await prisma.documentTemplateVersion.create({
        data: { documentTemplateId: t.id, versionNumber: 1, status: "PUBLISHED", styleConfigJson: t.styleConfigJson as never, contentConfigJson: t.contentConfigJson as never, changeSummary: "Backfilled from the template's own pre-existing content.", effectiveDate: new Date(), createdByUserId: owner.id },
      });
      documentTemplateVersionByTemplateId.set(t.id, v.id);
    }
    console.log(`  Created ${documentTemplateVersionByTemplateId.size} version(s).`);
  }

  // --- TechnicalReportTemplate ---
  const reportTemplates = await prisma.technicalReportTemplate.findMany({ where: { versions: { none: {} } } });
  console.log(`\nTechnicalReportTemplate: ${reportTemplates.length} template(s) with no version yet.`);
  const reportTemplateVersionByTemplateId = new Map<string, string>();
  if (!dryRun) {
    for (const t of reportTemplates) {
      const v = await prisma.technicalReportTemplateVersion.create({
        data: { technicalReportTemplateId: t.id, versionNumber: 1, status: "PUBLISHED", sectionsJson: t.sectionsJson as never, changeSummary: "Backfilled from the template's own pre-existing content.", effectiveDate: new Date(), createdByUserId: owner.id },
      });
      reportTemplateVersionByTemplateId.set(t.id, v.id);
    }
    console.log(`  Created ${reportTemplateVersionByTemplateId.size} version(s).`);
  }

  // --- EmailTemplate ---
  const emailTemplates = await prisma.emailTemplate.findMany({ where: { versions: { none: {} } } });
  console.log(`\nEmailTemplate: ${emailTemplates.length} template(s) with no version yet.`);
  const emailTemplateVersionByTemplateId = new Map<string, string>();
  if (!dryRun) {
    for (const t of emailTemplates) {
      const v = await prisma.emailTemplateVersion.create({
        data: { emailTemplateId: t.id, versionNumber: 1, status: "PUBLISHED", subject: t.subject, bodyHtml: t.bodyHtml, bodyText: t.bodyText, changeSummary: "Backfilled from the template's own pre-existing content.", effectiveDate: new Date(), createdByUserId: owner.id },
      });
      emailTemplateVersionByTemplateId.set(t.id, v.id);
    }
    console.log(`  Created ${emailTemplateVersionByTemplateId.size} version(s).`);
  }

  if (dryRun) {
    console.log("\nDry run — no generated-row backfill performed. Re-run without --dry-run to create versions and link historical rows.");
    await prisma.$disconnect();
    return;
  }

  // --- Link historical generated rows to their template's new version 1 ---
  const unlinkedDocuments = await prisma.generatedDocument.findMany({ where: { templateVersionId: null }, select: { id: true, templateId: true } });
  let linkedDocuments = 0;
  for (const doc of unlinkedDocuments) {
    const versionId = documentTemplateVersionByTemplateId.get(doc.templateId) ?? (await prisma.documentTemplateVersion.findFirst({ where: { documentTemplateId: doc.templateId }, orderBy: { versionNumber: "asc" } }))?.id;
    if (!versionId) continue;
    await prisma.generatedDocument.update({ where: { id: doc.id }, data: { templateVersionId: versionId } });
    linkedDocuments++;
  }
  console.log(`\nLinked ${linkedDocuments} historical GeneratedDocument row(s) to their template's version 1.`);

  const unlinkedReports = await prisma.generatedTechnicalReport.findMany({ where: { templateVersionId: null }, select: { id: true, templateId: true } });
  let linkedReports = 0;
  for (const report of unlinkedReports) {
    const versionId = reportTemplateVersionByTemplateId.get(report.templateId) ?? (await prisma.technicalReportTemplateVersion.findFirst({ where: { technicalReportTemplateId: report.templateId }, orderBy: { versionNumber: "asc" } }))?.id;
    if (!versionId) continue;
    await prisma.generatedTechnicalReport.update({ where: { id: report.id }, data: { templateVersionId: versionId } });
    linkedReports++;
  }
  console.log(`Linked ${linkedReports} historical GeneratedTechnicalReport row(s) to their template's version 1.`);

  const unlinkedDispatches = await prisma.emailDispatch.findMany({ where: { emailTemplateVersionId: null, emailTemplateId: { not: null } }, select: { id: true, emailTemplateId: true } });
  let linkedDispatches = 0;
  for (const dispatch of unlinkedDispatches) {
    if (!dispatch.emailTemplateId) continue;
    const versionId = emailTemplateVersionByTemplateId.get(dispatch.emailTemplateId) ?? (await prisma.emailTemplateVersion.findFirst({ where: { emailTemplateId: dispatch.emailTemplateId }, orderBy: { versionNumber: "asc" } }))?.id;
    if (!versionId) continue;
    await prisma.emailDispatch.update({ where: { id: dispatch.id }, data: { emailTemplateVersionId: versionId } });
    linkedDispatches++;
  }
  console.log(`Linked ${linkedDispatches} historical EmailDispatch row(s) to their template's version 1.`);

  console.log("\nDone.");
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
