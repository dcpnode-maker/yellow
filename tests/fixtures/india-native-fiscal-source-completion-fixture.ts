import { SQL } from "bun";
import type { IndiaGstSupplierServiceLocationResult } from "../../src/contexts/tax-fiscal/india-gst-supplier-service-location";
import type { IndiaGstRecipientSezStatusResult } from "../../src/contexts/tax-fiscal/india-gst-recipient-sez-status";
import {
  IndiaGstAccommodationFinalValuationService,
  IndiaNativeFiscalSeriesConfigurationService,
  type IndiaNativeFiscalInvoiceCalendarEvidence,
  type IndiaNativeFiscalInvoiceIssueNativeInput,
} from "../../src/contexts/tax-fiscal";
import type { IndiaGstAccommodationNativeFinalValuationInput } from "../../src/contexts/tax-fiscal/india-gst-accommodation-final-valuation";

import {
  ChargeCorrectionService,
  ChargeService,
  FolioService,
  FolioTransferService,
  type FolioTransferInput,
  type PostChargeResult,
} from "../../src/contexts/financials";
import { createPositiveTaxAttributionSnapshot } from "../../src/contexts/tax-fiscal/attribution";
import {
  IndiaGstAccommodationOrdinaryRegimeEvidenceService,
  type IndiaGstAccommodationOrdinaryRegimeEvidenceResult,
} from "../../src/contexts/tax-fiscal/india-gst-accommodation-ordinary-regime-evidence";
import {
  IndiaGstAccommodationSourceIntakeService,
  type IndiaGstAccommodationPaymentReceiptIntakeResult,
  type IndiaGstAccommodationServiceProvisionIntakeResult,
} from "../../src/contexts/tax-fiscal/india-gst-accommodation-source-intake";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  createAuditEnvelope,
  type ConnectionPool,
} from "../../src/kernel";

const SERVICE_EVENT = "india_gst.accommodation_service_provision_recorded";
const PAYMENT_EVENT = "india_gst.accommodation_payment_receipt_recorded";
const ORDINARY_EVENT = "india_gst.accommodation_ordinary_regime_recorded";
const MAX_INT64 = 9_223_372_036_854_775_807n;
const DEFAULT_ROOM_NIGHT_AMOUNTS = Object.freeze(["10000"] as const);
const DEFAULT_TIMEZONE = "Asia/Kolkata";

export interface NativeSourceFixtureOptions {
  readonly label?: string;
  readonly roomNightAmounts?: readonly string[];
  readonly timezone?: string;
  readonly revenueAccountCount?: number;
  /** Synthetic historical source/stay prerequisites; never overrides the issue clock. */
  readonly serviceProvisionDate?: string;
  readonly supplierBooksEntryDate?: string;
  readonly supplierBankCreditDate?: string;
  /** Synthetic quote arithmetic; never changes approved production GST rules. */
  readonly quotedTaxRounding?: "exact_5_percent" | "component_half_up";
  /** Synthetic quote evidence only; production rate history remains authoritative. */
  readonly quotedTaxRateBasisPoints?: 500 | 1200 | 1800;
}

export interface NativeSourceCharge {
  readonly result: PostChargeResult;
  readonly postingRootId: string;
}

export interface NativeSourceFixture {
  readonly tenant: string;
  readonly property: string;
  readonly actor: string;
  readonly unauthorizedActor: string;
  readonly party: string;
  readonly reservation: string;
  readonly lineage: string;
  readonly attribution: string;
  readonly folio: string;
  readonly guestAccount: string;
  readonly revenueAccount: string;
  readonly revenueAccounts: readonly string[];
  readonly serviceResult: IndiaGstAccommodationServiceProvisionIntakeResult;
  readonly paymentResult: IndiaGstAccommodationPaymentReceiptIntakeResult;
  readonly ordinaryResult: IndiaGstAccommodationOrdinaryRegimeEvidenceResult;
  readonly postCharge: (
    amountMinor: string,
    key?: string,
    revenueAccountIndex?: number,
  ) => Promise<NativeSourceCharge>;
}

interface DateRow {
  readonly business_date: string;
  readonly first_night: string;
  readonly completion_date: string;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function fixtureLabel(value: string | undefined): string {
  const label = value ?? "native-source";
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(label)) {
    throw new Error("Native source fixture label must contain 1-32 ASCII letters, digits, underscores or hyphens");
  }
  return label;
}

function fixtureTimezone(value: string | undefined): string {
  const timezone = value ?? DEFAULT_TIMEZONE;
  if (timezone.length < 1 || timezone.length > 100 || /[^A-Za-z0-9_+./-]/.test(timezone)) {
    throw new Error("Native source fixture timezone is invalid");
  }
  return timezone;
}

function canonicalAmounts(values: readonly string[] | undefined,
  rounding: NativeSourceFixtureOptions["quotedTaxRounding"] = "exact_5_percent",
  rateBasisPoints: NativeSourceFixtureOptions["quotedTaxRateBasisPoints"] = 500): {
  readonly values: readonly string[];
  readonly base: bigint;
  readonly tax: bigint;
  readonly payment: bigint;
  readonly rateBasisPoints: 500 | 1200 | 1800;
} {
  const amounts = values ?? DEFAULT_ROOM_NIGHT_AMOUNTS;
  if (!Array.isArray(amounts) || amounts.length < 1 || amounts.length > 366) {
    throw new Error("Native source fixture requires between one and 366 room-night amounts");
  }
  const canonical = amounts.map((amount) => {
    if (!/^[1-9][0-9]*$/.test(amount)) {
      throw new Error("Native source fixture room-night amounts must be canonical positive minor-unit strings");
    }
    const parsed = BigInt(amount);
    if (parsed > MAX_INT64) throw new Error("Native source fixture room-night amount exceeds int64");
    return parsed;
  });
  const base = canonical.reduce((sum, amount) => sum + amount, 0n);
  if (rateBasisPoints !== 500 && rateBasisPoints !== 1200 && rateBasisPoints !== 1800) {
    throw new Error("Native source fixture quoted tax rate basis points are unsupported");
  }
  const taxNumerator = base * BigInt(rateBasisPoints);
  if (rounding !== "exact_5_percent" && rounding !== "component_half_up") {
    throw new Error("Native source fixture quoted tax rounding is unsupported");
  }
  if (base > MAX_INT64 || (rounding === "exact_5_percent" && taxNumerator % 10_000n !== 0n)) {
    throw new Error(rateBasisPoints === 500
      ? "Native source fixture requires an exact 5% synthetic quoted-tax result"
      : `Native source fixture requires an exact ${rateBasisPoints / 100}% synthetic quoted-tax result`);
  }
  const tax = rounding === "component_half_up"
    ? canonical.reduce((sum, amount) => sum + 2n * ((amount * BigInt(rateBasisPoints / 2) + 5_000n) / 10_000n), 0n)
    : taxNumerator / 10_000n;
  const payment = base + tax;
  if (tax < 0n || (rounding === "exact_5_percent" && tax < 1n) || payment > MAX_INT64) {
    throw new Error("Native source fixture quoted-tax total is outside admitted int64 bounds");
  }
  return Object.freeze({ values: Object.freeze([...amounts]), base, tax, payment, rateBasisPoints });
}

function revenueAccountCount(value: number | undefined): number {
  const count = value ?? 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > 500) {
    throw new Error("Native source fixture revenueAccountCount must be an integer between one and 500");
  }
  return count;
}

/**
 * A publish-only production outbox adapter. ChargeService publishes through the
 * real PostgresEventBus using its supplied tenant Tx; this factory never consumes
 * events and therefore does not need access to Database's deliberately private pool.
 */
function fixtureEventBus(): PostgresEventBus {
  const publishOnlyPool: ConnectionPool = Object.freeze({
    reserve: async () => {
      throw new Error("Native source fixture outbox consumption is unavailable");
    },
  });
  return new PostgresEventBus(publishOnlyPool);
}

/**
 * Seeds only canonical booking/financial prerequisites, then records the three
 * Order434 sources and any requested charge through their real runtime services.
 * The fixed 5% arithmetic is synthetic quoted-tax evidence for tests, not a live
 * or future statutory GST rate assertion.
 */
