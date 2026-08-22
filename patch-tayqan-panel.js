const fs = require('fs');
let file = 'src/components/tayqan/tayqan-work-order-panel.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchInterface = `  qaWorkerRunId: string | null;
  measurementExceptions: {`;

const replaceInterface = `  qaWorkerRunId: string | null;
  aiDraft: { boqId: string; addedCount: number; skippedCount: number; alreadyPresentCount: number; unreviewedAddedCount: number; reviewedAddedCount: number; } | null;
  measurementExceptions: {`;

content = content.replace(searchInterface, replaceInterface);

const searchCondition = `{state.boqId && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm font-semibold text-slate-200">{t("tayqan.hire.workflow.exportDraftBoqTitle")}</p>`;

const replaceCondition = `{state.boqId && state.aiDraft !== null && (state.aiDraft.addedCount > 0 || state.aiDraft.alreadyPresentCount > 0) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm font-semibold text-slate-200">{t("tayqan.hire.workflow.exportDraftBoqTitle")}</p>`;

content = content.replace(searchCondition, replaceCondition);

fs.writeFileSync(file, content);
console.log('patched tayqan-work-order-panel.tsx');
