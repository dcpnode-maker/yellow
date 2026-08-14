import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ALLOWED_LICENSES,
  auditInstalledPackages,
  extractLicenseExpressions,
  isAllowedLicenseExpression,
  isPackageRootManifestPath,
} from "../scripts/license-check";

describe("dependency license policy", () => {
  it("accepts every allowlisted SPDX identifier", () => {
    for (const license of ALLOWED_LICENSES) {
      expect(isAllowedLicenseExpression(license)).toBeTrue();
    }
  });

  it("accepts compound expressions only when every identifier is allowed", () => {
    expect(isAllowedLicenseExpression("MIT OR (Apache-2.0 AND BSD-3-Clause)")).toBeTrue();
    expect(isAllowedLicenseExpression("MIT OR GPL-3.0-only")).toBeFalse();
  });

  it.each([
    "GPL-2.0-only",
    "LGPL-3.0-only",
    "AGPL-3.0-only",
    "Unknown-License",
    "LicenseRef-Proprietary",
    "Apache-2.0 WITH LLVM-exception",
    "MIT+",
    "",
    "MIT OR",
    "(MIT",
  ])("rejects forbidden or malformed expression %p", (expression) => {
    expect(isAllowedLicenseExpression(expression)).toBeFalse();
  });

  it("extracts current and usable deprecated declarations", () => {
    expect(extractLicenseExpressions({ license: " MIT " })).toEqual(["MIT"]);
    expect(
      extractLicenseExpressions({
        licenses: ["Apache-2.0", { type: "BSD-3-Clause" }, { type: "" }, {}],
      }),
    ).toEqual(["Apache-2.0", "BSD-3-Clause"]);
  });

  it("rejects missing or unusable declarations", () => {
    expect(extractLicenseExpressions({})).toEqual([]);
    expect(extractLicenseExpressions({ license: "", licenses: [{ type: "" }, {}] })).toEqual([]);
  });

  it("discovers only installed package roots, including scoped and nested packages", () => {
    expect(isPackageRootManifestPath("node_modules/elysia/package.json")).toBeTrue();
    expect(isPackageRootManifestPath("node_modules/@types/bun/package.json")).toBeTrue();
    expect(isPackageRootManifestPath("node_modules/outer/node_modules/inner/package.json")).toBeTrue();
    expect(isPackageRootManifestPath("node_modules/outer/node_modules/@scope/inner/package.json")).toBeTrue();
    expect(isPackageRootManifestPath("node_modules/@sinclair/typebox/compiler/package.json")).toBeFalse();
    expect(isPackageRootManifestPath("package.json")).toBeFalse();
  });

  it("deduplicates accepted packages and reports every violation", async () => {
    const root = await mkdtemp(join(tmpdir(), "yellow-license-check-"));

    try {
      const manifests = new Map([
        ["node_modules/good/package.json", { name: "good", version: "1.0.0", license: "MIT" }],
        [
          "node_modules/outer/node_modules/good/package.json",
          { name: "good", version: "1.0.0", license: "MIT" },
        ],
        ["node_modules/copyleft/package.json", { name: "copyleft", version: "2.0.0", license: "AGPL-3.0-only" }],
        ["node_modules/unlicensed/package.json", { name: "unlicensed", version: "3.0.0" }],
      ]);

      for (const [relativePath, manifest] of manifests) {
        const absolutePath = join(root, relativePath);
        await mkdir(join(absolutePath, ".."), { recursive: true });
        await writeFile(absolutePath, JSON.stringify(manifest));
      }

      const result = await auditInstalledPackages(root);

      expect(result.packageCount).toBe(1);
      expect(result.failures).toHaveLength(2);
      expect(result.failures.map(({ reason }) => reason)).toEqual([
        "copyleft@2.0.0: rejected license AGPL-3.0-only",
        "unlicensed@3.0.0: missing license",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