export async function createNativeSourceFixture(
  deploy: SQL,
  database: Database,
  options: NativeSourceFixtureOptions = {},
): Promise<NativeSourceFixture> {
  const label = fixtureLabel(options.label);
  const timezone = fixtureTimezone(options.timezone);
  const amounts = canonicalAmounts(options.roomNightAmounts, options.quotedTaxRounding, options.quotedTaxRateBasisPoints);
  const configuredRevenueAccountCount = revenueAccountCount(options.revenueAccountCount);
  const marker = `${label}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const pathMarker = marker.replaceAll("-", "").toLowerCase();
  const tenant = crypto.randomUUID();
  const property = crypto.randomUUID();
  const actor = crypto.randomUUID();
  const unauthorizedActor = crypto.randomUUID();
  const role = crypto.randomUUID();
  const party = crypto.randomUUID();
  const unitType = crypto.randomUUID();
  const sellable = crypto.randomUUID();
  const ratePlan = crypto.randomUUID();
  const reservation = crypto.randomUUID();
  const segment = crypto.randomUUID();
  const hold = crypto.randomUUID();
  const holdBinding = crypto.randomUUID();
  const attribution = crypto.randomUUID();
  const lineage = crypto.randomUUID();
  const guestAccount = crypto.randomUUID();
  const revenueAccounts = Object.freeze(Array.from(
    { length: configuredRevenueAccountCount },
    () => crypto.randomUUID(),
  ));
  const revenueAccount = revenueAccounts[0]!;
  const folio = crypto.randomUUID();
  const extension = crypto.randomUUID();
  const quoteHash = sha256(`order434:synthetic-quote:${marker}`);
  const contentHash = sha256(`order434:synthetic-jurisdiction:${marker}`);
  const jurisdictionKey = `in.order434.${pathMarker}`;
  const roomCodes = Object.freeze(Array.from(
    { length: configuredRevenueAccountCount },
    () => `O434_${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
  ));
  const revenueConfiguration = JSON.stringify(revenueAccounts.map((accountId, index) => Object.freeze({
    account_id: accountId,
    tx_code: roomCodes[index]!,
    name: `Room revenue ${index + 1}`,
  })));

  const [dates] = await deploy<DateRow[]>`
    SELECT
      (transaction_timestamp() AT TIME ZONE ${timezone})::date::text AS business_date,
      (COALESCE(${options.serviceProvisionDate ?? null}::date,
        (transaction_timestamp() AT TIME ZONE ${timezone})::date) - ${amounts.values.length})::date::text AS first_night,
      COALESCE(${options.serviceProvisionDate ?? null}::date,
        (transaction_timestamp() AT TIME ZONE ${timezone})::date)::text AS completion_date
  `;
  if (!dates) throw new Error("Native source fixture could not resolve property-local dates");
  const firstNight = new Date(`${dates.first_night}T00:00:00Z`);
  const roomNights = amounts.values.map((amount, index) => {
    const date = new Date(firstNight);
    date.setUTCDate(date.getUTCDate() + index);
    return Object.freeze({ businessDate: date.toISOString().slice(0, 10), amountMinor: BigInt(amount) });
  });
  const period = `[${dates.first_night}T00:00:00Z,${dates.completion_date}T00:00:00Z)`;
  const snapshot = createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash },
    currency: "INR",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: amounts.base,
      nights: amounts.values.length,
      personNights: amounts.values.length * 2,
      roomNights,
    },
    assignments: roomNights.map(({ businessDate }) => Object.freeze({
      businessDate,
      jurisdictionKey,
      evidenceRef: `tax-assignment:${sha256(`order434:assignment:${marker}:${businessDate}`)}`,
    })),
    jurisdiction: {
      extensionId: extension,
      ownerTenantId: tenant,
      key: jurisdictionKey,
      version: 1,
      contentHash,
      evidenceRef: `tax-jurisdiction:${sha256(`order434:jurisdiction:${marker}`)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey,
      country: "IN",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: amounts.base,
      baseTotalMinor: amounts.base,
      taxTotalMinor: amounts.tax,
      grandTotalMinor: amounts.payment,
      taxes: [{
        code: "GST_ROOM",
        name: "Synthetic quoted GST evidence",
        taxMinor: amounts.tax,
        components: [{
          lineId: "room",
          revenueGroup: "room_revenue",
          baseMinor: amounts.base,
          taxMinor: amounts.tax,
          rateBasisPoints: amounts.rateBasisPoints,
        }],
      }],
    },
  });

  await deploy.begin(async (tx) => {
    await tx`INSERT INTO tenant(id,slug,name,tier,status)
      VALUES(${tenant}::uuid,${`o434-${pathMarker}`} ,'Order434 native source fixture','shared','active')`;
    await tx`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
      VALUES(${property}::uuid,${tenant}::uuid,${`o434${pathMarker}.property`}::ltree,
        'property','Order434 native source fixture',${timezone},'INR')`;
    await tx`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${actor}::uuid,${tenant}::uuid,${`actor-${pathMarker}@order434.local`},'Order434 recorder','active'),
      (${unauthorizedActor}::uuid,${tenant}::uuid,${`deny-${pathMarker}@order434.local`},'Order434 ungranted actor','active')`;
    await tx`INSERT INTO permission(code,description)
      VALUES('tax-fiscal.india-valuation:finalize','Finalize governed India accommodation valuation')
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO role(id,tenant_id,name)
      VALUES(${role}::uuid,${tenant}::uuid,${`Order434 recorder ${marker}`})`;
    await tx`INSERT INTO role_permission(role_id,permission_code)
      VALUES(${role}::uuid,'tax-fiscal.india-valuation:finalize')`;
    await tx`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${tenant}::uuid,${actor}::uuid,${role}::uuid,${property}::uuid)`;
    await tx`INSERT INTO party(id,tenant_id,kind,display_name,status)
      VALUES(${party}::uuid,${tenant}::uuid,'person','Order434 guest','active')`;
    await tx`INSERT INTO party_role(tenant_id,party_id,role)
      VALUES(${tenant}::uuid,${party}::uuid,'guest')`;
    await tx`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy)
      VALUES(${unitType}::uuid,${tenant}::uuid,${property}::uuid,
        ${`U${pathMarker.slice(0, 15)}`},'Room','hotel',2)`;
    await tx`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
      VALUES(${sellable}::uuid,${tenant}::uuid,${unitType}::uuid,'Room','active')`;
    await tx`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status)
      VALUES(${ratePlan}::uuid,${tenant}::uuid,${property}::uuid,
        ${`R${pathMarker.slice(0, 15)}`},'Rate','INR',false,'active')`;
    await tx`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
      VALUES(${reservation}::uuid,${tenant}::uuid,${property}::uuid,${`O434-${pathMarker}`} ,'checked_out',${party}::uuid,'direct','INR')`;
    await tx`INSERT INTO reservation_segment(
        id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,
        adults,children,rate_plan_id,status)
      VALUES(${segment}::uuid,${tenant}::uuid,${reservation}::uuid,1,
        ${unitType}::uuid,${sellable}::uuid,${period}::tstzrange,2,'[]',${ratePlan}::uuid,'booked')`;
    await tx`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status)
      VALUES(${hold}::uuid,${tenant}::uuid,${property}::uuid,${sellable}::uuid,
        ${period}::tstzrange,'cart','{}',${dates.completion_date}::date,'consumed')`;
    await tx`INSERT INTO tax_attribution_snapshot(
        tenant_id,id,property_node,actor_id,schema_version,origin_kind,
        origin_quote_hash,snapshot_hash,currency,snapshot)
      VALUES(${tenant}::uuid,${attribution}::uuid,${property}::uuid,${actor}::uuid,1,
        'rate_quote',${quoteHash},${snapshot.snapshotHash},'INR',${JSON.stringify(snapshot)}::jsonb)`;
    await tx`INSERT INTO tax_attribution_hold_binding(
        tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,
        period,origin_quote_hash,snapshot_hash,currency)
      VALUES(${tenant}::uuid,${holdBinding}::uuid,${property}::uuid,${actor}::uuid,
        ${hold}::uuid,${attribution}::uuid,${sellable}::uuid,${period}::tstzrange,
        ${quoteHash},${snapshot.snapshotHash},'INR')`;
    await tx`INSERT INTO tax_attribution_reservation_binding(
        tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,
        reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency)
      VALUES(${tenant}::uuid,${lineage}::uuid,${property}::uuid,${actor}::uuid,
        ${holdBinding}::uuid,${hold}::uuid,${attribution}::uuid,${reservation}::uuid,
        ${segment}::uuid,${sellable}::uuid,${period}::tstzrange,
        ${quoteHash},${snapshot.snapshotHash},'INR')`;
    await tx`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
      VALUES(${guestAccount}::uuid,${tenant}::uuid,${property}::uuid,
        'guest',${party}::uuid,'Guest account','INR','open')`;
    await tx`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
      SELECT item.account_id::uuid,${tenant}::uuid,${property}::uuid,
             'revenue',NULL,item.name,'INR','open'
      FROM jsonb_to_recordset(${revenueConfiguration}::jsonb)
        AS item(account_id text,tx_code text,name text)`;
    await tx`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status)
      VALUES(${folio}::uuid,${tenant}::uuid,${guestAccount}::uuid,${reservation}::uuid,
        ${`O434-F-${pathMarker}`},1,'Primary','open')`;
    await tx`INSERT INTO business_day(tenant_id,property_node,business_date)
      VALUES(${tenant}::uuid,${property}::uuid,${dates.business_date}::date)`;
    await tx`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
      SELECT item.tx_code,item.name,'revenue','Rooms','guest','revenue'
      FROM jsonb_to_recordset(${revenueConfiguration}::jsonb)
        AS item(account_id text,tx_code text,name text)`;
    await tx`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id)
      SELECT ${tenant}::uuid,${property}::uuid,'INR',item.tx_code,item.account_id::uuid
      FROM jsonb_to_recordset(${revenueConfiguration}::jsonb)
        AS item(account_id text,tx_code text,name text)`;
  });

  const sourceIntake = new IndiaGstAccommodationSourceIntakeService();
  const ordinaryEvidence = new IndiaGstAccommodationOrdinaryRegimeEvidenceService();
  const serviceEvidence = sha256(`order434:test-only-service-source:${label}`);
  const paymentEvidence = sha256(`order434:test-only-payment-source:${label}`);
  const ordinaryEvidenceHash = sha256(`order434:test-only-ordinary-assertion:${label}`);
  const recorded = await database.withTenantTransaction(tenant, async (tx) => {
    const serviceResult = await sourceIntake.recordServiceProvision(tx, Object.freeze({
      tenantId: tenant,
      propertyNode: property,
      reservationId: reservation,
      reservationLineageId: lineage,
      serviceProvisionDate: dates.completion_date,
      serviceProvisionSource: "governed_service_provision_record" as const,
      serviceProvisionEvidenceSha256: serviceEvidence,
      legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
      idempotencyKey: `o434-service-${label}`,
      envelope: createAuditEnvelope({
        actorId: actor,
        tenantId: tenant,
        propertyNode: property,
        requestId: crypto.randomUUID(),
        operation: SERVICE_EVENT,
      }),
    }));
    const paymentResult = await sourceIntake.recordPaymentReceipt(tx, Object.freeze({
      tenantId: tenant,
      propertyNode: property,
      reservationId: reservation,
      serviceProvisionSnapshotId: serviceResult.serviceProvision.serviceProvisionSnapshotId,
      amountMinor: amounts.payment.toString(),
      currency: "INR" as const,
      coverageScope: "full_attribution" as const,
      supplierBooksEntryDate: options.supplierBooksEntryDate ?? dates.completion_date,
      supplierBankCreditDate: options.supplierBankCreditDate ?? dates.completion_date,
      paymentReceiptSource: "governed_supplier_payment_receipt_record" as const,
      paymentReceiptEvidenceSha256: paymentEvidence,
      legalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" as const,
      idempotencyKey: `o434-payment-${label}`,
      envelope: createAuditEnvelope({
        actorId: actor,
        tenantId: tenant,
        propertyNode: property,
        requestId: crypto.randomUUID(),
        operation: PAYMENT_EVENT,
      }),
    }));
    const ordinaryResult = await ordinaryEvidence.record(tx, Object.freeze({
      tenantId: tenant,
      propertyNode: property,
      reservationId: reservation,
      serviceProvisionSnapshotId: serviceResult.serviceProvision.serviceProvisionSnapshotId,
      regime: "ordinary_rule47_30_day" as const,
      ordinaryRegimeSource: "governed_rule47_ordinary_regime_record" as const,
      legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT" as const,
      ordinaryRegimeEvidenceSha256: ordinaryEvidenceHash,
      idempotencyKey: `o434-ordinary-${label}`,
      envelope: createAuditEnvelope({
        actorId: actor,
        tenantId: tenant,
        propertyNode: property,
        requestId: crypto.randomUUID(),
        operation: ORDINARY_EVENT,
      }),
    }));
    return Object.freeze({ serviceResult, paymentResult, ordinaryResult });
  });

  const charges = new ChargeService({
    events: fixtureEventBus(),
    idempotency: new PostgresIdempotency(),
  });
  const postCharge = Object.freeze(async (
    amountMinor: string,
    key = `o434-charge-${crypto.randomUUID()}`,
    revenueAccountIndex = 0,
  ): Promise<NativeSourceCharge> => {
    if (!Number.isSafeInteger(revenueAccountIndex)
        || revenueAccountIndex < 0 || revenueAccountIndex >= roomCodes.length) {
      throw new Error("Native source fixture revenueAccountIndex is outside the configured route range");
    }
    const roomCode = roomCodes[revenueAccountIndex]!;
    return database.withTenantTransaction(tenant, async (tx) => {
      const result = await charges.postCharge(tx, Object.freeze({
        tenantId: tenant,
        folioId: folio,
        txCode: roomCode,
        amountMinor,
        idempotencyKey: key,
        envelope: createAuditEnvelope({
          actorId: actor,
          tenantId: tenant,
          propertyNode: property,
          requestId: crypto.randomUUID(),
          operation: "journal.posted",
        }),
      }));
      const rows = await tx<Array<{ id: string }>>`
        SELECT id::text
        FROM posting_line
        WHERE tenant_id=${tenant}::uuid
          AND journal_id=${result.journalId}::uuid
          AND folio_id=${folio}::uuid
          AND account_id=${guestAccount}::uuid
          AND seq=1
      `;
      const root = rows[0];
      if (rows.length !== 1 || !root) {
        throw new Error("Native source fixture charge did not expose one canonical posting root");
      }
      return Object.freeze({ result, postingRootId: root.id });
    });
  });

  return Object.freeze({
    tenant,
    property,
    actor,
    unauthorizedActor,
    party,
    reservation,
    lineage,
    attribution,
    folio,
    guestAccount,
    revenueAccount,
    revenueAccounts,
    serviceResult: recorded.serviceResult,
    paymentResult: recorded.paymentResult,
    ordinaryResult: recorded.ordinaryResult,
    postCharge,
  });
}

export interface NativeStatutoryFixtureOptions {
  readonly serviceSez?: boolean;
  readonly includeServicePair?: boolean;
  /** Date of synthetic base registration evidence, not an issue-clock override. */
  readonly statusAsOfDate?: string;
  /** Original statutory locations; the production rules derive the component family. */
  readonly originalConfiguration?: NativeStatutoryOriginalConfiguration;
}

export type NativeStatutoryOriginalConfiguration =
  | "karnataka_supplier_karnataka_property"
  | "chandigarh_supplier_chandigarh_property"
  | "maharashtra_supplier_karnataka_property";

function statutoryStateConfiguration(configuration: NativeStatutoryOriginalConfiguration | undefined) {
  switch (configuration ?? "karnataka_supplier_karnataka_property") {
    case "karnataka_supplier_karnataka_property":
      return Object.freeze({ supplier: "29", property: "29", recipient: "29" });
    case "chandigarh_supplier_chandigarh_property":
      return Object.freeze({ supplier: "04", property: "04", recipient: "04" });
    case "maharashtra_supplier_karnataka_property":
      return Object.freeze({ supplier: "27", property: "29", recipient: "29" });
  }
}
function freezeStatutoryFixture<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) freezeStatutoryFixture(nested);
    Object.freeze(value);
  }
  return value;
}
function fixtureStatutoryHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}
function fixtureStatutoryGstin(state: string, body = "ABCDE1234F1Z"): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", prefix = state + body;
  let factor = 2, sum = 0;
  for (let i = prefix.length - 1; i >= 0; i--) {
    const addend = factor * alphabet.indexOf(prefix[i]!);
    sum += Math.floor(addend / 36) + addend % 36;
    factor = factor === 2 ? 1 : 2;
  }
  return prefix + alphabet[(36 - sum % 36) % 36];
}

/** Adds synthetic statutory configuration and dated official-evidence prerequisites
 * to an actual native source fixture; creates no timing, tax, binding or document. */
export async function createNativeStatutoryFixture(deploy: SQL, fixture: NativeSourceFixture,
  options: NativeStatutoryFixtureOptions = {}) {
  const serviceSez = options.serviceSez ?? false;
  const includeServicePair = options.includeServicePair ?? true;
  const state = statutoryStateConfiguration(options.originalConfiguration);
  const sellerId = crypto.randomUUID(), recipientId = crypto.randomUUID(), locationId = crypto.randomUUID();
  const supplierStatusId = crypto.randomUUID(), supplierSezId = crypto.randomUUID(), recipientSezId = crypto.randomUUID();
  const classificationId = crypto.randomUUID();
  const serviceDate = fixture.serviceResult.serviceProvision.serviceProvisionDate;
  const tos = options.statusAsOfDate ?? fixture.paymentResult.paymentReceipt.paymentReceiptDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tos)) throw new Error("Synthetic statutory status date must be a civil date");
  if (serviceSez && serviceDate === tos) throw new Error("Distinct service-day SEZ fixture requires different service/TOS dates");
  await deploy`INSERT INTO public.tax_assignment(tenant_id,property_node,jurisdiction_key,effective)
    VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'in-gst-lodging',daterange(NULL,NULL,'[)'))`;
  const [history] = await deploy.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
    await tx`SET LOCAL ROLE yellow_owner`;
    return tx<Array<{ member: { extensionId: string; key: string; version: number; contentHash: string } }>>`
      SELECT public.read_india_native_rate_history_day(${fixture.tenant}::uuid,${fixture.property}::uuid,${serviceDate}::date)->'selectedExtension' AS member`;
  });
  if (!history) throw new Error("Statutory service-day history unavailable");
  const jurisdiction = { extensionId: history.member.extensionId, ownerTenantId: null,
    key: history.member.key, version: String(history.member.version), contentHash: history.member.contentHash };
  const sellerBody = { registrationId: sellerId, propertyNode: fixture.property, scheme: "in-gstin" as const, currency: "INR" as const,
    jurisdiction, gstin: fixtureStatutoryGstin(state.supplier), stateCode: state.supplier, legalName: "Synthetic Native Seller", tradeName: null,
    addressLine: "1 Synthetic Road", locality: "Bengaluru", postalCode: "560001" };
  const { registrationId: _sellerId, ...sellerTail } = sellerBody;
  const seller = freezeStatutoryFixture({ ...sellerBody, evidenceHash: fixtureStatutoryHash({ registrationId: sellerId, tenantId: fixture.tenant, ...sellerTail }) });
  const recipientBody = { registrationId: recipientId, partyId: fixture.party, scheme: "in-gstin" as const,
    gstin: fixtureStatutoryGstin(state.recipient, "FGHIJ5678K1Z"), stateCode: state.recipient, legalName: "Synthetic Native Buyer", tradeName: "Buyer Trade",
    addressLine1: "2 Synthetic Road", locality: "Bengaluru", pin: "560002" };
  const { registrationId: _recipientId, ...recipientTail } = recipientBody;
  const recipient = freezeStatutoryFixture({ ...recipientBody,
    evidenceHash: fixtureStatutoryHash({ registrationId: recipientId, tenantId: fixture.tenant, ...recipientTail }) });
  const supplierRef = { registrationId: sellerId, evidenceHash: seller.evidenceHash };
  const recipientRef = { partyId: fixture.party, registrationId: recipientId, evidenceHash: recipient.evidenceHash };
  const locationBody = { supplierServiceLocationId: locationId, propertyNode: fixture.property, jurisdiction, supplier: supplierRef,
    serviceScope: "lodging_accommodation" as const, registeredPlace: { kind: "principal_place_of_business" as const,
      stateCode: state.supplier, addressLine: seller.addressLine, locality: seller.locality, postalCode: seller.postalCode },
    locationBasis: "supply_made_from_registered_place_of_business" as const, legalRule: "IGST_ACT_2_15_A" as const };
  const location: IndiaGstSupplierServiceLocationResult = freezeStatutoryFixture({ ...locationBody,
    evidenceHash: fixtureStatutoryHash({ tenantId: fixture.tenant, ...locationBody }) });
  const locationRef = { id: locationId, evidenceHash: location.evidenceHash };
  const gst = { status: "active" as const, taxpayerType: "regular" as const, source: "gst_common_portal" as const, evidenceSha256: "c".repeat(64) };
  const supplierStatusBody = { supplierGstRegistrationStatusId: supplierStatusId, propertyNode: fixture.property,
    supplierServiceLocation: locationRef, supplier: supplierRef, statusAsOf: tos, gstRegistration: gst,
    legalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS" as const };
  const supplierStatusHash = fixtureStatutoryHash({ tenantId: fixture.tenant, ...supplierStatusBody });
  const supplierSezBody = { supplierSezStatusId: supplierSezId, propertyNode: fixture.property,
    supplierServiceLocation: locationRef, supplier: supplierRef, statusAsOf: tos, gstRegistration: gst,
    sezStatus: "affirmatively_non_sez_regular" as const, approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS" as const };
  const supplierSez = freezeStatutoryFixture({ ...supplierSezBody, evidenceHash: fixtureStatutoryHash({ tenantId: fixture.tenant, ...supplierSezBody }) });
  const recipientSezBody = { recipientSezStatusId: recipientSezId, recipient: recipientRef, statusAsOf: tos, gstRegistration: gst,
    sezStatus: "affirmatively_non_sez_regular" as const, approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" as const };
  const recipientSez: IndiaGstRecipientSezStatusResult = freezeStatutoryFixture({ ...recipientSezBody,
    evidenceHash: fixtureStatutoryHash({ tenantId: fixture.tenant, ...recipientSezBody }) });
  const serviceSupplierId = serviceDate === tos ? supplierSezId : crypto.randomUUID();
  const serviceRecipientId = serviceDate === tos ? recipientSezId : crypto.randomUUID();
  const serviceSupplierBody = { ...supplierSezBody, supplierSezStatusId: serviceSupplierId, statusAsOf: serviceDate,
    gstRegistration: { ...gst, taxpayerType: serviceSez ? "sez_unit" as const : "regular" as const },
    sezStatus: serviceSez ? "sez_unit" as const : "affirmatively_non_sez_regular" as const,
    approval: serviceSez ? { form: "sez_rules_form_g" as const, reference: "SYNTHETIC-LOA-434",
      validity: { fromInclusive: "2025-01-01", toExclusive: "2027-01-01" }, status: "in_force" as const, evidenceSha256: "d".repeat(64) } : null };
  const serviceSupplier = freezeStatutoryFixture({ ...serviceSupplierBody,
    evidenceHash: fixtureStatutoryHash({ tenantId: fixture.tenant, ...serviceSupplierBody }) });
  const serviceRecipientBody = { ...recipientSezBody, recipientSezStatusId: serviceRecipientId, statusAsOf: serviceDate };
  const serviceRecipient = freezeStatutoryFixture({ ...serviceRecipientBody,
    evidenceHash: fixtureStatutoryHash({ tenantId: fixture.tenant, ...serviceRecipientBody }) });
  await deploy.begin(async tx => {
    await tx`INSERT INTO public.property_fiscal_registration(tenant_id,id,property_node,scheme,currency,
      jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,
      registration_number,region_code,legal_name,trade_name,address_line,locality,postal_code)
      VALUES(${fixture.tenant}::uuid,${sellerId}::uuid,${fixture.property}::uuid,'in-gstin','INR',${jurisdiction.extensionId}::uuid,
        NULL,${jurisdiction.key},${Number(jurisdiction.version)},${jurisdiction.contentHash},${seller.gstin},${state.supplier},${seller.legalName},NULL,
        ${seller.addressLine},${seller.locality},${seller.postalCode})`;
    await tx`INSERT INTO public.party_fiscal_registration(tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,trade_name,address_line1,locality,pin)
      VALUES(${fixture.tenant}::uuid,${recipientId}::uuid,${fixture.party}::uuid,'in-gstin',${recipient.gstin},${state.recipient},${recipient.legalName},${recipient.tradeName},
        ${recipient.addressLine1},${recipient.locality},${recipient.pin})`;
    await tx`INSERT INTO public.india_gst_supplier_service_location(tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,registered_place_kind,location_basis,legal_rule)
      VALUES(${fixture.tenant}::uuid,${locationId}::uuid,${sellerId}::uuid,${seller.evidenceHash},'lodging_accommodation',
        'principal_place_of_business','supply_made_from_registered_place_of_business','IGST_ACT_2_15_A')`;
    await tx`INSERT INTO public.india_gst_supplier_registration_status_snapshot(tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,
      status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      VALUES(${fixture.tenant}::uuid,${supplierStatusId}::uuid,${sellerId}::uuid,${seller.evidenceHash},${tos}::date,'active','regular','gst_common_portal',
        ${gst.evidenceSha256},'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')`;
    for (const status of [supplierSez, ...(includeServicePair && serviceDate !== tos ? [serviceSupplier] : [])]) {
      await tx`INSERT INTO public.india_gst_supplier_sez_status(tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,
        status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,
        approval_form,approval_reference,approval_validity,approval_status,approval_evidence_sha256,legal_rule)
        VALUES(${fixture.tenant}::uuid,${status.supplierSezStatusId}::uuid,${sellerId}::uuid,${seller.evidenceHash},${status.statusAsOf}::date,
          'active',${status.gstRegistration.taxpayerType},'gst_common_portal',${status.gstRegistration.evidenceSha256},
          ${status.approval?.form ?? null},${status.approval?.reference ?? null},
          ${status.approval ? `[${status.approval.validity.fromInclusive},${status.approval.validity.toExclusive})` : null}::daterange,
          ${status.approval?.status ?? null},${status.approval?.evidenceSha256 ?? null},'IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS')`;
    }
    for (const status of [recipientSez, ...(includeServicePair && serviceDate !== tos ? [serviceRecipient] : [])]) {
      await tx`INSERT INTO public.india_gst_recipient_sez_status(tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,
        status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
        VALUES(${fixture.tenant}::uuid,${status.recipientSezStatusId}::uuid,${recipientId}::uuid,${recipient.evidenceHash},${status.statusAsOf}::date,
          'active','regular','gst_common_portal',${gst.evidenceSha256},'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS')`;
    }
    await tx`INSERT INTO public.property_fiscal_location(tenant_id,property_node,country_code,state_code,address_line1,locality,pin)
      VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'IN',${state.property},'3 Property Road','Bengaluru','560003')`;
    await tx`INSERT INTO public.india_gst_item_classification(tenant_id,id,property_node,jurisdiction_extension_id,jurisdiction_owner_tenant_id,
      jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,country_code,line_id,revenue_group,classification_system,classification_code,is_service_code)
      VALUES(${fixture.tenant}::uuid,${classificationId}::uuid,${fixture.property}::uuid,${jurisdiction.extensionId}::uuid,NULL,
        ${jurisdiction.key},${Number(jurisdiction.version)},${jurisdiction.contentHash},'IN','room','room_revenue','SAC','996311','Y')`;
  });
  return { seller, recipient, location, supplierStatusId, supplierStatusHash, supplierSez, recipientSez,
    serviceSupplier, serviceRecipient, classificationId, jurisdiction, gst, tos };
}

export interface NativeIssuanceFixtureOptions extends NativeSourceFixtureOptions {
  /** Final consideration may differ from the original booked quote. */
  readonly chargeAmountMinor?: string;
  readonly calendarEvidence?: IndiaNativeFiscalInvoiceCalendarEvidence | null;
  readonly statutoryOriginalConfiguration?: NativeStatutoryOriginalConfiguration;
}

/** Explicit synthetic calendar, never a production holiday-policy assertion. */
export const NATIVE_ISSUANCE_TEST_CUTOVER_CALENDAR: IndiaNativeFiscalInvoiceCalendarEvidence = freezeStatutoryFixture({
  authorityId: "ORDER434_SYNTHETIC_CALENDAR",
  sourceDigestSha256: "b".repeat(64),
  throughDate: "2025-09-26",
  days: ["2025-09-23", "2025-09-24", "2025-09-25", "2025-09-26"].map(date => ({ date, state: "working" as const })),
});

/** Builds only authentic booking/charge/valuation and base configuration. The
 * caller must execute the real command; no timing, tax, binding or invoice is
 * owner-inserted, and this helper never grants itself runtime capabilities. */
export async function createNativeIssuanceFixture(
  deploy: SQL,
  runtime: Database,
  options: NativeIssuanceFixtureOptions = {},
) {
  const label = fixtureLabel(options.label ?? "native-issuance");
  const amount = options.chargeAmountMinor ?? canonicalAmounts(options.roomNightAmounts, options.quotedTaxRounding,
    options.quotedTaxRateBasisPoints).base.toString();
  if (!/^[1-9][0-9]*$/.test(amount) || BigInt(amount) > MAX_INT64) {
    throw new Error("Native issuance final consideration must be a positive int64 minor-unit string");
  }
  const fixture = await createNativeSourceFixture(deploy, runtime, { ...options, label });
  const charge = await fixture.postCharge(amount, `${label}-charge`);
  return completeNativeIssuanceFixture(deploy, runtime, options, label, fixture, fixture.folio, [{
    postingRootId: charge.postingRootId, sourceKind: "room_consideration", additionSubtype: null,
    discountEligibility: null, evidenceSource: "operator_attestation", evidenceReference: `${label}-charge`,
  }]);
}

async function completeNativeIssuanceFixture(
  deploy: SQL,
  runtime: Database,
  options: NativeIssuanceFixtureOptions,
  label: string,
  fixture: NativeSourceFixture,
  folioId: string,
  sources: IndiaGstAccommodationNativeFinalValuationInput["sources"],
) {
  const valuationService = new IndiaGstAccommodationFinalValuationService({ idempotency: new PostgresIdempotency() });
  const valuation = await runtime.withTenantTransaction(fixture.tenant, tx => valuationService.finalizeNative(tx, freezeStatutoryFixture({
    tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: fixture.reservation,
    folioId, buyerPartyId: fixture.party,
    serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
    sources,
    ordinaryAttestation: { relationshipConclusion: "unrelated_not_distinct", considerationConclusion: "money_only",
      section152Conclusion: "all_additions_enumerated", section153Conclusion: "all_discounts_eligible",
      sourceCompletenessConclusion: "all_sources_classified", evidenceSource: "operator_attestation",
      evidenceReference: `${label}-section15` },
    expectedCurrentValuationId: null, expectedCurrentEvidenceHash: null, approvalRequestId: null,
    idempotencyKey: `${label}-valuation`,
    envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property,
      actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "india_gst.accommodation_final_valuation_recorded" }),
  })));
  const serviceDate = fixture.serviceResult.serviceProvision.serviceProvisionDate;
  const receiptDate = fixture.paymentResult.paymentReceipt.paymentReceiptDate;
  // Choose base evidence dates from the real property clock. Production timing
  // is independently recalculated by the candidate inside its own transaction.
  const [clock] = await deploy<Array<{ status_date: string; issue_date: string }>>`
    SELECT least(${receiptDate}::date,
      CASE WHEN (transaction_timestamp() AT TIME ZONE p.timezone)::date <= ${serviceDate}::date + 30
        THEN (transaction_timestamp() AT TIME ZONE p.timezone)::date ELSE ${serviceDate}::date END)::text AS status_date,
      (transaction_timestamp() AT TIME ZONE p.timezone)::date::text AS issue_date
    FROM public.org_node p WHERE p.tenant_id=${fixture.tenant}::uuid AND p.id=${fixture.property}::uuid`;
  if (!clock) throw new Error("Native issuance fixture property clock is unavailable");
  const statutory = await createNativeStatutoryFixture(deploy, fixture, {
    statusAsOfDate: clock.status_date,
    originalConfiguration: options.statutoryOriginalConfiguration,
  });
  if (clock.issue_date !== clock.status_date) {
    // Series configuration independently requires current official registration
    // evidence; the invoice request retains its historical statutory/TOS row.
    await deploy`INSERT INTO public.india_gst_supplier_registration_status_snapshot(
      tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      VALUES(${fixture.tenant}::uuid,${crypto.randomUUID()}::uuid,${statutory.seller.registrationId}::uuid,
        ${statutory.seller.evidenceHash},${clock.issue_date}::date,'active','regular','gst_common_portal',
        ${statutory.gst.evidenceSha256},'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')`;
  }
  await deploy`INSERT INTO public.role_permission(role_id,permission_code)
    SELECT ur.role_id,permission.code FROM public.user_role ur CROSS JOIN public.permission permission
    WHERE ur.tenant_id=${fixture.tenant}::uuid AND ur.user_id=${fixture.actor}::uuid
      AND permission.code IN ('tax-fiscal.documents:issue','tax-fiscal.series:configure') ON CONFLICT DO NOTHING`;
  // Configure actual approved history members, not a guessed selected-rate ID.
  // Genuine cutovers need both service-day and later invoice/receipt-day routes.
  const extensions = await deploy.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
    await tx`SET LOCAL ROLE yellow_owner`;
    return tx<Array<{ member: { extensionId: string; key: string; version: number; contentHash: string } }>>`
      SELECT DISTINCT public.read_india_native_rate_history_day(${fixture.tenant}::uuid,
        ${fixture.property}::uuid,d.day)->'selectedExtension' AS member
      FROM (VALUES (${serviceDate}::date),(${receiptDate}::date),(${clock.issue_date}::date)) AS d(day)`;
  });
  const payableIds: string[] = [];
  const routeComponents = statutory.seller.stateCode !== statutory.location.registeredPlace.stateCode
    ? (() => { throw new Error("Native statutory seller and service-location states are inconsistent"); })()
    : statutory.seller.stateCode !== statutoryStateConfiguration(options.statutoryOriginalConfiguration).property
      ? ["IGST"] as const
      : new Set(["04", "26", "31", "35", "38"]).has(statutory.seller.stateCode)
        ? ["CGST", "UTGST"] as const
        : ["CGST", "SGST"] as const;
  for (const component of routeComponents) {
    const account = crypto.randomUUID();
    const code = `N434_${component}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
    payableIds.push(account);
    await deploy.begin(async tx => {
      await tx`INSERT INTO public.account(tenant_id,id,property_node,role,name,currency)
        VALUES(${fixture.tenant}::uuid,${account}::uuid,${fixture.property}::uuid,'tax_payable',${component},'INR')`;
      await tx`INSERT INTO public.tx_code(code,name,grp,usali_line,default_dr,default_cr)
        VALUES(${code},${component},'tax','liabilities.tax','guest','tax_payable')`;
      await tx`INSERT INTO public.tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id)
        VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'INR',${code},${account}::uuid)`;
      for (const { member } of extensions) {
        await tx`INSERT INTO public.tax_semantic_route(tenant_id,property_node,currency,jurisdiction_extension_id,
          jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,semantic_kind,semantic_code,tx_code)
          VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'INR',${member.extensionId}::uuid,NULL,
            ${member.key},${member.version},${member.contentHash},'tax',${component},${code})`;
      }
    });
  }
  const series = await runtime.withTenantTransaction(fixture.tenant, tx => new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
    tenantId: fixture.tenant, propertyNode: fixture.property, supplierRegistrationId: statutory.seller.registrationId,
    documentKind: "invoice", prefix: "INV/",
    envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
      requestId: crypto.randomUUID(), operation: "document.series.configured" }),
  }));
  const request: IndiaNativeFiscalInvoiceIssueNativeInput = freezeStatutoryFixture({
    tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
    reservationId: fixture.reservation, folioId, valuationId: valuation.valuationId,
    serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
    paymentReceiptSnapshotId: fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId,
    ordinaryRegimeEvidenceId: fixture.ordinaryResult.ordinaryRegimeEvidenceId,
    supplierServiceLocationId: statutory.location.supplierServiceLocationId,
    supplierRegistrationStatusId: statutory.supplierStatusId, supplierSezStatusId: statutory.supplierSez.supplierSezStatusId,
    recipientRegistrationId: statutory.recipient.registrationId, recipientSezStatusId: statutory.recipientSez.recipientSezStatusId,
    classificationId: statutory.classificationId, calendarEvidence: options.calendarEvidence ?? null,
    idempotencyKey: `${label}-first-invoice`,
    envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
      requestId: crypto.randomUUID(), operation: "document.issued" }),
  });
  return Object.freeze({ fixture, valuation, statutory, series, request, payableIds: Object.freeze(payableIds) });
}

