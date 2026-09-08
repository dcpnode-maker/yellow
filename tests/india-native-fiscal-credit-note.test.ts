import { describe, expect, test } from "bun:test";
import {
  IndiaNativeFiscalCreditNoteAuthorizationError,
  IndiaNativeFiscalCreditNoteConflictError,
  IndiaNativeFiscalCreditNoteDatabaseError,
  IndiaNativeFiscalCreditNoteNotFoundError,
  IndiaNativeFiscalCreditNoteService,
  IndiaNativeFiscalCreditNoteValidationError,
  snapshotIndiaNativeFiscalCreditNoteIssueInput,
  snapshotIndiaNativeFiscalCreditNoteReadInput,
  snapshotIndiaNativeFiscalCreditNoteDiscoveryInput,
  type IndiaNativeFiscalCreditNoteReceipt,
} from "../src/contexts/tax-fiscal/india-native-fiscal-credit-note";
import {
  IssueIndiaNativeFiscalCreditNoteCommand,
  ReadIndiaNativeFiscalCreditNoteCommand,
  issueIndiaNativeFiscalCreditNoteInTransaction,
  readIndiaNativeFiscalCreditNoteInTransaction,
  DiscoverIndiaNativeFiscalCreditNoteCommand,
  discoverIndiaNativeFiscalCreditNote,
  discoverIndiaNativeFiscalCreditNoteInTransaction,
} from "../src/commands/issue-india-native-fiscal-credit-note";
import { Database, type ConnectionPool } from "../src/kernel";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROPERTY = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const ORIGINAL = "44444444-4444-4444-8444-444444444444";
const CREDIT = "55555555-5555-4555-8555-555555555555";
const JOURNAL = "66666666-6666-4666-8666-666666666666";
const SERIES = "77777777-7777-4777-8777-777777777777";
const RESERVATION = "88888888-8888-4888-8888-888888888888";
const FOLIO = "99999999-9999-4999-8999-999999999999";
const SUPPLIER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RECIPIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REQUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function issueInput(extra: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    actorId: ACTOR,
    originalDocumentId: ORIGINAL,
    reason: "Full credit for an incorrectly issued invoice",
    idempotencyKey: "credit-note-446-0001",
    envelope: {
      actorId: ACTOR,
      tenantId: TENANT,
      propertyNode: PROPERTY,
      requestId: REQUEST,
      operation: "document.issued",
    },
    ...extra,
  };
}

function readInput(extra: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    actorId: ACTOR,
    creditDocumentId: CREDIT,
    ...extra,
  };
}

function receipt(): IndiaNativeFiscalCreditNoteReceipt;
function receipt(extra: Record<string, unknown>): Record<string, unknown>;
function receipt(extra: Record<string, unknown> = {}): IndiaNativeFiscalCreditNoteReceipt | Record<string, unknown> {
  return {
    documentId: CREDIT,
    documentKind: "credit_note",
    originalDocumentId: ORIGINAL,
    originalDocNo: "I/2627/18",
    originalSha256: HASH_A,
    correctionJournalId: JOURNAL,
    seriesId: SERIES,
    docNo: "C/2627/4",
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
    supplierRegistrationId: SUPPLIER,
    recipientRegistrationId: RECIPIENT,
    financialYearStart: "2026-04-01",
    currency: "INR",
    status: "issued",
    businessDate: "2026-09-07",
    issuedAt: "2026-09-07T08:09:10.123Z",
    prevHash: null,
    sha256: HASH_B,
    sourceEvidenceHash: HASH_C,
    totalMinor: "18750",
    reason: "Full credit for an incorrectly issued invoice",
    ...extra,
  };
}

function receiptJson(extra: Record<string, unknown> = {}): string {
  return JSON.stringify(receipt(extra));
}

function txReturning(rows: unknown[], calls: Array<{ sql: string; values: readonly unknown[] }>) {
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: Array.from(strings).join("?"), values });
    return rows;
  }) as never;
}

