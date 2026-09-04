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
