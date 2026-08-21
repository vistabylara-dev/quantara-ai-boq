import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const fixturesDir = path.join(__dirname, '..', 'tests', 'e2e', 'fixtures');

async function generateFixtures() {
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // 1. Generate text PDF
  const textPdfPath = path.join(fixturesDir, 'sample-text.pdf');
  const doc1 = new PDFDocument();
  doc1.pipe(fs.createWriteStream(textPdfPath));
  doc1.fontSize(20).text('Bill of Quantities', 100, 100);
  doc1.fontSize(12).text('Description: Concrete Foundation');
  doc1.fontSize(12).text('Quantity: 50');
  doc1.fontSize(12).text('Unit: m3');
  doc1.end();
  console.log('Created sample-text.pdf');

  // 2. Generate scanned PDF (simulated by having no text, just an empty space or image if possible, but actually just an empty doc with no text nodes, maybe vector graphics)
  const scannedPdfPath = path.join(fixturesDir, 'sample-scanned.pdf');
  const doc2 = new PDFDocument();
  doc2.pipe(fs.createWriteStream(scannedPdfPath));
  // Draw a rectangle to ensure page has content but no text
  doc2.rect(100, 100, 400, 400).fill('gray');
  doc2.end();
  console.log('Created sample-scanned.pdf');

  // 3. Generate XLSX
  const xlsxPath = path.join(fixturesDir, 'sample.xlsx');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BOQ');
  sheet.addRow(['Item', 'Description', 'Qty', 'Unit', 'Rate']);
  sheet.addRow(['1.1', 'Concrete Foundation', 50, 'm3', 120]);
  sheet.addRow(['1.2', 'Steel Reinforcement', 10, 'ton', 800]);
  await workbook.xlsx.writeFile(xlsxPath);
  console.log('Created sample.xlsx');
}

generateFixtures().catch(console.error);
