import { describe, expect, test } from "bun:test";

const proof = await Bun.file("tools/prove-public-finance-posting-flow.ts").text();
const readinessProbe = await Bun.file("tools/probe-colleague-demo-readiness.ts").text();

describe("Order 640 public finance posting proof", () => {
  test("the opt-in finance proof posts only through governed HTTP and reconciles the statement", () => {
    expect(proof).toContain("/api/v1/auth/demo:enter");
    expect(proof).toContain("/folios/${encodeURIComponent(folioId)}/charges");
    expect(proof).toContain("idempotencyKey");
    expect(proof).toContain("function sameDecimal");
    expect(proof).toContain("row.journalId === receipt.journalId");
    expect(proof).toContain('row.kind === "charge"');
    expect(proof).toContain("matchingRows.length === 1");
    expect(proof).not.toMatch(/INSERT INTO|UPDATE public|DELETE FROM|space_occupancy/iu);
  });

  test("the default colleague readiness probe remains read-only after login", () => {
    expect(readinessProbe).not.toMatch(/postFolioCharge|\/charges"|\/charges`|commitCheckout|commitCheckIn|transitionHousekeepingTask/u);
  });
});
