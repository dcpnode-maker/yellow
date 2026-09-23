import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { existsSync } from "node:fs";
import { ChargeCorrectionService } from "../src/contexts/financials";

import {
  IndiaNativeFiscalAccountingConflictError,
  IndiaNativeFiscalAccountingEventHandler,
  IndiaNativeFiscalAccountingNotFoundError,
  IndiaNativeFiscalAccountingValidationError,
} from "../src/contexts/financials/india-native-fiscal-accounting";
import {
  IndiaGstAccommodationFinalValuationService,
  type IndiaGstAccommodationNativeFinalValuationInput,
  type IndiaGstAccommodationNativeFinalValuationResult,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-final-valuation";
import { IndiaGstAccommodationServiceProvisionDateService, type IndiaGstAccommodationServiceProvisionDateResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-service-provision-date";
import { IndiaGstAccommodationPaymentReceiptDateService, type IndiaGstAccommodationPaymentReceiptDateResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-payment-receipt-date";
import { IndiaGstAccommodationHistoricalResolutionService, type IndiaGstAccommodationHistoricalResolutionResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-historical-resolution";
import { deriveIndiaGstAccommodationNativeInvoiceSource, type IndiaGstAccommodationNativeInvoiceSourceInput, type IndiaGstAccommodationNativeInvoiceSourceResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-invoice-source";
import { deriveIndiaGstAccommodationComponentFamily, type IndiaGstAccommodationComponentFamilyResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-component-family";
import { deriveIndiaGstAccommodationLevyInputBundle, type IndiaGstAccommodationLevyInputBundleResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-levy-input-bundle";
import { deriveIndiaGstAccommodationLevyComponentIdentity, type IndiaGstAccommodationLevyComponentIdentityResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-levy-component-identity";
import type { IndiaGstAccommodationNativeQuotedRateApplicabilityResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-quoted-rate-applicability";
import type { IndiaGstAccommodationNativeFinalComponentTaxResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax";
import { deriveIndiaGstSection14RateSelectionFromEvidence } from "../src/contexts/tax-fiscal/india-gst-section14-rate-selection";
import { createAuditEnvelope, Database, ExtensionRegistry, PostgresEventBus, PostgresIdempotency, type Tx } from "../src/kernel";
import {
  createNativeStatutoryFixture,
  createNativeSourceFixture,
  type NativeSourceFixture,
} from "./fixtures/india-native-fiscal-source-completion-fixture";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const TENANT = id(434701);
const canonicalCompletionInstalled = existsSync(new URL(
  "../migrations/0077_india_native_fiscal_source_completion.sql", import.meta.url,
));
const EVENT = id(434702);
const HASH = "a".repeat(64);
const PREDECESSOR = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const PREDECESSOR_CONTENT_HASH = "2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08";
const SUCCESSOR_CONTENT_HASH = "eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820";

type Mutable = Record<string, unknown>;
type ComponentFamily = "igst" | "cgst_sgst" | "cgst_utgst";

interface NativeTaxPreview {
  readonly valuationId: string;
  readonly generation: number;
  readonly valuationEvidenceHash: string;
  readonly nativeConsiderationBasisHash: string;
  readonly selectedExtensionId: string;
  readonly selectedExtensionVersion: number;
  readonly selectedContentHash: string;
  readonly componentFamily: ComponentFamily;
  readonly componentIdentities: readonly string[];
  readonly componentAmountsMinor: readonly string[];
  readonly transactionValueMinor: string;
  readonly taxMinor: string;
  readonly grandTotalMinor: string;
  readonly roomNights: readonly Mutable[];
  readonly roomNightsCanonicalJson: string;
  readonly persistenceRoomNights: readonly Mutable[];
}

interface NativeIntakeProjection {
  readonly serviceProvision: IndiaGstAccommodationServiceProvisionDateResult;
  readonly paymentReceipt: IndiaGstAccommodationPaymentReceiptDateResult;
  readonly ordinaryRegime: Omit<NativeSourceFixture["ordinaryResult"], "created" | "replayed">;
  readonly recordingRoots: Readonly<{
    serviceProvisionRecording: string;
    paymentReceiptRecording: string;
    ordinaryRegimeRecording: string;
  }>;
  readonly serviceProvisionCanonicalJson: string;
  readonly paymentReceiptCanonicalJson: string;
  readonly lineage: Mutable;
  readonly attributionSnapshot: Mutable;
}

interface NativeValuationEvidence {
  readonly valuationId: string;
  readonly generation: number;
  readonly actorId: string;
  readonly requestId: string;
  readonly evidenceHash: string;
  readonly nativeConsiderationBasisHash: string;
  readonly basis: Mutable & { readonly sources: readonly Mutable[]; readonly roomNights: readonly Mutable[] };
  readonly sourceClosure: Mutable & { readonly rootIds: readonly string[]; readonly sources: readonly Mutable[] };
  readonly intake: NativeIntakeProjection;
}

interface NativeTimingSource {
  readonly nativeTiming: IndiaGstAccommodationNativeInvoiceSourceInput["nativeTiming"];
  readonly nativeTimingProjectionPreimage: Mutable;
  readonly transactionContext: Readonly<{ issuingTransactionId: string; transactionTimestamp: string; propertyTimezone: string; invoiceIssueDate: string }>;
  readonly invoiceSourceInput: IndiaGstAccommodationNativeInvoiceSourceInput;
  readonly invoiceSourceResult: IndiaGstAccommodationNativeInvoiceSourceResult;
  readonly invoiceSourceInputCanonicalJson: string;
  readonly invoiceSourceResultCanonicalJson: string;
}

interface NativeQuotedTaxComposition {
  readonly componentFamilyCanonicalJson: string;
  readonly levyInputBundleCanonicalJson: string;
  readonly levyComponentIdentityCanonicalJson: string;
  readonly quotedApplicabilityCanonicalJson: string;
  readonly finalTaxCanonicalJson: string;
  readonly taxPreview: NativeTaxPreview;
}

interface NativePreparationBasis {
  readonly preimageCanonicalJson: string;
  readonly sourceBasisHash: string;
}

interface NativeFiscalSeriesIdentity {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly seriesId: string;
  readonly supplierRegistrationId: string;
  readonly kind: "invoice";
  readonly fiscal: true;
  readonly financialYearStart: string;
  readonly prefix: string;
}

type NativeStatutoryFixture = Awaited<ReturnType<typeof createNativeStatutoryFixture>>;
type NativeStatutorySelectors = Readonly<
  Pick<NativeStatutoryFixture, "seller" | "location" | "supplierStatusId" | "recipient" | "classificationId" | "jurisdiction"
    | "serviceSupplier" | "serviceRecipient">
  & { readonly supplierSez: Readonly<{ readonly supplierSezStatusId: string }>;
    readonly recipientSez: Readonly<{ readonly recipientSezStatusId: string }> }
>;

function freezeGraph<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freezeGraph(item);
    Object.freeze(value);
  }
  return value;
}

function row(created = true, journalId: string | null = id(434710)): Mutable {
  return {
    posting_binding_id: id(434703),
    native_timing_id: id(434704),
    tax_id: id(434705),
    valuation_id: id(434706),
    applicability_id: id(434707),
    reservation_id: id(434708),
    folio_id: id(434709),
    journal_id: journalId,
    currency: "INR",
    business_date: "2026-09-05",
    evidence_hash: HASH,
    created,
  };
}

function txReturning(
  rows: readonly Mutable[],
  calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [],
): Tx {
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push(Object.freeze({ text: strings.join("?"), values: Object.freeze(values) }));
    return rows;
  }) as unknown as Tx;
}

function txThrowing(error: unknown): Tx {
  return (async () => { throw error; }) as unknown as Tx;
}

const input = Object.freeze({ tenantId: TENANT, eventId: EVENT });

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(Reflect.get(value, key), seen);
  return Object.freeze(value);
}

// Independent serialization of genuine reader output for SQL/TS preimage parity.
function canonicalEvidence(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalEvidence).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalEvidence(record[key])}`).join(",")}}`;
}

function insertionHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function valuationInput(
  fixture: NativeSourceFixture,
  postingRootId: string,
  key: string,
): IndiaGstAccommodationNativeFinalValuationInput {
  return deepFreeze({
    tenantId: fixture.tenant,
    propertyNode: fixture.property,
    reservationId: fixture.reservation,
    folioId: fixture.folio,
    buyerPartyId: fixture.party,
    serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
    sources: [{
      postingRootId,
      sourceKind: "room_consideration",
      additionSubtype: null,
      discountEligibility: null,
      evidenceSource: "operator_attestation",
      evidenceReference: `private-preview-root:${postingRootId}`,
    }],
    ordinaryAttestation: {
      relationshipConclusion: "unrelated_not_distinct",
      considerationConclusion: "money_only",
      section152Conclusion: "all_additions_enumerated",
      section153Conclusion: "all_discounts_eligible",
      sourceCompletenessConclusion: "all_sources_classified",
      evidenceSource: "operator_attestation",
      evidenceReference: "private-preview-ordinary-section15-evidence",
    },
    expectedCurrentValuationId: null,
    expectedCurrentEvidenceHash: null,
    approvalRequestId: null,
    idempotencyKey: key,
    envelope: createAuditEnvelope({
      tenantId: fixture.tenant,
      propertyNode: fixture.property,
      actorId: fixture.actor,
      requestId: crypto.randomUUID(),
      operation: "india_gst.accommodation_final_valuation_recorded",
    }),
  });
}

describe("Order434 Financials native fiscal accounting event handler", () => {
  test("calls only the governed tenant/event capability and returns a frozen positive-tax result", async () => {
    const calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const actual = await new IndiaNativeFiscalAccountingEventHandler().handle(
      txReturning([row()], calls),
      input,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("public.consume_india_native_fiscal_accounting_event");
    expect(calls[0]!.values).toEqual([TENANT, EVENT]);
    expect(calls[0]!.text).not.toMatch(/INSERT|UPDATE|DELETE|account_id|amount_minor|actor_id/i);
    expect(actual).toEqual({
      postingBindingId: id(434703),
      nativeTimingId: id(434704),
      taxId: id(434705),
      valuationId: id(434706),
      applicabilityId: id(434707),
      reservationId: id(434708),
      folioId: id(434709),
      journalId: id(434710),
      currency: "INR",
      businessDate: "2026-09-05",
      evidenceHash: HASH,
      created: true,
      replayed: false,
    });
    expect(Object.isFrozen(actual)).toBeTrue();
  });

  test("retains the typed zero-tax null journal and durable replay disposition", async () => {
    const handler = new IndiaNativeFiscalAccountingEventHandler();
    const zeroTax = await handler.handle(
      txReturning([row(true, null)]),
      input,
    );
    expect(zeroTax.journalId).toBeNull();
    expect(zeroTax.created).toBeTrue();
    expect(zeroTax.replayed).toBeFalse();

    const replay = await handler.handle(txReturning([row(false)]), input);
    expect(replay.journalId).toBe(id(434710));
    expect(replay.created).toBeFalse();
    expect(replay.replayed).toBeTrue();
  });

  test("rejects invalid two-field inputs before invoking SQL", async () => {
    let queried = false;
    const tx = (async () => { queried = true; return []; }) as unknown as Tx;
    const handler = new IndiaNativeFiscalAccountingEventHandler();
    const candidates = [
      { tenantId: TENANT },
      { tenantId: TENANT, eventId: "not-a-uuid" },
      { tenantId: TENANT, eventId: EVENT, amountMinor: "1" },
      null,
    ];
    for (const candidate of candidates) {
      queried = false;
      await expect(handler.handle(tx, candidate as never)).rejects.toBeInstanceOf(
        IndiaNativeFiscalAccountingValidationError,
      );
      expect(queried).toBeFalse();
    }
    await expect(handler.handle(undefined as never, input)).rejects.toBeInstanceOf(
      IndiaNativeFiscalAccountingValidationError,
    );
  });

  test("fails closed for missing, ambiguous, or malformed capability evidence", async () => {
    const handler = new IndiaNativeFiscalAccountingEventHandler();
    await expect(handler.handle(txReturning([]), input)).rejects.toBeInstanceOf(
      IndiaNativeFiscalAccountingNotFoundError,
    );
    await expect(handler.handle(txReturning([row(), row()]), input)).rejects.toBeInstanceOf(
      IndiaNativeFiscalAccountingConflictError,
    );

    const malformed = [
      { ...row(), currency: "USD" },
      { ...row(), journal_id: "not-a-uuid" },
      { ...row(), business_date: "2026-02-30" },
      { ...row(), evidence_hash: "not-a-hash" },
      { ...row(), created: 1 },
      Object.fromEntries(Object.entries(row()).filter(([key]) => key !== "tax_id")),
      { ...row(), extra: true },
    ];
    for (const candidate of malformed) {
      await expect(handler.handle(txReturning([candidate]), input)).rejects.toBeInstanceOf(
        IndiaNativeFiscalAccountingConflictError,
      );
    }
  });

  test("maps governed SQLSTATE families and preserves unknown failures by identity", async () => {
    const handler = new IndiaNativeFiscalAccountingEventHandler();
    for (const code of ["22023", "22003"]) {
      await expect(handler.handle(txThrowing({ sqlState: code }), input)).rejects.toBeInstanceOf(
        IndiaNativeFiscalAccountingValidationError,
      );
    }
    await expect(handler.handle(txThrowing({ errno: "42501" }), input)).rejects.toBeInstanceOf(
      IndiaNativeFiscalAccountingNotFoundError,
    );
    for (const code of ["55000", "23505", "23503", "23514", "P0011"]) {
      await expect(handler.handle(txThrowing({ code }), input)).rejects.toBeInstanceOf(
        IndiaNativeFiscalAccountingConflictError,
      );
    }
    const unknown = new Error("unclassified database failure");
    await expect(handler.handle(txThrowing(unknown), input)).rejects.toBe(unknown);
    await expect(handler.handle(txThrowing("non-object failure"), input)).rejects.toBe("non-object failure");
  });

  test("the handler owns no connection, consumer cursor, money, date, account, or source-hash input", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/financials/india-native-fiscal-accounting.ts",
      import.meta.url,
    )).text();
    const inputShape = source.match(
      /export interface IndiaNativeFiscalAccountingEventInput\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? "";
    expect(inputShape).toMatch(/tenantId/);
    expect(inputShape).toMatch(/eventId/);
    expect(inputShape).not.toMatch(/actor|account|amount|money|date|hash|cursor|connection/i);
    expect(source).not.toMatch(/new\s+(?:SQL|Database)|withTenantTransaction|consumeBatch|consumer_mark/);
    expect(source).not.toMatch(/INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i);
  });
});

const deployUrl = process.env.YELLOW_ORDER434_NATIVE_ACCOUNTING_DEPLOY_DATABASE_URL
  ?? process.env.YELLOW_ORDER434_NATIVE_ACCOUNTING_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER434_NATIVE_ACCOUNTING_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_NATIVE_ACCOUNTING_DATABASE === "1"
    && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order434 private native-tax preview proof requires dedicated deploy and runtime database URLs");
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

databaseDescribe("Order434 live private native-tax preview and accounting metadata", () => {
  let deploy: SQL;
  let runtime: Database;
  let runtimeEvents: SQL;
  let valuation: IndiaGstAccommodationFinalValuationService;
  let corrections: ChargeCorrectionService;

  beforeAll(() => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    runtimeEvents = new SQL(runtimeUrl!, { max: 2, prepare: false });
    valuation = new IndiaGstAccommodationFinalValuationService({
      idempotency: new PostgresIdempotency(),
    });
    corrections = new ChargeCorrectionService({
      events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency(),
    });
  });

  afterAll(async () => {
    await runtime?.close();
    await runtimeEvents?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  test("matches the exact two-UUID consumer authority at the current migration stage", async () => {
    const [fn] = await deploy<Array<Record<string, unknown>>>`
      SELECT pg_get_userbyid(proc.proowner) AS owner,
             proc.prosecdef AS security_definer,
             proc.proconfig AS config,
             oidvectortypes(proc.proargtypes) AS arguments,
             pg_get_function_result(proc.oid) AS result,
             has_function_privilege('app_role',proc.oid,'EXECUTE') AS app_execute,
             has_function_privilege('yellow_runtime',proc.oid,'EXECUTE') AS runtime_execute,
             has_function_privilege('public',proc.oid,'EXECUTE') AS public_execute
        FROM pg_proc AS proc
        JOIN pg_namespace AS namespace ON namespace.oid=proc.pronamespace
       WHERE namespace.nspname='public'
         AND proc.proname='consume_india_native_fiscal_accounting_event'
    `;
    expect(fn).toMatchObject({
      owner: "yellow_owner",
      security_definer: true,
      arguments: "uuid, uuid",
      app_execute: canonicalCompletionInstalled,
      runtime_execute: false,
      public_execute: false,
    });
    expect(fn!.config).toEqual(expect.arrayContaining([expect.stringContaining("search_path=")]));
    const resultType = String(fn!.result);
    for (const field of [
      "posting_binding_id", "native_timing_id", "tax_id", "valuation_id",
      "applicability_id", "reservation_id", "folio_id", "journal_id", "currency",
      "business_date", "evidence_hash", "created",
    ]) expect(resultType).toContain(field);
  });

  test("keeps the authenticated accounting-source bridge read-only with exact staged authority", async () => {
    const [fn] = await deploy<Array<Record<string, unknown>>>`
      SELECT pg_get_userbyid(proc.proowner) AS owner,
             proc.prosecdef AS security_definer,proc.provolatile AS volatility,
             proc.proconfig AS config,oidvectortypes(proc.proargtypes) AS arguments,
             pg_get_function_result(proc.oid) AS result,
             pg_get_functiondef(proc.oid) AS definition,
             has_function_privilege('app_role',proc.oid,'EXECUTE') AS app_execute,
             has_function_privilege('yellow_runtime',proc.oid,'EXECUTE') AS runtime_execute,
             has_function_privilege('public',proc.oid,'EXECUTE') AS public_execute
        FROM pg_proc AS proc JOIN pg_namespace AS namespace ON namespace.oid=proc.pronamespace
       WHERE namespace.nspname='public' AND proc.proname='read_india_native_accounting_source_closure'
    `;
    expect(fn).toMatchObject({ owner: "yellow_owner", security_definer: true,
      volatility: "v", arguments: "uuid, uuid", app_execute: canonicalCompletionInstalled,
      runtime_execute: false, public_execute: false });
    expect(fn!.config).toEqual(expect.arrayContaining([
      expect.stringContaining("search_path="),expect.stringContaining("TimeZone=UTC"),
      expect.stringContaining("DateStyle=ISO"),
    ]));
    expect(fn!.result).toBe("TABLE(posting_binding_id uuid, accounting_evidence_hash text, source_closure jsonb)");
    expect(String(fn!.definition)).toContain("assert_india_native_accounting_binding");
    expect(String(fn!.definition)).toContain("read_india_native_valuation_source_closure");
    expect(String(fn!.definition)).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE|CALL)\b/i);
    // No native binding is fabricated here: successful complete issuance still
    // requires the real preparation/commit implementation and its database proof.
  });

  test("keeps the private preview owner-only, stable, and free of writes", async () => {
    const [fn] = await deploy<Array<Record<string, unknown>>>`
      SELECT pg_get_userbyid(proc.proowner) AS owner,
             proc.prosecdef AS security_definer,
             proc.provolatile AS volatility,
             proc.proconfig AS config,
             oidvectortypes(proc.proargtypes) AS arguments,
             pg_get_function_result(proc.oid) AS result,
             pg_get_functiondef(proc.oid) AS definition,
             has_function_privilege('yellow_owner',proc.oid,'EXECUTE') AS owner_execute,
             has_function_privilege('app_role',proc.oid,'EXECUTE') AS app_execute,
             has_function_privilege('yellow_runtime',proc.oid,'EXECUTE') AS runtime_execute,
             has_function_privilege('public',proc.oid,'EXECUTE') AS public_execute
        FROM pg_proc AS proc
        JOIN pg_namespace AS namespace ON namespace.oid=proc.pronamespace
       WHERE namespace.nspname='public'
         AND proc.proname='read_india_native_tax_preview'
    `;
    expect(fn).toMatchObject({
      owner: "yellow_owner",
      security_definer: false,
      volatility: "s",
      arguments: "uuid, uuid, uuid, uuid, uuid, uuid, text",
      result: "jsonb",
      owner_execute: true,
      app_execute: false,
      runtime_execute: false,
      public_execute: false,
    });
    expect(fn!.config).toEqual(expect.arrayContaining([
      expect.stringContaining("search_path="),
      expect.stringContaining("TimeZone=UTC"),
      expect.stringContaining("DateStyle=ISO"),
    ]));
    expect(String(fn!.definition)).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE|CALL)\b/i);
  });

  test("keeps the historical-rate day leaf private, stable and free of writes or locks", async () => {
    const [fn] = await deploy<Array<Record<string, unknown>>>`
      SELECT pg_get_userbyid(proc.proowner) AS owner,proc.prosecdef AS security_definer,
        proc.provolatile AS volatility,proc.proconfig AS config,
        oidvectortypes(proc.proargtypes) AS arguments,pg_get_function_result(proc.oid) AS result,
        pg_get_functiondef(proc.oid) AS definition,
        has_function_privilege('app_role',proc.oid,'EXECUTE') AS app_execute,
        has_function_privilege('yellow_runtime',proc.oid,'EXECUTE') AS runtime_execute,
        has_function_privilege('public',proc.oid,'EXECUTE') AS public_execute
      FROM pg_proc proc JOIN pg_namespace ns ON ns.oid=proc.pronamespace
      WHERE ns.nspname='public' AND proc.proname='read_india_native_rate_history_day'`;
    expect(fn).toMatchObject({ owner: "yellow_owner", security_definer: false,
      volatility: "s", arguments: "uuid, uuid, date", result: "jsonb",
      app_execute: false, runtime_execute: false, public_execute: false });
    expect(fn!.config).toEqual(expect.arrayContaining([
      expect.stringContaining("search_path="),expect.stringContaining("TimeZone=UTC"),
      expect.stringContaining("DateStyle=ISO"),
    ]));
    expect(String(fn!.definition)).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE|CALL)\b|pg_advisory|FOR\s+(?:SHARE|KEY)/i);
  });

  async function finalize(
    fixture: NativeSourceFixture,
    chargeAmount: string,
    key: string,
  ): Promise<IndiaGstAccommodationNativeFinalValuationResult> {
    const charge = await fixture.postCharge(chargeAmount, `${key}-charge`);
    const request = valuationInput(fixture, charge.postingRootId, `${key}-valuation`);
    return runtime.withTenantTransaction(fixture.tenant, tx => valuation.finalizeNative(tx, request));
  }

  async function privatePreview(
    fixture: NativeSourceFixture,
    finalValuation: IndiaGstAccommodationNativeFinalValuationResult,
    selectedExtensionId: string,
    componentFamily: ComponentFamily,
  ): Promise<NativeTaxPreview> {
    return deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      const [row] = await tx<Array<{ preview: NativeTaxPreview }>>`
        SELECT public.read_india_native_tax_preview(
          ${fixture.tenant}::uuid,
          ${fixture.property}::uuid,
          ${fixture.reservation}::uuid,
          ${fixture.folio}::uuid,
          ${finalValuation.valuationId}::uuid,
          ${selectedExtensionId}::uuid,
          ${componentFamily}
        ) AS preview
      `;
      if (!row) throw new Error("Private native-tax preview returned no row");
      return row.preview;
    });
  }

  async function readValuationNights(
    fixture: NativeSourceFixture,
    finalValuation: IndiaGstAccommodationNativeFinalValuationResult,
  ): Promise<readonly Readonly<{ ordinal: number; businessDate: string; amountMinor: string }>[]> {
    return deploy<Array<{ ordinal: number; businessDate: string; amountMinor: string }>>`
      SELECT ordinal::int,
             business_date::text AS "businessDate",
             transaction_value_minor::text AS "amountMinor"
        FROM india_gst_accommodation_valuation_room_night
       WHERE tenant_id=${fixture.tenant}::uuid
         AND valuation_id=${finalValuation.valuationId}::uuid
       ORDER BY ordinal
    `;
  }

  async function privateIntake(
    fixture: NativeSourceFixture,
    paymentId = fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId,
    contextTenant = fixture.tenant,
  ): Promise<NativeIntakeProjection> {
    return deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${contextTenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      const [result] = await tx<Array<{ evidence: NativeIntakeProjection }>>`
        SELECT public.read_india_native_intake_source(
          ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
          ${fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId}::uuid,
          ${paymentId}::uuid,${fixture.ordinaryResult.ordinaryRegimeEvidenceId}::uuid
        ) AS evidence`;
      if (!result) throw new Error("Private native intake read returned no row");
      return result.evidence;
    });
  }

  async function privateValuation(
    fixture: NativeSourceFixture,
    result: IndiaGstAccommodationNativeFinalValuationResult,
    timezone = "UTC",
  ): Promise<NativeValuationEvidence> {
    return deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      await tx`SELECT set_config('TimeZone',${timezone},true)`;
      const [row] = await tx<Array<{ evidence: NativeValuationEvidence }>>`
        SELECT public.read_india_native_valuation_evidence(
          ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
          ${fixture.folio}::uuid,${result.valuationId}::uuid,
          ${fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId}::uuid,
          ${fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId}::uuid,
          ${fixture.ordinaryResult.ordinaryRegimeEvidenceId}::uuid
        ) AS evidence`;
      if (!row) throw new Error("Private native valuation read returned no row");
      const [setting] = await tx<Array<{ timezone: string }>>`SELECT current_setting('TimeZone') AS timezone`;
      expect(setting?.timezone).toBe(timezone);
      return row.evidence;
    });
  }

  async function expectSqlState(operation: Promise<unknown>, state: string): Promise<void> {
    let caught: unknown;
    try { await operation; } catch (error) { caught = error; }
    expect(caught).toBeDefined();
    const error = caught as { errno?: unknown; sqlState?: unknown; code?: unknown };
    expect(String(error.errno ?? error.sqlState ?? error.code)).toBe(state);
  }

  async function privateHistory(fixture: NativeSourceFixture, businessDate: string, timezone = "UTC") {
    return deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      await tx`SELECT set_config('TimeZone',${timezone},true)`;
      const [result] = await tx<Array<{
        evidence: IndiaGstAccommodationHistoricalResolutionResult;
        canonical_json: string;
        pair_canonical_json: string;
      }>>`
        SELECT source.evidence,
          public.india_native_source_canonical_json((source.evidence-'evidenceHash')||
            jsonb_build_object('tenantId',${fixture.tenant}::text)) AS canonical_json,
          public.india_native_source_canonical_json(((source.evidence->'rateVersionPair')-'evidenceHash')||
            jsonb_build_object('tenantId',${fixture.tenant}::text,
              'predecessorOwnerTenantId',NULL,'successorOwnerTenantId',NULL)) AS pair_canonical_json
        FROM (SELECT public.read_india_native_rate_history_day(
          ${fixture.tenant}::uuid,${fixture.property}::uuid,${businessDate}::date) AS evidence) source`;
      if (!result) throw new Error("Private historical-rate day returned no row");
      const [setting] = await tx<Array<{ timezone: string }>>`SELECT current_setting('TimeZone') AS timezone`;
      expect(setting?.timezone).toBe(timezone);
      return result;
    });
  }

  type TimingCalendar = Readonly<{ authority: string; sourceHash: string; through: string; dates: readonly string[]; states: readonly string[] }>;
  async function privateTiming(fixture: NativeSourceFixture, calendar: TimingCalendar | null = null,
    ordinaryId = fixture.ordinaryResult.ordinaryRegimeEvidenceId) {
    const timingId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    return deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      const read = async () => {
        const [row] = await tx<Array<{ evidence: NativeTimingSource }>>`
          SELECT public.read_india_native_invoice_timing_source(
            ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
            ${fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId}::uuid,
            ${fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId}::uuid,${ordinaryId}::uuid,
            ${timingId}::uuid,${documentId}::uuid,${calendar?.authority ?? null}::text,
            ${calendar?.sourceHash ?? null}::text,${calendar?.through ?? null}::date,
            ${`{${calendar?.dates.join(",") ?? ""}}`}::date[],${`{${calendar?.states.join(",") ?? ""}}`}::text[]) AS evidence`;
        if (!row) throw new Error("Native timing source missing");
        return row.evidence;
      };
      const first = await read();
      await tx`SET LOCAL TIME ZONE 'Asia/Calcutta'`;
      expect(await read()).toEqual(first);
      const [clock] = await tx<Array<{ issuing_transaction: string; issue_date: string; timezone: string }>>`
        SELECT pg_current_xact_id()::text AS issuing_transaction,
          (transaction_timestamp() AT TIME ZONE p.timezone)::date::text AS issue_date,
          current_setting('TimeZone') AS timezone
        FROM public.org_node p WHERE p.tenant_id=${fixture.tenant}::uuid AND p.id=${fixture.property}::uuid`;
      expect(first.transactionContext.issuingTransactionId).toBe(clock!.issuing_transaction);
      expect(first.transactionContext.invoiceIssueDate).toBe(clock!.issue_date);
      expect(first.nativeTiming.invoiceIssueDate).toBe(clock!.issue_date);
      expect(clock!.timezone).toBe("Asia/Calcutta");
      return first;
    });
  }

  async function privateQuotedTax(
    fixture: NativeSourceFixture,
    finalValuation: IndiaGstAccommodationNativeFinalValuationResult,
    statutory: NativeStatutorySelectors,
    calendar: TimingCalendar | null = null,
    mutateInput?: (input: Mutable) => Mutable,
  ) {
    const timingId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    return deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      const [timingRow] = await tx<Array<{ evidence: NativeTimingSource }>>`
        SELECT public.read_india_native_invoice_timing_source(
          ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
          ${fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId}::uuid,
          ${fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId}::uuid,
          ${fixture.ordinaryResult.ordinaryRegimeEvidenceId}::uuid,
          ${timingId}::uuid,${documentId}::uuid,${calendar?.authority ?? null}::text,
          ${calendar?.sourceHash ?? null}::text,${calendar?.through ?? null}::date,
          ${`{${calendar?.dates.join(",") ?? ""}}`}::date[],
          ${`{${calendar?.states.join(",") ?? ""}}`}::text[]) AS evidence`;
      if (!timingRow) throw new Error("Native quoted-tax timing source missing");
      const [statutoryRow] = await tx<Array<{
        prepared_source_json: string;
        service_supply_nature_json: string;
        service_supplier_sez_status_id: string;
        service_recipient_sez_status_id: string;
      }>>`
        SELECT * FROM public.read_india_native_statutory_root_graph(
          ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
          ${fixture.folio}::uuid,${finalValuation.valuationId}::uuid,
          ${statutory.location.supplierServiceLocationId}::uuid,
          ${statutory.supplierStatusId}::uuid,${statutory.supplierSez.supplierSezStatusId}::uuid,
          ${statutory.recipient.registrationId}::uuid,${statutory.recipientSez.recipientSezStatusId}::uuid,
          ${statutory.classificationId}::uuid,${timingRow.evidence.invoiceSourceResultCanonicalJson},
          ${JSON.stringify(statutory.jurisdiction)})`;
      if (!statutoryRow) throw new Error("Native quoted-tax statutory source missing");
      const originalInput = JSON.parse(timingRow.evidence.invoiceSourceInputCanonicalJson) as Mutable;
      const inputJson = JSON.stringify(mutateInput ? mutateInput(originalInput) : originalInput);
      const [compositionRow] = await tx<Array<{ evidence: NativeQuotedTaxComposition }>>`
        SELECT public.compose_india_native_quoted_tax_source(
          ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
          ${fixture.folio}::uuid,${finalValuation.valuationId}::uuid,
          ${inputJson},${timingRow.evidence.invoiceSourceResultCanonicalJson},
          ${statutoryRow.service_supply_nature_json}) AS evidence`;
      if (!compositionRow) throw new Error("Native quoted-tax composition missing");
      return { evidence: compositionRow.evidence, timing: timingRow.evidence, statutory: statutoryRow };
    });
  }

  function assertTimingParity(actual: NativeTimingSource, fixture: NativeSourceFixture) {
    const input = freezeGraph(JSON.parse(actual.invoiceSourceInputCanonicalJson) as IndiaGstAccommodationNativeInvoiceSourceInput);
    const result = freezeGraph(JSON.parse(actual.invoiceSourceResultCanonicalJson) as IndiaGstAccommodationNativeInvoiceSourceResult);
    expect(input).toEqual(actual.invoiceSourceInput);
    expect(result).toEqual(actual.invoiceSourceResult);
    expect(input.serviceProvision).toEqual(fixture.serviceResult.serviceProvision);
    expect(input.paymentReceipt).toEqual(fixture.paymentResult.paymentReceipt);
    const expected = deriveIndiaGstAccommodationNativeInvoiceSource(input);
    expect(result).toEqual(expected);
    const projectionHash = new Bun.CryptoHasher("sha256").update(canonicalEvidence(actual.nativeTimingProjectionPreimage)).digest("hex");
    expect(actual.nativeTiming.evidenceHash).toBe(projectionHash);
    expect(actual.nativeTimingProjectionPreimage.kind).toBe("india-native-invoice-timing-projection-v1");
    expect(result.timing.predecessorHashes.nativeTiming).toBe(projectionHash);
    expect(result.timing.evidenceHash).not.toBe(projectionHash);
    expect(actual.nativeTimingProjectionPreimage.recordingRoots).toEqual({
      serviceProvisionRecording: fixture.serviceResult.evidenceHash,
      paymentReceiptRecording: fixture.paymentResult.evidenceHash,
      ordinaryRegimeRecording: fixture.ordinaryResult.evidenceHash,
    });
    if (result.rateSource.kind === "genuine_section14_rate_change") {
      const section14 = deriveIndiaGstSection14RateSelectionFromEvidence({
        tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: fixture.reservation,
        rateVersionPair: input.rateVersionPair, rateChangeDateEvidence: input.rateChangeDateEvidence,
        serviceProvisionResult: input.serviceProvision, paymentReceiptResult: input.paymentReceipt,
        invoiceTiming: freezeGraph({ propertyNode: fixture.property, serviceProvision: input.paymentReceipt.serviceProvision,
          invoiceIssueDate: input.nativeTiming.invoiceIssueDate, amountMinor: input.paymentReceipt.amountMinor,
          currency: input.paymentReceipt.currency, evidenceHash: input.nativeTiming.evidenceHash }),
        paymentEvidence: input.section14PaymentEvidence!,
      });
      expect(JSON.stringify(result.rateSource.section14)).toBe(JSON.stringify(section14));
    }
    return result;
  }

  function halfUp(value: bigint, basisPoints: number): bigint {
    const numerator = value * BigInt(basisPoints);
    const quotient = numerator / 10_000n;
    return (numerator % 10_000n) * 2n >= 10_000n ? quotient + 1n : quotient;
  }

  function expectedRooms(
    nights: readonly Readonly<{ ordinal: number; businessDate: string; amountMinor: string }>[],
    aggregateBasisPoints: number,
    identities: readonly string[],
  ): readonly Mutable[] {
    const componentBasisPoints = aggregateBasisPoints / identities.length;
    return nights.map(night => {
      const value = BigInt(night.amountMinor);
      const upper = value > 750_000n;
      const bps = upper ? 1_800 : aggregateBasisPoints;
      const perComponent = upper ? 1_800 / identities.length : componentBasisPoints;
      const components = identities.map(identity => ({
        identity,
        rateBasisPoints: perComponent,
        taxMinor: halfUp(value, perComponent).toString(),
      }));
      return {
        ordinal: String(night.ordinal),
        businessDate: night.businessDate,
        transactionValueMinor: night.amountMinor,
        slab: {
          uptoMinor: upper ? null : 750000,
          aggregateRateBasisPoints: bps,
          components,
        },
        taxMinor: components.reduce((sum, component) => sum + BigInt(component.taxMinor), 0n).toString(),
      };
    });
  }

  async function census(tenantId: string): Promise<Record<string, number>> {
    const [counts] = await deploy<Array<Record<string, number>>>`
      SELECT (SELECT count(*)::int FROM journal WHERE tenant_id=${tenantId}::uuid) AS journals,
             (SELECT count(*)::int FROM posting_line WHERE tenant_id=${tenantId}::uuid) AS lines,
             (SELECT count(*)::int FROM india_gst_accommodation_final_valuation
               WHERE tenant_id=${tenantId}::uuid) AS valuations,
             (SELECT count(*)::int FROM india_gst_accommodation_valuation_room_night
               WHERE tenant_id=${tenantId}::uuid) AS nights,
             (SELECT count(*)::int FROM fact_log WHERE tenant_id=${tenantId}::uuid) AS facts,
             (SELECT count(*)::int FROM outbox WHERE tenant_id=${tenantId}::uuid) AS events,
             (SELECT count(*)::int FROM document WHERE tenant_id=${tenantId}::uuid) AS documents
    `;
    if (!counts) throw new Error("Private preview census returned no row");
    return counts;
  }

  test("private preview reproduces predecessor and successor room JSON for all component families", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, {
      label: "private-preview-rates",
      roomNightAmounts: ["5000", "5000"],
    });
    const finalValuation = await finalize(fixture, "10000", "private-preview-rates");
    const nights = await readValuationNights(fixture, finalValuation);
    const [attribution] = await deploy<Array<{
      embedsHash: boolean;
      embeddedHash: string;
      storedHash: string;
    }>>`
      SELECT snapshot ? 'snapshotHash' AS "embedsHash",
             snapshot->>'snapshotHash' AS "embeddedHash",
             snapshot_hash AS "storedHash"
        FROM tax_attribution_snapshot
       WHERE tenant_id=${fixture.tenant}::uuid
         AND id=${fixture.attribution}::uuid
    `;
    expect(attribution).toEqual({
      embedsHash: true,
      embeddedHash: attribution!.storedHash,
      storedHash: attribution!.storedHash,
    });
    const before = await census(fixture.tenant);

    for (const rate of [
      { extensionId: PREDECESSOR, version: 1, contentHash: PREDECESSOR_CONTENT_HASH, lowerBasisPoints: 1200 },
      { extensionId: SUCCESSOR, version: 2, contentHash: SUCCESSOR_CONTENT_HASH, lowerBasisPoints: 500 },
    ] as const) {
      for (const family of ["igst", "cgst_sgst", "cgst_utgst"] as const) {
        const identities = family === "igst"
          ? ["igst"]
          : family === "cgst_sgst" ? ["cgst", "sgst"] : ["cgst", "utgst"];
        const preview = await privatePreview(fixture, finalValuation, rate.extensionId, family);
        const rooms = expectedRooms(nights, rate.lowerBasisPoints, identities);
        const componentSums = identities.map(identity => rooms.reduce((sum, room) => {
          const component = (room.slab as Mutable).components as readonly Mutable[];
          return sum + BigInt(String(component.find(item => item.identity === identity)!.taxMinor));
        }, 0n).toString());
        const tax = rooms.reduce((sum, room) => sum + BigInt(String(room.taxMinor)), 0n);
        expect(preview).toMatchObject({
          valuationId: finalValuation.valuationId,
          generation: finalValuation.generation,
          valuationEvidenceHash: finalValuation.evidenceHash,
          nativeConsiderationBasisHash: finalValuation.nativeConsiderationBasisHash,
          selectedExtensionId: rate.extensionId,
          selectedExtensionVersion: rate.version,
          selectedContentHash: rate.contentHash,
          componentFamily: family,
          componentIdentities: identities,
          componentAmountsMinor: componentSums,
          transactionValueMinor: "10000",
          taxMinor: tax.toString(),
          grandTotalMinor: (10_000n + tax).toString(),
          roomNights: rooms,
        });
        expect(preview.roomNightsCanonicalJson).toBe(JSON.stringify(rooms));
        expect(preview.roomNights.reduce((sum, room) =>
          sum + BigInt(String(room.taxMinor)), 0n).toString()).toBe(preview.taxMinor);
      }
    }
    expect(await census(fixture.tenant)).toEqual(before);
  }, 30_000);

  test("private intake reconstructs actual recording roots and exact original date-service preimages", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, { label: "private-intake-projections" });
    const before = await census(fixture.tenant);
    const service = fixture.serviceResult.serviceProvision;
    const payment = fixture.paymentResult.paymentReceipt;
    const fresh = await runtime.withTenantTransaction(fixture.tenant, async tx => ({
      service: await new IndiaGstAccommodationServiceProvisionDateService().resolve(tx, {
        tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: fixture.reservation,
        serviceProvisionSnapshotId: service.serviceProvisionSnapshotId, serviceProvisionDate: service.serviceProvisionDate,
      }),
      payment: await new IndiaGstAccommodationPaymentReceiptDateService().resolve(tx, {
        tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: fixture.reservation,
        serviceProvisionSnapshotId: service.serviceProvisionSnapshotId,
        paymentReceiptSnapshotId: payment.paymentReceiptSnapshotId, paymentReceiptDate: payment.paymentReceiptDate,
      }),
    }));
    const actual = await privateIntake(fixture);
    expect(actual.serviceProvision).toEqual(fresh.service);
    expect(actual.paymentReceipt).toEqual(fresh.payment);
    const { created: _created, replayed: _replayed, ...ordinary } = fixture.ordinaryResult;
    expect(actual.ordinaryRegime).toEqual(ordinary);
    expect(actual.recordingRoots).toEqual({
      serviceProvisionRecording: fixture.serviceResult.evidenceHash,
      paymentReceiptRecording: fixture.paymentResult.evidenceHash,
      ordinaryRegimeRecording: fixture.ordinaryResult.evidenceHash,
    });
    const { evidenceHash: serviceHash, ...serviceBody } = fresh.service;
    const { evidenceHash: paymentHash, ...paymentBody } = fresh.payment;
    expect(actual.serviceProvisionCanonicalJson).toBe(JSON.stringify({ tenantId: fixture.tenant, ...serviceBody }));
    expect(actual.paymentReceiptCanonicalJson).toBe(JSON.stringify({ tenantId: fixture.tenant, ...paymentBody }));
    expect(new Bun.CryptoHasher("sha256").update(actual.serviceProvisionCanonicalJson).digest("hex")).toBe(serviceHash);
    expect(new Bun.CryptoHasher("sha256").update(actual.paymentReceiptCanonicalJson).digest("hex")).toBe(paymentHash);
    expect(serviceHash).not.toBe(fixture.serviceResult.evidenceHash);
    expect(paymentHash).not.toBe(fixture.paymentResult.evidenceHash);
    expect(actual.lineage.id).toBe(fixture.lineage);
    expect(actual.attributionSnapshot.snapshotHash).toBe(service.reservationLineage.snapshotHash);
    await expectSqlState(privateIntake(fixture, crypto.randomUUID()), "55000");
    await expectSqlState(privateIntake(fixture, payment.paymentReceiptSnapshotId, crypto.randomUUID()), "42501");
    expect(await census(fixture.tenant)).toEqual(before);
  }, 30_000);

  test("private historical-rate day matches real TS registry history and both canonical preimages", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, { label: "private-historical-day" });
    // Ordinary fiscal configuration prerequisite; no derived timing or tax rows.
    await deploy`INSERT INTO public.tax_assignment(tenant_id,property_node,jurisdiction_key,effective)
      VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'in-gst-lodging',daterange(NULL,NULL,'[)'))`;
    const service = new IndiaGstAccommodationHistoricalResolutionService(new ExtensionRegistry(runtimeEvents));
    const [clock] = await runtime.withTenantTransaction(fixture.tenant, tx => tx<Array<{ business_date: string }>>`
      SELECT (transaction_timestamp() AT TIME ZONE property.timezone)::date::text AS business_date
        FROM public.org_node property WHERE property.tenant_id=${fixture.tenant}::uuid
          AND property.id=${fixture.property}::uuid`);
    if (!clock) throw new Error("Actual property-local transaction clock unavailable");
    const dates = [...new Set([
      "2022-07-18", "2025-09-21", "2025-09-22", clock.business_date,
      fixture.serviceResult.serviceProvision.serviceProvisionDate,
      fixture.paymentResult.paymentReceipt.supplierBooksEntryDate,
      fixture.paymentResult.paymentReceipt.supplierBankCreditDate,
      fixture.paymentResult.paymentReceipt.paymentReceiptDate,
    ])];
    const before = await census(fixture.tenant);
    for (const businessDate of dates) {
      const expected = await runtime.withTenantTransaction(fixture.tenant,
        tx => service.resolve(tx, { propertyNode: fixture.property, businessDate }));
      const actual = await privateHistory(fixture, businessDate);
      expect(actual.evidence).toEqual(expected);
      expect(actual.evidence.assignment).toEqual({
        jurisdictionKey: "in-gst-lodging", effectiveFrom: null, effectiveTo: null,
      });
      expect(actual.evidence.selectedExtension.extensionId).toBe(businessDate < "2025-09-22" ? PREDECESSOR : SUCCESSOR);
      const { evidenceHash, ...body } = expected;
      const { evidenceHash: pairHash, ...pair } = expected.rateVersionPair;
      expect(actual.canonical_json).toBe(canonicalEvidence({ tenantId: fixture.tenant, ...body }));
      expect(actual.pair_canonical_json).toBe(canonicalEvidence({ tenantId: fixture.tenant,
        predecessorOwnerTenantId: null, successorOwnerTenantId: null, ...pair }));
      expect(new Bun.CryptoHasher("sha256").update(actual.canonical_json).digest("hex")).toBe(evidenceHash);
      expect(new Bun.CryptoHasher("sha256").update(actual.pair_canonical_json).digest("hex")).toBe(pairHash);
      expect(await privateHistory(fixture, businessDate, "Asia/Calcutta")).toEqual(actual);
    }
    expect((await privateHistory(fixture, "2025-09-21")).evidence.businessDay).toEqual({
      businessDate: "2025-09-21", fromInstant: "2025-09-20T18:30:00.000000Z", toInstant: "2025-09-21T18:30:00.000000Z",
    });
    expect((await privateHistory(fixture, "2025-09-22")).evidence.businessDay).toEqual({
      businessDate: "2025-09-22", fromInstant: "2025-09-21T18:30:00.000000Z", toInstant: "2025-09-22T18:30:00.000000Z",
    });
    expect(await census(fixture.tenant)).toEqual(before);
  }, 30_000);

  test("native timing reader is private and the six-case helper is non-authoritative date arithmetic", async () => {
    const functions = await deploy<Array<{ proname: string; owner: string; runtime_execute: boolean; app_execute: boolean; config: string[] }>>`
      SELECT p.proname,pg_get_userbyid(p.proowner) AS owner,p.proconfig AS config,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime_execute,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
        AND p.proname IN ('read_india_native_invoice_timing_source','india_native_section14_case')`;
    expect(functions).toHaveLength(2);
    for (const fn of functions) {
      expect(fn.owner).toBe("yellow_owner");
      expect(fn.runtime_execute).toBe(false);
      expect(fn.app_execute).toBe(false);
      expect(fn.config).toContain("TimeZone=UTC");
    }
    // Arithmetic-only historical vectors: none is a persisted invoice or clock override.
    const cases = [
      ["2025-09-20", "2025-09-24", "2025-09-25", "supply_before_invoice_after_payment_after", "2025-09-24", "successor"],
      ["2025-09-20", "2025-09-21", "2025-09-25", "supply_invoice_before_payment_after", "2025-09-21", "predecessor"],
      ["2025-09-20", "2025-09-24", "2025-09-21", "supply_payment_before_invoice_after", "2025-09-21", "predecessor"],
      ["2025-09-24", "2025-09-20", "2025-09-25", "supply_after_invoice_before_payment_after", "2025-09-25", "successor"],
      ["2025-09-24", "2025-09-20", "2025-09-21", "supply_after_invoice_payment_before", "2025-09-20", "predecessor"],
      ["2025-09-24", "2025-09-25", "2025-09-21", "supply_invoice_after_payment_before", "2025-09-25", "successor"],
    ] as const;
    for (const [service, invoice, payment, selectedCase, timeOfSupplyDate, selectedVersionSide] of cases) {
      const [actual] = await deploy.begin(async tx => {
        await tx`SET LOCAL ROLE yellow_owner`;
        return tx<Array<{ evidence: Mutable }>>`SELECT public.india_native_section14_case(
          ${service}::date,${invoice}::date,${payment}::date,'2025-09-22'::date) AS evidence`;
      });
      expect(actual?.evidence).toEqual({ case: selectedCase, timeOfSupplyDate, selectedVersionSide });
    }
    for (const dates of [["2025-09-22", "2025-09-24", "2025-09-25"], ["2025-09-24", "2025-09-25", "2025-09-26"]]) {
      await expectSqlState(deploy.begin(async tx => {
        await tx`SET LOCAL ROLE yellow_owner`;
        await tx`SELECT public.india_native_section14_case(${dates[0]!}::date,${dates[1]!}::date,${dates[2]!}::date,'2025-09-22'::date)`;
      }), "22023");
    }
  });

  test("private prospective ordinary timing uses authentic roots and actual transaction/property clock", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, { label: "native-timing-ordinary" });
    await deploy`INSERT INTO public.tax_assignment(tenant_id,property_node,jurisdiction_key,effective)
      VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'in-gst-lodging',daterange(NULL,NULL,'[)'))`;
    const before = await census(fixture.tenant);
    const actual = await privateTiming(fixture);
    const result = assertTimingParity(actual, fixture);
    expect(result.rateSource.kind).toBe("ordinary_section13_single_version");
    expect(result.timing.branch).toBe("section13_2_a_invoice_or_payment");
    expect(actual.invoiceSourceInput.section14PaymentEvidence).toBeNull();
    await expectSqlState(privateTiming(fixture, null, crypto.randomUUID()), "55000");
    await expectSqlState(privateTiming(fixture, { authority: "TEST_CALENDAR", sourceHash: "a".repeat(64),
      through: "2025-09-26", dates: ["2025-09-23", "2025-09-24", "2025-09-25", "2025-09-26"],
      states: ["working", "working", "working", "working"] }), "22023");
    expect(await census(fixture.tenant)).toEqual(before);
  }, 30_000);

  test("private current-clock Section14 reconstructs genuine historical intake and exact calendar boundary hashes", async () => {
    const calendar: TimingCalendar = { authority: "ORDER434_SYNTHETIC_CALENDAR", sourceHash: "b".repeat(64),
      through: "2025-09-29", dates: ["2025-09-23", "2025-09-24", "2025-09-25", "2025-09-26", "2025-09-27", "2025-09-28", "2025-09-29"],
      states: ["working", "working", "working", "working", "non_working", "non_working", "working"] };
    const cases = [
      { label: "native-timing-safe", service: "2025-09-20", books: "2025-09-19", bank: "2025-09-21", calendar: null,
        selectedCase: "supply_payment_before_invoice_after", receipt: "2025-09-19" },
      { label: "native-timing-day-four", service: "2025-09-20", books: "2025-09-19", bank: "2025-09-26", calendar,
        selectedCase: "supply_payment_before_invoice_after", receipt: "2025-09-19" },
      { label: "native-timing-after-four", service: "2025-09-20", books: "2025-09-19", bank: "2025-09-29", calendar,
        selectedCase: "supply_before_invoice_after_payment_after", receipt: "2025-09-29" },
      { label: "native-timing-later-service", service: "2025-09-24", books: "2025-09-19", bank: "2025-09-21", calendar: null,
        selectedCase: "supply_invoice_after_payment_before", receipt: "2025-09-19" },
    ] as const;
    for (const item of cases) {
      const fixture = await createNativeSourceFixture(deploy, runtime, { label: item.label,
        serviceProvisionDate: item.service, supplierBooksEntryDate: item.books, supplierBankCreditDate: item.bank });
      await deploy`INSERT INTO public.tax_assignment(tenant_id,property_node,jurisdiction_key,effective)
        VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'in-gst-lodging',daterange(NULL,NULL,'[)'))`;
      const before = await census(fixture.tenant);
      const actual = await privateTiming(fixture, item.calendar);
      const result = assertTimingParity(actual, fixture);
      expect(result.rateSource.kind).toBe("genuine_section14_rate_change");
      if (result.rateSource.kind !== "genuine_section14_rate_change") throw new Error("Expected genuine cutover source");
      expect(result.rateSource.section14.case).toBe(item.selectedCase);
      expect(result.rateSource.section14.paymentReceiptDate).toBe(item.receipt);
      expect(result.rateSource.section14.predecessorHashes.invoiceIssue).toBe(actual.nativeTiming.evidenceHash);
      expect(result.timing.paymentReceiptDate).toBe(item.books);
      expect(result.timing.branch).toBe("section13_2_b_service_or_payment");
      if (item.calendar) {
        await expectSqlState(privateTiming(fixture), "22023");
        await expectSqlState(privateTiming(fixture, { ...calendar, through: "2025-09-28" }), "22023");
        await expectSqlState(privateTiming(fixture, { ...calendar, states: calendar.states.map(() => "non_working") }), "22023");
      }
      expect(await census(fixture.tenant)).toEqual(before);
    }
  }, 60_000);

  test("private valuation authenticates genuine stored basis, allocations and original actor across session timezones", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, {
      label: "private-valuation-roots", roomNightAmounts: ["3000", "7000"],
    });
    const charge = await fixture.postCharge("9999", "private-valuation-root-charge");
    const request = valuationInput(fixture, charge.postingRootId, "private-valuation-root-finalize");
    const result = await runtime.withTenantTransaction(fixture.tenant, tx => valuation.finalizeNative(tx, request));
    const before = await census(fixture.tenant);
    const actual = await privateValuation(fixture, result);
    expect(actual).toMatchObject({
      valuationId: result.valuationId, generation: result.generation, actorId: fixture.actor,
      requestId: request.envelope.requestId, evidenceHash: result.evidenceHash,
      nativeConsiderationBasisHash: result.nativeConsiderationBasisHash,
      basis: { kind: "india-native-consideration-basis-v1", transactionValueMinor: "9999",
        buyerPartyId: fixture.party, currency: "INR", approvalRequestId: null, approvalEvidenceHash: null },
    });
    expect(actual.sourceClosure.rootIds).toEqual([charge.postingRootId]);
    expect(actual.basis.sources).toHaveLength(1);
    expect(actual.basis.sources[0]).toMatchObject({ postingRootId: charge.postingRootId,
      currentAmountMinor: "9999", allocations: ["3000", "6999"], attestedBy: fixture.actor });
    expect(actual.basis.roomNights).toMatchObject([
      { ordinal: 0, quotedWeightMinor: "3000", transactionValueMinor: "3000" },
      { ordinal: 1, quotedWeightMinor: "7000", transactionValueMinor: "6999" },
    ]);
    expect(await privateValuation(fixture, result, "Asia/Calcutta")).toEqual(actual);
    expect(await census(fixture.tenant)).toEqual(before);
    await fixture.postCharge("1", "private-valuation-later-charge");
    const changed = await census(fixture.tenant);
    await expectSqlState(privateValuation(fixture, result), "55000");
    expect(await census(fixture.tenant)).toEqual(changed);
  }, 30_000);

  test("private valuation retains a real corrected original and contra root in the complete hash basis", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, {
      label: "private-valuation-correction", roomNightAmounts: ["5000", "5000"],
    });
    const stay = await fixture.postCharge("10000", "private-correction-stay");
    const wrong = await fixture.postCharge("2000", "private-correction-wrong");
    const contra = await runtime.withTenantTransaction(fixture.tenant, async tx => {
      const reversed = await corrections.reverseCharge(tx, {
        tenantId: fixture.tenant, folioId: fixture.folio,
        reversesJournalId: wrong.result.journalId, reason: "Duplicate charge corrected before valuation",
        postSealAuthorized: false,
        idempotencyKey: "private-correction-reverse", envelope: createAuditEnvelope({
          tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
          requestId: crypto.randomUUID(), operation: "journal.posted",
        }),
      });
      const [line] = await tx<Array<{ id: string }>>`SELECT id::text FROM posting_line
        WHERE tenant_id=${fixture.tenant}::uuid AND journal_id=${reversed.journalId}::uuid
          AND account_id=${fixture.guestAccount}::uuid`;
      if (!line) throw new Error("Actual correction guest root missing");
      return line.id;
    });
    const ordinary = valuationInput(fixture, stay.postingRootId, "private-correction-finalize");
    const sources = [stay.postingRootId, wrong.postingRootId, contra].map(postingRootId => ({
      ...ordinary.sources[0]!, postingRootId,
      sourceKind: postingRootId === contra ? "promotion_discount" as const : "room_consideration" as const,
      evidenceReference: `private-correction-source:${postingRootId}`,
    }));
    const request = deepFreeze({ ...ordinary, sources });
    const result = await runtime.withTenantTransaction(fixture.tenant, tx => valuation.finalizeNative(tx, request));
    const before = await census(fixture.tenant);
    const actual = await privateValuation(fixture, result);
    expect(actual.evidenceHash).toBe(result.evidenceHash);
    expect(actual.nativeConsiderationBasisHash).toBe(result.nativeConsiderationBasisHash);
    expect(actual.sourceClosure.rootIds).toEqual([stay.postingRootId, wrong.postingRootId, contra].sort());
    expect(actual.basis.sources).toHaveLength(3);
    expect(actual.basis.sources.find(source => source.postingRootId === contra)).toMatchObject({
      sourceKind: "promotion_discount", currentAmountMinor: "-2000", allocations: ["-1000", "-1000"],
    });
    expect(actual.basis.transactionValueMinor).toBe("10000");
    expect(actual.basis.roomNights.map(night => night.transactionValueMinor)).toEqual(["5000", "5000"]);
    expect(await census(fixture.tenant)).toEqual(before);
  }, 30_000);

  test("private preview keeps component-first rounding-to-zero and uses final rather than quoted slab", async () => {
    const zeroFixture = await createNativeSourceFixture(deploy, runtime, {
      label: "private-preview-zero",
      roomNightAmounts: ["20"],
    });
    const zeroValuation = await finalize(zeroFixture, "1", "private-preview-zero");
    const zero = await privatePreview(zeroFixture, zeroValuation, SUCCESSOR, "cgst_sgst");
    expect(zero).toMatchObject({
      transactionValueMinor: "1",
      componentAmountsMinor: ["0", "0"],
      taxMinor: "0",
      grandTotalMinor: "1",
      roomNights: [{
        transactionValueMinor: "1",
        slab: {
          uptoMinor: 750000,
          aggregateRateBasisPoints: 500,
          components: [
            { identity: "cgst", rateBasisPoints: 250, taxMinor: "0" },
            { identity: "sgst", rateBasisPoints: 250, taxMinor: "0" },
          ],
        },
        taxMinor: "0",
      }],
    });

    const crossedFixture = await createNativeSourceFixture(deploy, runtime, {
      label: "private-preview-crossed",
      roomNightAmounts: ["10000"],
    });
    const crossedValuation = await finalize(crossedFixture, "800000", "private-preview-crossed");
    const [quoted] = await deploy<Array<{ amount: string }>>`
      SELECT snapshot->'revenueLine'->'roomNights'->0->>'amountMinor' AS amount
        FROM tax_attribution_snapshot
       WHERE tenant_id=${crossedFixture.tenant}::uuid
         AND id=${crossedFixture.attribution}::uuid
    `;
    const crossed = await privatePreview(crossedFixture, crossedValuation, SUCCESSOR, "igst");
    expect(quoted?.amount).toBe("10000");
    expect(crossed).toMatchObject({
      transactionValueMinor: "800000",
      componentAmountsMinor: ["144000"],
      taxMinor: "144000",
      grandTotalMinor: "944000",
      roomNights: [{
        transactionValueMinor: "800000",
        slab: {
          uptoMinor: null,
          aggregateRateBasisPoints: 1800,
          components: [{ identity: "igst", rateBasisPoints: 1800, taxMinor: "144000" }],
        },
        taxMinor: "144000",
      }],
    });
  }, 30_000);

  test("private preview retains all 366 native valuation nights and component sums", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, {
      label: "private-preview-366",
      roomNightAmounts: Array.from({ length: 366 }, () => "20"),
    });
    const finalValuation = await finalize(fixture, "7320", "private-preview-366");
    const preview = await privatePreview(fixture, finalValuation, SUCCESSOR, "cgst_sgst");
    expect(preview.roomNights).toHaveLength(366);
    expect(preview.persistenceRoomNights).toHaveLength(366);
    expect(preview.roomNights[0]).toMatchObject({ ordinal: "0", transactionValueMinor: "20" });
    expect(preview.roomNights[365]).toMatchObject({ ordinal: "365", transactionValueMinor: "20" });
    expect(preview).toMatchObject({
      transactionValueMinor: "7320",
      componentAmountsMinor: ["366", "366"],
      taxMinor: "732",
      grandTotalMinor: "8052",
    });
    expect(JSON.parse(preview.roomNightsCanonicalJson)).toEqual(preview.roomNights);
  }, 30_000);

  test("private quoted-tax composer is owner-only, write-free, lock-free, and explicitly not full preparation", async () => {
    const [fn] = await deploy<Array<{ owner: string; volatility: string; arguments: string; result: string;
      app: boolean; runtime: boolean; public: boolean; definition: string }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner,p.provolatile::text AS volatility,
        oidvectortypes(p.proargtypes) AS arguments,pg_get_function_result(p.oid) AS result,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime,
        has_function_privilege('public',p.oid,'EXECUTE') AS public,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='compose_india_native_quoted_tax_source'`;
    expect(fn).toMatchObject({ owner: "yellow_owner", volatility: "v",
      arguments: "uuid, uuid, uuid, uuid, uuid, text, text, text", result: "jsonb",
      app: false, runtime: false, public: false });
    expect(fn!.definition).toContain("not complete preparation authenticity");
    expect(fn!.definition).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE|CALL)\b|pg_advisory|FOR\s+(?:UPDATE|SHARE)/i);
  });

  test("keeps quoted-tax persistence owner-private and bounded to reconstructed source rows", async () => {
    const [fn] = await deploy<Array<{ owner: string; securityDefiner: boolean; volatility: string;
      arguments: string; result: string; app: boolean; runtime: boolean; public: boolean; definition: string }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS "securityDefiner",
        p.provolatile::text AS volatility,oidvectortypes(p.proargtypes) AS arguments,
        pg_get_function_result(p.oid) AS result,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime,
        has_function_privilege('public',p.oid,'EXECUTE') AS public,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='persist_india_native_quoted_tax_source'`;
    expect(fn).toMatchObject({ owner: "yellow_owner", securityDefiner: false, volatility: "v",
      arguments: "uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, bigint, uuid, text, text, text, text, text, text, text",
      result: "jsonb", app: false, runtime: false, public: false });
    expect(fn!.definition).toContain("india_native_preparation_source_basis");
    expect(fn!.definition).toMatch(/v_basis\s*->>\s*'sourceBasisHash'(?:\:\:text)?\s+IS DISTINCT FROM p_native_source_basis_hash/);
    for (const table of [
      "india_gst_native_invoice_timing",
      "india_gst_accommodation_quoted_rate_applicability",
      "india_gst_accommodation_quoted_rate_applicability_room_night",
      "india_gst_accommodation_quoted_rate_component",
      "india_gst_accommodation_final_component_tax",
      "india_gst_accommodation_final_component_tax_room_night",
      "india_gst_accommodation_final_component_tax_component",
    ]) expect(fn!.definition).toContain(`INSERT INTO public.${table}`);
    expect(fn!.definition).not.toMatch(/INSERT\s+INTO\s+public\.(?:outbox|fact_log|document|india_gst_accommodation_final_component_tax_journal_binding)/i);
    expect(fn!.definition).not.toMatch(/pg_advisory|FOR\s+(?:UPDATE|SHARE)/i);
  });

  test("keeps the persisted projection assertion private, stable, exact-set based, and read-only", async () => {
    const [fn] = await deploy<Array<{ owner: string; securityDefiner: boolean; volatility: string;
      arguments: string; result: string; app: boolean; runtime: boolean; public: boolean; definition: string }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS "securityDefiner",
        p.provolatile::text AS volatility,oidvectortypes(p.proargtypes) AS arguments,
        pg_get_function_result(p.oid) AS result,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime,
        has_function_privilege('public',p.oid,'EXECUTE') AS public,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='assert_india_native_persisted_tax_projection'`;
    expect(fn).toMatchObject({ owner: "yellow_owner", securityDefiner: false, volatility: "s",
      arguments: "uuid, uuid, text, text, jsonb, text, text, jsonb", result: "void",
      app: false, runtime: false, public: false });
    expect(fn!.definition).toContain("compose_india_native_quoted_tax_source");
    expect(fn!.definition).toContain("read_india_native_valuation_evidence");
    expect(fn!.definition.match(/EXCEPT ALL/g)).toHaveLength(8);
    expect(fn!.definition).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE|CALL)\b|pg_advisory|FOR\s+(?:UPDATE|SHARE)/i);
  });

  async function rollbackPersistedTaxProjection(
    fixture: NativeSourceFixture,
    finalValuation: IndiaGstAccommodationNativeFinalValuationResult,
    statutory: NativeStatutorySelectors,
    calendar: TimingCalendar | null,
    expectedRateKind: "ordinary_section13_single_version" | "genuine_section14_rate_change",
    proofLabel: string,
  ): Promise<void> {
    const seriesId = crypto.randomUUID();
    const prefix = "N434P";
    const [series] = await deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      return tx<Array<NativeFiscalSeriesIdentity>>`
        INSERT INTO public.document_series(tenant_id,id,property_node,kind,prefix,next_no,fiscal,
          supplier_registration_id,financial_year_start)
        SELECT ${fixture.tenant}::uuid,${seriesId}::uuid,property.id,'invoice',${prefix},1,true,
          ${statutory.seller.registrationId}::uuid,
          make_date(date_part('year',local_clock.issue_date)::integer
            -CASE WHEN date_part('month',local_clock.issue_date)<4 THEN 1 ELSE 0 END,4,1)
        FROM public.org_node property
        CROSS JOIN LATERAL (SELECT (transaction_timestamp() AT TIME ZONE property.timezone)::date AS issue_date) local_clock
        WHERE property.tenant_id=${fixture.tenant}::uuid AND property.id=${fixture.property}::uuid
        RETURNING tenant_id::text AS "tenantId",property_node::text AS "propertyNode",
          id::text AS "seriesId",supplier_registration_id::text AS "supplierRegistrationId",
          kind,prefix,fiscal,financial_year_start::text AS "financialYearStart"`;
    });
    if (!series) throw new Error("Native persistence proof fiscal series missing");
    const before = await census(fixture.tenant);
    const timingId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const applicabilityId = crypto.randomUUID();
    const taxId = crypto.randomUUID();
    const bindingId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const requestKeyHash = insertionHash(`${proofLabel}-key`);
    const requestHash = insertionHash(`${proofLabel}-request`);
    const rollback = "ORDER434_EXPECTED_QUOTED_TAX_PERSISTENCE_ROLLBACK";
    let caught: unknown;
    try {
      await deploy.begin(async tx => {
        await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
        await tx`SET LOCAL ROLE yellow_owner`;
        const [timingRow] = await tx<Array<{ evidence: NativeTimingSource }>>`
          SELECT public.read_india_native_invoice_timing_source(
            ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
            ${fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId}::uuid,
            ${fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId}::uuid,
            ${fixture.ordinaryResult.ordinaryRegimeEvidenceId}::uuid,
            ${timingId}::uuid,${documentId}::uuid,${calendar?.authority ?? null}::text,
            ${calendar?.sourceHash ?? null}::text,${calendar?.through ?? null}::date,
            ${`{${calendar?.dates.join(",") ?? ""}}`}::date[],
            ${`{${calendar?.states.join(",") ?? ""}}`}::text[]) AS evidence`;
        if (!timingRow) throw new Error("Native persistence proof timing source missing");
        const [statutoryRow] = await tx<Array<{ prepared_source_json: string; service_supply_nature_json: string }>>`
          SELECT prepared_source_json,service_supply_nature_json
          FROM public.read_india_native_statutory_root_graph(
            ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
            ${fixture.folio}::uuid,${finalValuation.valuationId}::uuid,
            ${statutory.location.supplierServiceLocationId}::uuid,
            ${statutory.supplierStatusId}::uuid,${statutory.supplierSez.supplierSezStatusId}::uuid,
            ${statutory.recipient.registrationId}::uuid,${statutory.recipientSez.recipientSezStatusId}::uuid,
            ${statutory.classificationId}::uuid,${timingRow.evidence.invoiceSourceResultCanonicalJson},
            ${JSON.stringify(statutory.jurisdiction)})`;
        if (!statutoryRow) throw new Error("Native persistence proof statutory source missing");
        const [compositionRow] = await tx<Array<{ evidence: NativeQuotedTaxComposition }>>`
          SELECT public.compose_india_native_quoted_tax_source(
            ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
            ${fixture.folio}::uuid,${finalValuation.valuationId}::uuid,
            ${timingRow.evidence.invoiceSourceInputCanonicalJson},
            ${timingRow.evidence.invoiceSourceResultCanonicalJson},
            ${statutoryRow.service_supply_nature_json}) AS evidence`;
        const [valuationRow] = await tx<Array<{ evidence: NativeValuationEvidence }>>`
          SELECT public.read_india_native_valuation_evidence(
            ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
            ${fixture.folio}::uuid,${finalValuation.valuationId}::uuid,
            ${fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId}::uuid,
            ${fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId}::uuid,
            ${fixture.ordinaryResult.ordinaryRegimeEvidenceId}::uuid) AS evidence`;
        if (!compositionRow || !valuationRow) throw new Error("Native persistence proof composition missing");
        const timing = timingRow.evidence.invoiceSourceResult.timing;
        const context = {
          tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: fixture.reservation,
          folioId: fixture.folio, actorId: fixture.actor, valuationId: finalValuation.valuationId,
          nativeTimingId: timing.nativeTimingId, prospectiveDocumentId: timing.prospectiveDocumentId,
          seriesId, applicabilityId, taxId, accountingBindingId: bindingId, requestId,
          requestKeyHash, requestHash, requestEventId: eventId,
          issuingTransactionId: timingRow.evidence.transactionContext.issuingTransactionId,
          transactionTimestamp: timingRow.evidence.transactionContext.transactionTimestamp,
          propertyTimezone: timingRow.evidence.transactionContext.propertyTimezone,
          invoiceIssueDate: timingRow.evidence.transactionContext.invoiceIssueDate,
        };
        const [basisRow] = await tx<Array<{ evidence: NativePreparationBasis }>>`
          SELECT public.india_native_preparation_source_basis(
            ${JSON.stringify(context)}::jsonb,
            ${timingRow.evidence.invoiceSourceInputCanonicalJson},
            ${timingRow.evidence.invoiceSourceResultCanonicalJson},
            ${JSON.stringify(valuationRow.evidence)}::jsonb,
            ${statutoryRow.prepared_source_json},${statutoryRow.service_supply_nature_json},
            ${JSON.stringify(compositionRow.evidence)}::jsonb,${JSON.stringify(series)}::jsonb) AS evidence`;
        if (!basisRow) throw new Error("Native persistence proof source basis missing");
        const [persisted] = await tx<Array<{ evidence: Readonly<{ nativeTimingId: string; applicabilityId: string;
          taxId: string; requestEventPayloadHash: string; sourceBasisHash: string }> }>>`
          SELECT public.persist_india_native_quoted_tax_source(
            ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
            ${fixture.folio}::uuid,${finalValuation.valuationId}::uuid,${fixture.actor}::uuid,
            ${requestId}::uuid,${seriesId}::uuid,${applicabilityId}::uuid,${taxId}::uuid,
            ${bindingId}::uuid,43476001::bigint,${eventId}::uuid,${requestKeyHash},${requestHash},
            ${basisRow.evidence.sourceBasisHash},${timingRow.evidence.invoiceSourceInputCanonicalJson},
            ${timingRow.evidence.invoiceSourceResultCanonicalJson},${statutoryRow.prepared_source_json},
            ${statutoryRow.service_supply_nature_json}) AS evidence`;
        if (!persisted) throw new Error("Native persistence proof returned no row");
        const readProjection = async (): Promise<Mutable> => {
          const [row] = await tx<Array<{ evidence: Mutable }>>`
            SELECT jsonb_build_object(
              'app',to_jsonb(a),'tax',to_jsonb(t),
              'appNights',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ordinal)
                FROM india_gst_accommodation_quoted_rate_applicability_room_night x
                WHERE x.tenant_id=n.tenant_id AND x.applicability_id=a.id),'[]'::jsonb),
              'appComponents',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.room_night_ordinal,x.component_ordinal)
                FROM india_gst_accommodation_quoted_rate_component x
                WHERE x.tenant_id=n.tenant_id AND x.applicability_id=a.id),'[]'::jsonb),
              'taxNights',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ordinal)
                FROM india_gst_accommodation_final_component_tax_room_night x
                WHERE x.tenant_id=n.tenant_id AND x.tax_id=t.id),'[]'::jsonb),
              'taxComponents',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.room_night_ordinal,x.component_ordinal)
                FROM india_gst_accommodation_final_component_tax_component x
                WHERE x.tenant_id=n.tenant_id AND x.tax_id=t.id),'[]'::jsonb)) AS evidence
            FROM india_gst_native_invoice_timing n
            JOIN india_gst_accommodation_quoted_rate_applicability a
              ON a.tenant_id=n.tenant_id AND a.id=n.applicability_id AND a.native_timing_id=n.id
            JOIN india_gst_accommodation_final_component_tax t
              ON t.tenant_id=n.tenant_id AND t.id=n.tax_id AND t.native_timing_id=n.id
            WHERE n.tenant_id=${fixture.tenant}::uuid AND n.id=${timingId}::uuid`;
          if (!row) throw new Error("Native persisted projection snapshot missing");
          return row.evidence;
        };
        const beforeAssertion = await readProjection();
        const [validated] = await tx<Array<{ validated: "" }>>`
          SELECT public.assert_india_native_persisted_tax_projection(
            ${fixture.tenant}::uuid,${timingId}::uuid,
            ${timingRow.evidence.invoiceSourceInputCanonicalJson},
            ${timingRow.evidence.invoiceSourceResultCanonicalJson},
            ${JSON.stringify(valuationRow.evidence)}::jsonb,${statutoryRow.prepared_source_json},
            ${statutoryRow.service_supply_nature_json},${JSON.stringify(compositionRow.evidence)}::jsonb) AS validated`;
        // Bun's PostgreSQL codec exposes the successful void result as an empty
        // string; the complete before/after row snapshots prove no side effect.
        expect(validated).toEqual({ validated: "" });
        expect(await readProjection()).toEqual(beforeAssertion);
        const [graph] = await tx<Array<{ timingId: string; applicabilityId: string; taxId: string;
          sourceBasisHash: string; timingEvidenceHash: string; rateKind: string; timeOfSupplyDate: string;
          paymentReceiptDate: string; rateChangeDate: string | null; selectedVersionSide: string | null;
          section14Case: string | null; calendarDays: number; appEvidenceHash: string; taxEvidenceHash: string;
          transactionValueMinor: string; taxMinor: string; grandTotalMinor: string;
          appNights: number; appComponents: number; taxNights: number; taxComponents: number;
          appRecordedWithTiming: boolean; taxRecordedWithTiming: boolean }>>`
          SELECT n.id::text AS "timingId",a.id::text AS "applicabilityId",t.id::text AS "taxId",
            n.native_source_basis_hash AS "sourceBasisHash",n.evidence_hash AS "timingEvidenceHash",
            a.rate_selection_kind AS "rateKind",a.time_of_supply_date::text AS "timeOfSupplyDate",
            a.payment_receipt_date::text AS "paymentReceiptDate",a.rate_change_date::text AS "rateChangeDate",
            a.selected_version_side AS "selectedVersionSide",a.section14_case AS "section14Case",
            cardinality(a.calendar_dates)::int AS "calendarDays",a.evidence_hash AS "appEvidenceHash",
            t.evidence_hash AS "taxEvidenceHash",t.transaction_value_minor::text AS "transactionValueMinor",
            t.tax_minor::text AS "taxMinor",t.grand_total_minor::text AS "grandTotalMinor",
            (SELECT count(*)::int FROM india_gst_accommodation_quoted_rate_applicability_room_night x
              WHERE x.tenant_id=n.tenant_id AND x.applicability_id=a.id) AS "appNights",
            (SELECT count(*)::int FROM india_gst_accommodation_quoted_rate_component x
              WHERE x.tenant_id=n.tenant_id AND x.applicability_id=a.id) AS "appComponents",
            (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_room_night x
              WHERE x.tenant_id=n.tenant_id AND x.tax_id=t.id) AS "taxNights",
            (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_component x
              WHERE x.tenant_id=n.tenant_id AND x.tax_id=t.id) AS "taxComponents",
            a.recorded_at=n.transaction_timestamp AS "appRecordedWithTiming",
            t.recorded_at=n.transaction_timestamp AS "taxRecordedWithTiming"
          FROM india_gst_native_invoice_timing n
          JOIN india_gst_accommodation_quoted_rate_applicability a
            ON a.tenant_id=n.tenant_id AND a.id=n.applicability_id AND a.native_timing_id=n.id
          JOIN india_gst_accommodation_final_component_tax t
            ON t.tenant_id=n.tenant_id AND t.id=n.tax_id AND t.applicability_id=a.id AND t.native_timing_id=n.id
          WHERE n.tenant_id=${fixture.tenant}::uuid AND n.id=${timingId}::uuid`;
        const quote = JSON.parse(compositionRow.evidence.quotedApplicabilityCanonicalJson) as IndiaGstAccommodationNativeQuotedRateApplicabilityResult;
        const tax = JSON.parse(compositionRow.evidence.finalTaxCanonicalJson) as IndiaGstAccommodationNativeFinalComponentTaxResult;
        const rateSource = timingRow.evidence.invoiceSourceResult.rateSource;
        expect(rateSource.kind).toBe(expectedRateKind);
        const branchProjection = rateSource.kind === "genuine_section14_rate_change" ? {
          paymentReceiptDate: rateSource.section14.paymentReceiptDate,
          rateChangeDate: rateSource.section14.rateChangeDate,
          selectedVersionSide: rateSource.section14.selectedVersionSide,
          section14Case: rateSource.section14.case,
          calendarDays: calendar?.dates.length ?? 0,
        } : {
          paymentReceiptDate: timing.paymentReceiptDate,
          rateChangeDate: null,
          selectedVersionSide: null,
          section14Case: null,
          calendarDays: 0,
        };
        const basisPreimage = JSON.parse(basisRow.evidence.preimageCanonicalJson) as Mutable;
        const expectedEventPayloadHash = new Bun.CryptoHasher("sha256").update(canonicalEvidence({
          nativeTimingId: timingId, documentId, taxId, applicabilityId,
          valuationId: finalValuation.valuationId, reservationId: fixture.reservation,
          folioId: fixture.folio, sourceBasisHash: basisRow.evidence.sourceBasisHash,
        })).digest("hex");
        expect(persisted.evidence).toMatchObject({ nativeTimingId: timingId, applicabilityId, taxId,
          requestEventPayloadHash: expectedEventPayloadHash, sourceBasisHash: basisRow.evidence.sourceBasisHash });
        expect(basisRow.evidence.preimageCanonicalJson).toBe(canonicalEvidence(basisPreimage));
        expect(new Bun.CryptoHasher("sha256").update(basisRow.evidence.preimageCanonicalJson).digest("hex"))
          .toBe(basisRow.evidence.sourceBasisHash);
        expect(basisPreimage).toMatchObject({ kind: "india-native-fiscal-preparation-source-v1",
          context, seriesIdentity: series, valuationEvidence: valuationRow.evidence,
          quotedTaxComposition: compositionRow.evidence });
        expect(graph).toMatchObject({ timingId, applicabilityId, taxId,
          sourceBasisHash: basisRow.evidence.sourceBasisHash,
          timingEvidenceHash: timingRow.evidence.nativeTiming.evidenceHash,
          rateKind: expectedRateKind,
          timeOfSupplyDate: timing.timeOfSupplyDate,
          ...branchProjection,
          appEvidenceHash: quote.evidenceHash, taxEvidenceHash: tax.evidenceHash,
          transactionValueMinor: "10000", taxMinor: "500", grandTotalMinor: "10500",
          appNights: 2, appComponents: 4, taxNights: 2, taxComponents: 4,
          appRecordedWithTiming: true, taxRecordedWithTiming: true });
        throw new Error(rollback);
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as Error | undefined)?.message).toBe(rollback);
    const [remaining] = await deploy<Array<{ timing: number; applicability: number; tax: number }>>`
      SELECT (SELECT count(*)::int FROM india_gst_native_invoice_timing
                WHERE tenant_id=${fixture.tenant}::uuid AND id=${timingId}::uuid) AS timing,
             (SELECT count(*)::int FROM india_gst_accommodation_quoted_rate_applicability
                WHERE tenant_id=${fixture.tenant}::uuid AND id=${applicabilityId}::uuid) AS applicability,
             (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax
                WHERE tenant_id=${fixture.tenant}::uuid AND id=${taxId}::uuid) AS tax`;
    expect(remaining).toEqual({ timing: 0, applicability: 0, tax: 0 });
    expect(await census(fixture.tenant)).toEqual(before);
  }

  test("persists and exact-matches the reconstructed ordinary tax graph only inside a rollback proof", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, {
      label: "private-persist-ordinary", roomNightAmounts: ["5000", "5000"],
    });
    // The fixture's actual payment root is 10,500 gross: 10,000 quoted
    // consideration plus its exact synthetic 5% tax.
    const finalValuation = await finalize(fixture, "10000", "private-persist-ordinary");
    const statutory = await createNativeStatutoryFixture(deploy, fixture);
    await rollbackPersistedTaxProjection(fixture, finalValuation, statutory, null,
      "ordinary_section13_single_version", "private-persist-ordinary");
  }, 30_000);

  test("persists and exact-matches distinct genuine Section14 projections only inside a rollback proof", async () => {
    const calendar: TimingCalendar = {
      authority: "ORDER434_PERSIST_CALENDAR", sourceHash: "e".repeat(64), through: "2025-09-26",
      dates: ["2025-09-23", "2025-09-24", "2025-09-25", "2025-09-26"],
      states: ["working", "working", "working", "working"],
    };
    const fixture = await createNativeSourceFixture(deploy, runtime, {
      label: "private-persist-genuine", roomNightAmounts: ["5000", "5000"],
      serviceProvisionDate: "2025-09-20", supplierBooksEntryDate: "2025-09-25",
      supplierBankCreditDate: "2025-09-26",
    });
    const finalValuation = await finalize(fixture, "10000", "private-persist-genuine");
    const prepared = await createNativeStatutoryFixture(deploy, fixture);
    const timingSupplierStatusId = crypto.randomUUID();
    await deploy`INSERT INTO public.india_gst_supplier_registration_status_snapshot(
      tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      VALUES(${fixture.tenant}::uuid,${timingSupplierStatusId}::uuid,${prepared.seller.registrationId}::uuid,
        ${prepared.seller.evidenceHash},${fixture.serviceResult.serviceProvision.serviceProvisionDate}::date,
        'active','regular','gst_common_portal',${prepared.gst.evidenceSha256},
        'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')`;
    const statutory: NativeStatutorySelectors = Object.freeze({ ...prepared,
      supplierStatusId: timingSupplierStatusId,
      supplierSez: prepared.serviceSupplier, recipientSez: prepared.serviceRecipient });
    await rollbackPersistedTaxProjection(fixture, finalValuation, statutory, calendar,
      "genuine_section14_rate_change", "private-persist-genuine");
  }, 30_000);

  test("private ordinary quoted-tax composition byte-matches pure family and levy replay plus TS source hashes", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, { label: "private-compose-ordinary" });
    const finalValuation = await finalize(fixture, "10000", "private-compose-ordinary");
    const statutory = await createNativeStatutoryFixture(deploy, fixture);
    const before = await census(fixture.tenant);
    const actual = await privateQuotedTax(fixture, finalValuation, statutory);
    const serviceNature = deepFreeze(JSON.parse(actual.statutory.service_supply_nature_json));
    const family = deriveIndiaGstAccommodationComponentFamily(deepFreeze({
      tenantId: fixture.tenant, supplyNature: serviceNature,
    })) as IndiaGstAccommodationComponentFamilyResult;
    const history = deepFreeze((await privateHistory(fixture, fixture.serviceResult.serviceProvision.serviceProvisionDate)).evidence);
    const levy = deriveIndiaGstAccommodationLevyInputBundle(deepFreeze({
      tenantId: fixture.tenant, historicalResolution: history, supplyNature: serviceNature, componentFamily: family,
    })) as IndiaGstAccommodationLevyInputBundleResult;
    const identity = deriveIndiaGstAccommodationLevyComponentIdentity(deepFreeze({
      tenantId: fixture.tenant, historicalResolution: history, supplyNature: serviceNature,
      componentFamily: family, levyInputBundle: levy,
    })) as IndiaGstAccommodationLevyComponentIdentityResult;
    expect(actual.evidence.componentFamilyCanonicalJson).toBe(JSON.stringify(family));
    expect(actual.evidence.levyInputBundleCanonicalJson).toBe(JSON.stringify(levy));
    expect(actual.evidence.levyComponentIdentityCanonicalJson).toBe(JSON.stringify(identity));
    expect(identity.componentFamily).toBe("cgst_sgst");

    const quoted = JSON.parse(actual.evidence.quotedApplicabilityCanonicalJson) as IndiaGstAccommodationNativeQuotedRateApplicabilityResult;
    const { evidenceHash: quotedHash, ...quotedBody } = quoted;
    expect(quotedHash).toBe(insertionHash({ tenantId: fixture.tenant, propertyNode: fixture.property,
      reservationId: fixture.reservation, folioId: fixture.folio, ...quotedBody }));
    expect(quoted.rateSelection.kind).toBe("ordinary_section13_single_version");
    expect(quoted.predecessorHashes.levyComponentIdentity).toBe(identity.evidenceHash);
    expect(quoted.predecessorHashes.nativeTiming).toBe(actual.timing.invoiceSourceResult.timing.evidenceHash);
    expect(quoted.predecessorHashes.nativeTiming).not.toBe(actual.timing.nativeTiming.evidenceHash);

    const tax = JSON.parse(actual.evidence.finalTaxCanonicalJson) as IndiaGstAccommodationNativeFinalComponentTaxResult;
    const { evidenceHash: taxHash, ...taxBody } = tax;
    expect(taxHash).toBe(insertionHash({ tenant: fixture.tenant, property: fixture.property,
      reservation: fixture.reservation, folio: fixture.folio, ...taxBody }));
    expect(tax).toMatchObject({ nativeTimingId: quoted.nativeTiming.nativeTimingId,
      valuationId: finalValuation.valuationId, rateSelectionKind: "ordinary_section13_single_version",
      taxMinor: "500", grandTotalMinor: "10500" });
    expect(tax.predecessorHashes.quotedRateApplicability).toBe(quoted.evidenceHash);
    expect(actual.evidence.taxPreview.roomNightsCanonicalJson).toBe(JSON.stringify(tax.roomNights));
    expect(await census(fixture.tenant)).toEqual(before);

    await expectSqlState(privateQuotedTax(fixture, finalValuation, statutory, null, input => ({
      ...input,
      section14PaymentEvidence: { kind: "safe_ordinary_receipt", paymentProvisoEvidence: { forged: true } },
    })), "55000");
  }, 30_000);

  test("private genuine composition keeps compatible service-day levy and TOS-selected rate as distinct real graphs", async () => {
    const calendar: TimingCalendar = {
      authority: "ORDER434_SYNTHETIC_CALENDAR", sourceHash: "b".repeat(64), through: "2025-09-26",
      dates: ["2025-09-23", "2025-09-24", "2025-09-25", "2025-09-26"],
      states: ["working", "working", "working", "working"],
    };
    const fixture = await createNativeSourceFixture(deploy, runtime, { label: "private-compose-genuine",
      serviceProvisionDate: "2025-09-20", supplierBooksEntryDate: "2025-09-25",
      supplierBankCreditDate: "2025-09-26" });
    const finalValuation = await finalize(fixture, "10000", "private-compose-genuine");
    const preparedStatutory = await createNativeStatutoryFixture(deploy, fixture);
    const timingSupplierStatusId = crypto.randomUUID();
    await deploy`INSERT INTO public.india_gst_supplier_registration_status_snapshot(
      tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      VALUES(${fixture.tenant}::uuid,${timingSupplierStatusId}::uuid,${preparedStatutory.seller.registrationId}::uuid,
        ${preparedStatutory.seller.evidenceHash},${fixture.serviceResult.serviceProvision.serviceProvisionDate}::date,
        'active','regular','gst_common_portal',${preparedStatutory.gst.evidenceSha256},
        'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')`;
    const statutory = Object.freeze({ ...preparedStatutory, supplierStatusId: timingSupplierStatusId,
      supplierSez: preparedStatutory.serviceSupplier, recipientSez: preparedStatutory.serviceRecipient });
    const before = await census(fixture.tenant);
    const actual = await privateQuotedTax(fixture, finalValuation, statutory, calendar);
    const family = JSON.parse(actual.evidence.componentFamilyCanonicalJson) as IndiaGstAccommodationComponentFamilyResult;
    const identity = JSON.parse(actual.evidence.levyComponentIdentityCanonicalJson) as IndiaGstAccommodationLevyComponentIdentityResult;
    const quoted = JSON.parse(actual.evidence.quotedApplicabilityCanonicalJson) as IndiaGstAccommodationNativeQuotedRateApplicabilityResult;
    const tax = JSON.parse(actual.evidence.finalTaxCanonicalJson) as IndiaGstAccommodationNativeFinalComponentTaxResult;
    expect(family).toMatchObject({ supplyDate: "2025-09-20", componentFamily: "cgst_sgst" });
    expect(identity.selectedVersion).toMatchObject({ extensionId: PREDECESSOR, version: 1 });
    expect(quoted.rateSelection).toMatchObject({ kind: "genuine_section14_rate_change",
      timeOfSupplyDate: "2025-09-25", selectedVersionSide: "successor",
      selectedVersion: { extensionId: SUCCESSOR, version: 2 } });
    expect(quoted.nativeTiming.timeOfSupplyDate).toBe("2025-09-20");
    expect(quoted.nativeTiming.timeOfSupplyDate).not.toBe(quoted.rateSelection.timeOfSupplyDate);
    expect(quoted.predecessorHashes.levyComponentIdentity).toBe(identity.evidenceHash);
    expect(actual.statutory.service_supplier_sez_status_id).toBe(statutory.serviceSupplier.supplierSezStatusId);
    expect(actual.statutory.service_supplier_sez_status_id).not.toBe(preparedStatutory.supplierSez.supplierSezStatusId);
    expect(tax).toMatchObject({ rateSelectionKind: "genuine_section14_rate_change",
      taxMinor: "500", grandTotalMinor: "10500" });
    expect(actual.evidence.taxPreview.selectedExtensionId).toBe(SUCCESSOR);
    expect(insertionHash({ tenantId: fixture.tenant, propertyNode: fixture.property,
      reservationId: fixture.reservation, folioId: fixture.folio,
      ...Object.fromEntries(Object.entries(quoted).filter(([key]) => key !== "evidenceHash")) })).toBe(quoted.evidenceHash);
    expect(insertionHash({ tenant: fixture.tenant, property: fixture.property,
      reservation: fixture.reservation, folio: fixture.folio,
      ...Object.fromEntries(Object.entries(tax).filter(([key]) => key !== "evidenceHash")) })).toBe(tax.evidenceHash);
    expect(await census(fixture.tenant)).toEqual(before);
  }, 30_000);
});
