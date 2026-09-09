import { describe, expect, test } from "bun:test";
import type { Tx } from "../src/kernel";
import {
  IndiaNativeFiscalSeriesAuthorizationError,
  IndiaNativeFiscalSeriesDatabaseError,
  IndiaNativeFiscalSeriesValidationError,
} from "../src/contexts/tax-fiscal/india-native-fiscal-invoice";
import {
  IndiaNativeFiscalSeriesDiscoveryService,
  snapshotIndiaNativeFiscalSeriesDiscoveryInput,
} from "../src/contexts/tax-fiscal/india-native-fiscal-series-discovery";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROPERTY = "22222222-2222-4222-8222-222222222222";
const SUPPLIER = "33333333-3333-4333-8333-333333333333";
const ACTOR = "44444444-4444-4444-8444-444444444444";
const SERIES = "55555555-5555-4555-8555-555555555555";
const SERIES_KEYS = ["series_id", "tenant_id", "property_node", "supplier_registration_id",
  "document_kind", "prefix", "financial_year_start", "next_no"] as const;
type Call = { sql: string; values: unknown[] };
function input(extra: Record<string, unknown> = {}) {
  return { tenantId: TENANT, propertyNode: PROPERTY, supplierRegistrationId: SUPPLIER,
    documentKind: "credit_note" as const, actorId: ACTOR, ...extra };
}
function row(extra: Record<string, unknown> = {}) {
  return { authority_allowed: true, supplier_available: true, current_financial_year_start: "2026-04-01",
    series_id: SERIES, tenant_id: TENANT, property_node: PROPERTY, supplier_registration_id: SUPPLIER,
    document_kind: "credit_note", prefix: "CUSTOM/2627/", financial_year_start: "2026-04-01", next_no: "37", ...extra };
}
function empty(extra: Record<string, unknown> = {}) {
  return row({ ...Object.fromEntries(SERIES_KEYS.map(key => [key, null])), ...extra });
}
function denied(extra: Record<string, unknown> = {}) {
  return empty({ authority_allowed: false, supplier_available: null, current_financial_year_start: null, ...extra });
}
function returning(value: unknown, calls: Call[] = []): Tx {
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: strings.join(" ? "), values });
    return value;
  }) as Tx;
}
const service = new IndiaNativeFiscalSeriesDiscoveryService();

