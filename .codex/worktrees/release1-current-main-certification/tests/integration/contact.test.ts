import { expect, test, describe, afterAll } from "vitest";
import { POST } from "../../src/app/api/contact/route";
import { prisma } from "../../src/lib/db/prisma";
import { z } from "zod";

describe("Contact API Integration Test", () => {
  let createdRecordId: string | null = null;

  afterAll(async () => {
    // Cleanup
    if (createdRecordId) {
      await prisma.salesInquiry.delete({
        where: { id: createdRecordId },
      });
    }
  });

  test("should reject invalid direct API requests", async () => {
    const req = new Request("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({ firstName: "Only First Name" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  test("should persist real SalesInquiry with consent and deliveryStatus", async () => {
    const payload = {
      firstName: "Integration",
      lastName: "Test",
      workEmail: "test@quantara.com",
      companyType: "Main Contractor",
      constructionDiscipline: "Civil",
      currentBoqProcess: "Excel",
      monthlyVolume: "6-20",
      requiredInputs: "PDF",
      requiredOutputs: "Excel",
      numberOfUsers: "1-5",
      integrationRequirements: "ERP",
      preferredContactMethod: "Email",
      consent: true,
      companySize: "1-50",
      useCase: "Enterprise BOQ",
    };

    const req = new Request("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);

    // Verify Prisma
    const record = await prisma.salesInquiry.findFirst({
      where: { workEmail: "test@quantara.com" },
      orderBy: { createdAt: "desc" },
    });

    expect(record).not.toBeNull();
    if (record) {
      createdRecordId = record.id;
      expect(record.deliveryStatus).toBe("stored");
      expect(record.consent).toBe(true);
      expect(record.constructionDiscipline).toBe("Civil");
    }
  });
});
