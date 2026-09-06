import { describe, expect, it } from "vitest";
import {
  boqItemSchema,
  companyUpdateSchema,
  projectSchema,
  validateWriteInput,
} from "../src/lib/validation/backend-schemas";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("backend write schemas", () => {
  it("normalizes a blank optional company website to null", () => {
    expect(companyUpdateSchema.parse({
      address: "Dubai",
      taxRegistrationNumber: "",
      website: "   ",
    })).toEqual({
      address: "Dubai",
      taxRegistrationNumber: "",
      website: null,
    });
  });

  it("accepts only public web URLs for company document images", () => {
    expect(companyUpdateSchema.parse({
      logoUrl: " https://assets.example.com/logo.png ",
      stampUrl: "",
      signatureUrl: null,
    })).toEqual({
      logoUrl: "https://assets.example.com/logo.png",
      stampUrl: null,
      signatureUrl: null,
    });

    for (const logoUrl of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "https://user:secret@example.com/logo.png",
      "not a URL",
    ]) {
      const result = companyUpdateSchema.safeParse({ logoUrl });
      expect(result.success, logoUrl).toBe(false);
    }
  });

  it("returns path-addressable field errors", () => {
    const result = validateWriteInput(projectSchema, {
      clientId: "not-a-uuid",
      industryEngineId: uuid,
      slug: "Invalid Slug",
      reference: "",
      name: "Project",
      location: "Dubai",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_REQUEST");
      expect(result.error.fieldErrors).toHaveProperty("clientId");
      expect(result.error.fieldErrors).toHaveProperty("slug");
      expect(result.error.fieldErrors).toHaveProperty("reference");
    }
  });

  it("rejects a gross margin of 100 percent before calculation", () => {
    const result = boqItemSchema.safeParse({
      sectionId: uuid,
      itemNumber: 1,
      itemCode: "ITEM-001",
      category: "Construction",
      description: "Concrete",
      quantity: "1.0000",
      unit: "m3",
      marginMode: "GROSS_MARGIN",
      marginPercentage: "100",
      sortOrder: 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "marginPercentage")).toBe(true);
    }
  });
});
