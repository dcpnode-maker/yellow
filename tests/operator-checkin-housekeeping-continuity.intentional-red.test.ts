import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

describe("Order226 intentional red — check-in Housekeeping continuity", () => {
  test("the exact stale-safe open and return hooks exist", () => {
    for (const hook of [
      "checkInHousekeepingActionIsCurrent",
      "openCheckInHousekeeping",
      "returnFromHousekeepingToCheckIn",
      "checkin-housekeeping-action",
      "housekeeping-arrival-return",
    ]) {
      expect(`${source}\n${css}`).toContain(hook);
    }
  });
});
