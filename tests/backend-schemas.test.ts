import { describe, expect, it } from "vitest";
import {
  boqItemSchema,
  projectSchema,
  validateWriteInput,
} from "../src/lib/validation/backend-schemas";
import { registerSchema } from "../src/lib/validation/auth-schemas";
import { clientCreateSchema } from "../src/lib/validation/client-schema";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("backend write schemas", () => {
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

  it("requires only company name, email and phone across client business-profile registration", () => {
    const client = clientCreateSchema.parse({
      companyName: "Small Client Co",
      email: "client@example.com",
      phone: "+971500000001",
    });

    expect(client.name).toBe("Small Client Co");
    expect(client.companyName).toBe("Small Client Co");
    expect(client.email).toBe("client@example.com");
    expect(client.phone).toBe("+971500000001");
    expect(client.address).toBeNull();
    expect(client.taxRegistrationNumber).toBeNull();
    expect(client.notes).toBeNull();

    expect(clientCreateSchema.safeParse({
      email: "client@example.com",
      phone: "+971500000001",
    }).success).toBe(false);

    expect(clientCreateSchema.safeParse({
      companyName: "Small Client Co",
      phone: "+971500000001",
    }).success).toBe(false);

    expect(clientCreateSchema.safeParse({
      companyName: "Small Client Co",
      email: "client@example.com",
    }).success).toBe(false);
  });

  it("requires company name, email and phone for account signup while profile fields remain optional", () => {
    expect(registerSchema.safeParse({
      companyName: "Small Contractor LLC",
      email: "owner@example.com",
      phone: "+971500000002",
      password: "Password123",
    }).success).toBe(true);

    expect(registerSchema.safeParse({
      companyName: "Small Contractor LLC",
      email: "owner@example.com",
      password: "Password123",
    }).success).toBe(false);
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
