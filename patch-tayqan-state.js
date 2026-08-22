const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');

const search = `      qaWorkerRunId: order.qaWorkerRunId,
      measurementExceptions: measurementExceptionsSummary(parseProgress(order.progressJson)),`;

const replace = `      qaWorkerRunId: order.qaWorkerRunId,
      aiDraft: parseProgress(order.progressJson).aiDraft ?? null,
      measurementExceptions: measurementExceptionsSummary(parseProgress(order.progressJson)),`;

content = content.replace(search, replace);
fs.writeFileSync(file, content);
console.log('patched toState in tayqan-work-order-service.ts');