function valuationSource(postingRootId: string, label: string, negative = false) {
  return Object.freeze({
    postingRootId,
    sourceKind: negative ? "promotion_discount" : "room_consideration",
    additionSubtype: null,
    discountEligibility: null,
    evidenceSource: "operator_attestation",
    evidenceReference: `${label}:${postingRootId}`,
  });
}

/** Commits a real erroneous charge and reversal before genuine native valuation. */
export async function createNativeCorrectionFirstIssuanceFixture(
  deploy: SQL,
  runtime: Database,
  options: NativeIssuanceFixtureOptions = {},
) {
  const label = fixtureLabel(options.label ?? "native-correction-first");
  const amount = options.chargeAmountMinor
    ?? canonicalAmounts(options.roomNightAmounts, options.quotedTaxRounding,
      options.quotedTaxRateBasisPoints).base.toString();
  if (!/^[1-9][0-9]*$/.test(amount) || BigInt(amount) > MAX_INT64) {
    throw new Error("Native correction-first final consideration must be a positive int64 minor-unit string");
  }
  const fixture = await createNativeSourceFixture(deploy, runtime, { ...options, label });
  const stay = await fixture.postCharge(amount, `${label}-stay`);
  const erroneous = await fixture.postCharge("1", `${label}-error`);
  const corrections = new ChargeCorrectionService({
    events: fixtureEventBus(), idempotency: new PostgresIdempotency(),
  });
  const corrected = await runtime.withTenantTransaction(fixture.tenant, async tx => {
    const result = await corrections.reverseCharge(tx, {
      tenantId: fixture.tenant, folioId: fixture.folio, reversesJournalId: erroneous.result.journalId,
      reason: "Correct erroneous pre-invoice accommodation charge", postSealAuthorized: false,
      idempotencyKey: `${label}-reverse`, envelope: createAuditEnvelope({ tenantId: fixture.tenant,
        propertyNode: fixture.property, actorId: fixture.actor, requestId: crypto.randomUUID(),
        operation: "journal.posted" }),
    });
    const rows = await tx<Array<{ id: string }>>`
      SELECT id::text FROM public.posting_line WHERE tenant_id=${fixture.tenant}::uuid
        AND journal_id=${result.journalId}::uuid AND account_id=${fixture.guestAccount}::uuid
      ORDER BY seq`;
    if (rows.length !== 1 || !rows[0]) throw new Error("Native correction-first contra root is unavailable");
    return Object.freeze({ result, postingRootId: rows[0].id });
  });
  const candidate = await completeNativeIssuanceFixture(deploy, runtime, options, label, fixture,
    fixture.folio, [valuationSource(stay.postingRootId, `${label}-stay`),
      valuationSource(erroneous.postingRootId, `${label}-error`),
      valuationSource(corrected.postingRootId, `${label}-reverse`, true)]);
  return Object.freeze({ ...candidate, preparation: Object.freeze({ stay, erroneous, corrected }) });
}

