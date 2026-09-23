import { describe, expect, test } from "bun:test";

import {
  IndiaNativeFiscalSeriesConfigurationService,
  IndiaNativeFiscalSeriesDatabaseError,
  IndiaNativeFiscalSeriesValidationError,
  snapshotIndiaNativeFiscalSeriesConfigurationInput,
} from "../src/contexts/tax-fiscal";
import { ConfigureIndiaNativeFiscalSeriesCommand } from "../src/commands/configure-india-native-fiscal-series";
import { Database, type Tx } from "../src/kernel";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROPERTY = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const SUPPLIER = "44444444-4444-4444-8444-444444444444";
const SERIES = "55555555-5555-4555-8555-555555555555";
const REQUEST = "66666666-6666-4666-8666-666666666666";

function input(extra: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    supplierRegistrationId: SUPPLIER,
    documentKind: "credit_note" as const,
    prefix: "CR/2627/",
    envelope: {
      actorId: ACTOR,
      tenantId: TENANT,
      propertyNode: PROPERTY,
      requestId: REQUEST,
      operation: "document.series.configured",
    },
    ...extra,
  };
}

function row(extra: Record<string, unknown> = {}) {
  return {
    series_id: SERIES,
    tenant_id: TENANT,
    property_node: PROPERTY,
    supplier_registration_id: SUPPLIER,
    document_kind: "credit_note",
    prefix: "CR/2627/",
    financial_year_start: "2026-04-01",
    next_no: "1",
    created: true,
    ...extra,
  };
}

function txReturning(value: unknown, calls: Array<{ sql: string; values: readonly unknown[] }> = []): Tx {
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = Array.from(strings).join(" ");
    calls.push({ sql, values });
    if (sql.includes("current_setting('app.tenant_id'")) {
      return [{ tenant_id: TENANT, current_user: "app_role", current_role: "app_role" }];
    }
    if (typeof value === "function") return value();
    return value;
  }) as Tx;
}

function expectSeriesQuery(calls: Array<{ sql: string; values: readonly unknown[] }>) {
  expect(calls).toHaveLength(2);
  expect(calls[1]!.sql).toContain("create_india_native_fiscal_series");
  expect(calls[1]!.values).toEqual([TENANT, PROPERTY, SUPPLIER, "credit_note", "CR/2627/", ACTOR]);
  expect(calls[1]!.values).not.toContain(REQUEST);
}

