const fs = require('fs');
let file = 'src/components/tayqan/tayqan-work-order-panel.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `  qaWorkerRunId: string | null;`,
  `  qaWorkerRunId: string | null;\n  aiDraft: { boqId: string; addedCount: number; skippedCount: number; alreadyPresentCount: number; unreviewedAddedCount: number; reviewedAddedCount: number; } | null;`
);

content = content.replace(
  `      {state.boqId && (`,
  `      {state.boqId && state.aiDraft !== null && (state.aiDraft.addedCount > 0 || state.aiDraft.alreadyPresentCount > 0) && (`
);

fs.writeFileSync(file, content);
console.log("patched!");