/** Commits a governed sibling-folio transfer before genuine native valuation. */
export async function createNativeTransferFirstIssuanceFixture(
  deploy: SQL,
  runtime: Database,
  options: NativeIssuanceFixtureOptions = {},
) {
  const label = fixtureLabel(options.label ?? "native-transfer-first");
  const amount = options.chargeAmountMinor
    ?? canonicalAmounts(options.roomNightAmounts, options.quotedTaxRounding,
      options.quotedTaxRateBasisPoints).base.toString();
  if (!/^[1-9][0-9]*$/.test(amount) || BigInt(amount) > MAX_INT64) {
    throw new Error("Native transfer-first final consideration must be a positive int64 minor-unit string");
  }
  const fixture = await createNativeSourceFixture(deploy, runtime, { ...options, label });
  const charge = await fixture.postCharge(amount, `${label}-charge`);
  const folioPrefix = `NT-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}-`;
  await deploy`INSERT INTO public.document_series(tenant_id,property_node,kind,prefix,next_no,fiscal)
    VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'folio',${folioPrefix},1,false)`;
  const folios = new FolioService({ events: fixtureEventBus(), idempotency: new PostgresIdempotency() });
  const destination = await runtime.withTenantTransaction(fixture.tenant, tx => folios.openAdditional(tx, {
    tenantId: fixture.tenant, reservationId: fixture.reservation, sourceFolioId: fixture.folio,
    name: "Transferred accommodation", idempotencyKey: `${label}-destination`,
    envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property,
      actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "folio.opened" }),
  }));
  const family = await runtime.withTenantTransaction(fixture.tenant, tx => tx<Array<{
    id: string; window_no: number; balance_minor: string;
  }>>`SELECT folio.id::text,folio.window_no,COALESCE(balance.balance_minor,0)::text AS balance_minor
    FROM public.folio folio LEFT JOIN public.folio_balance balance
      ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
    WHERE folio.tenant_id=${fixture.tenant}::uuid AND folio.reservation_id=${fixture.reservation}::uuid
    ORDER BY folio.window_no,folio.id`);
  const generation = new Bun.CryptoHasher("md5").update(family
    .map(row => `${row.id}:${row.window_no}:${row.balance_minor}`).join("|")).digest("hex");
  const transfers = new FolioTransferService({
    events: fixtureEventBus(), idempotency: new PostgresIdempotency(), folios,
  });
  const input: FolioTransferInput = {
    tenantId: fixture.tenant, sourceFolioId: fixture.folio, destinationFolioId: destination.folioId,
    groupIds: [charge.result.journalId], reason: "Route accommodation to legal invoice window",
    generation, previewRevision: "", idempotencyKey: `${label}-transfer`,
    envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property,
      actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "journal.posted" }),
  };
  const preview = await runtime.withTenantTransaction(fixture.tenant, tx => transfers.preview(tx, input));
  const transfer = await runtime.withTenantTransaction(fixture.tenant,
    tx => transfers.transfer(tx, Object.freeze({ ...input, previewRevision: preview.previewRevision })));
  const candidate = await completeNativeIssuanceFixture(deploy, runtime, options, label, fixture,
    destination.folioId, [valuationSource(charge.postingRootId, `${label}-charge`)]);
  return Object.freeze({ ...candidate, preparation: Object.freeze({ charge, destination, transfer }) });
}

