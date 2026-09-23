import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const probe = readFileSync("tools/probe-public-demo-performance.ts", "utf8");

test("public demo speed probe uses explicit latency and bundle budgets", () => {
  for (const expected of [
    "YELLOW_BUDGET_LOCAL_HEALTH_MS",
    "YELLOW_BUDGET_PUBLIC_HEALTH_MS",
    "YELLOW_BUDGET_PUBLIC_SHELL_MS",
    "YELLOW_BUDGET_TOTAL_JS_BYTES",
    "YELLOW_BUDGET_LARGEST_JS_BYTES",
  ]) {
    expect(probe).toContain(expected);
  }
});

test("public demo speed probe is read-only and checks health plus shell", () => {
  expect(probe).toContain("/health");
  expect(probe).toContain("public app shell");
  expect(probe).toContain("fetch(url");
  expect(probe).not.toMatch(/\bPOST\b|\bPATCH\b|\bPUT\b|\bDELETE\b/);
});

test("public demo speed probe protects route-level code splitting", () => {
  expect(probe).toContain("largest JavaScript chunk");
  expect(probe).toContain("total built JavaScript");
  expect(probe).toContain('file.endsWith(".js")');
});
