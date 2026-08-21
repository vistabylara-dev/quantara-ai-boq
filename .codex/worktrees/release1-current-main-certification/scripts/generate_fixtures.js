const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const fixturesDir = path.join(__dirname, '../tests/e2e/fixtures');

if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Write a simple text file
const textPath = path.join(fixturesDir, 'sample.txt');
fs.writeFileSync(textPath, 'Sample construction BOQ item: 100x100mm wood block, Quantity: 50, Unit: PCS\n');

try {
  require.resolve('xlsx');
} catch (e) {
  console.log('Installing xlsx for fixture generation...');
  execSync('npm install --no-save xlsx');
}

const XLSX = require('xlsx');

// Create XLSX
const wb = XLSX.utils.book_new();
const wsData = [
  ['Item Code', 'Description', 'Quantity', 'Unit', 'Rate'],
  ['BW-01', 'Blockwork 200mm', 1500, 'SQM', 45.0],
  ['PT-01', 'Emulsion Paint', 3000, 'SQM', 12.5]
];
const ws = XLSX.utils.aoa_to_sheet(wsData);
XLSX.utils.book_append_sheet(wb, ws, 'BOQ');
XLSX.writeFile(wb, path.join(fixturesDir, 'sample-data.xlsx'));
console.log('Created sample-data.xlsx');

// Generate a dummy PDF.
try {
  require.resolve('pdfkit');
} catch (e) {
  console.log('Installing pdfkit for fixture generation...');
  execSync('npm install --no-save pdfkit');
}

const PDFDocument = require('pdfkit');

function createPdf(filename, text, isScanned) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(path.join(fixturesDir, filename));
    doc.pipe(stream);
    
    doc.fontSize(20).text('Quantara Test Document', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(text);
    
    if (isScanned) {
        doc.text('\n[SCANNED IMAGE DATA PLACEHOLDER]');
    }
    
    doc.end();
    stream.on('finish', () => {
      console.log(`Created ${filename}`);
      resolve();
    });
  });
}

async function run() {
  await createPdf('sample-text.pdf', '1.0 Substructure\n1.1 Excavation\nVolume: 500 CUM', false);
  await createPdf('sample-scanned.pdf', 'Scanned BOQ Document Page 1', true);
  console.log('All fixtures generated successfully.');
}

run();
