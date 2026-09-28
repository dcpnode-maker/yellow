import { describe, expect, test } from "bun:test";

import type { Tx } from "../src/kernel";
import { createPositiveTaxAttributionSnapshot } from "../src/contexts/tax-fiscal/attribution";
import {
  IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError,
  IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError,
  IndiaGstAccommodationOrdinaryRegimeEvidenceService,
  IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError,
  type IndiaGstAccommodationOrdinaryRegimeEvidenceInput,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-ordinary-regime-evidence";
import {
  IndiaGstAccommodationSourceIntakeService,
  IndiaGstAccommodationSourceIntakeConflictError,
  IndiaGstAccommodationSourceIntakeNotFoundError,
  IndiaGstAccommodationSourceIntakeValidationError,
  type IndiaGstAccommodationPaymentReceiptIntakeInput,
  type IndiaGstAccommodationServiceProvisionIntakeInput,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-source-intake";

const TENANT = "00000000-0000-4000-8000-000000004340";
const PROPERTY = "00000000-0000-4000-8000-000000004341";
const RESERVATION = "00000000-0000-4000-8000-000000004342";
const LINEAGE = "00000000-0000-4000-8000-000000004343";
const SERVICE = "00000000-0000-4000-8000-000000004344";
const ORDINARY = "00000000-0000-4000-8000-000000004345";
const ACTOR = "00000000-0000-4000-8000-000000004346";
const REQUEST = "00000000-0000-4000-8000-000000004347";
const HOLD = "00000000-0000-4000-8000-000000004349";
const ATTRIBUTION = "00000000-0000-4000-8000-000000004350";
const SEGMENT = "00000000-0000-4000-8000-000000004351";
const EXTENSION = "00000000-0000-4000-8000-000000004352";
const PAYMENT = "00000000-0000-4000-8000-000000004353";
const EXTERNAL = "a".repeat(64);
const ROOT = "b".repeat(64);
const QUOTE = "c".repeat(64);

interface QueryCall {
  readonly sql: string;
  readonly values: readonly unknown[];
}

function mockTx(responses: readonly (
  readonly unknown[] | Error | {
    readonly code: string;
    readonly errno?: string | number;
    readonly sqlState?: string | number;
  }
)[]): {
  readonly tx: Tx;
  readonly calls: QueryCall[];
} {
  const pending = [...responses];
  const calls: QueryCall[] = [];
  const query = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<readonly unknown[]> => {
    calls.push({ sql: strings.join("?"), values });
    const response = pending.shift();
    if (response instanceof Error || (response && !Array.isArray(response) && "code" in response)) {
      throw response;
    }
    return response ?? [];
  };
  return { tx: query as unknown as Tx, calls };
}

function rejectingTx(error: unknown): Tx {
  return (async () => { throw error; }) as unknown as Tx;
}

async function capturedRejection(action: () => Promise<unknown>): Promise<{
  readonly rejected: boolean;
  readonly reason: unknown;
}> {
  try {
    await action();
    return { rejected: false, reason: undefined };
  } catch (reason) {
    return { rejected: true, reason };
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function attributionSnapshot() {
  return createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash: QUOTE },
    currency: "INR",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: 10_000n,
      nights: 1,
      personNights: 2,
      roomNights: [{ businessDate: "2044-02-29", amountMinor: 10_000n }],
    },
    assignments: [{
      businessDate: "2044-02-29",
      jurisdictionKey: "in.order434.gst.27",
      evidenceRef: `tax-assignment:${QUOTE}`,
    }],
    jurisdiction: {
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      key: "in.order434.gst.27",
      version: 1,
      contentHash: "d".repeat(64),
      evidenceRef: `tax-jurisdiction:${"e".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: "in.order434.gst.27",
      country: "IN",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n,
      taxTotalMinor: 500n,
      grandTotalMinor: 10_500n,
      taxes: [{
        code: "GST_ROOM",
        name: "Aggregate GST evidence",
        taxMinor: 500n,
        components: [{
          lineId: "room",
          revenueGroup: "room_revenue",
          baseMinor: 10_000n,
          taxMinor: 500n,
          rateBasisPoints: 500,
        }],
      }],
    },
  });
}

function serviceRow() {
  const snapshot = attributionSnapshot();
  return {
    tenant_id: TENANT,
    id: SERVICE,
    property_node: PROPERTY,
    reservation_lineage_id: LINEAGE,
    hold_binding_id: HOLD,
    attribution_id: ATTRIBUTION,
    reservation_id: RESERVATION,
    segment_id: SEGMENT,
    origin_quote_hash: QUOTE,
    snapshot_hash: snapshot.snapshotHash,
    currency: "INR",
    service_provision_date: "2044-02-29",
    service_provision_source: "governed_service_provision_record",
    service_provision_evidence_sha256: EXTERNAL,
    legal_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
    lineage_id: LINEAGE,
    lineage_property_node: PROPERTY,
    lineage_hold_binding_id: HOLD,
    lineage_attribution_id: ATTRIBUTION,
    lineage_reservation_id: RESERVATION,
    lineage_segment_id: SEGMENT,
    lineage_origin_quote_hash: QUOTE,
    lineage_snapshot_hash: snapshot.snapshotHash,
    lineage_currency: "INR",
    attribution_snapshot: snapshot,
  };
}

function paymentRow() {
  const service = serviceRow();
  return {
    tenant_id: TENANT,
    id: PAYMENT,
    service_provision_snapshot_id: SERVICE,
    currency: "INR",
    amount_minor: "10500",
    coverage_scope: "full_attribution",
    supplier_books_entry_date: "2044-03-02",
    supplier_bank_credit_date: "2044-03-01",
    payment_receipt_date: "2044-03-01",
    payment_receipt_source: "governed_supplier_payment_receipt_record",
    payment_receipt_evidence_sha256: EXTERNAL,
    legal_rule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY",
    service_tenant_id: TENANT,
    service_id: SERVICE,
    property_node: PROPERTY,
    reservation_lineage_id: LINEAGE,
    hold_binding_id: HOLD,
    attribution_id: ATTRIBUTION,
    reservation_id: RESERVATION,
    segment_id: SEGMENT,
    origin_quote_hash: QUOTE,
    snapshot_hash: service.snapshot_hash,
    service_currency: "INR",
    service_provision_date: "2044-02-29",
    service_provision_source: "governed_service_provision_record",
    service_provision_evidence_sha256: EXTERNAL,
    service_legal_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
    lineage_id: LINEAGE,
    lineage_property_node: PROPERTY,
    lineage_hold_binding_id: HOLD,
    lineage_attribution_id: ATTRIBUTION,
    lineage_reservation_id: RESERVATION,
    lineage_segment_id: SEGMENT,
    lineage_origin_quote_hash: QUOTE,
    lineage_snapshot_hash: service.snapshot_hash,
    lineage_currency: "INR",
    attribution_snapshot: service.attribution_snapshot,
  };
}

function serviceInput(
  overrides: Partial<IndiaGstAccommodationServiceProvisionIntakeInput> = {},
): IndiaGstAccommodationServiceProvisionIntakeInput {
  return deepFreeze({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    reservationLineageId: LINEAGE,
    serviceProvisionDate: "2044-02-29",
    serviceProvisionSource: "governed_service_provision_record" as const,
    serviceProvisionEvidenceSha256: EXTERNAL,
    legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
    idempotencyKey: "service-source-434",
    envelope: {
      actorId: ACTOR,
      tenantId: TENANT,
      propertyNode: PROPERTY,
      requestId: REQUEST,
      operation: "india_gst.accommodation_service_provision_recorded",
    },
    ...overrides,
  });
}

function paymentInput(
  overrides: Partial<IndiaGstAccommodationPaymentReceiptIntakeInput> = {},
): IndiaGstAccommodationPaymentReceiptIntakeInput {
  return deepFreeze({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    serviceProvisionSnapshotId: SERVICE,
    amountMinor: "10500",
    currency: "INR" as const,
    coverageScope: "full_attribution" as const,
    supplierBooksEntryDate: "2044-03-02",
    supplierBankCreditDate: "2044-03-01",
    paymentReceiptSource: "governed_supplier_payment_receipt_record" as const,
    paymentReceiptEvidenceSha256: EXTERNAL,
    legalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" as const,
    idempotencyKey: "payment-source-434",
    envelope: {
      actorId: ACTOR,
      tenantId: TENANT,
      propertyNode: PROPERTY,
      requestId: REQUEST,
      operation: "india_gst.accommodation_payment_receipt_recorded",
    },
    ...overrides,
  });
}

function ordinaryInput(
  overrides: Partial<IndiaGstAccommodationOrdinaryRegimeEvidenceInput> = {},
): IndiaGstAccommodationOrdinaryRegimeEvidenceInput {
  return deepFreeze({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    serviceProvisionSnapshotId: SERVICE,
    regime: "ordinary_rule47_30_day" as const,
    ordinaryRegimeSource: "governed_rule47_ordinary_regime_record" as const,
    legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT" as const,
    ordinaryRegimeEvidenceSha256: EXTERNAL,
    idempotencyKey: "ordinary-source-434",
    envelope: {
      actorId: ACTOR,
      tenantId: TENANT,
      propertyNode: PROPERTY,
      requestId: REQUEST,
      operation: "india_gst.accommodation_ordinary_regime_recorded",
    },
    ...overrides,
  });
}

describe("Order434 accommodation source-intake validation", () => {
  test("service intake rejects non-exact, unfrozen, malformed and non-governed inputs before SQL", async () => {
    const service = new IndiaGstAccommodationSourceIntakeService();
    const { tx, calls } = mockTx([]);
    const invalid = [
      { ...serviceInput(), serviceProvisionDate: "2043-02-29" },
      { ...serviceInput(), serviceProvisionEvidenceSha256: "A".repeat(64) },
      { ...serviceInput(), reservationLineageId: "A0000000-0000-4000-8000-000000004343" },
      { ...serviceInput(), serviceProvisionSource: "inferred_from_checkout" },
      { ...serviceInput(), legalRule: "CGST_RULE_47" },
      { ...serviceInput(), idempotencyKey: "short" },
      { ...serviceInput(), envelope: { ...serviceInput().envelope, actorId: "A0000000-0000-4000-8000-000000004346" } },
      { ...serviceInput(), envelope: { ...serviceInput().envelope, operation: "india_gst.wrong" } },
      { ...serviceInput(), extra: true },
    ];
    for (const candidate of invalid) {
      await expect(service.recordServiceProvision(tx, deepFreeze(candidate) as never))
        .rejects.toBeInstanceOf(IndiaGstAccommodationSourceIntakeValidationError);
    }
    await expect(service.recordServiceProvision(tx, { ...serviceInput() } as never))
      .rejects.toBeInstanceOf(IndiaGstAccommodationSourceIntakeValidationError);
    expect(calls).toHaveLength(0);
  });

  test("payment intake validates exact bigint, dates, identity and fixed0057 contract before SQL", async () => {
    const service = new IndiaGstAccommodationSourceIntakeService();
    const { tx, calls } = mockTx([]);
    const invalid = [
      { amountMinor: "0" },
      { amountMinor: "010500" },
      { amountMinor: "9223372036854775808" },
      { supplierBooksEntryDate: "2044-04-31" },
      { supplierBankCreditDate: "not-a-date" },
      { currency: "USD" },
      { coverageScope: "partial_attribution" },
      { paymentReceiptSource: "payment.created_at" },
      { paymentReceiptEvidenceSha256: "f".repeat(63) },
      { legalRule: "CGST_ACT_13" },
      { serviceProvisionSnapshotId: "A0000000-0000-4000-8000-000000004344" },
    ];
    for (const override of invalid) {
      await expect(service.recordPaymentReceipt(tx, paymentInput(override as never)))
        .rejects.toBeInstanceOf(IndiaGstAccommodationSourceIntakeValidationError);
    }
    expect(calls).toHaveLength(0);
  });

  test("ordinary treatment must be an affirmative exact D-777 assertion", async () => {
    const service = new IndiaGstAccommodationOrdinaryRegimeEvidenceService();
    const { tx, calls } = mockTx([]);
    for (const override of [
      { regime: undefined },
      { regime: "continuous_supply" },
      { ordinaryRegimeSource: "inferred_from_silence" },
      { legalBasis: "CGST_RULE_47_EXCEPTION" },
      { ordinaryRegimeEvidenceSha256: "A".repeat(64) },
      { envelope: { ...ordinaryInput().envelope, propertyNode: RESERVATION } },
    ]) {
      await expect(service.record(tx, ordinaryInput(override as never)))
        .rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError);
    }
    expect(calls).toHaveLength(0);
  });
});

describe("Order434 ordinary-regime mocked Tx repository interaction", () => {
  test("calls the governed SQL capability on every request and keeps external and server hashes distinct", async () => {
    const { tx, calls } = mockTx([[{
      ordinary_regime_evidence_id: ORDINARY,
      service_provision_snapshot_id: SERVICE,
      evidence_hash: ROOT,
      created: true,
    }]]);
    const result = await new IndiaGstAccommodationOrdinaryRegimeEvidenceService().record(
      tx,
      ordinaryInput(),
    );
    expect(result).toEqual({
      ordinaryRegimeEvidenceId: ORDINARY,
      serviceProvisionSnapshotId: SERVICE,
      regime: "ordinary_rule47_30_day",
      ordinaryRegimeSource: "governed_rule47_ordinary_regime_record",
      legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT",
      ordinaryRegimeEvidenceSha256: EXTERNAL,
      evidenceHash: ROOT,
      created: true,
      replayed: false,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("record_india_gst_accommodation_ordinary_regime_evidence");
    expect(calls[0]?.values).toEqual([
      TENANT, PROPERTY, RESERVATION, SERVICE,
      "ordinary_rule47_30_day",
      "governed_rule47_ordinary_regime_record",
      "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT",
      EXTERNAL, REQUEST, ACTOR, "ordinary-source-434",
    ]);
  });

  test("reports SQL-owned exact replay without bypassing the capability", async () => {
    const row = {
      ordinary_regime_evidence_id: ORDINARY,
      service_provision_snapshot_id: SERVICE,
      evidence_hash: ROOT,
      created: false,
    };
    const first = mockTx([[row]]);
    const second = mockTx([[row]]);
    const service = new IndiaGstAccommodationOrdinaryRegimeEvidenceService();
    expect((await service.record(first.tx, ordinaryInput())).replayed).toBe(true);
    expect((await service.record(second.tx, ordinaryInput({
      envelope: { ...ordinaryInput().envelope, requestId: "00000000-0000-4000-8000-000000004348" },
    }))).replayed).toBe(true);
    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
  });

  test("rejects malformed capability rows and maps governed SQLSTATE classes", async () => {
    const malformed = mockTx([[{
      ordinary_regime_evidence_id: ORDINARY,
      service_provision_snapshot_id: RESERVATION,
      evidence_hash: ROOT,
      created: true,
    }]]);
    await expect(new IndiaGstAccommodationOrdinaryRegimeEvidenceService().record(
      malformed.tx,
      ordinaryInput(),
    )).rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError);

    for (const [code, expected] of [
      [42501, IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError],
      ["23505", IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError],
      [22023, IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError],
    ] as const) {
      const failure = mockTx([{
        code: "ERR_POSTGRES_SERVER_ERROR",
        errno: code,
      }]);
      await expect(new IndiaGstAccommodationOrdinaryRegimeEvidenceService().record(
        failure.tx,
        ordinaryInput(),
      )).rejects.toBeInstanceOf(expected);
    }
  });
});

describe("Order434 service and payment mocked Tx repository interaction", () => {
  test("records service through the capability then reuses the exact0056 resolver hash", async () => {
    const { tx, calls } = mockTx([
      [{
        service_provision_snapshot_id: SERVICE,
        service_provision_evidence_sha256: EXTERNAL,
        evidence_hash: ROOT,
        created: true,
      }],
      [serviceRow()],
    ]);
    const result = await new IndiaGstAccommodationSourceIntakeService()
      .recordServiceProvision(tx, serviceInput());
    expect(result.created).toBe(true);
    expect(result.replayed).toBe(false);
    expect(result.evidenceHash).toBe(ROOT);
    expect(result.serviceProvision.serviceProvisionSnapshotId).toBe(SERVICE);
    expect(result.serviceProvision.serviceProvisionEvidenceSha256).toBe(EXTERNAL);
    expect(result.serviceProvision.evidenceHash).not.toBe(ROOT);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.values).toEqual([
      TENANT, PROPERTY, RESERVATION, LINEAGE, "2044-02-29", EXTERNAL,
      REQUEST, ACTOR, "service-source-434",
    ]);
    expect(calls[1]?.sql).toContain("india_gst_accommodation_service_provision_snapshot");
  });

  test("records explicit books/bank evidence and reuses0057 full-attribution validation", async () => {
    const { tx, calls } = mockTx([
      [{
        payment_receipt_snapshot_id: PAYMENT,
        payment_receipt_evidence_sha256: EXTERNAL,
        evidence_hash: ROOT,
        created: false,
      }],
      [paymentRow()],
    ]);
    const result = await new IndiaGstAccommodationSourceIntakeService()
      .recordPaymentReceipt(tx, paymentInput());
    expect(result.created).toBe(false);
    expect(result.replayed).toBe(true);
    expect(result.evidenceHash).toBe(ROOT);
    expect(result.paymentReceipt.paymentReceiptDate).toBe("2044-03-01");
    expect(result.paymentReceipt.amountMinor).toBe("10500");
    expect(result.paymentReceipt.evidenceHash).not.toBe(ROOT);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.values).toEqual([
      TENANT, PROPERTY, RESERVATION, SERVICE, 10_500n,
      "2044-03-02", "2044-03-01", EXTERNAL, REQUEST, ACTOR, "payment-source-434",
    ]);
    expect(calls[1]?.sql).toContain("india_gst_accommodation_payment_receipt_snapshot");
  });

  test("maps realistic Bun PostgreSQL errors for both source capabilities", async () => {
    for (const [errno, expected] of [
      [42501, IndiaGstAccommodationSourceIntakeNotFoundError],
      ["23505", IndiaGstAccommodationSourceIntakeConflictError],
    ] as const) {
      const serviceFailure = mockTx([{
        code: "ERR_POSTGRES_SERVER_ERROR",
        errno,
      }]);
      await expect(new IndiaGstAccommodationSourceIntakeService().recordServiceProvision(
        serviceFailure.tx,
        serviceInput(),
      )).rejects.toBeInstanceOf(expected);

      const paymentFailure = mockTx([{
        code: "ERR_POSTGRES_SERVER_ERROR",
        errno,
      }]);
      await expect(new IndiaGstAccommodationSourceIntakeService().recordPaymentReceipt(
        paymentFailure.tx,
        paymentInput(),
      )).rejects.toBeInstanceOf(expected);
    }
  });

  test("preserves nullish and non-SQL failures by exact identity at both boundaries", async () => {
    const plain = new Error("non-SQL dependency failure");
    for (const reason of [null, undefined, plain] as const) {
      const sourceFailure = await capturedRejection(() =>
        new IndiaGstAccommodationSourceIntakeService().recordServiceProvision(
          rejectingTx(reason),
          serviceInput(),
        ));
      expect(sourceFailure.rejected).toBe(true);
      expect(sourceFailure.reason).toBe(reason);

      const ordinaryFailure = await capturedRejection(() =>
        new IndiaGstAccommodationOrdinaryRegimeEvidenceService().record(
          rejectingTx(reason),
          ordinaryInput(),
        ));
      expect(ordinaryFailure.rejected).toBe(true);
      expect(ordinaryFailure.reason).toBe(reason);
    }
  });
});
