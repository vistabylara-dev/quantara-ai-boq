import type { CanonicalDocumentData } from "../build-document-data";
import type { DocumentTemplateContentConfig, DocumentTemplateStyleConfig } from "../template-config";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type GenerateHtmlInput = {
  data: CanonicalDocumentData;
  style: DocumentTemplateStyleConfig;
  content: DocumentTemplateContentConfig;
};

/**
 * Self-contained, print-safe static HTML — inline CSS only, no external
 * stylesheet or script, and deliberately independent of the app's own
 * dark-mode theme (a printed/exported document must stay light unless the
 * template's own cover explicitly uses a dark style). Used both as one of
 * the five downloadable GeneratedDocument formats and as the renderer
 * behind the live `/documents/preview` route, so the two always agree.
 */
export function generateHtml(input: GenerateHtmlInput): string {
  const { data, style, content } = input;
  const rtl = style.direction === "rtl";
  const showInternal = data.boq.showInternalFields;

  const sectionsHtml = data.boq.sections
    .filter((section) => section.items.length > 0)
    .map((section) => {
      const rows = section.items
        .map(
          (item) => `
          <tr>
            <td class="num">${item.itemNumber}</td>
            <td>${escapeHtml(item.itemCode)}</td>
            <td>${escapeHtml(item.description)}</td>
            ${content.columns.specification ? `<td>${escapeHtml(item.specification)}</td>` : ""}
            <td class="num">${escapeHtml(item.unit)}</td>
            <td class="num">${item.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
            ${showInternal ? `<td class="num">${(item.landedCost ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>` : ""}
            ${showInternal ? `<td class="num">${(item.marginPercentage ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 })}%</td>` : ""}
            <td class="num">${item.sellingRate.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
            <td class="num">${item.totalAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
          </tr>`,
        )
        .join("");
      return `
        <tr class="section-row"><td colspan="10">${escapeHtml(section.code)} — ${escapeHtml(section.title)}</td></tr>
        ${rows}`;
    })
    .join("");

  const totalsHtml = [
    ["Subtotal", data.boq.totals.subtotal],
    ["Discount", data.boq.totals.discountAmount],
    ["Taxable Amount", data.boq.totals.taxableAmount],
    [`VAT (${data.project.taxRate}%)`, data.boq.totals.taxAmount],
  ]
    .map(([label, value]) => `<div class="totals-row"><span>${label}</span><span>${formatCurrency(value as number, data.project.currency)}</span></div>`)
    .join("");

  return `<!doctype html>
<html lang="${rtl ? "ar" : "en"}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.boq.title)} — ${escapeHtml(data.project.reference)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: ${rtl ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif" : "'Segoe UI', Helvetica, Arial, sans-serif"}; background: #ffffff; color: #0f172a; margin: 0; padding: 32px; }
  h1 { color: ${style.primaryColor}; font-size: 22px; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 12px; }
  .grid { display: flex; gap: 24px; margin: 20px 0; flex-wrap: wrap; }
  .grid > div { flex: 1; min-width: 220px; }
  .label { color: ${style.accentColor}; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
  th { background: ${style.primaryColor}; color: white; text-align: ${rtl ? "right" : "left"}; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: ${rtl ? "right" : "left"}; }
  td.num, th.num { text-align: ${rtl ? "left" : "right"}; }
  tr.section-row td { background: #e2e8f0; font-weight: 600; }
  .totals { margin-top: 16px; width: 280px; margin-${rtl ? "right" : "left"}: auto; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .totals-row.grand { font-weight: 700; font-size: 14px; border-top: 1px solid #0f172a; margin-top: 4px; padding-top: 8px; }
  .section-block { margin-top: 20px; }
  .section-block h2 { font-size: 13px; color: ${style.accentColor}; margin-bottom: 4px; }
  .section-block p { font-size: 11px; color: #334155; line-height: 1.5; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .signatures div { width: 40%; border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 10px; color: #64748b; }
  .draft-badge { display: inline-block; background: #fee2e2; color: #b91c1c; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 999px; margin-bottom: 12px; }
  .trial-watermark-banner { background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 11px; padding: 6px 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #bfdbfe; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  ${data.meta.isDraft ? `<div class="draft-badge">${escapeHtml(style.watermarkDraftText)}</div>` : ""}
  ${data.meta.watermarkText ? `<div class="trial-watermark-banner">${escapeHtml(data.meta.watermarkText)}</div>` : ""}
  <h1>${escapeHtml(data.boq.title)}</h1>
  <div class="muted">${escapeHtml(data.project.reference)} · Revision ${escapeHtml(data.boq.revision)} · ${data.boq.status.toUpperCase()}</div>
  <div class="muted">Generated ${new Date(data.meta.generatedAt).toLocaleString()} by ${escapeHtml(data.meta.generatedByName)} · ${escapeHtml(data.meta.templateName)}</div>

  <div class="grid">
    ${content.showCompanyInfo ? `<div><div class="label">From</div>${[data.company.legalName, data.company.address, data.company.email, data.company.phone].filter(Boolean).map((l) => `<div>${escapeHtml(l as string)}</div>`).join("")}</div>` : ""}
    ${content.showProjectInfo ? `<div><div class="label">Bill To / Project</div>${[data.client.companyName ?? data.client.name, data.project.location, `Currency: ${data.project.currency} · Tax: ${data.project.taxRate}%`].filter(Boolean).map((l) => `<div>${escapeHtml(l as string)}</div>`).join("")}</div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Code</th>
        <th>Description</th>
        ${content.columns.specification ? "<th>Spec</th>" : ""}
        <th class="num">Unit</th>
        <th class="num">Qty</th>
        ${showInternal ? '<th class="num">Landed</th>' : ""}
        ${showInternal ? '<th class="num">Margin</th>' : ""}
        <th class="num">Rate</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${sectionsHtml}</tbody>
  </table>

  <div class="totals">
    ${totalsHtml}
    <div class="totals-row grand"><span>Grand Total</span><span>${formatCurrency(data.boq.totals.grandTotal, data.project.currency)}</span></div>
  </div>

  ${content.showTermsSection ? `<div class="section-block"><h2>Terms &amp; Payment</h2><p>${escapeHtml(data.boq.termsText)}</p></div>` : ""}
  ${content.showExclusionsSection ? `<div class="section-block"><h2>Exclusions</h2><p>${escapeHtml(data.boq.exclusionsText)}</p></div>` : ""}
  ${content.showSignatureSection ? `<div class="signatures"><div>Prepared by</div><div>Client acceptance</div></div>` : ""}
</body>
</html>`;
}