describe("Order453 authenticated native fiscal-series configuration", () => {
  test("preserves create and same-prefix replay through the existing six-argument capability", async () => {
    let created = true;
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const tx = txReturning(() => {
      const value = row({ created });
      created = false;
      return [value];
    }, calls);
    const service = new IndiaNativeFiscalSeriesConfigurationService();

    const first = await service.configure(tx, input());
    const replay = await service.configure(tx, input());

    expect(first).toEqual({ seriesId: SERIES, tenantId: TENANT, propertyNode: PROPERTY,
      supplierRegistrationId: SUPPLIER, documentKind: "credit_note", prefix: "CR/2627/",
      financialYearStart: "2026-04-01", nextNo: "1", replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });
    expectSeriesQuery(calls.slice(0, 2));
    expectSeriesQuery(calls.slice(2));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(replay)).toBe(true);
  });

  test("snapshots valid input before asynchronous authority and SQL work", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    let release!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    const caller = input();
    const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: Array.from(strings).join(" "), values });
      if (calls.length === 1) {
        caller.tenantId = SERIES;
        caller.propertyNode = SERIES;
        caller.supplierRegistrationId = SERIES;
        caller.prefix = "MUTATED";
        caller.envelope.actorId = SERIES;
        await paused;
        return [{ tenant_id: TENANT, current_user: "app_role", current_role: "app_role" }];
      }
      return [row()];
    }) as Tx;
    const pending = new IndiaNativeFiscalSeriesConfigurationService().configure(tx, caller as never);
    release();
    await pending;
    expect(calls[1]!.values).toEqual([TENANT, PROPERTY, SUPPLIER, "credit_note", "CR/2627/", ACTOR]);
  });

  test("rejects hostile inputs and never calls SQL", async () => {
    let calls = 0;
    const tx = (async () => { calls += 1; return []; }) as never as Tx;
    let touched = 0;
    const accessor = Object.defineProperty(input(), "prefix", {
      enumerable: true,
      get() { touched += 1; return "CR/2627/"; },
    });
    const proxy = new Proxy(input(), { ownKeys() { touched += 1; throw new Error("input trap"); } });
    for (const value of [null, [], {}, input({ extra: true }), input({ tenantId: "not-a-uuid" }), input({ prefix: "bad prefix" }), accessor, proxy]) {
      await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(tx, value as never))
        .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesValidationError);
    }
    expect(calls).toBe(0);
    expect(touched).toBe(0);
    const frozen = snapshotIndiaNativeFiscalSeriesConfigurationInput(input());
    expect(frozen).not.toBeNull();
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen!.envelope)).toBe(true);
  });

  test("fails closed for zero, duplicate, malformed, foreign, and non-lossless driver rows", async () => {
    const cases: unknown[][] = [
      [], [row(), row()], [row({ tenant_id: SERIES })], [row({ property_node: SERIES })],
      [row({ supplier_registration_id: SERIES })], [row({ document_kind: "invoice" })],
      [row({ prefix: "OTHER/" })], [row({ financial_year_start: "2026-04-31" })],
      [row({ financial_year_start: "2026-02-01" })], [row({ extra: "unexpected" })],
      [row({ created: "true" })], [row({ next_no: "0" })], [row({ next_no: "9223372036854775808" })],
      [row({ next_no: 1.5 })],
    ];
    for (const rows of cases) {
      await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning(rows), input()))
        .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    }
    let touched = 0;
    const accessor = Object.defineProperty(row(), "next_no", { enumerable: true, get() { touched += 1; return "1"; } });
    const proxy = new Proxy(row(), { getOwnPropertyDescriptor() { touched += 1; throw new Error("row trap"); } });
    const outerProxy = new Proxy([row()], { get(target, property, receiver) {
      if (property === "then") return Reflect.get(target, property, receiver);
      touched += 1; throw new Error("container trap");
    } });
    const indexedAccessor = [row()];
    Object.defineProperty(indexedAccessor, "0", { enumerable: true, get() { touched += 1; return row(); } });
    const unknownMetadata = [row()] as unknown[];
    Object.defineProperty(unknownMetadata, "unexpected", { enumerable: true, value: true });
    const observedMetadata = [row()] as unknown[];
    Object.defineProperty(observedMetadata, "columns", { enumerable: false, value: ["series_id"] });
    const nested = input();
    Object.defineProperty(nested.envelope, "requestId", { enumerable: true, get() { touched += 1; return REQUEST; } });
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning([accessor]), input()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning([proxy]), input()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning(outerProxy), input()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning(indexedAccessor), input()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning(unknownMetadata), input()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning(observedMetadata), input()))
      .resolves.toMatchObject({ seriesId: SERIES });
    const bunResultPrototype = Object.create(Array.prototype, {
      constructor: { value: function SQLResultArray() {}, enumerable: false, writable: true, configurable: true },
    });
    const bunResult = (value: object): unknown[] => {
      const result = [value] as unknown[];
      Object.setPrototypeOf(result, bunResultPrototype);
      for (const [name, metadata] of [["count", 1], ["command", "SELECT"], ["lastInsertRowid", null], ["affectedRows", null]] as const) {
        Object.defineProperty(result, name, { value: metadata, enumerable: true, writable: true, configurable: true });
      }
      return result;
    };
    const bunSeriesResult = bunResult(row());
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning(bunSeriesResult), input()))
      .resolves.toMatchObject({ seriesId: SERIES });
    const bunContextResult = bunResult({ tenant_id: TENANT, current_user: "app_role", current_role: "app_role" });
    let bunQueries = 0;
    const bunTx = (async (strings: TemplateStringsArray) => {
      bunQueries += 1;
      return strings.join(" ").includes("current_setting('app.tenant_id'") ? bunContextResult : bunSeriesResult;
    }) as Tx;
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(bunTx, input()))
      .resolves.toMatchObject({ seriesId: SERIES });
    expect(bunQueries).toBe(2);
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning([row()]), nested))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesValidationError);
    expect(touched).toBe(0);
    const huge = await new IndiaNativeFiscalSeriesConfigurationService().configure(
      txReturning([row({ next_no: "9007199254740993" })]), input(),
    );
    expect(huge.nextNo).toBe("9007199254740993");

    const unavailableTx = txReturning(() => { throw Object.assign(new Error("private capability detail"), { errno: "55000" }); });
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(unavailableTx, input()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);

    const contextAccessor = Object.defineProperty({ tenant_id: TENANT, current_user: "app_role", current_role: "app_role" }, "tenant_id", {
      enumerable: true, get() { touched += 1; return TENANT; },
    });
    const contextTx = (async (strings: TemplateStringsArray) => {
      const sql = Array.from(strings).join(" ");
      return sql.includes("current_setting('app.tenant_id'") ? [contextAccessor] : [row()];
    }) as Tx;
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(contextTx, input()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    expect(touched).toBe(0);
  });

  test("rejects hostile Bun result prototypes and metadata accessors without invoking them", async () => {
    const resultWithPrototype = (prototype: object): unknown[] => {
      const result = [row()] as unknown[];
      Object.setPrototypeOf(result, prototype);
      Object.defineProperty(result, "count", { value: 1, enumerable: true });
      Object.defineProperty(result, "command", { value: "SELECT", enumerable: true });
      Object.defineProperty(result, "lastInsertRowid", { value: null, enumerable: true });
      Object.defineProperty(result, "affectedRows", { value: null, enumerable: true });
      return result;
    };
    const validPrototype = Object.create(Array.prototype, {
      constructor: { value: function SQLResultArray() {}, enumerable: false },
    });
    let prototypeTouched = 0;
    const proxiedPrototype = new Proxy(validPrototype, {
      get(target, property, receiver) {
        if (property === "then") return Reflect.get(target, property, receiver);
        prototypeTouched += 1; throw new Error("prototype get trap");
      },
      getPrototypeOf() { prototypeTouched += 1; throw new Error("prototype trap"); },
      ownKeys() { prototypeTouched += 1; throw new Error("prototype keys trap"); },
      getOwnPropertyDescriptor() { prototypeTouched += 1; throw new Error("prototype descriptor trap"); },
    });
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(
      txReturning(resultWithPrototype(proxiedPrototype)), input(),
    )).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    expect(prototypeTouched).toBe(0);

    const constructorAccessorPrototype = Object.create(Array.prototype, {
      constructor: { enumerable: false, get() { prototypeTouched += 1; return function SQLResultArray() {}; } },
    });
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(
      txReturning(resultWithPrototype(constructorAccessorPrototype)), input(),
    )).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    expect(prototypeTouched).toBe(0);

    const extraMethodPrototype = Object.create(Array.prototype, {
      constructor: { value: function SQLResultArray() {}, enumerable: false },
      extraMethod: { value: () => undefined, enumerable: false },
    });
    const deepParent = Object.create(Array.prototype, {
      constructor: { value: function SQLResultArray() {}, enumerable: false },
    });
    const deepPrototype = Object.create(deepParent, {
      constructor: { value: function SQLResultArray() {}, enumerable: false },
    });
    const foreignPrototype = Object.create(Object.prototype, {
      constructor: { value: function SQLResultArray() {}, enumerable: false },
    });
    for (const prototype of [extraMethodPrototype, deepPrototype, foreignPrototype]) {
      await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(
        txReturning(resultWithPrototype(prototype)), input(),
      )).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    }

    for (const metadata of ["command", "affectedRows"] as const) {
      let metadataTouched = 0;
      const result = [row()] as unknown[];
      Object.defineProperty(result, metadata, {
        enumerable: false,
        get() { metadataTouched += 1; return metadata === "command" ? "SELECT" : 0; },
      });
      await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(txReturning(result), input()))
        .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
      expect(metadataTouched).toBe(0);
    }
  });

  test("the command delegates executeInTransaction and opens one tenant transaction for execute", async () => {
    const directCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const connection = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Array.from(strings).join(" ");
      if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
      if (sql.includes("role_reset")) return [{ role_reset: true, tenant_reset: true }];
      if (sql.includes("current_setting('app.tenant_id'")) return [{ tenant_id: TENANT, current_user: "app_role", current_role: "app_role" }];
      if (sql.includes("create_india_native_fiscal_series")) return [row({ created: false })];
      throw new Error(`unexpected SQL: ${sql}`);
    }, {
      unsafe: async () => [],
      release: () => {},
      close: async () => {},
    });
    const command = new ConfigureIndiaNativeFiscalSeriesCommand(new Database({
      reserve: async () => connection as never,
    }));
    const direct = await command.executeInTransaction(txReturning([row()], directCalls), input());
    expect(direct.seriesId).toBe(SERIES);
    expectSeriesQuery(directCalls);

    const result = await command.execute(input());
    expect(result.seriesId).toBe(SERIES);
    expect(result.replayed).toBe(true);
  });
});