describe("Order446 typed India native fiscal credit note", () => {
  test("snapshots exact issue and read inputs without invoking hostile accessors", () => {
    const issued = snapshotIndiaNativeFiscalCreditNoteIssueInput(issueInput());
    const read = snapshotIndiaNativeFiscalCreditNoteReadInput(readInput());
    expect(issued).toEqual(issueInput());
    expect(read).toEqual(readInput());
    expect(Object.isFrozen(issued)).toBeTrue();
    expect(Object.isFrozen(issued?.envelope)).toBeTrue();
    expect(Object.isFrozen(read)).toBeTrue();

    let reads = 0;
    const issueAccessor = Object.defineProperty(issueInput(), "tenantId", {
      enumerable: true,
      get() { reads += 1; return TENANT; },
    });
    const readAccessor = Object.defineProperty(readInput(), "tenantId", {
      enumerable: true,
      get() { reads += 1; return TENANT; },
    });
    expect(snapshotIndiaNativeFiscalCreditNoteIssueInput(issueAccessor)).toBeNull();
    expect(snapshotIndiaNativeFiscalCreditNoteReadInput(readAccessor)).toBeNull();
    expect(reads).toBe(0);
    expect(snapshotIndiaNativeFiscalCreditNoteIssueInput(new Proxy(issueInput(), {}))).toBeNull();
    expect(snapshotIndiaNativeFiscalCreditNoteReadInput(new Proxy(readInput(), {}))).toBeNull();

    const preserved = snapshotIndiaNativeFiscalCreditNoteIssueInput(issueInput({ reason: "  exact reason  " }));
    expect(preserved?.reason).toBe("  exact reason  ");
    expect(snapshotIndiaNativeFiscalCreditNoteIssueInput(issueInput({ reason: "💛".repeat(500) }))).not.toBeNull();
    expect(snapshotIndiaNativeFiscalCreditNoteIssueInput(issueInput({ reason: "💛".repeat(501) }))).toBeNull();
    expect(snapshotIndiaNativeFiscalCreditNoteIssueInput(issueInput({ reason: "bad\ud800" }))).toBeNull();
  });

  test("rejects unsupported or mismatched caller authority before the first query", async () => {
    const invalid = [
      issueInput({ amountMinor: "1" }),
      issueInput({ actorId: CREDIT }),
      issueInput({ reason: "   " }),
      issueInput({ reason: "bad\u0007value" }),
      issueInput({ idempotencyKey: "short" }),
      issueInput({ originalDocumentId: "not-a-uuid" }),
      issueInput({ envelope: { ...issueInput().envelope, operation: "journal.posted" } }),
    ];
    let calls = 0;
    const tx = (async () => { calls += 1; return []; }) as never;
    const service = new IndiaNativeFiscalCreditNoteService();
    for (const value of invalid) {
      await expect(service.issue(tx, value)).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    }
    await expect(service.read(tx, readInput({ originalDocumentId: ORIGINAL })))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    expect(calls).toBe(0);
  });

  test("binds exactly seven issue parameters and preserves immutable receipt bytes", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const json = receiptJson();
    const service = new IndiaNativeFiscalCreditNoteService();
    const result = await service.issue(txReturning([{ receipt_json: json, replayed: false }], calls), issueInput());

    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toContain("public.commit_india_native_fiscal_credit_note(");
    expect(calls[0]!.values).toEqual([
      TENANT, PROPERTY, ACTOR, ORIGINAL,
      "Full credit for an incorrectly issued invoice", "credit-note-446-0001", REQUEST,
    ]);
    expect(result.receiptJson).toBe(json);
    expect(result.receipt).toEqual(receipt());
    expect(result.replayed).toBeFalse();
    expect(Object.isFrozen(result)).toBeTrue();
    expect(Object.isFrozen(result.receipt)).toBeTrue();
    expect(Object.hasOwn(result.receipt, "replayed")).toBeFalse();

    const reorderedJson = JSON.stringify(Object.fromEntries(Object.entries(receipt()).reverse()), null, 2);
    const reordered = await service.issue(
      txReturning([{ receipt_json: reorderedJson, replayed: true }], []),
      issueInput(),
    );
    expect(reordered.receiptJson).toBe(reorderedJson);
    expect(reordered.receipt).toEqual(receipt());
  });

  test("accepts native Bun SQLResultArray metadata without treating it as receipt data", async () => {
    // Observed from real Bun1.3.14 PostgreSQL SELECT results. The result container
    // has these own metadata fields; individual rows remain exact plain records.
    class SQLResultArray extends Array<unknown> {}
    const nativeRows = (row: unknown) => Object.assign(new SQLResultArray(row), {
      count: 1, command: "SELECT", lastInsertRowid: null, affectedRows: 0,
    });
    const service = new IndiaNativeFiscalCreditNoteService();
    const json = receiptJson();
    expect((await service.issue(txReturning(nativeRows({ receipt_json: json, replayed: false }), []), issueInput())).receiptJson)
      .toBe(json);
    expect((await service.read(txReturning(nativeRows({ receipt_json: json }), []), readInput()))?.receiptJson)
      .toBe(json);
    let reads = 0;
    const hostile = Object.defineProperty(nativeRows({ receipt_json: json, replayed: false }), "count", {
      get() { reads += 1; throw new Error("must never execute a metadata accessor"); },
    });
    await expect(service.issue(txReturning(hostile, []), issueInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    expect(reads).toBe(0);
  });

  test("reads the same immutable receipt body with exactly four selectors", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const json = receiptJson();
    const service = new IndiaNativeFiscalCreditNoteService();
    const result = await service.read(txReturning([{ receipt_json: json }], calls), readInput());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toContain("public.read_india_native_fiscal_credit_note(");
    expect(calls[0]!.values).toEqual([TENANT, PROPERTY, ACTOR, CREDIT]);
    expect(result).toEqual({ receipt: receipt(), receiptJson: json });
    expect(Object.isFrozen(result)).toBeTrue();
    expect(Object.isFrozen(result?.receipt)).toBeTrue();
  });

  test("conceals a missing credit note as null", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const result = await new IndiaNativeFiscalCreditNoteService()
      .read(txReturning([{ receipt_json: null }], calls), readInput());
    expect(result).toBeNull();
    expect(calls).toHaveLength(1);
  });

  test("maps malformed, selector-divergent and hostile database rows to storage failure", async () => {
    const service = new IndiaNativeFiscalCreditNoteService();
    const cases: unknown[][] = [
      [],
      [{ receipt_json: receiptJson(), replayed: "false" }],
      [{ receipt_json: receiptJson() }, { receipt_json: receiptJson() }],
      [{ receipt_json: "not-json", replayed: false }],
      [{ receipt_json: receiptJson({ originalDocumentId: CREDIT }), replayed: false }],
      [{ receipt_json: receiptJson({ propertyNode: TENANT }), replayed: false }],
      [{ receipt_json: receiptJson({ totalMinor: "0" }), replayed: false }],
      [{ receipt_json: receiptJson({ surplus: "forbidden" }), replayed: false }],
    ];
    for (const rows of cases) {
      await expect(service.issue(txReturning(rows, []), issueInput()))
        .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    }

    let getterReads = 0;
    const hostileRow = Object.defineProperty({ replayed: false }, "receipt_json", {
      enumerable: true,
      get() { getterReads += 1; return receiptJson(); },
    });
    await expect(service.issue(txReturning([hostileRow], []), issueInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    expect(getterReads).toBe(0);
    await expect(service.issue(txReturning(new Proxy([{ receipt_json: receiptJson(), replayed: false }], {}), []), issueInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);

    await expect(service.read(txReturning([{ receipt_json: "not-json" }], []), readInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    await expect(service.read(txReturning([{ receipt_json: receiptJson({ documentId: ORIGINAL }) }], []), readInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    await expect(service.read(txReturning([{ receipt_json: receiptJson(), surplus: true }], []), readInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
  });

  test("maps SQL states to sanitized typed domain failures", async () => {
    const service = new IndiaNativeFiscalCreditNoteService();
    const mapped: Array<[string, new (...args: never[]) => Error]> = [
      ["42501", IndiaNativeFiscalCreditNoteAuthorizationError],
      ["P0002", IndiaNativeFiscalCreditNoteNotFoundError],
      ["22023", IndiaNativeFiscalCreditNoteValidationError],
      ["23505", IndiaNativeFiscalCreditNoteConflictError],
      ["40001", IndiaNativeFiscalCreditNoteConflictError],
      ["P0011", IndiaNativeFiscalCreditNoteConflictError],
    ];
    for (const [code, expected] of mapped) {
      const tx = (async () => { throw { code, message: "secret SQL body" }; }) as never;
      try {
        await service.issue(tx, issueInput());
        throw new Error("expected issue failure");
      } catch (error) {
        expect(error).toBeInstanceOf(expected);
        expect(String((error as Error).message)).not.toContain("secret");
        expect(JSON.stringify(error)).not.toContain("secret");
      }
    }
    const unknown = (async () => { throw new Error("connection password secret"); }) as never;
    await expect(service.issue(unknown, issueInput())).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);

    let hostileReads = 0;
    const hostileError = new Proxy({}, {
      getPrototypeOf() { hostileReads += 1; throw new Error("secret proxy trap"); },
      get() { hostileReads += 1; throw new Error("secret proxy trap"); },
    });
    const hostile = (async () => { throw hostileError; }) as never;
    await expect(service.issue(hostile, issueInput())).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    expect(hostileReads).toBe(0);
  });

  test("transaction-owned convenience functions delegate without opening a second transaction", async () => {
    const issueCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const issued = await issueIndiaNativeFiscalCreditNoteInTransaction(
      txReturning([{ receipt_json: receiptJson(), replayed: true }], issueCalls), issueInput(),
    );
    const readCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const read = await readIndiaNativeFiscalCreditNoteInTransaction(
      txReturning([{ receipt_json: receiptJson() }], readCalls), readInput(),
    );
    expect(issued.replayed).toBeTrue();
    expect(read?.receipt.documentId).toBe(CREDIT);
    expect(issueCalls).toHaveLength(1);
    expect(readCalls).toHaveLength(1);
  });

  test("commands snapshot before checkout and use the database rollback boundary", async () => {
    function database(failure?: { code: string }) {
      const steps: string[] = [];
      let reserves = 0;
      const connection = Object.assign(
        async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const sql = Array.from(strings).join(" ");
          if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
          if (sql.includes("role_reset")) return [{ role_reset: true, tenant_reset: true }];
          if (sql.includes("commit_india_native_fiscal_credit_note")) {
            if (failure) throw failure;
            return [{ receipt_json: receiptJson(), replayed: false }];
          }
          if (sql.includes("read_india_native_fiscal_credit_note")) return [{ receipt_json: receiptJson() }];
          throw new Error(`unexpected query: ${sql}`);
        },
        {
          unsafe: async (sql: string) => { steps.push(sql); return []; },
          release: () => { steps.push("RELEASE"); },
          close: async () => { steps.push("CLOSE"); },
        },
      );
      const pool: ConnectionPool = { reserve: async () => { reserves += 1; return connection as never; } };
      return { value: new Database(pool), steps, reserves: () => reserves };
    }

    const success = database();
    const issued = await new IssueIndiaNativeFiscalCreditNoteCommand(success.value).execute(issueInput());
    expect(issued.receipt.documentId).toBe(CREDIT);
    expect(success.reserves()).toBe(1);
    expect(success.steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", "COMMIT", "RELEASE"]);

    const readSuccess = database();
    expect((await new ReadIndiaNativeFiscalCreditNoteCommand(readSuccess.value).execute(readInput()))?.receipt.documentId).toBe(CREDIT);
    expect(readSuccess.steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", "COMMIT", "RELEASE"]);

    const denied = database({ code: "42501" });
    await expect(new IssueIndiaNativeFiscalCreditNoteCommand(denied.value).execute(issueInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteAuthorizationError);
    expect(denied.steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", "ROLLBACK", "RELEASE"]);

    const invalid = database();
    await expect(new IssueIndiaNativeFiscalCreditNoteCommand(invalid.value)
      .execute(issueInput({ amountMinor: "1" })))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    expect(invalid.reserves()).toBe(0);
    expect(invalid.steps).toEqual([]);
  });
});

describe("Order448 existing full-credit discovery", () => {
  const input = (extra: Record<string, unknown> = {}) => ({
    tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, originalDocumentId: ORIGINAL, ...extra,
  });

  test("rejects hostile input without getters, proxy traps, checkout or SQL", async () => {
    let touched = 0;
    const hostile = Object.defineProperty(input(), "actorId", {
      enumerable: true, get() { touched += 1; return ACTOR; },
    });
    const proxy = new Proxy(input(), { getPrototypeOf() { touched += 1; throw new Error("secret"); } });
    const revoked = Proxy.revocable(input(), {}); revoked.revoke();
    const hidden = Object.defineProperty(input(), "actorId", { enumerable: false });
    const invalid: unknown[] = [null, [], "input", hostile, proxy, revoked.proxy, hidden,
      Object.create(input()), input({ extra: true }), input({ creditDocumentId: CREDIT }),
      input({ [Symbol("extra")]: true }),
    ];
    for (const key of ["tenantId", "propertyNode", "actorId", "originalDocumentId"]) {
      for (const value of [undefined, null, 1, "not-a-uuid", SUPPLIER.toUpperCase()]) invalid.push(input({ [key]: value }));
    }
    const tx = (async () => { touched += 1; return []; }) as never;
    const database = new Database({ reserve: async () => { touched += 1; throw new Error("unexpected checkout"); } });
    for (const value of invalid) {
      expect(snapshotIndiaNativeFiscalCreditNoteDiscoveryInput(value)).toBeNull();
      await expect(new IndiaNativeFiscalCreditNoteService().discover(tx, value))
        .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
      await expect(new DiscoverIndiaNativeFiscalCreditNoteCommand(database).execute(value))
        .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    }
    expect(touched).toBe(0);
    const snapshot = snapshotIndiaNativeFiscalCreditNoteDiscoveryInput(input());
    expect(snapshot).toEqual(input());
    expect(Object.isFrozen(snapshot)).toBeTrue();
  });

  test("binds one authoritative scalar lookup statement and preserves reordered receipt bytes", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const json = JSON.stringify(Object.fromEntries(Object.entries(receipt()).reverse()), null, 2);
    const result = await discoverIndiaNativeFiscalCreditNoteInTransaction(txReturning([{ receipt_json: json }], calls), input());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([TENANT, PROPERTY, ACTOR, ORIGINAL]);
    const sql = calls[0]!.sql.replace(/\s+/g, " ").trim();
    expect(sql).toBe("WITH input AS ( SELECT ?::uuid AS tenant_id, ?::uuid AS property_node, ?::uuid AS actor_id, ?::uuid AS original_document_id ) SELECT public.read_india_native_fiscal_credit_note( input.tenant_id, input.property_node, input.actor_id, (SELECT credit.document_id FROM public.india_native_fiscal_credit_note AS credit WHERE credit.tenant_id = input.tenant_id AND credit.property_node = input.property_node AND credit.original_document_id = input.original_document_id) ) AS receipt_json FROM input");
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|LIMIT|BEGIN|COMMIT)\b/i);
    expect(sql).not.toContain("credit.receipt_json");
    expect(result).toEqual({ receipt: receipt(), receiptJson: json });
    expect(Object.isFrozen(result)).toBeTrue();
    expect(Object.isFrozen(result?.receipt)).toBeTrue();
    expect(Object.hasOwn(result!, "replayed")).toBeFalse();
    const absentCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
    expect(await new IndiaNativeFiscalCreditNoteService().discover(txReturning([{ receipt_json: null }], absentCalls), input())).toBeNull();
    expect(absentCalls).toEqual(calls);
  });

  test("accepts native driver metadata and delegates the supplied transaction without checkout", async () => {
    class SQLResultArray extends Array<unknown> {}
    const rows = Object.assign(new SQLResultArray({ receipt_json: receiptJson() }), {
      count: 1, command: "SELECT", lastInsertRowid: null, affectedRows: 0,
    });
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const database = new Database({ reserve: async () => { throw new Error("must not check out"); } });
    const result = await new DiscoverIndiaNativeFiscalCreditNoteCommand(database)
      .executeInTransaction(txReturning(rows, calls), input());
    expect(result?.receiptJson).toBe(receiptJson());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([TENANT, PROPERTY, ACTOR, ORIGINAL]);
    await expect(new IndiaNativeFiscalCreditNoteService().discover(null as never, input()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    let touched = 0;
    Object.defineProperty(rows, "count", { get() { touched += 1; return 1; } });
    await expect(new IndiaNativeFiscalCreditNoteService().discover(txReturning(rows, []), input()))
      .rejects.toThrow(new IndiaNativeFiscalCreditNoteDatabaseError());
    expect(touched).toBe(0);
  });

  test("rejects malformed, selector-divergent and hostile storage without invoking it", async () => {
    let touched = 0;
    const accessor = Object.defineProperty({}, "receipt_json", {
      enumerable: true, get() { touched += 1; return receiptJson(); },
    });
    const proxy = new Proxy({ receipt_json: receiptJson() }, { getPrototypeOf() { touched += 1; throw new Error("secret"); } });
    const arrayAccessor = Object.defineProperty([null], "0", { get() { touched += 1; return accessor; } });
    const cases: unknown[][] = [[], [{ receipt_json: null }, { receipt_json: null }],
      [{ receipt_json: receiptJson(), extra: 1 }], [accessor], [proxy], arrayAccessor,
      new Proxy([{ receipt_json: receiptJson() }], {}),
    ];
    for (const value of [undefined, 1, {}, "not-json", "{}", "[]", receiptJson({ originalDocumentId: TENANT }),
      receiptJson({ propertyNode: TENANT }), receiptJson({ totalMinor: "0" }), receiptJson({ currency: "USD" }),
      receiptJson({ surplus: true }), receiptJson({ reason: "bad\ud800" })]) cases.push([{ receipt_json: value }]);
    for (const rows of cases) {
      await expect(new IndiaNativeFiscalCreditNoteService().discover(txReturning(rows, []), input()))
        .rejects.toThrow(new IndiaNativeFiscalCreditNoteDatabaseError());
    }
    expect(touched).toBe(0);
  });

  test("sanitizes denied authority and every unexpected SQL failure including duplicate binding", async () => {
    for (const code of ["42501", "21000", "P0002", "22023", "23505", "08006"]) {
      const tx = (async () => { throw { code, message: "secret database detail" }; }) as never;
      await expect(new IndiaNativeFiscalCreditNoteService().discover(tx, input())).rejects.toThrow(
        code === "42501" ? new IndiaNativeFiscalCreditNoteAuthorizationError() : new IndiaNativeFiscalCreditNoteDatabaseError(),
      );
    }
    let touched = 0;
    const hostile = new Proxy({}, { getPrototypeOf() { touched += 1; throw new Error("secret"); } });
    await expect(new IndiaNativeFiscalCreditNoteService().discover((async () => { throw hostile; }) as never, input()))
      .rejects.toThrow(new IndiaNativeFiscalCreditNoteDatabaseError());
    expect(touched).toBe(0);
  });

  test("snapshots before checkout, uses one tenant transaction, and rolls storage failures back", async () => {
    async function run(reply: unknown[], failure?: { code: string }) {
      const caller = input();
      const steps: string[] = [];
      const bound: unknown[][] = [];
      let reserves = 0;
      const connection = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = Array.from(strings).join(" ");
        if (sql.includes("set_config('app.tenant_id'")) { expect(values).toEqual([TENANT]); return [{ tenant_id: TENANT }]; }
        if (sql.includes("role_reset")) return [{ role_reset: true, tenant_reset: true }];
        if (sql.includes("read_india_native_fiscal_credit_note")) {
          bound.push(values);
          if (failure) throw failure;
          return reply;
        }
        throw new Error("unexpected SQL");
      }, {
        unsafe: async (sql: string) => { steps.push(sql); return []; },
        release: () => { steps.push("RELEASE"); }, close: async () => { steps.push("CLOSE"); },
      });
      const database = new Database({ reserve: async () => {
        reserves += 1;
        caller.tenantId = CREDIT; caller.actorId = CREDIT; caller.propertyNode = CREDIT; caller.originalDocumentId = CREDIT;
        await Promise.resolve();
        return connection as never;
      } });
      const promise = discoverIndiaNativeFiscalCreditNote(database, caller);
      if (failure || reply.length !== 1) {
        await expect(promise).rejects.toBeInstanceOf(failure ? IndiaNativeFiscalCreditNoteAuthorizationError : IndiaNativeFiscalCreditNoteDatabaseError);
      } else expect((await promise)?.receiptJson).toBe(receiptJson());
      expect(reserves).toBe(1);
      expect(bound).toEqual([[TENANT, PROPERTY, ACTOR, ORIGINAL]]);
      expect(steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", failure || reply.length !== 1 ? "ROLLBACK" : "COMMIT", "RELEASE"]);
    }
    await run([{ receipt_json: receiptJson() }]);
    await run([], { code: "42501" });
    await run([]);
  });
});
