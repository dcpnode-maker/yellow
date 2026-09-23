import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

test("Order 202 intentional red: governed housekeeping task-sheet generation", () => {
  const migration = join(ROOT, "migrations", "0027_governed_housekeeping_task_sheet_generation.sql");
  const domain = join(ROOT, "src", "contexts", "housekeeping", "sheets.ts");
  const app = readFileSync(join(ROOT, "src", "app.ts"), "utf8");
  const page = readFileSync(join(ROOT, "src", "http", "operator", "index.html"), "utf8");

  expect(existsSync(migration)).toBe(true);
  expect(existsSync(domain)).toBe(true);
  expect(app).toContain("housekeeping/sheets/preview");
  expect(app).toContain("housekeeping/sheets/generate");
  expect(page).toContain('id="housekeeping-sheet-generator"');
});

