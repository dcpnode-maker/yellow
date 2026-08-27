import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

describe("Order 199 intentional red: composed Phase-5 financial journey", () => {
  test("pristine PostgreSQL proves both exact-zero settlement paths", () => {
    const journey = resolve(ROOT, "tests", "phase-5-financial-journey.integration.test.ts");
    expect(existsSync(journey)).toBe(true);
    const source = readFileSync(journey, "utf8");
    expect(source).toContain("charge -> payment capture -> zero -> settle -> close");
    expect(source).toContain("charge -> receivable transfer -> zero -> settle -> close");
    expect(source).toContain("capture, transfer and settlement arbitration");
  });
});
