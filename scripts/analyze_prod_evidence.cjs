const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:\\Users\\PC\\.gemini\\antigravity\\brain\\287a06bb-9e83-4e95-b39b-dd28dbc5135e\\scratch\\prod_evidence.json'));

const results = data.data.datasets.map(d => ({
  package: d.targetPackageCode,
  jobStatus: d.job.status,
  expected: d.expectedRowCount,
  actual: d.itemCount,
  match: d.expectedRowCount === d.itemCount ? "MATCH" : "MISMATCH"
}));

console.table(results);
console.log(`Summary: ${data.data.summary.datasetsCompleted} completed out of 15. Total Items: ${data.data.summary.totalItemsCreated}`);
