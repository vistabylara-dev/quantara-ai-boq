import type { CanonicalDocumentData } from "../build-document-data";
import type { DocumentTemplateContentConfig, DocumentTemplateStyleConfig } from "../template-config";
import {
  getDocumentItemSpecification,
  getDocumentItemQuantity,
  getDocumentOutputSections,
  shouldRenderDocumentSection,
  shouldRenderSpecification,
} from "../furniture-document-output";
import { logoImageToDataUri, type LoadedLogoImage } from "../logo-image";

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

/**
 * A professional, repeating diagonal watermark tile (data-URI SVG
 * background-image) — used both for the trial-export watermarked HTML
 * download and the commercially-locked in-app preview, so an unpaid/draft
 * export is unmistakably marked across the whole page, not just a single
 * top banner easy to crop out of a screenshot.
 */
function watermarkBackgroundCss(text: string): string {
  const safeText = text.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[char] ?? char));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240"><text x="0" y="130" transform="rotate(-32 180 120)" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#2563eb" fill-opacity="0.14">${safeText}</text></svg>`;
  return `background-image: url("data:image/svg+xml,${encodeURIComponent(svg)}"); background-repeat: repeat;`;
}

export type GenerateHtmlInput = {
  data: CanonicalDocumentData;
  style: DocumentTemplateStyleConfig;
  content: DocumentTemplateContentConfig;
  logoImage?: LoadedLogoImage | null;
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
  const showSpecification = shouldRenderSpecification(data, content.columns.specification);
  const logoDataUri = logoImageToDataUri(input.logoImage);
  const tableColumnCount = 7 + (showSpecification ? 1 : 0) + (showInternal ? 2 : 0);

  const sectionsHtml = getDocumentOutputSections(data)
    .filter((section) => shouldRenderDocumentSection(data, section))
    .map((section) => {
      const rows = section.items
        .map(
          (item) => `
          <tr>
            <td class="num">${item.itemNumber}</td>
            <td>${escapeHtml(item.itemCode)}</td>
            <td>${escapeHtml(item.description)}</td>
            ${showSpecification ? `<td class="specification">${escapeHtml(getDocumentItemSpecification(data, item))}</td>` : ""}
            <td class="num">${escapeHtml(item.unit)}</td>
            <td class="num">${getDocumentItemQuantity(data, item)}</td>
            ${showInternal ? `<td class="num">${(item.landedCost ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>` : ""}
            ${showInternal ? `<td class="num">${(item.marginPercentage ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 })}%</td>` : ""}
            <td class="num">${(item.sellingRate ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
            <td class="num">${(item.totalAmount ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
          </tr>`,
        )
        .join("");
      return `
        <tr class="section-row"><td colspan="${tableColumnCount}">${escapeHtml(section.code)} — ${escapeHtml(section.title)}</td></tr>
        ${rows}`;
    })
    .join("");

  // HTML generation only ever receives WITH_PRICES data today (QUANTITIES_ONLY
  // is DOCX-only per this mission) — totals is always populated here; the
  // fallback only satisfies the now-optional shared type, it changes nothing.
  const htmlTotals = data.boq.totals ?? { subtotal: 0, discountAmount: 0, taxableAmount: 0, taxAmount: 0, grandTotal: 0 };
  const totalsHtml = [
    ["Subtotal", htmlTotals.subtotal],
    ["Discount", htmlTotals.discountAmount],
    ["Taxable Amount", htmlTotals.taxableAmount],
    [`VAT (${data.project.taxRate}%)`, htmlTotals.taxAmount],
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
  body { font-family: ${rtl ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif" : "'Segoe UI', Helvetica, Arial, sans-serif"}; background-color: #ffffff; color: #0f172a; margin: 0; padding: 32px; ${data.meta.watermarkText ? watermarkBackgroundCss(data.meta.watermarkText) : ""} }
  h1 { color: ${style.primaryColor}; font-size: 22px; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 12px; }
  .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .company-logo { max-height: 56px; max-width: 180px; object-fit: contain; }
  .grid { display: flex; gap: 24px; margin: 20px 0; flex-wrap: wrap; }
  .grid > div { flex: 1; min-width: 220px; }
  .label { color: ${style.accentColor}; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
  th { background: ${style.primaryColor}; color: white; text-align: ${rtl ? "right" : "left"}; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: ${rtl ? "right" : "left"}; }
  td.specification { white-space: pre-line; }
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
  <div class="header-row">
    <div>
      <h1>${escapeHtml(data.boq.title)}</h1>
      <div class="muted">${escapeHtml(data.project.reference)} · Revision ${escapeHtml(data.boq.revision)} · ${data.boq.status.toUpperCase()}</div>
      <div class="muted">Generated ${new Date(data.meta.generatedAt).toLocaleString()} by ${escapeHtml(data.meta.generatedByName)} · ${escapeHtml(data.meta.templateName)}</div>
    </div>
    ${logoDataUri ? `<img class="company-logo" src="${escapeHtml(logoDataUri)}" alt="${escapeHtml(data.company.tradeName || data.company.legalName || "Company")} logo" />` : ""}
  </div>

  <div class="grid">
    ${content.showCompanyInfo ? `<div><div class="label">From</div>${[data.company.legalName, data.company.address, data.company.email, data.company.phone, data.company.website, data.company.taxRegistrationNumber ? `TRN: ${data.company.taxRegistrationNumber}` : ""].filter(Boolean).map((l) => `<div>${escapeHtml(l as string)}</div>`).join("")}</div>` : ""}
    ${content.showProjectInfo ? `<div><div class="label">Bill To / Project</div>${[data.client.companyName ?? data.client.name, data.project.location, `Currency: ${data.project.currency} · Tax: ${data.project.taxRate}%`].filter(Boolean).map((l) => `<div>${escapeHtml(l as string)}</div>`).join("")}</div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Code</th>
        <th>Description</th>
        ${showSpecification ? `<th>${data.furniture ? "Specification / Evidence" : "Spec"}</th>` : ""}
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
    <div class="totals-row grand"><span>Grand Total</span><span>${formatCurrency(htmlTotals.grandTotal, data.project.currency)}</span></div>
  </div>

  ${content.showTermsSection ? `<div class="section-block"><h2>Terms &amp; Payment</h2><p>${escapeHtml(data.boq.termsText)}</p></div>` : ""}
  ${content.showExclusionsSection ? `<div class="section-block"><h2>Exclusions</h2><p>${escapeHtml(data.boq.exclusionsText)}</p></div>` : ""}
  ${content.showSignatureSection ? `<div class="signatures"><div>Prepared by</div><div>Client acceptance</div></div>` : ""}
</body>
</html>`;
}
