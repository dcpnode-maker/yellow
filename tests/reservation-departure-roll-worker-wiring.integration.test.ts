import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RESERVATION_DEPARTURE_ROLL_ACTOR_ID,
  ReservationDepartureRollWorker,
  type DueDepartureScope,
  type DueDepartureScopeSource,
  type RollDueDeparturesInput,
} from "../src/contexts/reservations";
import { PostgresDueDepartureScopeSource } from "../src/workers/postgres-due-departure-scopes";

const TENANT = "00000000-0000-0000-0000-000000023301";
const PROPERTY = "00000000-0000-0000-0000-000000023302";
const RESERVATION = "00000000-0000-0000-0000-000000023303";
const SEGMENT = "00000000-0000-0000-0000-000000023304";
const DISCOVERY_TENANT = "00000000-0000-0000-0000-000000023351";
const DISCOVERY_PROPERTY_DUE = "00000000-0000-0000-0000-000000023352";
const DISCOVERY_PROPERTY_INCOHERENT = "00000000-0000-0000-0000-000000023353";
const DISCOVERY_PARTY = "00000000-0000-0000-0000-000000023354";
const DISCOVERY_UNIT_DUE = "00000000-0000-0000-0000-000000023355";
const DISCOVERY_UNIT_INCOHERENT = "00000000-0000-0000-0000-000000023356";
const DISCOVERY_RATE_DUE = "00000000-0000-0000-0000-000000023357";
const DISCOVERY_RATE_INCOHERENT = "00000000-0000-0000-0000-000000023358";
const DISCOVERY_RESERVATION_DUE = "00000000-0000-0000-0000-000000023359";
const DISCOVERY_RESERVATION_INCOHERENT = "00000000-0000-0000-0000-000000023360";
const DISCOVERY_SEGMENT_DUE = "00000000-0000-0000-0000-000000023361";
const DISCOVERY_SEGMENT_OLD = "00000000-0000-0000-0000-000000023362";
const DISCOVERY_SEGMENT_LATEST = "00000000-0000-0000-0000-000000023363";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;

class StaticSource implements DueDepartureScopeSource {
  constructor(readonly scopes: readonly DueDepartureScope[]) {}
  async listDueScopes(): Promise<readonly DueDepartureScope[]> { return this.scopes; }
}

