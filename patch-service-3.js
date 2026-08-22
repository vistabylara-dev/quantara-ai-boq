const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `return fail(actor, loaded, "SCOPE_COVERAGE_INCOMPLETE", "tayqan.hire.workflow.scopeCoverageIncomplete", {\n      kind: "ACTION",\n      i18nKey: "tayqan.hire.workflow.scopeCoverageIncomplete",\n    }, new AppError`,
  `return fail(actor, loaded, "SCOPE_COVERAGE_INCOMPLETE", "tayqan.hire.workflow.scopeCoverageIncomplete", {\n      kind: "ERROR",\n      i18nKey: "tayqan.hire.workflow.scopeCoverageIncomplete",\n      error: { code: "SCOPE_COVERAGE_INCOMPLETE" }\n    }, new AppError`
);
fs.writeFileSync(file, content);
console.log("patched!");
