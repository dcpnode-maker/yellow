import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { checkImportBoundaries } from "../scripts/check-import-boundaries";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const CHECKER = resolve(PROJECT_ROOT, "scripts", "check-import-boundaries.ts");
const EXPECTED_CONTEXTS = [
  "crm",
  "distribution",
  "financials",
  "groups",
  "housekeeping",
  "identity",
  "inventory",
  "rates",
  "reporting",
  "reservations",
  "statutory-privacy",
  "stay-operations",
  "tax-fiscal",
] as const;

async function withFixture<T>(
  files: Readonly<Record<string, string>>,
  run: (root: string) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "yellow-import-boundaries-"));

  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      const target = resolve(root, relativePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents, "utf8");
    }

    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function countTypeScriptFiles(root: string): Promise<number> {
  let count = 0;

  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      count += await countTypeScriptFiles(path);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      count += 1;
    }
  }

  return count;
}

describe("context layout", () => {
  test("contains exactly 13 canonical context indices and one kernel index", async () => {
    const contextRoot = resolve(PROJECT_ROOT, "src", "contexts");
    const contextDirectories = (await readdir(contextRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(contextDirectories).toEqual([...EXPECTED_CONTEXTS]);

    for (const context of EXPECTED_CONTEXTS) {
      expect((await stat(resolve(contextRoot, context, "index.ts"))).isFile()).toBe(true);
    }

    expect((await stat(resolve(PROJECT_ROOT, "src", "kernel", "index.ts"))).isFile()).toBe(true);
  });

  test("the real source tree obeys the boundary rule", async () => {
    const result = await checkImportBoundaries(PROJECT_ROOT);
    const expectedFilesScanned =
      await countTypeScriptFiles(resolve(PROJECT_ROOT, "src", "contexts")) +
      await countTypeScriptFiles(resolve(PROJECT_ROOT, "src", "kernel"));

    expect(result.filesScanned).toBe(expectedFilesScanned);
    expect(result.violations).toEqual([]);
  });
});

describe("import boundary checker", () => {
  test("allows public indices, same-context internals, and context-to-kernel imports", async () => {
    await withFixture(
      {
        "src/contexts/inventory/index.ts": "",
        "src/contexts/reservations/repository.ts": "export const repository = true;\n",
        "src/kernel/index.ts": "",
        "src/contexts/reservations/consumer.ts": `
          import "../inventory";
          export * from "../inventory/index.ts";
          export * from "../inventory/index";
          import "./repository";
          import "../../kernel";
          import "../../http/security-headers";
          import "elysia";
          const ordinary = "import '../inventory/private'";
          // import "../inventory/comment-only";
        `,
      },
      async (root) => {
        const result = await checkImportBoundaries(root);
        expect(result.violations).toEqual([]);
      },
    );
  });

  test("rejects deep cross-context imports in every required syntax form", async () => {
    await withFixture(
      {
        "src/contexts/inventory/index.ts": "",
        "src/contexts/reservations/static.ts": 'import "../inventory/repository";\n',
        "src/contexts/reservations/reexport.ts": 'export * from "../inventory/internal";\n',
        "src/contexts/reservations/dynamic.ts": 'void import("../inventory/private");\n',
        "src/kernel/index.ts": "",
      },
      async (root) => {
        const result = await checkImportBoundaries(root);

        expect(result.violations.map(({ specifier }) => specifier).sort()).toEqual([
          "../inventory/internal",
          "../inventory/private",
          "../inventory/repository",
        ]);
        expect(result.violations.every(({ reason }) => reason.includes("public index"))).toBe(true);
      },
    );
  });

  test("rejects kernel imports of both a context root and a deep context path", async () => {
    await withFixture(
      {
        "src/contexts/inventory/index.ts": "",
        "src/kernel/root.ts": 'import "../contexts/inventory";\n',
        "src/kernel/deep.ts": 'void import("../contexts/inventory/repository");\n',
      },
      async (root) => {
        const result = await checkImportBoundaries(root);

        expect(result.violations.map(({ specifier }) => specifier).sort()).toEqual([
          "../contexts/inventory",
          "../contexts/inventory/repository",
        ]);
        expect(result.violations.every(({ reason }) => reason === "kernel must not import context 'inventory'"))
          .toBe(true);
      },
    );
  });

  test("an illegal fixture makes the real CLI exit nonzero with actionable output", async () => {
    await withFixture(
      {
        "src/contexts/inventory/index.ts": "",
        "src/contexts/reservations/bad.ts": 'import "../inventory/repository";\n',
        "src/kernel/index.ts": "",
      },
      async (root) => {
        const child = Bun.spawn([process.execPath, CHECKER, root], {
          cwd: PROJECT_ROOT,
          stderr: "pipe",
          stdout: "pipe",
        });
        const [exitCode, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);

        expect(exitCode).not.toBe(0);
        expect(stdout).toBe("");
        expect(stderr).toContain("src/contexts/reservations/bad.ts");
        expect(stderr).toContain('"../inventory/repository"');
        expect(stderr).toContain("public index");
      },
    );
  });
});