describe("Order454 migration-free current fiscal-series discovery", () => {
  test("one parameterized read returns only eight frozen, bound fields and lossless advanced counter", async () => {
    for (const kind of ["invoice", "credit_note", "debit_note"] as const) {
      const calls: Call[] = [];
      const result = await service.read(returning([row({ document_kind: kind, next_no: "9223372036854775807" })], calls), input({ documentKind: kind }));
      expect(result).toEqual({ seriesId: SERIES, tenantId: TENANT, propertyNode: PROPERTY,
        supplierRegistrationId: SUPPLIER, documentKind: kind, prefix: "CUSTOM/2627/",
        financialYearStart: "2026-04-01", nextNo: "9223372036854775807" });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.keys(result!)).toHaveLength(8);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.values).toEqual([TENANT, PROPERTY, SUPPLIER, kind, ACTOR]);
      for (const value of [TENANT, PROPERTY, SUPPLIER, ACTOR]) expect(calls[0]!.sql).not.toContain(value);
      expect(calls[0]!.sql).toContain("? ::text AS document_kind");
    }
  });

  test("mandatory authority precedes absence; invalid supplier and malformed denial never become null", async () => {
    expect(await service.read(returning([empty()]), input())).toBeNull();
    await expect(service.read(returning([denied()]), input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesAuthorizationError);
    await expect(service.read(returning([empty({ supplier_available: false })]), input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    for (const key of [...SERIES_KEYS, "supplier_available", "current_financial_year_start"]) {
      await expect(service.read(returning([denied({ [key]: "protected" })]), input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    }
    for (const authority of [null, undefined, "true", "false", 0, 1]) {
      await expect(service.read(returning([row({ authority_allowed: authority })]), input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    }
    for (const key of SERIES_KEYS) {
      await expect(service.read(returning([empty({ [key]: row()[key] })]), input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    }
  });

  test("input is exact own data and invalid selectors cause zero SQL calls", async () => {
    const invalid: unknown[] = [null, [], true, "input", input({ actorId: "INVALID" }), input({ documentKind: "folio" }),
      input({ tenantId: TENANT.toUpperCase().replace("1", "A") }), input({ propertyNode: 1 }), input({ supplierRegistrationId: null })];
    for (const key of ["tenantId", "propertyNode", "supplierRegistrationId", "documentKind", "actorId"]) {
      const value: Record<string, unknown> = input(); delete value[key]; invalid.push(value);
    }
    for (const key of ["prefix", "financialYearStart", "date", "nextNo", "seriesId", "envelope", "extra"]) invalid.push(input({ [key]: "forbidden" }));
    invalid.push(Object.assign(Object.create({ inherited: true }), input()));
    invalid.push(Object.assign(input(), { [Symbol("hidden")]: true }));
    invalid.push(Object.defineProperty(input(), "actorId", { value: ACTOR, enumerable: false }));
    for (const value of invalid) {
      const calls: Call[] = [];
      expect(snapshotIndiaNativeFiscalSeriesDiscoveryInput(value)).toBeNull();
      await expect(service.read(returning([row()], calls), value)).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesValidationError);
      expect(calls).toHaveLength(0);
    }
    expect(snapshotIndiaNativeFiscalSeriesDiscoveryInput(Object.assign(Object.create(null), input()))).toEqual(input());
    await expect(service.read(null as unknown as Tx, input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesValidationError);
  });

  test("input accessors/proxies are never invoked and the accepted input is detached before await", async () => {
    let traps = 0;
    const accessor = Object.defineProperty(input(), "actorId", { enumerable: true, get() { traps++; return ACTOR; } });
    const proxy = new Proxy(input(), { get() { traps++; throw Error(); }, ownKeys() { traps++; throw Error(); }, getPrototypeOf() { traps++; throw Error(); } });
    const revoked = Proxy.revocable(input(), {}); revoked.revoke();
    for (const value of [accessor, proxy, revoked.proxy]) {
      await expect(service.read(returning([row()]), value)).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesValidationError);
    }
    expect(traps).toBe(0);
    const original = input(), snapshot = snapshotIndiaNativeFiscalSeriesDiscoveryInput(original)!;
    expect(snapshot).not.toBe(original); expect(Object.isFrozen(snapshot)).toBe(true);
    let finish!: (value: unknown) => void;
    const calls: Call[] = [];
    const tx = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: strings.join(" ? "), values });
      return new Promise(resolve => { finish = resolve; });
    }) as Tx;
    const promise = service.read(tx, original);
    original.actorId = SERIES; original.propertyNode = SERIES; original.supplierRegistrationId = SERIES;
    finish([row()]);
    expect(await promise).toMatchObject({ propertyNode: PROPERTY, supplierRegistrationId: SUPPLIER });
    expect(calls[0]!.values).toEqual([TENANT, PROPERTY, SUPPLIER, "credit_note", ACTOR]);
  });

  test("malformed identity, prefix, current FY and counter are unavailable, not usable configuration", async () => {
    const changes: Record<string, unknown>[] = [
      { series_id: "not-a-uuid" }, { tenant_id: SERIES }, { property_node: SERIES }, { supplier_registration_id: SERIES },
      { document_kind: "invoice" }, { prefix: "" }, { prefix: "has space" }, { prefix: "x".repeat(13) }, { prefix: "Ｃ/" },
      { prefix: 1 }, { financial_year_start: "2025-04-01" }, { financial_year_start: "2026-04-02" },
      { current_financial_year_start: "2026-02-30" }, { current_financial_year_start: "0000-04-01" },
      { current_financial_year_start: "2026-01-01" }, { current_financial_year_start: new Date() },
      { supplier_available: null }, { supplier_available: "true" }, { created: false },
    ];
    for (const next_no of ["0", "-1", "+1", "01", "1.0", "1e2", "9223372036854775808", "9".repeat(1000), 1, 1n, null, {}, "1\n"]) changes.push({ next_no });
    for (const change of changes) await expect(service.read(returning([row(change)]), input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    for (const date of ["2025-04-01", "2027-04-01"]) {
      expect(await service.read(returning([row({ current_financial_year_start: date, financial_year_start: date, next_no: "1" })]), input())).toMatchObject({ financialYearStart: date, nextNo: "1" });
    }
  });

  test("one plain driver row accepts actual Bun metadata but rejects extra or hostile containers without traps", async () => {
    class BunRows extends Array<unknown> {}
    const driver = new BunRows(row());
    for (const [key, value] of Object.entries({ count: 1, command: "SELECT", lastInsertRowid: null, affectedRows: null, columns: [], columnTypes: [] })) {
      Object.defineProperty(driver, key, { value, enumerable: true });
    }
    expect(await service.read(returning(driver), input())).toMatchObject({ seriesId: SERIES });
    expect(await service.read(returning([Object.assign(Object.create(null), row())]), input())).toMatchObject({ seriesId: SERIES });
    let traps = 0;
    // Promise settlement itself probes `then` before the service receives a value.
    // Permit only that language-protocol lookup; every decoder-related trap stays hostile.
    const proxy = new Proxy([row()], { get(_target, key) { if (key === "then") return undefined; traps++; throw Error(); }, ownKeys() { traps++; throw Error(); }, getPrototypeOf() { traps++; throw Error(); } });
    const rowProxy = new Proxy(row(), { get() { traps++; throw Error(); }, ownKeys() { traps++; throw Error(); }, getPrototypeOf() { traps++; throw Error(); } });
    const getter = Object.defineProperty(row(), "authority_allowed", { enumerable: true, get() { traps++; return true; } });
    const metaGetter = Object.defineProperty([row()], "count", { get() { traps++; return 1; } });
    const indexGetter = Object.defineProperty([row()], "0", { get() { traps++; return row(); } });
    class ExtraPrototype extends Array<unknown> { extra() {} }
    const bad: unknown[] = [null, {}, [], [row(), row()], new Array(1), proxy, [rowProxy], [getter], metaGetter, indexGetter,
      [Object.assign(Object.create({ inherited: 1 }), row())], Object.assign([row()], { unexpected: 1 }),
      Object.assign([row()], { [Symbol("metadata")]: 1 }), new ExtraPrototype(row()),
      [Object.defineProperty(row(), "prefix", { value: "C/", enumerable: false })]];
    const proxyPrototype = Object.setPrototypeOf([row()], new Proxy(Array.prototype, { getPrototypeOf() { traps++; throw Error(); } }));
    bad.push(proxyPrototype);
    const inheritedAccessor = Object.create(Array.prototype);
    Object.defineProperty(inheritedAccessor, "constructor", { get() { traps++; return Array; } });
    bad.push(Object.setPrototypeOf([row()], inheritedAccessor));
    for (const value of bad) await expect(service.read(returning(value), input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
    expect(traps).toBe(0);
  });

  test("SQL contains current coherent authority and an indexed gated read, no writing capability or lock", async () => {
    const calls: Call[] = [];
    await service.read(returning([empty()], calls), input());
    const sql = calls[0]!.sql;
    for (const required of ["authority AS MATERIALIZED", "session_user = 'yellow_runtime'", "current_user = 'app_role'",
      "pg_catalog.current_setting('role', true) = 'app_role'", "pg_catalog.current_setting('app.tenant_id', true) = input.tenant_id::text",
      "a.status='active'", "t.status='active'", "r.tenant_id=ur.tenant_id", "r.id=ur.role_id",
      "grant_node.tenant_id=ur.tenant_id", "grant_node.path @> p.path", "tax-fiscal.series:configure",
      "pg_catalog.transaction_timestamp() AT TIME ZONE p.timezone", "registration_status.status_as_of=property_date.business_date",
      "registration_status.gst_registration_status='active'", "registration.property_node=scope.property_node",
      "registration.scheme='in-gstin'", "registration.currency='INR'", "LEFT JOIN LATERAL",
      "scope.authority_allowed AND scope.supplier_available", "series.tenant_id=scope.tenant_id", "series.property_node=scope.property_node",
      "series.supplier_registration_id=scope.supplier_registration_id", "series.kind=scope.document_kind",
      "series.financial_year_start=scope.current_financial_year_start", "series.kind IN ('invoice','credit_note','debit_note')", "series.fiscal", "LIMIT 2"]) expect(sql).toContain(required);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|OFFSET|FOR SHARE|FOR KEY SHARE|FOR UPDATE)\b|pg_advisory|create_india_native_fiscal_series|assert_india_native_credit_authority|read_india_native_fiscal_credit_note/);
    expect(sql.indexOf("authority AS MATERIALIZED")).toBeLessThan(sql.indexOf("FROM public.document_series"));
  });

  test("storage errors are sanitized and SQL permission denial retains its domain boundary", async () => {
    for (const field of ["errno", "sqlState", "code"]) {
      const tx = (async () => { throw { [field]: "42501", detail: "secret" }; }) as unknown as Tx;
      await expect(service.read(tx, input())).rejects.toBeInstanceOf(IndiaNativeFiscalSeriesAuthorizationError);
    }
    let traps = 0;
    const hostile = new Proxy({}, { get() { traps++; throw Error(); }, getPrototypeOf() { traps++; throw Error(); } });
    for (const error of [Error("secret sql"), { errno: "23505", message: "secret" }, hostile,
      Object.defineProperty({}, "errno", { get() { traps++; return "42501"; } })]) {
      const tx = (async () => { throw error; }) as unknown as Tx;
      try { await service.read(tx, input()); throw Error("unexpected success"); }
      catch (failure) {
        expect(failure).toBeInstanceOf(IndiaNativeFiscalSeriesDatabaseError);
        expect((failure as Error).message).not.toContain("secret");
      }
    }
    expect(traps).toBe(0);
  });
});
