import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

describe("Order 213 intentional red: governed arrival pickup-task automation", () => {
  test("owner capability, durable consumer and runtime worker are required", async () => {
    const migration = join(ROOT, "migrations", "0029_governed_arrival_pickup_task.sql");
    const consumer = join(ROOT, "src", "contexts", "stay-operations", "pickup-task-automation.ts");
    expect(await Bun.file(migration).exists()).toBe(true);
    expect(await Bun.file(consumer).exists()).toBe(true);

    const [sql, worker, server, status] = await Promise.all([
      Bun.file(migration).text(), Bun.file(consumer).text(),
      Bun.file(join(ROOT, "src", "server.ts")).text(),
      Bun.file(join(ROOT, "src", "project-status.ts")).text(),
    ]);
    expect(sql).toContain("govern_arrival_pickup_task");
    expect(sql).toContain("guest_request");
    expect(sql).toContain("arrival_pickup");
    expect(worker).toContain('arrival-pickup-task');
    expect(worker).toContain('task.created');
    expect(server).toContain("YELLOW_PICKUP_TASK_WORKER");
    expect(status).toContain("pickupTaskWorkerEnabled");
  });
});
