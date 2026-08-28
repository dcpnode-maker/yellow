import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RESERVATION_ARRIVAL_ROLL_ACTOR_ID,
  ReservationArrivalRollWorker,
  type DueArrivalScope,
  type DueArrivalScopeSource,
  type RollDueArrivalsInput,
} from "../src/contexts/reservations";
import { PostgresDueArrivalScopeSource } from "../src/workers/postgres-due-arrival-scopes";

const TENANT = "00000000-0000-0000-0000-000000023201";
const PROPERTY = "00000000-0000-0000-0000-000000023202";
const RESERVATION = "00000000-0000-0000-0000-000000023203";
const SEGMENT = "00000000-0000-0000-0000-000000023204";
const DISCOVERY_TENANT = "00000000-0000-0000-0000-000000023251";
const DISCOVERY_PROPERTY_DUE = "00000000-0000-0000-0000-000000023252";
const DISCOVERY_PROPERTY_INCOHERENT = "00000000-0000-0000-0000-000000023253";
const DISCOVERY_PARTY = "00000000-0000-0000-0000-000000023254";
const DISCOVERY_UNIT_DUE = "00000000-0000-0000-0000-000000023255";
const DISCOVERY_UNIT_INCOHERENT = "00000000-0000-0000-0000-000000023256";
const DISCOVERY_RATE_DUE = "00000000-0000-0000-0000-000000023257";
const DISCOVERY_RATE_INCOHERENT = "00000000-0000-0000-0000-000000023258";
const DISCOVERY_RESERVATION_DUE = "00000000-0000-0000-0000-000000023259";
const DISCOVERY_RESERVATION_INCOHERENT = "00000000-0000-0000-0000-000000023260";
const DISCOVERY_SEGMENT_DUE = "00000000-0000-0000-0000-000000023261";
const DISCOVERY_SEGMENT_OLD = "00000000-0000-0000-0000-000000023262";
const DISCOVERY_SEGMENT_LATEST = "00000000-0000-0000-0000-000000023263";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;

class StaticSource implements DueArrivalScopeSource {
  constructor(readonly scopes: readonly DueArrivalScope[]) {}
  async listDueScopes(): Promise<readonly DueArrivalScope[]> { return this.scopes; }
}

