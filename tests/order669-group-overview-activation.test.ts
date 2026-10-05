import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CAPABILITY_REGISTRY, isOperationalCapability } from "../frontend/yellow/src/ecosystem/capability-registry";

test("group-block overview opens the existing board without claiming sales or write features", () => {
  const overview = CAPABILITY_REGISTRY.find(row => row.key === "groups-events.block-overview")!;
  const sales = CAPABILITY_REGISTRY.find(row => row.key === "groups-events.sales")!;
  expect(overview.status).toBe("beta");
  expect(overview.existing).toBe(true);
  expect(overview.route).toBe("/p/:propertyId/reservations");
  expect(overview.statusReason).toContain("Read-only beta");
  expect(overview.statusReason).toContain("not activated");
  expect(isOperationalCapability(overview)).toBe(true);
  expect(isOperationalCapability(sales)).toBe(false);
  expect(sales.status).toBe("planned");
  const hub = readFileSync(new URL("../frontend/yellow/src/workspaces/EcosystemHub.tsx", import.meta.url), "utf8");
  expect(hub).toContain('"groups-events.block-overview": "reservations"');
});