describe("Order 233 reservation departure-roll worker wiring", () => {
  test("one cycle binds bounded scopes to the fixed system actor and exact operation", async () => {
    const calls: RollDueDeparturesInput[] = [];
    const worker = new ReservationDepartureRollWorker({
      async rollDueDepartures(input: RollDueDeparturesInput) {
        calls.push(input);
        return {
          tenantId: input.tenantId,
          propertyNode: input.propertyNode,
          businessDate: "2047-01-10",
          examined: 1,
          transitioned: 1,
          departures: [{ reservationId: RESERVATION, segmentId: SEGMENT, businessDate: "2047-01-10" }],
        };
      },
    }, new StaticSource([{ tenantId: TENANT, propertyNode: PROPERTY }]), {
      scopeBatchSize: 2,
      departureBatchSize: 7,
    });

    expect(await worker.drainOnce()).toEqual({ scopes: 1, examined: 1, transitioned: 1, failures: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      limit: 7,
      envelope: {
        actorId: RESERVATION_DEPARTURE_ROLL_ACTOR_ID,
        tenantId: TENANT,
        propertyNode: PROPERTY,
        operation: "reservation.due_out",
      },
    });
    expect(calls[0]!.envelope.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("a failed scope is contained and does not prevent the next scope", async () => {
    const propertyB = "00000000-0000-0000-0000-000000023305";
    const calls: string[] = [];
    const worker = new ReservationDepartureRollWorker({
      async rollDueDepartures(input: RollDueDeparturesInput) {
        calls.push(input.propertyNode);
        if (input.propertyNode === PROPERTY) throw new Error("injected scope failure");
        return {
          tenantId: input.tenantId,
          propertyNode: input.propertyNode,
          businessDate: null,
          examined: 0,
          transitioned: 0,
          departures: [],
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
    expect(() => new ReservationDepartureRollWorker({ rollDueDepartures: async () => { throw new Error("unused"); } }, source,
      { pollIntervalMs: 99 })).toThrow();
    expect(() => new ReservationDepartureRollWorker({ rollDueDepartures: async () => { throw new Error("unused"); } }, source,
      { scopeBatchSize: 101 })).toThrow();
    expect(() => new ReservationDepartureRollWorker({ rollDueDepartures: async () => { throw new Error("unused"); } }, source,
      { departureBatchSize: 101 })).toThrow();

    const controller = new AbortController();
    let cycles = 0;
    const worker = new ReservationDepartureRollWorker({
      async rollDueDepartures() { throw new Error("unused"); },
    }, source, { pollIntervalMs: 100 });
    await Promise.race([
      worker.run({ signal: controller.signal, onResult() { cycles += 1; controller.abort(); } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("departure-roll worker did not stop")), 1_000)),
    ]);
    expect(cycles).toBe(1);
  });

  test("server composition is workbench-only opt-in and logs no failure details", async () => {
    const [server, adapter] = await Promise.all([
      Bun.file(new URL("../src/server.ts", import.meta.url)).text(),
      Bun.file(new URL("../src/workers/postgres-due-departure-scopes.ts", import.meta.url)).text(),
    ]);
    expect(server).toContain(
      'workbenchEnabled && Bun.env.YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER === "1"',
    );
    expect(server).toContain("if (reservationDepartureRollEnabled)");
    expect(server).toContain("reservationDepartureRollWorkerEnabled: reservationDepartureRollEnabled");
    expect(server).toContain("new ReservationDepartureRollService(");
    expect(server).toContain("new ReservationDepartureRollWorker(");
    expect(server).toContain('console.error("reservation departure-roll worker discovery failed")');
    const wiring = server.slice(server.indexOf("if (reservationDepartureRollEnabled)"),
      server.indexOf("if (businessDayRollEnabled)"));
    expect(wiring).toContain("superviseWorker(worker.run({ signal: runtimeAbort.signal,");
    expect(wiring).toContain('}), "reservation departure-roll worker stopped unexpectedly");');
    expect(server).toContain("runtimeWorkerTasks.push(promise.catch(() => { console.error(failureMessage); }));");
    expect(server).not.toMatch(/reservation departure-roll worker[^\n]*(?:error|cause|stack|message)/i);
    const status = await Bun.file(new URL("../src/project-status.ts", import.meta.url)).text();
    const operator = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    expect(status).toContain("readonly reservationDepartureRollWorkerEnabled: boolean;");
    expect(status).toContain("reservationDepartureRollWorkerEnabled: false,");
    expect(operator).toContain(
      'healthCard("Reservation departure-roll worker", live.workers.reservationDepartureRoll',
    );
    expect(adapter).toContain("FROM runtime_due_departure_scopes(${limit})");
    expect(adapter).not.toMatch(/business_day|reservation_segment|UPDATE|INSERT|DELETE/i);
  });
});

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let runtime: SQL | undefined;

databaseDescribe("Order 233 PostgreSQL due-departure scope discovery", () => {
  beforeAll(async () => {
    admin = new SQL(DEPLOY_DATABASE_URL!, { max: 2, prepare: false });
    runtime = new SQL(RUNTIME_DATABASE_URL!, { max: 2, prepare: false });
    await admin`INSERT INTO tenant (id,slug,name,tier,status)
      VALUES (${DISCOVERY_TENANT}::uuid,'order-233-discovery','Order 233 Discovery','shared','active')`;
    await admin`INSERT INTO org_node (id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${DISCOVERY_PROPERTY_DUE}::uuid,${DISCOVERY_TENANT}::uuid,'order_233.discovery_due','property',
       'Order 233 Due','Pacific/Kiritimati','USD'),
      (${DISCOVERY_PROPERTY_INCOHERENT}::uuid,${DISCOVERY_TENANT}::uuid,'order_233.discovery_incoherent','property',
       'Order 233 Incoherent','Pacific/Kiritimati','USD')`;
    await admin`INSERT INTO party (id,tenant_id,kind,display_name)
      VALUES (${DISCOVERY_PARTY}::uuid,${DISCOVERY_TENANT}::uuid,'person','Order 233 Guest')`;
    await admin`INSERT INTO unit_type (id,tenant_id,property_node,code,name,profile_key) VALUES
      (${DISCOVERY_UNIT_DUE}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_DUE}::uuid,
       'O233D','Order 233 Due','hotel'),
      (${DISCOVERY_UNIT_INCOHERENT}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_INCOHERENT}::uuid,
       'O233I','Order 233 Incoherent','hotel')`;
    await admin`INSERT INTO rate_plan (id,tenant_id,property_node,code,name,currency) VALUES
      (${DISCOVERY_RATE_DUE}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_DUE}::uuid,
       'O233D','Order 233 Due','USD'),
      (${DISCOVERY_RATE_INCOHERENT}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_INCOHERENT}::uuid,
       'O233I','Order 233 Incoherent','USD')`;
    await admin`INSERT INTO reservation
      (id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency) VALUES
      (${DISCOVERY_RESERVATION_DUE}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_DUE}::uuid,
       'O233-DUE','in_house',${DISCOVERY_PARTY}::uuid,'direct','USD'),
      (${DISCOVERY_RESERVATION_INCOHERENT}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_PROPERTY_INCOHERENT}::uuid,
       'O233-INCOHERENT','in_house',${DISCOVERY_PARTY}::uuid,'direct','USD')`;
    await admin`INSERT INTO reservation_segment
      (id,tenant_id,reservation_id,seq,unit_type_id,period,rate_plan_id,status) VALUES
      (${DISCOVERY_SEGMENT_DUE}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_RESERVATION_DUE}::uuid,1,
       ${DISCOVERY_UNIT_DUE}::uuid,
       tstzrange(
         (date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') - interval '1 day') AT TIME ZONE 'Pacific/Kiritimati',
         date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') AT TIME ZONE 'Pacific/Kiritimati',
         '[)'),${DISCOVERY_RATE_DUE}::uuid,'in_house'),
      (${DISCOVERY_SEGMENT_OLD}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_RESERVATION_INCOHERENT}::uuid,1,
       ${DISCOVERY_UNIT_INCOHERENT}::uuid,
       tstzrange(
         (date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') - interval '1 day') AT TIME ZONE 'Pacific/Kiritimati',
         date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') AT TIME ZONE 'Pacific/Kiritimati',
         '[)'),${DISCOVERY_RATE_INCOHERENT}::uuid,'in_house'),
      (${DISCOVERY_SEGMENT_LATEST}::uuid,${DISCOVERY_TENANT}::uuid,${DISCOVERY_RESERVATION_INCOHERENT}::uuid,2,
       ${DISCOVERY_UNIT_INCOHERENT}::uuid,
       tstzrange(
         date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') AT TIME ZONE 'Pacific/Kiritimati',
         (date_trunc('day', transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati') + interval '1 day') AT TIME ZONE 'Pacific/Kiritimati',
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

  test("runtime discovery returns only bounded exact latest-in-house due property scopes", async () => {
    const source = new PostgresDueDepartureScopeSource(runtime!);
    expect(await source.listDueScopes(10)).toEqual([
      { tenantId: DISCOVERY_TENANT, propertyNode: DISCOVERY_PROPERTY_DUE },
    ]);
    await expect(source.listDueScopes(0)).rejects.toThrow("limit must be between 1 and 1000");
    await expect(source.listDueScopes(1_001)).rejects.toThrow("limit must be between 1 and 1000");
  });
});
