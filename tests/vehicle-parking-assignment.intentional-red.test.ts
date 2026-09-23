import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("Order 236 intentional red — governed vehicle parking assignment", () => {
  test("owner-mediated parking capability is absent before implementation", () => {
    const migration = new URL("migrations/0037_governed_vehicle_parking_assignment.sql", root);
    expect(existsSync(migration)).toBe(true);
    expect(read("migrations/0037_governed_vehicle_parking_assignment.sql"))
      .toContain("assign_vehicle_parking");
  });

  test("parking service is absent before implementation", () => {
    const vehicles = read("src/contexts/stay-operations/vehicles.ts");
    expect(vehicles).toContain("VehicleParkingAssignmentService");
    expect(vehicles).toContain("async assign(input: VehicleParkingAssignmentInput)");
  });

  test("strict parking HTTP routes are absent before implementation", () => {
    const app = read("src/app.ts");
    const operator = read("src/http/operator.ts");
    expect(app).toContain("/api/v1/properties/:property/vehicles/:vehicle/parking");
    expect(operator).toContain("stay-operations.vehicles:park");
    expect(operator).toContain("vehicleParkingAssign");
  });

  test("server composition is absent before implementation", () => {
    const server = read("src/server.ts");
    expect(server).toContain("VehicleParkingAssignmentService");
    expect(server).toContain("vehicleParking");
  });

  test("stale-safe vehicle-detail parking UI is absent before implementation", () => {
    const script = read("src/http/operator/operator.js");
    const css = read("src/http/operator/operator.css");
    expect(script).toContain("loadVehicleParking");
    expect(script).toContain("assignVehicleParking");
    expect(css).toContain(".vehicle-parking-assignment");
  });
});
