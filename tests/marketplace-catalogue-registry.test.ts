import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { listDatasetDefinitions, requireDatasetDefinition, getDatasetDefinition } from "@/lib/services/catalogue-dataset-registry";

describe("Marketplace Catalogue Registry", () => {
  it("should list all datasets", () => {
    const datasets = listDatasetDefinitions();
    expect(datasets.length).toBeGreaterThan(0);
  });

  it("should retrieve a valid dataset definition", () => {
    const dataset = requireDatasetDefinition("quantara-master-architectural-finishes-v1");
    expect(dataset.datasetId).toBe("quantara-master-architectural-finishes-v1");
    expect(dataset.targetPackageCode).toBe("architectural-finishes-library");
  });

  it("should throw NotFoundError for invalid dataset definition", () => {
    expect(() => requireDatasetDefinition("invalid-dataset-id")).toThrow();
  });

  it("should return null for non-existent dataset", () => {
    const dataset = getDatasetDefinition("invalid-dataset-id");
    expect(dataset).toBeNull();
  });
});
