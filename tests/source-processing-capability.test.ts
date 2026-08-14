import { describe, expect, it } from "vitest";
import { getSourceProcessingCapability } from "../src/lib/files/source-processing-capability";
import { PROVIDER_REGISTRY } from "../src/lib/integrations/provider-registry";
import { ARCADE_PROVIDER_CONFIGURATIONS } from "../src/lib/integrations/arcade/arcade-provider-config";

describe("source-processing capability truth", () => {
  it("allows only real current rendering/table paths", () => {
    expect(getSourceProcessingCapability("pdf")).toMatchObject({ canRenderPages: true, canExtractTables: true });
    expect(getSourceProcessingCapability("xlsx")).toMatchObject({ canRenderPages: false, canExtractTables: true });
    expect(getSourceProcessingCapability("png")).toMatchObject({ canRenderPages: true, canExtractTables: false });
  });

  it("keeps CAD/BIM uploads as evidence without claiming native extraction", () => {
    for (const extension of ["dwg", "dxf", "ifc", "rvt"]) {
      const capability = getSourceProcessingCapability(extension);
      expect(capability.mode).toBe("CAD_BIM_CONNECTOR_REQUIRED");
      expect(capability.canRenderPages).toBe(false);
      expect(capability.canExtractTables).toBe(false);
      expect(capability.message).toMatch(/not currently enabled|not currently/i);
    }
  });

  it("keeps Autodesk-family marketplace claims aligned with runtime reality", () => {
    for (const id of ["autodesk", "autocad"]) {
      const provider = PROVIDER_REGISTRY.find((entry) => entry.id === id);
      expect(provider).toBeDefined();
      expect(provider?.status).toBe("BETA");
      expect(provider?.supportedData.length).toBeGreaterThan(0);
      expect(provider?.description).toMatch(/metadata|review/i);
    }

    for (const id of ["revit", "autodesk-construction-cloud", "bim-360", "civil-3d", "navisworks"]) {
      const provider = PROVIDER_REGISTRY.find((entry) => entry.id === id);
      expect(provider).toBeDefined();
      expect(provider?.status).toBe("COMING_SOON");
      expect(provider?.supportedData).toEqual([]);
    }

    // Marketplace beta status never upgrades direct CAD/BIM upload support:
    // the runtime still requires the controlled connector and human review.
    expect(getSourceProcessingCapability("dwg").mode).toBe("CAD_BIM_CONNECTOR_REQUIRED");
    expect(ARCADE_PROVIDER_CONFIGURATIONS).toEqual([]);
  });
});