describe("Order 232 reservation arrival-roll worker wiring", () => {
  test("one cycle binds bounded scopes to the fixed system actor and exact operation", async () => {
    const calls: RollDueArrivalsInput[] = [];
    const worker = new ReservationArrivalRollWorker({
      async rollDueArrivals(input: RollDueArrivalsInput) {
        calls.push(input);
        return {
          tenantId: input.tenantId,
          propertyNode: input.propertyNode,
          businessDate: "2047-01-10",
          examined: 1,
          transitioned: 1,
          arrivals: [{ reservationId: RESERVATION, segmentId: SEGMENT, businessDate: "2047-01-10" }],
        };
      },
    }, new StaticSource([{ tenantId: TENANT, propertyNode: PROPERTY }]), {
      scopeBatchSize: 2,
      arrivalBatchSize: 7,
    });

    expect(await worker.drainOnce()).toEqual({ scopes: 1, examined: 1, transitioned: 1, failures: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      limit: 7,
      envelope: {
        actorId: RESERVATION_ARRIVAL_ROLL_ACTOR_ID,
        tenantId: TENANT,
        propertyNode: PROPERTY,
        operation: "reservation.due_in",
      },
    });
    expect(calls[0]!.envelope.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("a failed scope is contained and does not prevent the next scope", async () => {
    const propertyB = "00000000-0000-0000-0000-000000023205";
    const calls: string[] = [];
    const worker = new ReservationArrivalRollWorker({
      async rollDueArrivals(input: RollDueArrivalsInput) {
        calls.push(input.propertyNode);
        if (input.propertyNode === PROPERTY) throw new Error("injected scope failure");
        return {
          tenantId: input.tenantId,
          propertyNode: input.propertyNode,
          businessDate: null,
          examined: 0,
          transitioned: 0,
          arrivals: [],
        };
      },
    }, new StaticSource([
      { tenantId: TENANT, propertyNode: PROPERTY },
      { tenantId: TENANT, propertyNode: propertyB },
    ]));

    const result = await worker.drainOnce();
    expect(calls).toEqual([PROPERTY, propertyB]);
    expect(result).toEqual({
      scopes: 2,
      examined: 0,
      transitioned: 0,
      failures: [{ tenantId: TENANT, propertyNode: PROPERTY, error: "injected scope failure" }],
    });
  });

  test("abort stops the polling loop and worker bounds fail closed", async () => {
    const source = new StaticSource([]);
    expect(() => new ReservationArrivalRollWorker({ rollDueArrivals: async () => { throw new Error("unused"); } }, source,
      { pollIntervalMs: 99 })).toThrow();
    expect(() => new ReservationArrivalRollWorker({ rollDueArrivals: async () => { throw new Error("unused"); } }, source,
      { scopeBatchSize: 101 })).toThrow();
    expect(() => new ReservationArrivalRollWorker({ rollDueArrivals: async () => { throw new Error("unused"); } }, source,
      { arrivalBatchSize: 101 })).toThrow();

    const controller = new AbortController();
    let cycles = 0;
    const worker = new ReservationArrivalRollWorker({
      async rollDueArrivals() { throw new Error("unused"); },
    }, source, { pollIntervalMs: 100 });
    await Promise.race([
      worker.run({ signal: controller.signal, onResult() { cycles += 1; controller.abort(); } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("arrival-roll worker did not stop")), 1_000)),
    ]);
    expect(cycles).toBe(1);
  });

  test("server composition is workbench-only opt-in and logs no failure details", async () => {
    const [server, adapter] = await Promise.all([
      Bun.file(new URL("../src/server.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/workers/postgres-due-arrival-scopes.ts", import.meta.url)).text(),
    ]);
    expect(server).toContain(
      'workbenchEnabled && Bun.env.YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER === "1"',
    );
    expect(server).toContain("if (reservationArrivalRollEnabled)");
    expect(server).toContain("reservationArrivalRollWorkerEnabled: reservationArrivalRollEnabled");
    expect(server).toContain("new ReservationArrivalRollService(");
    expect(server).toContain("new ReservationArrivalRollWorker(");
    expect(server).toContain('console.error("reservation arrival-roll worker discovery failed")');
    expect(server).toContain('console.error("reservation arrival-roll worker stopped unexpectedly")');
    expect(server).not.toMatch(/reservation arrival-roll worker[^\n]*(?:error|cause|stack|message)/i);
    const status = await Bun.file(new URL("../src/project-status.ts", import.meta.url)).text();
    const operator = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    expect(status).toContain("readonly reservationArrivalRollWorkerEnabled: boolean;");
    expect(status).toContain("reservationArrivalRollWorkerEnabled: false,");
    expect(operator).toContain(
      'healthCard("Reservation arrival-roll worker", live.workers.reservationArrivalRoll',
    );
    expect(adapter).toContain("FROM runtime_due_arrival_scopes(${limit})");
    expect(adapter).not.toMatch(/business_day|reservation_segment|UPDATE|INSERT|DELETE/i);
  });
});

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let runtime: SQL | undefined;

databaseDescribe("Order 232 PostgreSQL due-arrival scope discovery", () => {
  beforeAll(async () => {
    admin = new SQL(DEPLOY_DATABASE_URL!, { max: 2, prepare: false });
    runtime = new SQL(RUNTIME_DATABASE_URL!, { max: 2, prepare: false });
    await admin`INSERT INTO tenant (id,slug,name,tier,status)
      VALUES (${DISCOVERY_TENANT}::uuid,'order-232-discovery','Order 232 Discovery','shared','active')`;
    await admin`INSERT INTO org_node (id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${DISCOVERY_PROPERTY_DUE}::uuid,${DISCOVERY_TENANT}::uuid,'order_232.discovery_due','property',
       'Order 232 Due','Pacific/Kiritimati','USD'),
      (${DISCOVERY_PROPERTY_INCOHERENT}::uuid,${DISCOVERY_TENANT}::uuid,'order_232.discovery_incoherent','property',
       'Order 232 Incoherent','Pacific/Kiritimati','USD')`;
    await admin`INSERT INTO party (id,tenant_id,kind,display_name)
      VALUES (${DISCOVERY_PARTY}::uuid,${DISCOVERY_TENANT}::uuid,'person','Order 232 Guest')`;
    await admin`INSERT INTO unit_type (id,tenant_id,property_node,code,name,profile_key) VALUES
      (${DISCOVERY_UNIT_DUE}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_DUE}::uuid,
       'O232D','Order 232 Due','hotel'),
      (${DISCOVERY_UNIT_INCOHERENT}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_INCOHERENT}::uuid,
       'O232I','Order 232 Incoherent','hotel')`;
    await admin`INSERT INTO rate_plan (id,tenant_id,property_node,code,name,currency) VALUES
      (${DISCOVERY_RATE_DUE}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_DUE}::uuid,
       'O232D','Order 232 Due','USD'),
      (${DISCOVERY_RATE_INCOHERENT}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_INCOHERENT}::uuid,
       'O232I','Order 232 Incoherent','USD')`;
    await admin`INSERT INTO reservation
      (id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency) VALUES
      (${DISCOVERY_RESERVATION_DUE}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_DUE}::uuid,
       'O232-DUE','reserved',${DISCOVERY_PARTY}::uuid,'direct','USD'),
      (${DISCOVERY_RESERVATION_INCOHERENT}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_INCOHERENT}::uuid,
       'O232-INCOHERENT','reserved',${DISCOVERY_PARTY}::uuid,'direct','USD')`;
    await admin`INSERT INTO reservation_segment
      (id,tenant_id,reservation_id,seq,unit_type_id,period,rate_plan_id,status) VALUES
      (${DISCOVERY_SEGMENT_DUE}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_RESERVATION_DUE}::uuid,1,
       ${DISCOVERY_UNIT_DUE}::uuid,
       tstzrange(
         date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') AT TIME ZONE 'Pacific/Kiritimati',
         (date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') + interval '1 day') AT TIME ZONE 'Pacific/Kiritimati',
         '[)'),${DISCOVERY_RATE_DUE}::uuid,'booked'),
      (${DISCOVERY_SEGMENT_OLD}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_RESERVATION_INCOHERENT}::uuid,1,
       ${DISCOVERY_UNIT_INCOHERENT}::uuid,
       tstzrange(
         date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') AT TIME ZONE 'Pacific/Kiritimati',
         (date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') + interval '1 day') AT TIME ZONE 'Pacific/Kiritimati',
         '[)'),${DISCOVERY_RATE_INCOHERENT}::uuid,'booked'),
      (${DISCOVERY_SEGMENT_LATEST}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_RESERVATION_INCOHERENT}::uuid,2,
       ${DISCOVERY_UNIT_INCOHERENT}::uuid,
       tstzrange(
         (date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') + interval '1 day') AT TIME ZONE 'Pacific/Kiritimati',
         (date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') + interval '2 days') AT TIME ZONE 'Pacific/Kiritimati',
         '[)'),${DISCOVERY_RATE_INCOHERENT}::uuid,'cancelled')`;
  });

  afterAll(async () => {
    if (admin) {
      await admin`DELETE FROM reservation_segment WHERE tenant_id=${DISCOVERY_TENANT}::uuid`;
      await admin`DELETE FROM reservation WHERE tenant_id=${DISCOVERY_TENANT}::uuid`;
      await admin`DELETE FROM rate_plan WHERE tenant_id=${DISCOVERY_TENANT}::uuid`;
      await admin`DELETE FROM unit_type WHERE tenant_id=${DISCOVERY_TENANT}::uuid`;
      await admin`DELETE FROM party WHERE tenant_id=${DISCOVERY_TENANT}::uuid`;
      await admin`DELETE FROM org_node WHERE tenant_id=${DISCOVERY_TENANT}::uuid`;
      await admin`DELETE FROM tenant WHERE id=${DISCOVERY_TENANT}::uuid`;
    }
    await runtime?.close();
    await admin?.close();
    runtime = undefined;
    admin = undefined;
  });

  test("runtime discovery returns only bounded exact latest-booked due property scopes", async () => {
    const source = new PostgresDueArrivalScopeSource(runtime!);
    expect(await source.listDueScopes(10)).toEqual([
      { tenantId: DISCOVERY_TENANT, propertyNode: DISCOVERY_PROPERTY_DUE },
    ]);
    await expect(source.listDueScopes(0)).rejects.toThrow("limit must be between 1 and 1000");
    await expect(source.listDueScopes(1_001)).rejects.toThrow("limit must be between 1 and 1000");
  });
});
