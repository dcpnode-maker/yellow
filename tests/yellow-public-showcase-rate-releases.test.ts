import { expect, test } from "bun:test";

const source = await Bun.file("tools/provision-public-showcase-rate-releases.ts").text();

test("guards the exact two-property room-matrix release surface", () => {
  expect(source).toContain('modelKey: "room-matrix"');
  expect(source).toContain('key: "room-matrix"');
  expect(source).toContain('authoringMode: "guided"');
  expect(source).toContain("expectedPriceMinor");
  expect(source).toContain("release history is not the exact retained recovery state");
  expect(source).toContain("pending approval is not the exact retained recovery state");
  expect(source).toContain("retained draft idempotency evidence differs");
  expect(source).toContain("retained approval idempotency evidence differs");
  expect(source).toContain("RETAINED_LOCANDA");
  expect(source).toContain("approver property authority is unavailable before mutation");
  expect(source).toContain("current price evidence is not exact");
  expect(source).toContain("function canonical(value: unknown)");
  expect(source).toContain(".sort(([left], [right]) => left.localeCompare(right))");
  expect(source.indexOf('code: "DLX"')).toBeLessThan(source.indexOf('code: "KING"'));
  expect(source).toContain('process.argv.includes("--apply")');
});

test("uses the governed four-eyes API without exposing protected credentials", () => {
  expect(source).toContain("/api/v1/auth/demo:enter");
  expect(source).toContain("/api/v1/auth/local:login");
  expect(source).toContain("YELLOW_REVIEW_APPROVER_PASSWORD");
  expect(source).toContain("/approval-request");
  expect(source).toContain("/decision");
  expect(source).toContain("/publish");
  expect(source).toContain('decision: "approved"');
  expect(source).toContain('idempotency-replayed');
  expect(source).toContain("requester unexpectedly gained approval authority");
  expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
  expect(source).not.toContain("postgres://");
  expect(source).not.toMatch(/AQ\.[A-Za-z0-9_-]+/);
});
