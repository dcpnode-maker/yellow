import { expect, test } from "bun:test";

const source = await Bun.file("tools/provision-public-showcase-rate-prices.ts").text();

test("preflights the complete date and pricing surface before governed writes", () => {
  expect(source).toContain("function stayDates()");
  expect(source).toContain("dates.length * rows.length");
  expect(source).toContain("offset += 28");
  expect(source).toContain("exact.length !== dates.length");
  expect(source).toContain("ids.size !== 1");
  expect(source).toContain('extraAdultMinor: null');
  expect(source).toContain('extraChildren: []');
  expect(source).toContain('Object.keys(pricing ?? {}).sort()');
});

test("uses only the governed rate API with stable command keys", () => {
  expect(source).toContain('/rate-prices`');
  expect(source).toContain('"idempotency-key"');
  expect(source).toContain("yellow-order535-");
  expect(source).toContain('process.argv.includes("--apply")');
  expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
  expect(source).not.toContain("postgres://");
});
