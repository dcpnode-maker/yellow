import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 216 intentional red: exact vehicle detail is absent before implementation", () => {
  const service = readFileSync(new URL("../src/contexts/stay-operations/vehicles.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const operator = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

  expect(service).not.toContain("async get(input: VehicleRegisterDetailInput)");
  expect(app).not.toContain('.get("/api/v1/properties/:property/vehicles/:vehicle"');
  expect(app).not.toContain('.get("/p/:property/vehicles/:vehicle"');
  expect(operator).not.toContain("function openVehicleDetail(");
  expect(operator).not.toContain("function canonicalVehicleDetailPath(");
});
