import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

describe("Order 200 intentional red: governed arrival readiness and check-in", () => {
  test("server-owned readiness, atomic command, routes and workbench exist", () => {
    const service = resolve(ROOT, "src", "contexts", "stay-operations", "checkin.ts");
    expect(existsSync(service)).toBe(true);
    const source = readFileSync(service, "utf8");
    const operator = readFileSync(resolve(ROOT, "src", "http", "operator.ts"), "utf8");
    const html = readFileSync(resolve(ROOT, "src", "http", "operator", "index.html"), "utf8");
    const client = readFileSync(resolve(ROOT, "src", "http", "operator", "operator.js"), "utf8");
    expect(source).toContain("class CheckInService");
    expect(operator).toContain("check-in/readiness");
    expect(html).toContain('id="checkin-workbench"');
    expect(client).toContain("loadCheckInReadiness");
  });
});