const MAXIMUM_NATIVE_ROOM_NIGHTS = Object.freeze(Array.from({ length: 366 }, () => "10000"));

/** Builds the admitted 366-night/500-source/500-revenue-account native boundary. */
export async function createNativeMaximumBoundIssuanceFixture(
  deploy: SQL,
  runtime: Database,
  options: Pick<NativeIssuanceFixtureOptions, "label"> = {},
) {
  const label = fixtureLabel(options.label ?? "native-maximum-bound");
  const fixtureOptions: NativeIssuanceFixtureOptions = Object.freeze({
    label,
    roomNightAmounts: MAXIMUM_NATIVE_ROOM_NIGHTS,
    revenueAccountCount: 500,
  });
  const fixture = await createNativeSourceFixture(deploy, runtime, fixtureOptions);
  const charges: NativeSourceCharge[] = [];
  for (let index = 0; index < 500; index++) {
    charges.push(await fixture.postCharge("7320", `${label}-charge-${index + 1}`, index));
  }
  const candidate = await completeNativeIssuanceFixture(deploy, runtime, fixtureOptions, label, fixture,
    fixture.folio, charges.map((charge, index) => valuationSource(charge.postingRootId,
      `${label}-charge-${index + 1}`)));
  return Object.freeze({ ...candidate, preparation: Object.freeze({ charges: Object.freeze(charges) }) });
}

