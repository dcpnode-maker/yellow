import { expect, test } from "bun:test";

test("Order 205 intentional red: governed vehicle register is absent before implementation", async () => {
  const context = await Bun.file("src/contexts/stay-operations/vehicles.ts").text();
  const operator = await Bun.file("src/http/operator.ts").text();
  const html = await Bun.file("src/http/operator/index.html").text();
  const script = await Bun.file("src/http/operator/operator.js").text();

  expect(context).toContain("export class VehicleRegisterService");
  expect(context).toContain("async list(");
  expect(operator).toContain('/api/v1/properties/:property/vehicles');
  expect(operator).toContain('stay-operations.vehicles:read');
  expect(html).toContain('id="vehicle-register-workbench"');
  expect(script).toContain("loadVehicleRegister");
});
