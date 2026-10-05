import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 216 intentional red is green: exact vehicle detail is implemented", () => {
  const service = readFileSync(new URL("../src/contexts/stay-operations/vehicles.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const operator = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

  expect(service).toContain("async get(input: VehicleRegisterDetailInput)");
  expect(app).toContain('.get("/api/v1/properties/:property/vehicles/:vehicle"');
  expect(app).toContain('.get("/p/:property/vehicles/:vehicle"');
  expect(operator).toContain("function openVehicleDetail(");
  expect(operator).toContain("function canonicalVehicleDetailPath(");
});
