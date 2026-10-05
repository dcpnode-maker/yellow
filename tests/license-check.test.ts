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
  resolveAllowedLicenseExpression,
} from "../scripts/license-check";

describe("dependency license policy", () => {
  it("keeps founder-approved pako and tslib exceptions exact and fail-closed", async () => {
    expect(ALLOWED_LICENSES.has("Zlib")).toBeFalse();
    expect(ALLOWED_LICENSES.has("0BSD")).toBeFalse();
    expect(isAllowedLicenseExpression("Zlib")).toBeFalse();
    expect(isAllowedLicenseExpression("0BSD")).toBeFalse();

    const root = await mkdtemp(join(tmpdir(), "yellow-license-exceptions-"));
    try {
      const manifests = new Map([
        ["node_modules/pako/package.json", { name: "pako", version: "2.2.0", license: "(MIT AND Zlib)" }],
        ["node_modules/tslib/package.json", { name: "tslib", version: "2.8.1", license: "0BSD" }],
        ["node_modules/not-pako/package.json", { name: "not-pako", version: "2.2.0", license: "(MIT AND Zlib)" }],
        ["node_modules/pako-wrong-version/package.json", { name: "pako", version: "2.2.1", license: "(MIT AND Zlib)" }],
        ["node_modules/pako-unparenthesized/package.json", { name: "pako", version: "2.2.0", license: "MIT AND Zlib" }],
        ["node_modules/pako-expanded-expression/package.json", { name: "pako", version: "2.2.0", license: "(MIT AND Zlib AND Apache-2.0)" }],
        ["node_modules/tslib-wrong-version/package.json", { name: "tslib", version: "2.8.2", license: "0BSD" }],
        ["node_modules/tslib-expanded-expression/package.json", { name: "tslib", version: "2.8.1", license: "0BSD AND MIT" }],
        ["node_modules/other-zero-clause/package.json", { name: "other-zero-clause", version: "1.0.0", license: "0BSD" }],
      ]);

      for (const [relativePath, manifest] of manifests) {
        const absolutePath = join(root, relativePath);
        await mkdir(join(absolutePath, ".."), { recursive: true });
        await writeFile(absolutePath, JSON.stringify(manifest));
      }

      const result = await auditInstalledPackages(root);
      expect(result.packageCount).toBe(2);
      expect(result.failures).toHaveLength(7);
      expect(result.choices).toEqual([
        {
          packagePath: join("node_modules", "pako", "package.json"),
          packageName: "pako@2.2.0",
          declaredExpression: "(MIT AND Zlib)",
          acceptedExpression: "(MIT AND Zlib)",
          exception: "pako's MIT and embedded zlib notices are retained in the native Cesium distribution.",
        },
        {
          packagePath: join("node_modules", "tslib", "package.json"),
          packageName: "tslib@2.8.1",
          declaredExpression: "0BSD",
          acceptedExpression: "0BSD",
          exception: "founder-approved zero-clause BSD license for the installed tslib runtime.",
        },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts every allowlisted SPDX identifier", () => {
    for (const license of ALLOWED_LICENSES) {
      expect(isAllowedLicenseExpression(license)).toBeTrue();
    }
  });

  it("uses SPDX choice semantics for OR and conjunction semantics for AND", () => {
    expect(isAllowedLicenseExpression("MIT OR GPL-3.0-only")).toBeTrue();
    expect(resolveAllowedLicenseExpression("MIT OR GPL-3.0-only")).toEqual({
      acceptedExpression: "MIT",
      choseAlternative: true,
    });
    expect(isAllowedLicenseExpression("MIT AND GPL-3.0-only")).toBeFalse();
    expect(isAllowedLicenseExpression("(MIT OR ISC) AND BSD-3-Clause")).toBeTrue();
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
    expect(extractLicenseExpressions({ license: { type: " MIT " } })).toEqual(["MIT"]);
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
        [
          "node_modules/dual/package.json",
          { name: "dual", version: "4.0.0", licenses: ["AGPL-3.0-only", "MIT"] },
        ],
        [
          "node_modules/legacy/package.json",
          { name: "legacy", version: "5.0.0", license: { type: "MIT" } },
        ],
      ]);

      for (const [relativePath, manifest] of manifests) {
        const absolutePath = join(root, relativePath);
        await mkdir(join(absolutePath, ".."), { recursive: true });
        await writeFile(absolutePath, JSON.stringify(manifest));
      }

      const result = await auditInstalledPackages(root);

      expect(result.packageCount).toBe(3);
      expect(result.failures).toHaveLength(2);
      expect(result.failures.map(({ reason }) => reason)).toEqual([
        "copyleft@2.0.0: rejected license AGPL-3.0-only",
        "unlicensed@3.0.0: missing license",
      ]);
      expect(result.choices).toEqual([
        {
          packagePath: join("node_modules", "dual", "package.json"),
          packageName: "dual@4.0.0",
          declaredExpression: "AGPL-3.0-only OR MIT",
          acceptedExpression: "MIT",
        },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
