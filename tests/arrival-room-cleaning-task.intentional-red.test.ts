import { describe, expect, test } from "bun:test";

describe("Order 229 intentional red: governed arrival room-cleaning task creation", () => {
  test("the exact owner-mediated create-or-return capability exists", async () => {
    const migration = Bun.file(new URL(
      "../migrations/0032_governed_arrival_room_cleaning_task.sql",
      import.meta.url,
    ));

    expect(await migration.exists()).toBe(true);
    expect(await migration.text()).toContain(
      "CREATE FUNCTION public.create_arrival_room_cleaning_task(",
    );
  });

  test("the housekeeping domain exposes the bounded arrival-cleaning surface", async () => {
    const domain = Bun.file(new URL(
      "../src/contexts/housekeeping/arrival-cleaning.ts",
      import.meta.url,
    ));
    const exports = await Bun.file(new URL(
      "../src/contexts/housekeeping/index.ts",
      import.meta.url,
    )).text();

    expect(await domain.exists()).toBe(true);
    expect(await domain.text()).toContain("ArrivalRoomCleaningTaskService");
    expect(exports).toContain("ArrivalRoomCleaningTaskService");
  });

  test("exact HTTP authority and contextual controls exist", async () => {
    const [app, adapter, script] = await Promise.all([
      Bun.file(new URL("../src/app.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text(),
    ]);

    expect(app).toContain("/arrival-room-cleaning-task/candidate");
    expect(app).toContain("/arrival-room-cleaning-task");
    expect(adapter).toContain("housekeeping.arrival-tasks:read");
    expect(adapter).toContain("housekeeping.arrival-tasks:create");
    expect(script).toContain("Create cleaning task");
    expect(script).toContain("arrivalRoomCleaningTaskRequest");
  });
});
