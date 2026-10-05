import { describe, expect, test } from "bun:test";

describe("Order 228 intentional red: governed arrival pickup-task dispatch", () => {
  test("the exact owner-mediated lifecycle capability exists", async () => {
    const migration = Bun.file(new URL(
      "../migrations/0031_governed_arrival_pickup_task_transition.sql",
      import.meta.url,
    ));

    expect(await migration.exists()).toBe(true);
    expect(await migration.text()).toContain(
      "CREATE FUNCTION public.transition_arrival_pickup_task(",
    );
  });

  test("the stay-operations domain exposes the bounded dispatch surface", async () => {
    const domain = Bun.file(new URL(
      "../src/contexts/stay-operations/pickup-task-dispatch.ts",
      import.meta.url,
    ));
    const exports = await Bun.file(new URL(
      "../src/contexts/stay-operations/index.ts",
      import.meta.url,
    )).text();

    expect(await domain.exists()).toBe(true);
    expect(await domain.text()).toContain("ArrivalPickupTaskDispatchService");
    expect(exports).toContain("ArrivalPickupTaskDispatchService");
  });

  test("exact HTTP actions and current-detail controls exist", async () => {
    const [app, adapter, script] = await Promise.all([
      Bun.file(new URL("../src/app.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text(),
    ]);

    for (const action of ["assign", "start", "complete"] as const) {
      expect(app).toContain(`/arrival-pickup-task/:task/${action}`);
    }
    expect(adapter).toContain("stay-operations.pickup-tasks:dispatch");
    expect(adapter).toContain("stay-operations.pickup-tasks:work");
    expect(script).toContain("Assign pickup");
    expect(script).toContain("Start pickup");
    expect(script).toContain("Complete pickup");
  });
});
