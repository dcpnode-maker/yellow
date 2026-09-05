import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

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
import { createAuditEnvelope, Database, PostgresIdempotency, type Tx } from "../src/kernel";
import {
  createNativeSourceFixture,
  type NativeSourceFixture,
} from "./fixtures/india-native-fiscal-source-completion-fixture";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const TENANT = id(434701);
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
  let valuation: IndiaGstAccommodationFinalValuationService;

  beforeAll(() => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    valuation = new IndiaGstAccommodationFinalValuationService({
      idempotency: new PostgresIdempotency(),
    });
  });

  afterAll(async () => {
    await runtime?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("keeps the exact two-UUID draft consumer capability withheld pending full authentication", async () => {
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
      app_execute: false,
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
});
