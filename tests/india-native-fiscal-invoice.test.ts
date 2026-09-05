import { describe, expect, test } from "bun:test";

import {
  composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly,
  IndiaNativeFiscalInvoiceIssuanceService,
  IndiaNativeFiscalInvoiceValidationError,
  IndiaNativeFiscalSeriesConfigurationService,
  IndiaNativeFiscalSeriesConflictError,
  IndiaNativeFiscalSeriesValidationError,
  deriveIndiaFinancialYearStart,
  validateIndiaNativeFiscalPrefix,
} from "../src/contexts/tax-fiscal";
import {
  IssueIndiaNativeFiscalInvoiceCommand,
} from "../src/commands/issue-india-native-fiscal-invoice";
import { Database, type ConnectionPool } from "../src/kernel";
import { makeOrder419Input } from "./fixtures/india-irp-order419-fixture";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const serviceSourceUrl = new URL("../src/contexts/tax-fiscal/india-native-fiscal-invoice.ts", import.meta.url);

const BLOCKERS = [
  "FISCAL_DOCUMENT_ORIGIN_UNSELECTED",
  "LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED",
  "DOCUMENT_SERIES_UNBOUND",
] as const;

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function issueInput(extra: Record<string, unknown> = {}) {
  return {
    tenantId: ID,
    propertyNode: OTHER,
    reservationId: ID,
    folioId: OTHER,
    journalId: ID,
    recipientPartyId: OTHER,
    recipientRegistrationId: ID,
    classificationId: OTHER,
    supplyNatureAtTimeOfSupplyInput: {},
    supplyNatureAtTimeOfSupplyResult: {},
    actorId: ID,
    idempotencyKey: "invoice-issue-2026-0001",
    envelope: {
      actorId: ID,
      tenantId: ID,
      propertyNode: OTHER,
      requestId: OTHER,
      operation: "document.issued",
    },
    ...extra,
  };
}

function nativeIssueInput(extra: Record<string, unknown> = {}) {
  return {
    tenantId: ID,
    propertyNode: OTHER,
    actorId: ID,
    reservationId: ID,
    folioId: OTHER,
    valuationId: "33333333-3333-4333-8333-333333333333",
    serviceProvisionSnapshotId: "44444444-4444-4444-8444-444444444444",
    paymentReceiptSnapshotId: "55555555-5555-4555-8555-555555555555",
    ordinaryRegimeEvidenceId: "66666666-6666-4666-8666-666666666666",
    supplierServiceLocationId: "77777777-7777-4777-8777-777777777777",
    supplierRegistrationStatusId: "88888888-8888-4888-8888-888888888888",
    supplierSezStatusId: "99999999-9999-4999-8999-999999999999",
    recipientRegistrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recipientSezStatusId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    classificationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    calendarEvidence: null,
    idempotencyKey: "native-invoice-issue-2026-0001",
    envelope: {
      actorId: ID,
      tenantId: ID,
      propertyNode: OTHER,
      requestId: OTHER,
      operation: "document.issued",
    },
    ...extra,
  };
}

function completedReceipt() {
  const input = nativeIssueInput();
  return {
    document_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    document_kind: "invoice",
    series_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    doc_no: "I/2627/1",
    property_node: input.propertyNode,
    reservation_id: input.reservationId,
    folio_id: input.folioId,
    supplier_registration_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    recipient_registration_id: input.recipientRegistrationId,
    financial_year_start: "2026-04-01",
    currency: "INR",
    status: "issued",
    business_date: "2026-09-05",
    issued_at: "2026-09-05T00:00:00.000Z",
    prev_hash: null,
    sha256: "1".repeat(64),
    source_evidence_hash: "2".repeat(64),
    pre_document_evidence_hash: "3".repeat(64),
    readiness_evidence_hash: "4".repeat(64),
    created: false,
  };
}

