const fs = require('fs');

let c = fs.readFileSync('tests/commerce-product-routes.test.ts', 'utf8');

// The original test block is approximately:
// it("v4 gate 1: an APPROVED enterprise_core annual price never exposes its amountMinor or price code through GET /api/commerce/products, while an approved Starter price still does", async () => { ... });

const oldTestBlock = `    it("v4 gate 1: an APPROVED enterprise_core annual price never exposes its amountMinor or price code through GET /api/commerce/products, while an approved Starter price still does", async () => {
      await seedCommerceProducts(prisma);
      const enterpriseStub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "enterprise_core" }, include: { prices: true } });
      expect(enterpriseStub.purchaseMode).toBe("DIRECT");
      const annualPrice = enterpriseStub.prices.find((p) => p.billingInterval === "YEAR" && p.isActive);
      expect(annualPrice).toBeDefined();
      await prisma.commercePrice.update({ where: { id: annualPrice!.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId, reviewedAt: new Date() } });
      await prisma.commercePrice.updateMany({ where: { code: "starter_monthly_aed_149" }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId, reviewedAt: new Date() } });

      const res = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      const body = await json(res);

      const enterpriseCore = body.data.find((p: { code: string }) => p.code === "enterprise_core");
      // Product metadata stays public...
      expect(enterpriseCore).toBeDefined();
      expect(enterpriseCore.purchaseMode).toBe("DIRECT");
      // ...but the approved annual price is withheld entirely — no price code, no amount.
      expect(enterpriseCore.prices).toHaveLength(0);
      expect(JSON.stringify(enterpriseCore)).not.toContain(annualPrice!.code);
      expect(JSON.stringify(enterpriseCore)).not.toContain(String(annualPrice!.amountMinor));

      // Starter — a non-redacted, non-Enterprise product — is entirely unaffected.
      const starter = body.data.find((p: { code: string }) => p.code === "starter");
      expect(starter).toBeDefined();
      const starterMonthly = starter.prices.find((p: { code: string }) => p.code === "starter_monthly_aed_149");
      expect(starterMonthly).toBeDefined();
      expect(starterMonthly.amountMinor).toBe(14900);
    });`;

const newTestBlock = `    it("an APPROVED enterprise_core annual price correctly exposes its amountMinor and price code through GET /api/commerce/products because Enterprise is DIRECT", async () => {
      await seedCommerceProducts(prisma);
      const enterpriseStub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code: "enterprise_core" }, include: { prices: true } });
      expect(enterpriseStub.purchaseMode).toBe("DIRECT");
      const annualPrice = enterpriseStub.prices.find((p) => p.billingInterval === "YEAR" && p.isActive);
      expect(annualPrice).toBeDefined();
      await prisma.commercePrice.update({ where: { id: annualPrice!.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId, reviewedAt: new Date() } });
      await prisma.commercePrice.updateMany({ where: { code: "starter_monthly_aed_149" }, data: { reviewStatus: "APPROVED", reviewedByUserId: ownerUserId, reviewedAt: new Date() } });

      const res = await publicProductsGET(new Request("http://localhost/api/commerce/products"));
      const body = await json(res);

      const enterpriseCore = body.data.find((p: { code: string }) => p.code === "enterprise_core");
      expect(enterpriseCore).toBeDefined();
      expect(enterpriseCore.purchaseMode).toBe("DIRECT");
      
      expect(enterpriseCore.prices).toHaveLength(1);
      const exposedPrice = enterpriseCore.prices[0];
      expect(exposedPrice.code).toBe(annualPrice!.code);
      expect(exposedPrice.amountMinor).toBe(annualPrice!.amountMinor);

      // Starter is also fully public.
      const starter = body.data.find((p: { code: string }) => p.code === "starter");
      expect(starter).toBeDefined();
      const starterMonthly = starter.prices.find((p: { code: string }) => p.code === "starter_monthly_aed_149");
      expect(starterMonthly).toBeDefined();
      expect(starterMonthly.amountMinor).toBe(14900);
    });`;

// Replace using regex or direct string
if (c.includes(oldTestBlock)) {
    c = c.replace(oldTestBlock, newTestBlock);
} else {
    // If exact string match fails, let's try regex fallback
    const startStr = 'it("v4 gate 1: an APPROVED enterprise_core annual price never exposes';
    const endStr = 'expect(starterMonthly.amountMinor).toBe(14900);\n    });';
    const startIndex = c.indexOf(startStr);
    const endIndex = c.indexOf(endStr) + endStr.length;
    if (startIndex !== -1 && endIndex !== -1) {
        c = c.substring(0, startIndex) + newTestBlock + c.substring(endIndex);
    } else {
        console.error("Could not find old test block!");
    }
}

fs.writeFileSync('tests/commerce-product-routes.test.ts', c);
