const fs = require('fs');
let file = 'src/lib/services/tayqan-work-order-service.ts';
let content = fs.readFileSync(file, 'utf8');

const search = `function toState(order: Awaited<ReturnType<typeof loadOrder>>) {
  return {
    id: order.id,`;

const replace = `function toState(order: Awaited<ReturnType<typeof loadOrder>>) {
  const progress = parseProgress(order.progressJson);
  return {
    id: order.id,`;

const search2 = `    measurementExceptions: measurementExceptionsSummary(parseProgress(order.progressJson)),
    startedAt: order.startedAt.toISOString(),`;

const replace2 = `    measurementExceptions: measurementExceptionsSummary(progress),
    aiDraft: progress.aiDraft ?? null,
    startedAt: order.startedAt.toISOString(),`;

content = content.replace(search, replace).replace(search2, replace2);
fs.writeFileSync(file, content);
console.log("patched toState");
