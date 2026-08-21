import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const packages = await prisma.industryDataPackage.findMany({
    include: {
      items: true
    }
  });

  const products = await prisma.commerceProduct.findMany({
    where: { industryPackageId: { in: packages.map(p => p.id) } },
    include: { prices: true }
  });

  let report = "# Price Setup Pending Audit\n\n";
  report += "| Package | Product Code | Is Active | Has Price | Status |\n";
  report += "|---------|--------------|-----------|-----------|--------|\n";

  let ready = 0;
  let pending = 0;

  for (const pkg of packages) {
    const prod = products.find(p => p.industryPackageId === pkg.id);
    const hasActivePrice = prod?.prices.some(p => p.isActive) ?? false;
    
    let status = "❌ PRICE SETUP PENDING";
    if (prod && prod.isActive && hasActivePrice) {
      status = "✅ READY";
      ready++;
    } else {
      pending++;
    }

    report += `| ${pkg.name} | ${prod ? prod.code : 'N/A'} | ${prod ? prod.isActive : 'N/A'} | ${hasActivePrice} | ${status} |\n`;
  }

  report += `\n**Summary:** ${ready} Ready, ${pending} Pending Setup.\n`;
  
  // write to artifacts directory
  fs.writeFileSync("C:/Users/PC/.gemini/antigravity/brain/287a06bb-9e83-4e95-b39b-dd28dbc5135e/price_setup_pending_audit_report.md", report);
  console.log("Done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
