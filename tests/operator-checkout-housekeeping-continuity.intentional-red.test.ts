import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

describe("Order234 intentional red — checkout to Housekeeping continuity", () => {
  test("the exact checkout receipt does not yet admit a minimized frozen completion descriptor", () => {
    const descriptor = functionSource("checkoutHousekeepingCompletionDescriptor");
    const submit = functionSource("submitCheckout");

    for (const boundary of [
      "assignedSpaceId", "confirmationNo", "detailGeneration", "originPath", "property",
      "reservationId", "reservationStatus", "segmentStatus", "releasedClaimCount !== 1",
      'reservationStatus !== "checked_out"', 'segmentStatus !== "departed"', "canonicalUuid", "Object.freeze",
    ]) expect(descriptor).toContain(boundary);
    expect(submit).toContain("checkoutHousekeepingCompletionDescriptor(result");
  });

  test("the refreshed checked-out detail does not yet expose its exact stale-safe Housekeeping action", () => {
    const render = functionSource("renderReservationDetail");

    expect(script.includes("function checkoutHousekeepingCompletionActionIsCurrent(")).toBe(true);
    expect(script.includes("function openCheckoutHousekeeping(")).toBe(true);
    expect(render.includes("renderCheckoutHousekeepingReview(reservation)")).toBe(true);
    expect(script.includes('"Review room in Housekeeping"')).toBe(true);
  });
});