export interface NativeIssuanceCohortOptions extends Pick<NativeIssuanceFixtureOptions,
  "label" | "roomNightAmounts" | "quotedTaxRounding" | "quotedTaxRateBasisPoints"> {
  readonly count: number;
}

type NativeIssuanceCandidate = Awaited<ReturnType<typeof createNativeIssuanceFixture>>;

interface SharedSourceTemplateRow {
  readonly unit_type_id: string;
  readonly sellable_unit_id: string;
  readonly rate_plan_id: string;
  readonly revenue_account_id: string;
  readonly tx_code: string;
  readonly business_date: string;
}

async function createSharedNativeSourceMember(
  deploy: SQL,
  runtime: Database,
  original: NativeIssuanceCandidate,
  options: NativeIssuanceCohortOptions,
  label: string,
): Promise<NativeSourceFixture> {
  const amounts = canonicalAmounts(options.roomNightAmounts, options.quotedTaxRounding, options.quotedTaxRateBasisPoints);
  const fixture = original.fixture;
  const [template] = await deploy<SharedSourceTemplateRow[]>`
    SELECT ut.id::text AS unit_type_id, su.id::text AS sellable_unit_id,
      rp.id::text AS rate_plan_id, tr.credit_account_id::text AS revenue_account_id,
      tr.tx_code,
      (transaction_timestamp() AT TIME ZONE p.timezone)::date::text AS business_date
    FROM public.org_node p
    JOIN public.unit_type ut ON ut.tenant_id=p.tenant_id AND ut.property_node=p.id
    JOIN public.sellable_unit su ON su.tenant_id=ut.tenant_id AND su.unit_type_id=ut.id
    JOIN public.rate_plan rp ON rp.tenant_id=p.tenant_id AND rp.property_node=p.id
    JOIN public.tx_code_route tr ON tr.tenant_id=p.tenant_id AND tr.property_node=p.id
    WHERE p.tenant_id=${fixture.tenant}::uuid AND p.id=${fixture.property}::uuid
      AND tr.credit_account_id=${fixture.revenueAccount}::uuid
    ORDER BY tr.tx_code
    LIMIT 1`;
  if (!template) throw new Error("Native issuance cohort shared source template is unavailable");

  const marker = `${label}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const pathMarker = marker.replaceAll("-", "").toLowerCase();
  const party = crypto.randomUUID(), reservation = crypto.randomUUID(), segment = crypto.randomUUID();
  const hold = crypto.randomUUID(), holdBinding = crypto.randomUUID(), attribution = crypto.randomUUID();
  const lineage = crypto.randomUUID(), guestAccount = crypto.randomUUID(), folio = crypto.randomUUID();
  const completionDate = template.business_date;
  const firstNightDate = new Date(`${completionDate}T00:00:00Z`);
  firstNightDate.setUTCDate(firstNightDate.getUTCDate() - amounts.values.length);
  const firstNight = firstNightDate.toISOString().slice(0, 10);
  const roomNights = amounts.values.map((nightAmount, index) => {
    const date = new Date(`${firstNight}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return Object.freeze({ businessDate: date.toISOString().slice(0, 10), amountMinor: BigInt(nightAmount) });
  });
  const period = `[${firstNight}T00:00:00Z,${completionDate}T00:00:00Z)`;
  const quoteHash = sha256(`order434:synthetic-quote:${marker}`);
  const snapshot = createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash }, currency: "INR",
    line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: amounts.base,
      nights: amounts.values.length, personNights: amounts.values.length * 2, roomNights },
    assignments: roomNights.map(({ businessDate }) => Object.freeze({ businessDate,
      jurisdictionKey: original.statutory.jurisdiction.key,
      evidenceRef: `tax-assignment:${sha256(`order434:assignment:${marker}:${businessDate}`)}` })),
    jurisdiction: { extensionId: original.statutory.jurisdiction.extensionId, ownerTenantId: null,
      key: original.statutory.jurisdiction.key, version: Number(original.statutory.jurisdiction.version),
      contentHash: original.statutory.jurisdiction.contentHash,
      evidenceRef: `tax-jurisdiction:${sha256(`order434:jurisdiction:${marker}`)}` },
    evaluation: { schemaVersion: 1, jurisdictionKey: original.statutory.jurisdiction.key, country: "IN",
      priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: amounts.base,
      baseTotalMinor: amounts.base, taxTotalMinor: amounts.tax, grandTotalMinor: amounts.payment,
      taxes: [{ code: "GST_ROOM", name: "Synthetic quoted GST evidence", taxMinor: amounts.tax,
        components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: amounts.base,
          taxMinor: amounts.tax, rateBasisPoints: amounts.rateBasisPoints }] }] },
  });

  await deploy.begin(async tx => {
    await tx`INSERT INTO public.party(id,tenant_id,kind,display_name,status)
      VALUES(${party}::uuid,${fixture.tenant}::uuid,'person','Order434 cohort guest','active')`;
    await tx`INSERT INTO public.party_role(tenant_id,party_id,role)
      VALUES(${fixture.tenant}::uuid,${party}::uuid,'guest')`;
    await tx`INSERT INTO public.reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
      VALUES(${reservation}::uuid,${fixture.tenant}::uuid,${fixture.property}::uuid,${`O434-${pathMarker}`},
        'checked_out',${party}::uuid,'direct','INR')`;
    await tx`INSERT INTO public.reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,
      period,adults,children,rate_plan_id,status)
      VALUES(${segment}::uuid,${fixture.tenant}::uuid,${reservation}::uuid,1,${template.unit_type_id}::uuid,
        ${template.sellable_unit_id}::uuid,${period}::tstzrange,2,'[]',${template.rate_plan_id}::uuid,'booked')`;
    await tx`INSERT INTO public.hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status)
      VALUES(${hold}::uuid,${fixture.tenant}::uuid,${fixture.property}::uuid,${template.sellable_unit_id}::uuid,
        ${period}::tstzrange,'cart','{}',${completionDate}::date,'consumed')`;
    await tx`INSERT INTO public.tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,
      origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot)
      VALUES(${fixture.tenant}::uuid,${attribution}::uuid,${fixture.property}::uuid,${fixture.actor}::uuid,1,
        'rate_quote',${quoteHash},${snapshot.snapshotHash},'INR',${JSON.stringify(snapshot)}::jsonb)`;
    await tx`INSERT INTO public.tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,
      attribution_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency)
      VALUES(${fixture.tenant}::uuid,${holdBinding}::uuid,${fixture.property}::uuid,${fixture.actor}::uuid,
        ${hold}::uuid,${attribution}::uuid,${template.sellable_unit_id}::uuid,${period}::tstzrange,
        ${quoteHash},${snapshot.snapshotHash},'INR')`;
    await tx`INSERT INTO public.tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,
      hold_id,attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency)
      VALUES(${fixture.tenant}::uuid,${lineage}::uuid,${fixture.property}::uuid,${fixture.actor}::uuid,
        ${holdBinding}::uuid,${hold}::uuid,${attribution}::uuid,${reservation}::uuid,${segment}::uuid,
        ${template.sellable_unit_id}::uuid,${period}::tstzrange,${quoteHash},${snapshot.snapshotHash},'INR')`;
    await tx`INSERT INTO public.account(id,tenant_id,property_node,role,party_id,name,currency,status)
      VALUES(${guestAccount}::uuid,${fixture.tenant}::uuid,${fixture.property}::uuid,'guest',${party}::uuid,
        'Guest account','INR','open')`;
    await tx`INSERT INTO public.folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status)
      VALUES(${folio}::uuid,${fixture.tenant}::uuid,${guestAccount}::uuid,${reservation}::uuid,
        ${`O434-F-${pathMarker}`},1,'Primary','open')`;
  });

  const sourceIntake = new IndiaGstAccommodationSourceIntakeService();
  const ordinaryEvidence = new IndiaGstAccommodationOrdinaryRegimeEvidenceService();
  const recorded = await runtime.withTenantTransaction(fixture.tenant, async tx => {
    const serviceResult = await sourceIntake.recordServiceProvision(tx, freezeStatutoryFixture({
      tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: reservation,
      reservationLineageId: lineage, serviceProvisionDate: completionDate,
      serviceProvisionSource: "governed_service_provision_record", legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
      serviceProvisionEvidenceSha256: sha256(`order434:test-only-service-source:${marker}`),
      idempotencyKey: `o434-service-${marker}`, envelope: createAuditEnvelope({ actorId: fixture.actor,
        tenantId: fixture.tenant, propertyNode: fixture.property, requestId: crypto.randomUUID(), operation: SERVICE_EVENT }),
    }));
    const paymentResult = await sourceIntake.recordPaymentReceipt(tx, freezeStatutoryFixture({
      tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: reservation,
      serviceProvisionSnapshotId: serviceResult.serviceProvision.serviceProvisionSnapshotId,
      amountMinor: amounts.payment.toString(), currency: "INR", coverageScope: "full_attribution",
      supplierBooksEntryDate: completionDate,
      supplierBankCreditDate: completionDate,
      paymentReceiptSource: "governed_supplier_payment_receipt_record",
      paymentReceiptEvidenceSha256: sha256(`order434:test-only-payment-source:${marker}`),
      legalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY", idempotencyKey: `o434-payment-${marker}`,
      envelope: createAuditEnvelope({ actorId: fixture.actor, tenantId: fixture.tenant, propertyNode: fixture.property,
        requestId: crypto.randomUUID(), operation: PAYMENT_EVENT }),
    }));
    const ordinaryResult = await ordinaryEvidence.record(tx, freezeStatutoryFixture({
      tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: reservation,
      serviceProvisionSnapshotId: serviceResult.serviceProvision.serviceProvisionSnapshotId,
      regime: "ordinary_rule47_30_day", ordinaryRegimeSource: "governed_rule47_ordinary_regime_record",
      legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT",
      ordinaryRegimeEvidenceSha256: sha256(`order434:test-only-ordinary-assertion:${marker}`),
      idempotencyKey: `o434-ordinary-${marker}`, envelope: createAuditEnvelope({ actorId: fixture.actor,
        tenantId: fixture.tenant, propertyNode: fixture.property, requestId: crypto.randomUUID(), operation: ORDINARY_EVENT }),
    }));
    return Object.freeze({ serviceResult, paymentResult, ordinaryResult });
  });

  const charges = new ChargeService({ events: fixtureEventBus(), idempotency: new PostgresIdempotency() });
  const postCharge = Object.freeze(async (amountMinor: string, key = `o434-charge-${crypto.randomUUID()}`,
    revenueAccountIndex = 0): Promise<NativeSourceCharge> => {
    if (revenueAccountIndex !== 0) throw new Error("Native issuance cohort exposes one shared revenue route");
    return runtime.withTenantTransaction(fixture.tenant, async tx => {
      const result = await charges.postCharge(tx, freezeStatutoryFixture({ tenantId: fixture.tenant, folioId: folio,
        txCode: template.tx_code, amountMinor, idempotencyKey: key,
        envelope: createAuditEnvelope({ actorId: fixture.actor, tenantId: fixture.tenant,
          propertyNode: fixture.property, requestId: crypto.randomUUID(), operation: "journal.posted" }) }));
      const rows = await tx<Array<{ id: string }>>`SELECT id::text FROM public.posting_line
        WHERE tenant_id=${fixture.tenant}::uuid AND journal_id=${result.journalId}::uuid
          AND folio_id=${folio}::uuid AND account_id=${guestAccount}::uuid AND seq=1`;
      if (rows.length !== 1 || !rows[0]) throw new Error("Native issuance cohort charge lacks one canonical posting root");
      return Object.freeze({ result, postingRootId: rows[0].id });
    });
  });
  return Object.freeze({ tenant: fixture.tenant, property: fixture.property, actor: fixture.actor,
    unauthorizedActor: fixture.unauthorizedActor, party, reservation, lineage, attribution, folio, guestAccount,
    revenueAccount: template.revenue_account_id, revenueAccounts: Object.freeze([template.revenue_account_id]),
    serviceResult: recorded.serviceResult, paymentResult: recorded.paymentResult,
    ordinaryResult: recorded.ordinaryResult, postCharge });
}