function seriesInput(extra: Record<string, unknown> = {}) {
  return {
    tenantId: ID,
    propertyNode: OTHER,
    supplierRegistrationId: ID,
    documentKind: "invoice" as const,
    prefix: "I/2627/",
    envelope: {
      actorId: ID,
      tenantId: ID,
      propertyNode: OTHER,
      requestId: OTHER,
      operation: "document.series.configured",
    },
    ...extra,
  };
}

describe("India native fiscal invoice policy helpers", () => {
  test("derives the property-local Indian financial year without server-local time", () => {
    expect(deriveIndiaFinancialYearStart("2026-03-31")).toBe("2025-04-01");
    expect(deriveIndiaFinancialYearStart("2026-04-01")).toBe("2026-04-01");
    expect(deriveIndiaFinancialYearStart("2027-01-01")).toBe("2026-04-01");
  });

  test("accepts only bounded Rule-46 prefix material", () => {
    expect(validateIndiaNativeFiscalPrefix("I/2627/", "2026-04-01")).toBe("I/2627/");
    expect(() => validateIndiaNativeFiscalPrefix("I 2627", "2026-04-01")).toThrow(IndiaNativeFiscalSeriesValidationError);
    expect(() => validateIndiaNativeFiscalPrefix("I/2627/", "2026-01-01")).toThrow(IndiaNativeFiscalSeriesValidationError);
    expect(() => validateIndiaNativeFiscalPrefix("1234567890123", "2026-04-01")).toThrow(IndiaNativeFiscalSeriesValidationError);
  });

  test("reports create and exact replay from the atomic series capability", async () => {
    let created = true;
    const tx = (async (strings: TemplateStringsArray) => {
      const sql = Array.from(strings).join(" ");
      if (sql.includes("current_setting('app.tenant_id'")) {
        return [{ tenant_id: ID, current_user: "app_role", current_role: "app_role" }];
      }
      if (sql.includes("create_india_native_fiscal_series")) {
        const row = {
          series_id: "33333333-3333-4333-8333-333333333333",
          tenant_id: ID,
          property_node: OTHER,
          supplier_registration_id: ID,
          document_kind: "invoice",
          prefix: "I/2627/",
          financial_year_start: "2026-04-01",
          next_no: 1n,
          created,
        };
        created = false;
        return [row];
      }
      return [];
    }) as never;
    const service = new IndiaNativeFiscalSeriesConfigurationService();
    const first = await service.configure(tx, seriesInput());
    const replay = await service.configure(tx, seriesInput());
    expect(first.replayed).toBeFalse();
    expect(replay.replayed).toBeTrue();
    expect(replay).toMatchObject({ seriesId: first.seriesId, nextNo: "1", financialYearStart: "2026-04-01" });
  });

  test("fails closed when the capability returns a different locked prefix", async () => {
    const tx = (async (strings: TemplateStringsArray) => {
      const sql = Array.from(strings).join(" ");
      if (sql.includes("current_setting('app.tenant_id'")) {
        return [{ tenant_id: ID, current_user: "app_role", current_role: "app_role" }];
      }
      if (sql.includes("create_india_native_fiscal_series")) {
        return [{
          series_id: "33333333-3333-4333-8333-333333333333",
          tenant_id: ID,
          property_node: OTHER,
          supplier_registration_id: ID,
          document_kind: "invoice",
          prefix: "C/2627/",
          financial_year_start: "2026-04-01",
          next_no: 1n,
          created: false,
        }];
      }
      return [];
    }) as never;
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(tx, seriesInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesConflictError);
  });

  test("maps the database changed-prefix conflict to the bounded domain error", async () => {
    const tx = (async (strings: TemplateStringsArray) => {
      const sql = Array.from(strings).join(" ");
      if (sql.includes("current_setting('app.tenant_id'")) {
        return [{ tenant_id: ID, current_user: "app_role", current_role: "app_role" }];
      }
      if (sql.includes("create_india_native_fiscal_series")) throw { code: "23505" };
      return [];
    }) as never;
    await expect(new IndiaNativeFiscalSeriesConfigurationService().configure(tx, seriesInput()))
      .rejects.toBeInstanceOf(IndiaNativeFiscalSeriesConflictError);
  });

  test("rejects calendar dates that are not real dates", () => {
    expect(() => deriveIndiaFinancialYearStart("2026-02-30")).toThrow();
    expect(() => deriveIndiaFinancialYearStart("not-a-date")).toThrow();
  });

  test("rejects caller-controlled fiscal authority before opening a database command", async () => {
    let calls = 0;
    const tx = (async () => { calls += 1; return []; }) as never;
    const service = new IndiaNativeFiscalInvoiceIssuanceService({});
    await expect(service.issue(tx, issueInput({ docNo: "I/2627/1" }) as never)).rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    expect(calls).toBe(0);
  });

  test("native issue accepts only selectors and rejects caller document or amount authority", async () => {
    let calls = 0;
    const tx = (async () => { calls += 1; return []; }) as never;
    const service = new IndiaNativeFiscalInvoiceIssuanceService();
    await expect(service.issueNative(tx, nativeIssueInput({ docNo: "I/2627/1" }) as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    await expect(service.issueNative(tx, nativeIssueInput({ taxMinor: "500" }) as never))
      .rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceValidationError);
    expect(calls).toBe(0);
  });

  test("native completed replay uses the exact 22-argument preparation and performs no new effects", async () => {
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    let handlerCalls = 0;
    let readerCalls = 0;
    const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ text: Array.from(strings).join("?"), values });
      return [{
        native_timing_id: "33333333-3333-4333-8333-333333333333",
        request_event_id: "44444444-4444-4444-8444-444444444444",
        posting_binding_id: "55555555-5555-4555-8555-555555555555",
        prepared_source_json: null,
        completed_receipt: completedReceipt(),
      }];
    }) as never;
    const input = nativeIssueInput({ calendarEvidence: {
      authorityId: "GST_COUNCIL_CALENDAR",
      sourceDigestSha256: "5".repeat(64),
      throughDate: "2026-09-04",
      days: [
        { date: "2026-09-01", state: "working" },
        { date: "2026-09-02", state: "non_working" },
        { date: "2026-09-03", state: "working" },
        { date: "2026-09-04", state: "working" },
      ],
    } });
    const service = new IndiaNativeFiscalInvoiceIssuanceService({
      nativeAccounting: { handle: async () => { handlerCalls += 1; throw new Error("must not handle"); } },
      nativeFinancialSource: { resolveNative: async () => { readerCalls += 1; throw new Error("must not read"); } },
    });
    const result = await service.issueNative(tx, input as never);
    expect(result.replayed).toBeTrue();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("public.prepare_india_native_fiscal_invoice_v2");
    expect(calls[0]!.values).toEqual([
      input.tenantId, input.propertyNode, input.actorId, input.reservationId, input.folioId,
      input.valuationId, input.serviceProvisionSnapshotId, input.paymentReceiptSnapshotId,
      input.ordinaryRegimeEvidenceId, input.supplierServiceLocationId,
      input.supplierRegistrationStatusId, input.supplierSezStatusId,
      input.recipientRegistrationId, input.recipientSezStatusId, input.classificationId,
      "GST_COUNCIL_CALENDAR", "5".repeat(64), "2026-09-04",
      '{"2026-09-01","2026-09-02","2026-09-03","2026-09-04"}',
      '{"working","non_working","working","working"}',
      input.idempotencyKey, input.envelope.requestId,
    ]);
    expect(handlerCalls).toBe(0);
    expect(readerCalls).toBe(0);
  });

  test("the dedicated command opens one tenant transaction and propagates rollback failures", async () => {
    const makeDatabase = (prepareFailure?: Error) => {
      const steps: string[] = [];
      let prepareValues: readonly unknown[] | undefined;
      const connection = Object.assign(
        async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const sql = Array.from(strings).join(" ");
          if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
          if (sql.includes("role_reset")) return [{ role_reset: true, tenant_reset: true }];
          if (sql.includes("prepare_india_native_fiscal_invoice_v2")) {
            prepareValues = values;
            if (prepareFailure) throw prepareFailure;
            return [{
              native_timing_id: "33333333-3333-4333-8333-333333333333",
              request_event_id: "44444444-4444-4444-8444-444444444444",
              posting_binding_id: "55555555-5555-4555-8555-555555555555",
              prepared_source_json: null,
              completed_receipt: completedReceipt(),
            }];
          }
          throw new Error(`unexpected command transaction query: ${sql}`);
        },
        {
          unsafe: async (sql: string) => { steps.push(sql); return []; },
          release: () => { steps.push("RELEASE"); },
          close: async () => { steps.push("CLOSE"); },
        },
      );
      let reserves = 0;
      const pool: ConnectionPool = {
        reserve: async () => { reserves += 1; return connection as never; },
      };
      return { database: new Database(pool), steps, reserves: () => reserves,
        prepareValues: () => prepareValues };
    };
    const input = nativeIssueInput();
    const success = makeDatabase();
    const result = await new IssueIndiaNativeFiscalInvoiceCommand(success.database)
      .execute(input as never);
    expect(result.replayed).toBeTrue();
    expect(success.reserves()).toBe(1);
    expect(success.prepareValues()?.slice(15, 20)).toEqual([null, null, null, "{}", "{}"]);
    expect(success.steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", "COMMIT", "RELEASE"]);

    const cause = new Error("native issue failed");
    const failure = makeDatabase(cause);
    await expect(new IssueIndiaNativeFiscalInvoiceCommand(failure.database)
      .execute(input as never)).rejects.toBe(cause);
    expect(failure.reserves()).toBe(1);
    expect(failure.steps).toEqual(["BEGIN", "SET LOCAL ROLE app_role", "ROLLBACK", "RELEASE"]);
  });

  test("leaves fiscal lock ordering and atomic replay authority to the database capability", async () => {
    const source = await Bun.file(serviceSourceUrl).text();
    expect(source).not.toMatch(/pg_catalog\.pg_advisory_xact_lock/);
    expect(source).toMatch(/\$\{input\.idempotencyKey\},\s*\$\{JSON\.stringify\(payload\)\}::text::jsonb,\s*\$\{input\.envelope\.requestId\}::uuid/s);
    const payload = source.slice(source.indexOf("function commitPayload"), source.indexOf("export function deriveIndiaFinancialYearStart"));
    for (const field of [
      "readinessState", "submissionReady", "permittedActions", "blockers", "recipientRegistrationId",
      "sourceEvidenceHash", "preDocumentEvidenceHash", "readinessEvidenceHash", "preDocumentJson",
      "sourceEvidencePreimage", "preDocumentEvidencePreimage", "readinessEvidencePreimage",
    ]) expect(payload).toContain(`${field}:`);
    for (const forbidden of ["tenantId:", "propertyNode:", "actorId:", "reservationId:", "folioId:", "journalId:"]) {
      expect(payload).not.toContain(forbidden);
    }
  });

  test("passes genuine Order426 SellerDtls through the exact Order429 frozen payload", async () => {
    const order419 = makeOrder419Input({ family: "cgst_sgst", nights: 2 });
    const source = order419.source;
    const preDocumentEvidence = composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(order419);
    expect(Object.keys(preDocumentEvidence.sections)).toEqual([
      "Version", "TranDtls", "SellerDtls", "BuyerDtls", "ItemList", "ValDtls",
    ]);
    expect(preDocumentEvidence.sections.SellerDtls).toEqual(source.sellerDetails.payload.SellerDtls);
    const readinessBody = {
      state: "blocked_pending_fiscal_document_origin_policy" as const,
      submissionReady: false as const,
      permittedActions: [] as const,
      blockers: BLOCKERS,
      preDocumentEvidence,
      sourceEvidenceHash: source.evidenceHash,
      preDocumentEvidenceHash: preDocumentEvidence.evidenceHash,
    };
    const readiness = Object.freeze({
      ...readinessBody,
      evidenceHash: digest({ tenantId: order419.tenantId, ...readinessBody }),
    });
    const actorId = "11111111-1111-4111-8111-111111111111";
    const requestId = "22222222-2222-4222-8222-222222222222";
    const issueInput = {
      tenantId: order419.tenantId,
      propertyNode: source.financialSource.propertyNode,
      reservationId: source.financialSource.reservationId,
      folioId: source.financialSource.folioId,
      journalId: source.financialSource.journalId,
      recipientPartyId: source.legalBuyerPartyId,
      recipientRegistrationId: source.recipientRegistration.registrationId,
      classificationId: source.classification.classificationId,
      supplyNatureAtTimeOfSupplyInput: {},
      supplyNatureAtTimeOfSupplyResult: {},
      actorId,
      idempotencyKey: "invoice-issue-genuine-2026-0001",
      envelope: {
        actorId,
        tenantId: order419.tenantId,
        propertyNode: source.financialSource.propertyNode,
        requestId,
        operation: "document.issued",
      },
    };
    let frozenPayload: Record<string, unknown> | undefined;
    const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Array.from(strings).join(" ");
      if (sql.includes("current_setting('app.tenant_id'")) {
        return [{ tenant_id: order419.tenantId, current_user: "app_role", current_role: "app_role" }];
      }
      if (sql.includes("commit_india_native_fiscal_invoice")) {
        frozenPayload = JSON.parse(String(values[7])) as Record<string, unknown>;
        return [{
          document_id: "33333333-3333-4333-8333-333333333333",
          document_kind: "invoice",
          series_id: "44444444-4444-4444-8444-444444444444",
          doc_no: "I/4445/1",
          property_node: source.financialSource.propertyNode,
          reservation_id: source.financialSource.reservationId,
          folio_id: source.financialSource.folioId,
          supplier_registration_id: source.sellerRegistration.registrationId,
          recipient_registration_id: source.recipientRegistration.registrationId,
          financial_year_start: "2044-04-01",
          currency: "INR",
          status: "issued",
          business_date: "2044-01-01",
          issued_at: "2044-01-01T00:00:00.000Z",
          prev_hash: null,
          sha256: "a".repeat(64),
          source_evidence_hash: source.evidenceHash,
          pre_document_evidence_hash: preDocumentEvidence.evidenceHash,
          readiness_evidence_hash: readiness.evidenceHash,
          created: true,
        }];
      }
      return [];
    }) as never;
    const service = new IndiaNativeFiscalInvoiceIssuanceService({
      readiness: { resolve: async () => readiness } as never,
      source: { resolve: async () => source } as never,
    });
    const result = await service.issue(tx, issueInput as never);
    expect(result.documentKind).toBe("invoice");
    expect(result.replayed).toBeFalse();
    expect(frozenPayload && Object.keys(frozenPayload)).toEqual([
      "readinessState", "submissionReady", "permittedActions", "blockers",
      "recipientRegistrationId", "sourceEvidenceHash", "preDocumentEvidenceHash",
      "readinessEvidenceHash", "preDocumentJson", "sourceEvidencePreimage",
      "preDocumentEvidencePreimage", "readinessEvidencePreimage",
    ]);
    const sections = JSON.parse(String(frozenPayload?.preDocumentJson)) as Record<string, unknown>;
    expect(Object.keys(sections)).toEqual(["Version", "TranDtls", "SellerDtls", "BuyerDtls", "ItemList", "ValDtls"]);
    expect(sections.SellerDtls).toEqual(source.sellerDetails.payload.SellerDtls);
    expect(digest(JSON.parse(String(frozenPayload?.sourceEvidencePreimage)))).toBe(source.evidenceHash);
    expect(digest(JSON.parse(String(frozenPayload?.preDocumentEvidencePreimage)))).toBe(preDocumentEvidence.evidenceHash);
    expect(digest(JSON.parse(String(frozenPayload?.readinessEvidencePreimage)))).toBe(readiness.evidenceHash);
  });
});
