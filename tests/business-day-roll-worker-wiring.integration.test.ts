import { describe, expect, test } from "bun:test";

import {
  BUSINESS_DAY_ROLL_ACTOR_ID,
  BusinessDayRollWorker,
  type DueBusinessDayScope,
  type DueBusinessDayScopeSource,
  type OpenCurrentBusinessDayInput,
} from "../src/contexts/financials";

const TENANT = "00000000-0000-0000-0000-000000034701";
const PROPERTY = "00000000-0000-0000-0000-000000034702";

class StaticSource implements DueBusinessDayScopeSource {
  constructor(readonly scopes: readonly DueBusinessDayScope[]) {}
  async listDueScopes(): Promise<readonly DueBusinessDayScope[]> { return this.scopes; }
}

describe("Order 347 business-day roll worker wiring", () => {
  test("one cycle binds a bounded scope to the server-created audit envelope", async () => {
    const calls: OpenCurrentBusinessDayInput[] = [];
    const worker = new BusinessDayRollWorker({
      async openCurrentBusinessDay(input) {
        calls.push(input);
        return { tenantId: input.tenantId, propertyNode: input.propertyNode, businessDate: "2047-01-01", opened: true };
      },
    }, new StaticSource([{ tenantId: TENANT, propertyNode: PROPERTY }]), { scopeBatchSize: 2 });

    expect(await worker.drainOnce()).toEqual({ scopes: 1, opened: 1, failures: [] });
    expect(calls[0]).toMatchObject({ tenantId: TENANT, propertyNode: PROPERTY, envelope: {
      actorId: BUSINESS_DAY_ROLL_ACTOR_ID, tenantId: TENANT, propertyNode: PROPERTY,
      operation: "business_day.opened",
    } });
    expect(calls[0]!.envelope.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("contains one failed scope, continues, rejects bad bounds and aborts promptly", async () => {
    const second = "00000000-0000-0000-0000-000000034703";
    const calls: string[] = [];
    const worker = new BusinessDayRollWorker({
      async openCurrentBusinessDay(input) {
        calls.push(input.propertyNode);
        if (input.propertyNode === PROPERTY) throw new Error("injected failure");
        return { tenantId: input.tenantId, propertyNode: input.propertyNode, businessDate: "2047-01-01", opened: false };
      },
    }, new StaticSource([{ tenantId: TENANT, propertyNode: PROPERTY }, { tenantId: TENANT, propertyNode: second }]));
    expect(await worker.drainOnce()).toEqual({ scopes: 2, opened: 0,
      failures: [{ tenantId: TENANT, propertyNode: PROPERTY, error: "injected failure" }] });
    expect(calls).toEqual([PROPERTY, second]);
    expect(() => new BusinessDayRollWorker({ openCurrentBusinessDay: async () => { throw new Error("unused"); } },
      new StaticSource([]), { pollIntervalMs: 99 })).toThrow();
    expect(() => new BusinessDayRollWorker({ openCurrentBusinessDay: async () => { throw new Error("unused"); } },
      new StaticSource([]), { scopeBatchSize: 101 })).toThrow();

    const controller = new AbortController();
    let cycles = 0;
    const idle = new BusinessDayRollWorker({ openCurrentBusinessDay: async () => { throw new Error("unused"); } },
      new StaticSource([]), { pollIntervalMs: 100 });
    await Promise.race([
      idle.run({ signal: controller.signal, onResult() { cycles += 1; controller.abort(); } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("worker did not stop")), 1_000)),
    ]);
    expect(cycles).toBe(1);
  });

  test("server composition is workbench-only opt-in and exposes configured/disabled truth", async () => {
    const [server, source, status, operator] = await Promise.all([
      Bun.file(new URL("../src/server.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/workers/postgres-due-business-day-scopes.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/project-status.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text(),
    ]);
    expect(server).toContain('workbenchEnabled && Bun.env.YELLOW_BUSINESS_DAY_ROLL_WORKER === "1"');
    expect(server).toContain("if (businessDayRollEnabled)");
    expect(server).toContain("new BusinessDayRollWorker(");
    expect(server).toContain("businessDayRollWorkerEnabled: businessDayRollEnabled");
    expect(status).toContain("readonly businessDayRollWorkerEnabled: boolean;");
    expect(status).toContain("businessDayRollWorkerEnabled: false,");
    expect(operator).toContain("businessDayRoll: this.#runtimeStatus.businessDayRollWorkerEnabled");
    expect(source).toContain("FROM runtime_due_business_day_scopes(${limit})");
    expect(source).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|business_date)\b/i);
  });
});
