import { describe, expect, test } from "bun:test";

import {
  IndiaNativeFiscalInvoiceIssuanceService,
  IndiaNativeFiscalInvoiceConflictError,
  IndiaNativeFiscalInvoiceStaleEvidenceError,
  IndiaNativeFiscalInvoiceValidationError,
  snapshotIndiaNativeFiscalInvoiceCalendarEvidence,
} from "../src/contexts/tax-fiscal/india-native-fiscal-invoice";
import {
  IssueIndiaNativeFiscalInvoiceCommand,
  issueIndiaNativeFiscalInvoiceConfirmedInTransaction,
  issueIndiaNativeFiscalInvoiceForOperatorInTransaction,
} from "../src/commands/issue-india-native-fiscal-invoice";
import { Database, type ConnectionPool } from "../src/kernel";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROPERTY = "22222222-2222-4222-8222-222222222222";
const SELECTOR_HASH = "a".repeat(64);
const CONFIRMATION_HASH = "b".repeat(64);

function operatorInput(extra: Record<string, unknown> = {}) {
  const native = confirmedInput();
  return {
    tenantId: native.tenantId,
    propertyNode: native.propertyNode,
    actorId: native.actorId,
    reservationId: native.reservationId,
    folioId: native.folioId,
    recipientRegistrationId: native.recipientRegistrationId,
    calendarEvidence: native.calendarEvidence,
    idempotencyKey: native.idempotencyKey,
    envelope: native.envelope,
    expectedSelectorHash: native.expectedSelectorHash,
    expectedConfirmationHash: native.expectedConfirmationHash,
    ...extra,
  };
}

function internalSelectors(extra: Record<string, unknown> = {}) {
  const input = confirmedInput();
  return {
    valuationId: input.valuationId,
    serviceProvisionSnapshotId: input.serviceProvisionSnapshotId,
    paymentReceiptSnapshotId: input.paymentReceiptSnapshotId,
    ordinaryRegimeEvidenceId: input.ordinaryRegimeEvidenceId,
    supplierServiceLocationId: input.supplierServiceLocationId,
    supplierRegistrationStatusId: input.supplierRegistrationStatusId,
    supplierSezStatusId: input.supplierSezStatusId,
    recipientRegistrationId: input.recipientRegistrationId,
    recipientSezStatusId: input.recipientSezStatusId,
    classificationId: input.classificationId,
    ...extra,
  };
}

function completedPrepareV4Row(input = confirmedInput(), selectors: unknown = internalSelectors()) {
  return completedPrepareRow(input).map((row) => ({ ...row, internal_selectors: selectors }));
}

function confirmedInput(extra: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    actorId: "33333333-3333-4333-8333-333333333333",
    reservationId: "44444444-4444-4444-8444-444444444444",
    folioId: "55555555-5555-4555-8555-555555555555",
    valuationId: "66666666-6666-4666-8666-666666666666",
    serviceProvisionSnapshotId: "77777777-7777-4777-8777-777777777777",
    paymentReceiptSnapshotId: "88888888-8888-4888-8888-888888888888",
    ordinaryRegimeEvidenceId: "99999999-9999-4999-8999-999999999999",
    supplierServiceLocationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    supplierRegistrationStatusId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    supplierSezStatusId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    recipientRegistrationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    recipientSezStatusId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    classificationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    calendarEvidence: null,
    idempotencyKey: "confirmed-native-invoice-2026-0001",
    envelope: {
      actorId: "33333333-3333-4333-8333-333333333333",
      tenantId: TENANT,
      propertyNode: PROPERTY,
      requestId: "12121212-1212-4212-8212-121212121212",
      operation: "document.issued",
    },
    expectedSelectorHash: SELECTOR_HASH,
    expectedConfirmationHash: CONFIRMATION_HASH,
    ...extra,
  };
}

