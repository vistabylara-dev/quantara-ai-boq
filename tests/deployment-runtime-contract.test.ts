import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type RootPackage = {
  packageManager?: string;
  engines?: Record<string, string>;
};

type RootLockfile = {
  packages?: Record<string, { engines?: Record<string, string> }>;
};

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as RootPackage;
const packageLock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
) as RootLockfile;

describe("deployment runtime contract", () => {
  it("allows hosting platforms to apply compatible Node 24 and npm 11 updates", () => {
    const deployEngines = {
      node: "24.x",
      npm: "11.x",
    };

    expect(packageJson.engines).toEqual(deployEngines);
    expect(packageLock.packages?.[""]?.engines).toEqual(deployEngines);
  });

  it("retains exact local and CI toolchain pins", () => {
    const nodeVersion = readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim();
    const npmConfig = readFileSync(new URL("../.npmrc", import.meta.url), "utf8");

    expect(nodeVersion).toBe("24.17.0");
    expect(packageJson.packageManager).toBe("npm@11.13.0");
    expect(npmConfig).toMatch(/^engine-strict=true$/m);
  });
});
