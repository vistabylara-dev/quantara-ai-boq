const fs = require('fs');

let c = fs.readFileSync('tests/commerce-product-routes.test.ts', 'utf8');

const startStr = 'it("v4 gate 1: an APPROVED enterprise_core annual price never exposes';
const endStr = 'expect(starterMonthly.amountMinor).toBe(14900);\n    });';
const startIndex = c.indexOf(startStr);
const endIndex = c.indexOf(endStr) + endStr.length;
if (startIndex !== -1 && endIndex !== -1) {
    const newTestBlock = `it("an APPROVED enterprise_core annual price correctly exposes its amountMinor and price code through GET /api/commerce/products because Enterprise is DIRECT", async () => {
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
    c = c.substring(0, startIndex) + newTestBlock + c.substring(endIndex);
    fs.writeFileSync('tests/commerce-product-routes.test.ts', c);
} else {
    console.error("Not found!");
}