/** Creates distinct authentic native sources under one configured fiscal series. */
export async function createNativeIssuanceCohort(
  deploy: SQL,
  runtime: Database,
  options: NativeIssuanceCohortOptions,
): Promise<readonly Awaited<ReturnType<typeof createNativeIssuanceFixture>>[]> {
  if (!Number.isSafeInteger(options.count) || options.count < 1 || options.count > 100) {
    throw new Error("Native issuance cohort count must be an integer between one and 100");
  }
  const baseLabel = fixtureLabel(options.label ?? "native-cohort");
  const firstLabel = `${baseLabel.slice(0, 27)}-1`;
  const original = await createNativeIssuanceFixture(deploy, runtime, { ...options, label: firstLabel });
  const candidates: NativeIssuanceCandidate[] = [original];
  const valuationService = new IndiaGstAccommodationFinalValuationService({ idempotency: new PostgresIdempotency() });
  for (let index = 2; index <= options.count; index++) {
    const label = `${baseLabel.slice(0, 27)}-${index}`;
    const member = await createSharedNativeSourceMember(deploy, runtime, original, options, label);
    const amount = canonicalAmounts(options.roomNightAmounts, options.quotedTaxRounding,
      options.quotedTaxRateBasisPoints).base.toString();
    const charge = await member.postCharge(amount, `${label}-charge`);
    const valuation = await runtime.withTenantTransaction(member.tenant, tx => valuationService.finalizeNative(tx,
      freezeStatutoryFixture({ tenantId: member.tenant, propertyNode: member.property, reservationId: member.reservation,
        folioId: member.folio, buyerPartyId: member.party,
        serviceProvisionSnapshotId: member.serviceResult.serviceProvision.serviceProvisionSnapshotId,
        sources: [{ postingRootId: charge.postingRootId, sourceKind: "room_consideration", additionSubtype: null,
          discountEligibility: null, evidenceSource: "operator_attestation", evidenceReference: `${label}-charge` }],
        ordinaryAttestation: { relationshipConclusion: "unrelated_not_distinct", considerationConclusion: "money_only",
          section152Conclusion: "all_additions_enumerated", section153Conclusion: "all_discounts_eligible",
          sourceCompletenessConclusion: "all_sources_classified", evidenceSource: "operator_attestation",
          evidenceReference: `${label}-section15` }, expectedCurrentValuationId: null,
        expectedCurrentEvidenceHash: null, approvalRequestId: null, idempotencyKey: `${label}-valuation`,
        envelope: createAuditEnvelope({ tenantId: member.tenant, propertyNode: member.property, actorId: member.actor,
          requestId: crypto.randomUUID(), operation: "india_gst.accommodation_final_valuation_recorded" }) })));
    const recipientId = crypto.randomUUID(), recipientSezId = crypto.randomUUID();
    const recipientBody = { registrationId: recipientId, partyId: member.party, scheme: "in-gstin" as const,
      gstin: fixtureStatutoryGstin("29", `FGHIJ${String(index).padStart(4, "0")}K1Z`), stateCode: "29" as const,
      legalName: original.statutory.recipient.legalName, tradeName: original.statutory.recipient.tradeName,
      addressLine1: original.statutory.recipient.addressLine1, locality: original.statutory.recipient.locality,
      pin: original.statutory.recipient.pin };
    const { registrationId: _recipientId, ...recipientTail } = recipientBody;
    const recipientEvidenceHash = fixtureStatutoryHash({ registrationId: recipientId, tenantId: member.tenant,
      ...recipientTail });
    const finalRecipient = freezeStatutoryFixture({ ...recipientBody, evidenceHash: recipientEvidenceHash });
    const recipientSezBody = { ...original.statutory.recipientSez, recipientSezStatusId: recipientSezId,
      recipient: { partyId: member.party, registrationId: recipientId, evidenceHash: recipientEvidenceHash },
      gstRegistration: { ...original.statutory.recipientSez.gstRegistration, taxpayerType: "regular" as const },
      sezStatus: "affirmatively_non_sez_regular" as const, approval: null };
    const finalRecipientSez = freezeStatutoryFixture({ ...recipientSezBody,
      evidenceHash: fixtureStatutoryHash({ tenantId: member.tenant,
        ...Object.fromEntries(Object.entries(recipientSezBody).filter(([key]) => key !== "evidenceHash")) }) });
    await deploy.begin(async tx => {
      await tx`INSERT INTO public.party_fiscal_registration(tenant_id,id,party_id,scheme,registration_number,region_code,
        legal_name,trade_name,address_line1,locality,pin) VALUES(${member.tenant}::uuid,${recipientId}::uuid,${member.party}::uuid,
        'in-gstin',${finalRecipient.gstin},'29',${finalRecipient.legalName},${finalRecipient.tradeName},
        ${finalRecipient.addressLine1},${finalRecipient.locality},${finalRecipient.pin})`;
      await tx`INSERT INTO public.india_gst_recipient_sez_status(tenant_id,id,recipient_registration_id,
        recipient_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
        gst_status_evidence_sha256,legal_rule) VALUES(${member.tenant}::uuid,${recipientSezId}::uuid,${recipientId}::uuid,
        ${recipientEvidenceHash},${finalRecipientSez.statusAsOf}::date,'active','regular','gst_common_portal',
        ${finalRecipientSez.gstRegistration.evidenceSha256},'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS')`;
    });
    const statutory = freezeStatutoryFixture({ ...original.statutory, recipient: finalRecipient,
      recipientSez: finalRecipientSez, serviceRecipient: finalRecipientSez });
    const request: IndiaNativeFiscalInvoiceIssueNativeInput = freezeStatutoryFixture({ ...original.request,
      reservationId: member.reservation, folioId: member.folio, valuationId: valuation.valuationId,
      serviceProvisionSnapshotId: member.serviceResult.serviceProvision.serviceProvisionSnapshotId,
      paymentReceiptSnapshotId: member.paymentResult.paymentReceipt.paymentReceiptSnapshotId,
      ordinaryRegimeEvidenceId: member.ordinaryResult.ordinaryRegimeEvidenceId,
      recipientRegistrationId: recipientId, recipientSezStatusId: recipientSezId,
      idempotencyKey: `${label}-first-invoice`, envelope: createAuditEnvelope({ tenantId: member.tenant,
        propertyNode: member.property, actorId: member.actor, requestId: crypto.randomUUID(), operation: "document.issued" }) });
    candidates.push(Object.freeze({ fixture: member, valuation, statutory, series: original.series,
      request, payableIds: original.payableIds }));
  }
  return Object.freeze(candidates);
}