function completedReceipt(input = confirmedInput()) {
  return {
    document_id: "13131313-1313-4313-8313-131313131313",
    document_kind: "invoice",
    series_id: "14141414-1414-4414-8414-141414141414",
    doc_no: "I/2627/1",
    property_node: input.propertyNode,
    reservation_id: input.reservationId,
    folio_id: input.folioId,
    supplier_registration_id: "15151515-1515-4515-8515-151515151515",
    recipient_registration_id: input.recipientRegistrationId,
    financial_year_start: "2026-04-01",
    currency: "INR",
    status: "issued",
    business_date: "2026-09-07",
    issued_at: "2026-09-07T12:00:00.000Z",
    prev_hash: null,
    sha256: "1".repeat(64),
    source_evidence_hash: "2".repeat(64),
    pre_document_evidence_hash: "3".repeat(64),
    readiness_evidence_hash: "4".repeat(64),
    created: false,
  };
}

function completedPrepareRow(input = confirmedInput()) {
  return [{
    native_timing_id: "16161616-1616-4616-8616-161616161616",
    request_event_id: "17171717-1717-4717-8717-171717171717",
    posting_binding_id: "18181818-1818-4818-8818-181818181818",
    prepared_source_json: null,
    completed_receipt: completedReceipt(input),
  }];
}

