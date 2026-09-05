import { SQL } from "bun";

import { ChargeService, type PostChargeResult } from "../../src/contexts/financials";
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

function canonicalAmounts(values: readonly string[] | undefined): {
  readonly values: readonly string[];
  readonly base: bigint;
  readonly tax: bigint;
  readonly payment: bigint;
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
  const taxNumerator = base * 500n;
  if (base > MAX_INT64 || taxNumerator % 10_000n !== 0n) {
    throw new Error("Native source fixture requires an exact 5% synthetic quoted-tax result");
  }
  const tax = taxNumerator / 10_000n;
  const payment = base + tax;
  if (tax < 1n || payment > MAX_INT64) {
    throw new Error("Native source fixture quoted-tax total is outside positive int64 bounds");
  }
  return Object.freeze({ values: Object.freeze([...amounts]), base, tax, payment });
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
  const amounts = canonicalAmounts(options.roomNightAmounts);
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
      ((transaction_timestamp() AT TIME ZONE ${timezone})::date - ${amounts.values.length})::date::text AS first_night,
      (transaction_timestamp() AT TIME ZONE ${timezone})::date::text AS completion_date
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
          rateBasisPoints: 500,
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
      supplierBooksEntryDate: dates.completion_date,
      supplierBankCreditDate: dates.completion_date,
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
