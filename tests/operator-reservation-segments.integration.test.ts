import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const operatorSource = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
const segmentSource = readFileSync(
  new URL("../src/contexts/reservations/segments.ts", import.meta.url),
  "utf8",
);
const markup = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const browser = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

describe("Order 098 operator reservation segment changes", () => {
  test("P0: the planned query, authority, routes and workbench are present", () => {
    expect(segmentSource).toContain("findByConfirmation");
    expect(operatorSource).toContain('"reservations.segments:read"');
    expect(operatorSource).toContain('"reservations.segments:write"');
    expect(appSource).toContain("/reservation-segments");
    expect(appSource).toContain("/segments/:segment/departure");
    expect(appSource).toContain("/segments/:segment/move");
    expect(markup).toContain('id="reservation-segment-editor"');
    expect(browser).toContain("renderReservationSegments");
  });
});