describe("confirmed India native fiscal issue", () => {
  test("public operator issue passes exactly 15 admitted arguments and replays through the shared completion path", async () => {
    const input = operatorInput({
      calendarEvidence: {
        authorityId: "GST_COUNCIL_CALENDAR", sourceDigestSha256: "5".repeat(64), throughDate: "2026-09-04",
        days: ["01", "02", "03", "04"].map((day) => ({ date: `2026-09-${day}`, state: day === "02" ? "non_working" : "working" })),
      },
    });
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    let effects = 0;
    const service = new IndiaNativeFiscalInvoiceIssuanceService({
      nativeAccounting: { handle: async () => { effects += 1; throw new Error("must not account replay"); } },
      nativeFinancialSource: { resolveNative: async () => { effects += 1; throw new Error("must not read replay"); } },
    });
    const result = await service.issueNativeForOperator((async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ text: Array.from(strings).join("?"), values });
      return completedPrepareV4Row(confirmedInput({ calendarEvidence: input.calendarEvidence }));
    }) as never, input as never);

    expect(result.replayed).toBeTrue();
    expect(effects).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("public.prepare_india_native_fiscal_invoice_v4");
    expect(calls[0]!.text).toContain("internal_selectors");
    expect(calls[0]!.values).toEqual([
      input.tenantId, input.propertyNode, input.actorId, input.reservationId, input.folioId,
      input.recipientRegistrationId, "GST_COUNCIL_CALENDAR", "5".repeat(64), "2026-09-04",
      '{"2026-09-01","2026-09-02","2026-09-03","2026-09-04"}',
      '{"working","non_working","working","working"}', input.idempotencyKey,
      input.envelope.requestId, SELECTOR_HASH, CONFIRMATION_HASH,
    ]);
  });

  test("public input and the reusable calendar snapshot reject private, accessor, proxy and holey data before I/O", async () => {
    let sqlCalls = 0;
    const tx = (async () => { sqlCalls += 1; return completedPrepareV4Row(); }) as never;
    const service = new IndiaNativeFiscalInvoiceIssuanceService();
    await expect(service.issueNativeForOperator(tx, operatorInput({ valuationId: confirmedInput().valuationId }) as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);

    let getterCalls = 0;
    const accessor = operatorInput();
    Object.defineProperty(accessor, "recipientRegistrationId", { enumerable: true,
      get() { getterCalls += 1; return confirmedInput().recipientRegistrationId; } });
    await expect(service.issueNativeForOperator(tx, accessor as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    expect(getterCalls).toBe(0);

    let proxyCalls = 0;
    const proxy = new Proxy(operatorInput(), { get(target, key, receiver) { proxyCalls += 1; return Reflect.get(target, key, receiver); } });
    await expect(service.issueNativeForOperator(tx, proxy as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    expect(proxyCalls).toBe(0);

    const calendar = {
      authorityId: "GST_COUNCIL_CALENDAR", sourceDigestSha256: "5".repeat(64), throughDate: "2026-09-04",
      days: [{ date: "2026-09-01", state: "working" }, { date: "2026-09-02", state: "working" },
        { date: "2026-09-03", state: "working" }, { date: "2026-09-04", state: "working" }],
    };
    const holey = { ...calendar, days: [...calendar.days] };
    delete holey.days[2];
    expect(() => snapshotIndiaNativeFiscalInvoiceCalendarEvidence(holey)).toThrow(IndiaNativeFiscalInvoiceValidationError);
    let dayReads = 0;
    const dayAccessor = { ...calendar };
    Object.defineProperty(dayAccessor, "days", { enumerable: true, get() { dayReads += 1; return calendar.days; } });
    expect(() => snapshotIndiaNativeFiscalInvoiceCalendarEvidence(dayAccessor)).toThrow(IndiaNativeFiscalInvoiceValidationError);
    expect(dayReads).toBe(0);
    expect(sqlCalls).toBe(0);
  });

  test("validates exact returned selectors and replay/source exclusivity before downstream effects", async () => {
    let effects = 0;
    const service = new IndiaNativeFiscalInvoiceIssuanceService({
      nativeAccounting: { handle: async () => { effects += 1; throw new Error("must not account"); } },
    });
    const malformed = [
      { ...internalSelectors(), classificationId: undefined },
      { ...internalSelectors(), extraSelector: confirmedInput().valuationId },
      { ...internalSelectors(), valuationId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
      { ...internalSelectors(), recipientRegistrationId: "abababab-abab-4bab-8bab-abababababab" },
    ];
    for (const selectors of malformed) {
      await expect(service.issueNativeForOperator((async () => completedPrepareV4Row(confirmedInput(), selectors)) as never,
        operatorInput() as never)).rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceConflictError);
    }
    let selectorReads = 0;
    const accessor = internalSelectors();
    Object.defineProperty(accessor, "valuationId", { enumerable: true,
      get() { selectorReads += 1; return confirmedInput().valuationId; } });
    await expect(service.issueNativeForOperator((async () => completedPrepareV4Row(confirmedInput(), accessor)) as never,
      operatorInput() as never)).rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceConflictError);
    expect(selectorReads).toBe(0);

    const replayWithSource = completedPrepareV4Row() as Array<Record<string, unknown>>;
    replayWithSource[0]!.prepared_source_json = "{}";
    await expect(service.issueNativeForOperator((async () => replayWithSource) as never, operatorInput() as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceConflictError);

    const malformedReplay = completedPrepareV4Row() as Array<Record<string, unknown>>;
    malformedReplay[0]!.completed_receipt = {
      ...completedReceipt(),
      property_node: "abababab-abab-4bab-8bab-abababababab",
    };
    await expect(service.issueNativeForOperator((async () => malformedReplay) as never, operatorInput() as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceConflictError);

    const freshWithoutSource = completedPrepareV4Row() as Array<Record<string, unknown>>;
    freshWithoutSource[0]!.completed_receipt = null;
    await expect(service.issueNativeForOperator((async () => freshWithoutSource) as never, operatorInput() as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceConflictError);

    const malformedFreshSource = completedPrepareV4Row() as Array<Record<string, unknown>>;
    malformedFreshSource[0]!.completed_receipt = null;
    malformedFreshSource[0]!.prepared_source_json = "{}";
    await expect(service.issueNativeForOperator((async () => malformedFreshSource) as never, operatorInput() as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceConflictError);
    expect(effects).toBe(0);
  });

  test("snapshots public route, calendar, hashes, key and audit before awaiting SQL", async () => {
    const input = operatorInput({ calendarEvidence: {
      authorityId: "GST_COUNCIL_CALENDAR", sourceDigestSha256: "5".repeat(64), throughDate: "2026-09-04",
      days: ["01", "02", "03", "04"].map((day) => ({ date: `2026-09-${day}`, state: "working" })),
    } });
    let values: readonly unknown[] = [];
    const result = await issueIndiaNativeFiscalInvoiceForOperatorInTransaction((async (_strings: TemplateStringsArray, ...seen: unknown[]) => {
      values = seen;
      input.recipientRegistrationId = "abababab-abab-4bab-8bab-abababababab";
      input.expectedSelectorHash = "9".repeat(64);
      input.idempotencyKey = "mutated-after-await";
      input.envelope.requestId = "19191919-1919-4919-8919-191919191919";
      (input.calendarEvidence as unknown as { days: Array<{ state: string }> }).days[0]!.state = "non_working";
      return completedPrepareV4Row();
    }) as never, input as never);
    expect(result.replayed).toBeTrue();
    expect(values[5]).toBe(confirmedInput().recipientRegistrationId);
    expect(values[10]).toBe('{"working","working","working","working"}');
    expect(values[11]).toBe("confirmed-native-invoice-2026-0001");
    expect(values[12]).toBe("12121212-1212-4212-8212-121212121212");
    expect(values[13]).toBe(SELECTOR_HASH);
  });

  test("maps a real driver-style own errno P2081 and rolls back one public command transaction", async () => {
    const steps: string[] = [];
    const connection = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Array.from(strings).join(" ");
      if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
      if (sql.includes("role_reset")) return [{ role_reset: true, tenant_reset: true }];
      if (sql.includes("prepare_india_native_fiscal_invoice_v4")) {
        throw Object.assign(new Error("sensitive driver detail"), { code: "ERR_POSTGRES_SERVER_ERROR", errno: "P2081" });
      }
      throw new Error(`unexpected SQL: ${sql}`);
    }, { unsafe: async (sql: string) => { steps.push(sql); return []; }, release: () => steps.push("RELEASE"), close: async () => undefined });
    const command = new IssueIndiaNativeFiscalInvoiceCommand(new Database({ reserve: async () => connection as never }));
    await expect(command.executeOperator(operatorInput() as never)).rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceStaleEvidenceError);
    expect(steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", "ROLLBACK", "RELEASE"]);
  });

  test("passes the exact legacy 22 arguments followed by both lower-hex evidence hashes and replays without effects", async () => {
    const input = confirmedInput({
      calendarEvidence: {
        authorityId: "GST_COUNCIL_CALENDAR",
        sourceDigestSha256: "5".repeat(64),
        throughDate: "2026-09-04",
        days: [
          { date: "2026-09-01", state: "working" },
          { date: "2026-09-02", state: "non_working" },
          { date: "2026-09-03", state: "working" },
          { date: "2026-09-04", state: "working" },
        ],
      },
    });
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    let accountingCalls = 0;
    let sourceCalls = 0;
    const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ text: Array.from(strings).join("?"), values });
      return completedPrepareRow(input);
    }) as never;
    const service = new IndiaNativeFiscalInvoiceIssuanceService({
      nativeAccounting: { handle: async () => { accountingCalls += 1; throw new Error("must not account replay"); } },
      nativeFinancialSource: { resolveNative: async () => { sourceCalls += 1; throw new Error("must not read replay"); } },
    });

    const result = await service.issueNativeConfirmed(tx, input as never);

    expect(result.replayed).toBeTrue();
    expect(accountingCalls).toBe(0);
    expect(sourceCalls).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("public.prepare_india_native_fiscal_invoice_v3");
    expect(calls[0]!.text).not.toContain("prepare_india_native_fiscal_invoice_v2");
    expect(calls[0]!.values).toEqual([
      input.tenantId, input.propertyNode, input.actorId, input.reservationId, input.folioId,
      input.valuationId, input.serviceProvisionSnapshotId, input.paymentReceiptSnapshotId,
      input.ordinaryRegimeEvidenceId, input.supplierServiceLocationId,
      input.supplierRegistrationStatusId, input.supplierSezStatusId,
      input.recipientRegistrationId, input.recipientSezStatusId, input.classificationId,
      "GST_COUNCIL_CALENDAR", "5".repeat(64), "2026-09-04",
      '{"2026-09-01","2026-09-02","2026-09-03","2026-09-04"}',
      '{"working","non_working","working","working"}',
      input.idempotencyKey, input.envelope.requestId, SELECTOR_HASH, CONFIRMATION_HASH,
    ]);
  });

  test("rejects malformed hashes and hostile own-property shapes before invoking SQL", async () => {
    let sqlCalls = 0;
    const tx = (async () => { sqlCalls += 1; return []; }) as never;
    const service = new IndiaNativeFiscalInvoiceIssuanceService();

    await expect(service.issueNativeConfirmed(tx, confirmedInput({ expectedSelectorHash: "A".repeat(64) }) as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    await expect(service.issueNativeConfirmed(tx, confirmedInput({ expectedConfirmationHash: "a".repeat(63) }) as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);

    let getterCalls = 0;
    const accessor = confirmedInput();
    Object.defineProperty(accessor, "expectedSelectorHash", {
      enumerable: true,
      get() { getterCalls += 1; return SELECTOR_HASH; },
    });
    await expect(service.issueNativeConfirmed(tx, accessor as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    expect(getterCalls).toBe(0);

    let reserves = 0;
    const hostileCommand = new IssueIndiaNativeFiscalInvoiceCommand(new Database({
      reserve: async () => { reserves += 1; throw new Error("must not reserve"); },
    }));
    await expect(hostileCommand.executeConfirmed(accessor as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    expect(getterCalls).toBe(0);
    expect(reserves).toBe(0);

    let proxyCalls = 0;
    const proxy = new Proxy(confirmedInput(), {
      get(target, key, receiver) {
        proxyCalls += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    await expect(service.issueNativeConfirmed(tx, proxy as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    expect(proxyCalls).toBe(0);
    expect(sqlCalls).toBe(0);
  });

  test("uses an immutable own-data snapshot for nested calendar and envelope values", async () => {
    const input = confirmedInput({
      calendarEvidence: {
        authorityId: "GST_COUNCIL_CALENDAR",
        sourceDigestSha256: "5".repeat(64),
        throughDate: "2026-09-04",
        days: [
          { date: "2026-09-01", state: "working" },
          { date: "2026-09-02", state: "working" },
          { date: "2026-09-03", state: "working" },
          { date: "2026-09-04", state: "working" },
        ],
      },
    });
    let values: readonly unknown[] = [];
    const tx = (async (_strings: TemplateStringsArray, ...queryValues: unknown[]) => {
      values = queryValues;
      input.expectedSelectorHash = "c".repeat(64);
      input.envelope.requestId = "19191919-1919-4919-8919-191919191919";
      (input.calendarEvidence as unknown as { days: Array<{ state: string }> }).days[0]!.state = "non_working";
      return completedPrepareRow(input);
    }) as never;

    const result = await new IndiaNativeFiscalInvoiceIssuanceService().issueNativeConfirmed(tx, input as never);

    expect(result.replayed).toBeTrue();
    expect(values.at(-2)).toBe(SELECTOR_HASH);
    expect(values.at(-3)).toBe("12121212-1212-4212-8212-121212121212");
    expect(values[19]).toBe('{"working","working","working","working"}');
  });

  test("maps only P2081 to a dedicated sanitized stale-evidence error before accounting", async () => {
    let accountingCalls = 0;
    const service = new IndiaNativeFiscalInvoiceIssuanceService({
      nativeAccounting: { handle: async () => { accountingCalls += 1; throw new Error("must not account"); } },
    });
    const providerMessage = "seller GSTIN and internal row details must not escape";
    const driverError = Object.assign(new Error(providerMessage), { sqlState: "P2081" });
    const tx = (async () => { throw driverError; }) as never;

    let caught: unknown;
    try {
      await service.issueNativeConfirmed(tx, confirmedInput() as never);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(IndiaNativeFiscalInvoiceStaleEvidenceError);
    expect((caught as Error).message).toBe("India native fiscal confirmation evidence is stale");
    expect((caught as Error).message).not.toContain(providerMessage);
    expect(accountingCalls).toBe(0);

    const cause = { code: "55000", message: "ordinary conflict" };
    await expect(service.issueNativeConfirmed((async () => { throw cause; }) as never, confirmedInput() as never))
      .rejects.toBe(cause);
  });

  test("does not invoke hostile SQLSTATE accessors or proxy traps and propagates the original error", async () => {
    const service = new IndiaNativeFiscalInvoiceIssuanceService();
    let accessorCalls = 0;
    const accessorError = new Error("hostile accessor");
    Object.defineProperty(accessorError, "code", {
      get() { accessorCalls += 1; return "P2081"; },
    });
    await expect(service.issueNativeConfirmed(
      (async () => { throw accessorError; }) as never,
      confirmedInput() as never,
    )).rejects.toBe(accessorError);
    expect(accessorCalls).toBe(0);

    let proxyCalls = 0;
    const proxyError = new Proxy({ code: "P2081" }, {
      get(target, key, receiver) {
        proxyCalls += 1;
        return Reflect.get(target, key, receiver);
      },
      getOwnPropertyDescriptor(target, key) {
        proxyCalls += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    await expect(service.issueNativeConfirmed(
      (async () => { throw proxyError; }) as never,
      confirmedInput() as never,
    )).rejects.toBe(proxyError);
    expect(proxyCalls).toBe(0);
  });

  test("offers an in-transaction command path and owns exactly one transaction only when requested", async () => {
    const input = confirmedInput();
    const steps: string[] = [];
    let reserves = 0;
    const connection = Object.assign(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = Array.from(strings).join(" ");
        if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
        if (sql.includes("role_reset")) return [{ role_reset: true, tenant_reset: true }];
        if (sql.includes("prepare_india_native_fiscal_invoice_v3")) return completedPrepareRow(input);
        throw new Error(`unexpected SQL: ${sql}`);
      },
      {
        unsafe: async (sql: string) => { steps.push(sql); return []; },
        release: () => { steps.push("RELEASE"); },
        close: async () => { steps.push("CLOSE"); },
      },
    );
    const pool: ConnectionPool = {
      reserve: async () => { reserves += 1; return connection as never; },
    };
    const command = new IssueIndiaNativeFiscalInvoiceCommand(new Database(pool));

    const owned = await command.executeConfirmed(input as never);
    expect(owned.replayed).toBeTrue();
    expect(reserves).toBe(1);
    expect(steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", "COMMIT", "RELEASE"]);

    const callerTx = (async () => completedPrepareRow(input)) as never;
    const composed = await command.executeConfirmedInTransaction(callerTx, input as never);
    const composedByFunction = await issueIndiaNativeFiscalInvoiceConfirmedInTransaction(callerTx, input as never);
    expect(composed.replayed).toBeTrue();
    expect(composedByFunction.replayed).toBeTrue();
    expect(reserves).toBe(1);
  });

  test("rolls back the owned transaction on stale evidence without retrying or committing", async () => {
    const input = confirmedInput();
    const steps: string[] = [];
    let prepareCalls = 0;
    const connection = Object.assign(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = Array.from(strings).join(" ");
        if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
        if (sql.includes("role_reset")) return [{ role_reset: true, tenant_reset: true }];
        if (sql.includes("prepare_india_native_fiscal_invoice_v3")) {
          prepareCalls += 1;
          throw { errno: "P2081", message: "sensitive database detail" };
        }
        throw new Error(`unexpected SQL: ${sql}`);
      },
      {
        unsafe: async (sql: string) => { steps.push(sql); return []; },
        release: () => { steps.push("RELEASE"); },
        close: async () => { steps.push("CLOSE"); },
      },
    );
    const pool: ConnectionPool = { reserve: async () => connection as never };

    await expect(new IssueIndiaNativeFiscalInvoiceCommand(new Database(pool)).executeConfirmed(input as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceStaleEvidenceError);
    expect(prepareCalls).toBe(1);
    expect(steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", "ROLLBACK", "RELEASE"]);
  });
});
