import { describe, expect, test } from "bun:test";

describe("Order 201 intentional red: governed housekeeping task lifecycle", () => {
  test("owner capability, domain, routes and workbench exist", async () => {
    const migration = Bun.file(new URL("../migrations/0026_governed_housekeeping_task_transition.sql", import.meta.url));
    const domain = Bun.file(new URL("../src/contexts/housekeeping/tasks.ts", import.meta.url));
    const app = await Bun.file(new URL("../src/app.ts", import.meta.url)).text();
    const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
    const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();

    expect(await migration.exists()).toBe(true);
    expect(await domain.exists()).toBe(true);
    expect(app).toContain("/housekeeping/tasks");
    expect(html).toContain('id="housekeeping-view"');
    expect(script).toContain("loadHousekeepingBoard");
  });
});
