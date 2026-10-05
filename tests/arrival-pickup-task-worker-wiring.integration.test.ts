import { describe, expect, test } from "bun:test";

const serverUrl = new URL("../src/server.ts", import.meta.url);
const statusUrl = new URL("../src/project-status.ts", import.meta.url);
const operatorUrl = new URL("../src/http/operator/operator.js", import.meta.url);

describe("Order 213 arrival pickup-task worker wiring", () => {
  test("worker is a workbench-only exact opt-in with bounded error logging", async () => {
    const server = await Bun.file(serverUrl).text();

    expect(server).toContain('workbenchEnabled && Bun.env.YELLOW_PICKUP_TASK_WORKER === "1"');
    expect(server).toContain("new ArrivalPickupTaskAutomationConsumer(events)");
    expect(server).toContain("if (pickupTaskWorkerEnabled)");
    expect(server).toContain('console.error("arrival pickup task consumer failed")');
    const wiring = server.slice(server.indexOf("if (pickupTaskWorkerEnabled)"),
      server.indexOf("if (reservationArrivalRollEnabled)"));
    expect(wiring).toContain("superviseWorker(pickupTasks.run({ signal: runtimeAbort.signal,");
    expect(wiring).toContain('}), "arrival pickup task consumer stopped unexpectedly");');
    expect(server).toContain("runtimeWorkerTasks.push(promise.catch(() => { console.error(failureMessage); }));");
    expect(server).not.toMatch(/arrival pickup task consumer[^\n]*(?:error|cause|stack|message)/i);
  });

  test("project runtime status records the explicit worker state and defaults disabled", async () => {
    const [server, status, operator] = await Promise.all([
      Bun.file(serverUrl).text(),
      Bun.file(statusUrl).text(),
      Bun.file(operatorUrl).text(),
    ]);

    expect(status).toContain("readonly pickupTaskWorkerEnabled: boolean;");
    expect(status).toContain("pickupTaskWorkerEnabled: false,");
    expect(server).toContain("pickupTaskWorkerEnabled,");
    expect(operator).toContain('healthCard("Arrival pickup worker", live.workers.arrivalPickupTask');
  });
});
