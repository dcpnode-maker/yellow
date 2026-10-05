import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import type { AuditEnvelope, JsonValue, PostgresIdempotency, Tx } from "../../kernel";
import {
  IndiaGstAccommodationQuotedRateApplicabilityService,
  type IndiaGstAccommodationQuotedRateApplicabilityInput,
} from "./india-gst-accommodation-quoted-rate-applicability";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "folioId",
  "quotedRateApplicabilityInput",
  "idempotencyKey",
  "envelope",
] as const;

export interface IndiaGstAccommodationQuotedRateApplicabilityRecorderInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly quotedRateApplicabilityInput: IndiaGstAccommodationQuotedRateApplicabilityInput;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface IndiaGstAccommodationQuotedRateApplicabilityRecorderResult
  extends Readonly<Record<string, JsonValue>> {
  readonly applicabilityId: string;
  readonly evidenceHash: string;
  readonly created: boolean;
  readonly replayed: boolean;
}

export interface IndiaGstAccommodationQuotedRateApplicabilityRecorderServiceOptions {
  readonly idempotency: PostgresIdempotency;
}

export class IndiaGstAccommodationQuotedRateApplicabilityRecorderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationQuotedRateApplicabilityRecorderValidationError";
  }
}

export class IndiaGstAccommodationQuotedRateApplicabilityRecorderConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationQuotedRateApplicabilityRecorderConflictError";
  }
}

export class IndiaGstAccommodationQuotedRateApplicabilityRecorderNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationQuotedRateApplicabilityRecorderNotFoundError";
  }
}

interface CapabilityRow {
  readonly applicability_id: string;
  readonly evidence_hash: string;
  readonly created: boolean;
}

function fail(message: string): never {
  throw new IndiaGstAccommodationQuotedRateApplicabilityRecorderValidationError(message);
}

function exact(value: unknown, keys: readonly string[], subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(`${subject} must be an exact plain record`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${subject} shape is invalid`);
  }
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || seen.has(value) || utilTypes.isProxy(value)
      || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("quoted applicability recorder input must be an exact deeply frozen graph");
  }
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null) {
    fail("quoted applicability recorder input must contain plain records");
  }
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      fail("quoted applicability recorder arrays must be exact and dense");
    }
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || !("value" in descriptor)
        || descriptor.writable !== false) {
      fail("quoted applicability recorder input descriptors are invalid");
    }
    deeplyFrozen(descriptor.value, seen);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) fail(`${subject} must be a lowercase UUID`);
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function postgresArray(values: readonly (string | number | bigint | boolean | null)[]): string {
  return `{${values.map((value) => value === null
    ? "NULL"
    : `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
}

function mapDbError(error: unknown): never {
  const code = (error as { readonly code?: string; readonly errno?: string }).code
    ?? (error as { readonly errno?: string }).errno;
  if (code === "42501") {
    throw new IndiaGstAccommodationQuotedRateApplicabilityRecorderNotFoundError(
      "Quoted rate-applicability authority was not found",
    );
  }
  if (code === "55000" || code === "23505" || code === "23503") {
    throw new IndiaGstAccommodationQuotedRateApplicabilityRecorderConflictError(
      "Quoted rate-applicability scope is stale or unavailable",
    );
  }
  if (code === "22023" || code === "22003" || code === "23514") {
    throw new IndiaGstAccommodationQuotedRateApplicabilityRecorderValidationError(
      "Quoted rate-applicability evidence is invalid",
    );
  }
  throw error;
}

export class IndiaGstAccommodationQuotedRateApplicabilityRecorderService {
  readonly #idempotency: PostgresIdempotency;

  constructor(options: IndiaGstAccommodationQuotedRateApplicabilityRecorderServiceOptions) {
    this.#idempotency = options.idempotency;
  }

  async record(
    tx: Tx,
    input: IndiaGstAccommodationQuotedRateApplicabilityRecorderInput,
  ): Promise<IndiaGstAccommodationQuotedRateApplicabilityRecorderResult> {
    deeplyFrozen(input);
    exact(input, INPUT_KEYS, "quoted applicability recorder input");
    exact(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "audit envelope");
    const tenantId = uuid(input.tenantId, "tenantId");
    const propertyNode = uuid(input.propertyNode, "propertyNode");
    const reservationId = uuid(input.reservationId, "reservationId");
    const folioId = uuid(input.folioId, "folioId");
    const actorId = uuid(input.envelope.actorId, "envelope.actorId");
    const requestId = uuid(input.envelope.requestId, "envelope.requestId");
    if (typeof input.idempotencyKey !== "string" || !KEY.test(input.idempotencyKey)) {
      fail("idempotencyKey is invalid");
    }
    if (input.envelope.tenantId !== tenantId || input.envelope.propertyNode !== propertyNode
        || input.envelope.operation !== "india_gst.accommodation_quoted_rate_applicability_recorded") {
      fail("audit envelope is invalid");
    }
    const predecessor = input.quotedRateApplicabilityInput;
    if (typeof predecessor !== "object" || predecessor === null) fail("Order341 input is invalid");
    if (predecessor.tenantId !== tenantId || predecessor.propertyNode !== propertyNode
        || predecessor.reservationId !== reservationId || predecessor.folioId !== folioId) {
      fail("Order341 scope conflicts with recorder scope");
    }

    try {
      const resolved = await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(tx, predecessor);
      const paymentEvidence = predecessor.section14Input.paymentEvidence;
      const calendar = paymentEvidence.kind === "calendar_governed_receipt"
        ? paymentEvidence.calendarEvidence
        : null;
      const throughDate = paymentEvidence.kind === "calendar_governed_receipt"
        ? paymentEvidence.throughDate
        : null;
      const calendarDates = calendar?.days.map((day) => day.date) ?? [];
      const calendarStates = calendar?.days.map((day) => day.state) ?? [];
      const nightOrdinals = resolved.components.map((night) => Number(night.ordinal));
      if (nightOrdinals.some((ordinal) => !Number.isSafeInteger(ordinal))) {
        fail("quoted room-night ordinal is outside the supported integer range");
      }
      const componentRows = resolved.components.flatMap((night) => night.slab.components.map(
        (component, index) => Object.freeze({
          nightOrdinal: Number(night.ordinal),
          componentOrdinal: index,
          identity: component.identity,
          rateBasisPoints: component.rateBasisPoints,
        }),
      ));
      const calendarDatesArray = postgresArray(calendarDates);
      const calendarStatesArray = postgresArray(calendarStates);
      const nightOrdinalsArray = postgresArray(nightOrdinals);
      const nightDatesArray = postgresArray(resolved.components.map((night) => night.businessDate));
      const nightAmountsArray = postgresArray(resolved.components.map((night) => BigInt(night.quotedAmountMinor)));
      const slabUptoArray = postgresArray(resolved.components.map(
        (night) => night.slab.uptoMinor === null ? null : BigInt(night.slab.uptoMinor),
      ));
      const aggregateRatesArray = postgresArray(
        resolved.components.map((night) => night.slab.aggregateRateBasisPoints),
      );
      const itcEligibleArray = postgresArray(resolved.components.map((night) => night.slab.itcEligible));
      const componentNightOrdinalsArray = postgresArray(componentRows.map((component) => component.nightOrdinal));
      const componentOrdinalsArray = postgresArray(componentRows.map((component) => component.componentOrdinal));
      const componentIdentitiesArray = postgresArray(componentRows.map((component) => component.identity));
      const componentRatesArray = postgresArray(componentRows.map((component) => component.rateBasisPoints));
      const requestHash = digest({
        v: 1,
        tenantId,
        propertyNode,
        reservationId,
        folioId,
        lineageId: predecessor.reservationLineageId,
        attributionId: predecessor.attributionId,
        evidenceHash: resolved.evidenceHash,
        calendar,
      });
      const result = await this.#idempotency.execute<Record<string, JsonValue>>(
        tx,
        {
          tenantId,
          operation: "tax-fiscal.india-quoted-rate-applicability.record",
          key: input.idempotencyKey,
          request: { requestHash },
        },
        async (query) => {
          const selected = resolved.section14.selectedVersion;
          const section14 = predecessor.section14Result;
          const rows = await query<CapabilityRow[]>`
            SELECT *
            FROM public.record_india_gst_accommodation_quoted_rate_applicability(
              ${tenantId}::uuid,
              ${propertyNode}::uuid,
              ${reservationId}::uuid,
              ${folioId}::uuid,
              ${predecessor.reservationLineageId}::uuid,
              ${predecessor.attributionId}::uuid,
              ${requestId}::uuid,
              ${actorId}::uuid,
              ${predecessor.section14Input.serviceProvisionResult.serviceProvisionSnapshotId}::uuid,
              ${predecessor.section14Input.paymentReceiptResult.paymentReceiptSnapshotId}::uuid,
              ${predecessor.section14Input.invoiceIssueResult.invoiceIssueSnapshotId}::uuid,
              ${predecessor.componentIdentityInput.supplyNature.jurisdiction.extensionId}::uuid,
              ${predecessor.componentIdentityInput.supplyNature.classification.classificationId}::uuid,
              ${predecessor.componentIdentityInput.supplyNature.supplier.serviceLocation.id}::uuid,
              ${predecessor.componentIdentityInput.supplyNature.supplier.status.id}::uuid,
              ${predecessor.componentIdentityInput.supplyNature.recipient.status.id}::uuid,
              ${predecessor.componentIdentityInput.supplyNature.recipient.partyId}::uuid,
              ${resolved.section14.case},
              ${section14.serviceProvisionDate}::date,
              ${section14.invoiceIssueDate}::date,
              ${section14.paymentReceiptDate}::date,
              ${section14.rateChangeDate}::date,
              ${resolved.section14.timeOfSupplyDate}::date,
              ${resolved.section14.selectedVersionSide},
              ${selected.extensionId}::uuid,
              ${selected.version}::smallint,
              ${selected.status},
              ${selected.contentHash},
              ${selected.effectiveFromInstant}::timestamptz,
              ${selected.effectiveToInstant}::timestamptz,
              ${predecessor.componentIdentityResult.componentFamily},
              ${resolved.predecessorHashes.section14},
              ${resolved.predecessorHashes.levyComponentIdentity},
              ${resolved.predecessorHashes.reservationLineage},
              ${resolved.predecessorHashes.attributionSnapshot},
              ${resolved.evidenceHash},
              ${calendar?.authorityId ?? null},
              ${calendar?.sourceDigestSha256 ?? null},
              ${throughDate}::date,
              ${calendarDatesArray}::date[],
              ${calendarStatesArray}::text[],
              ${nightOrdinalsArray}::integer[],
              ${nightDatesArray}::date[],
              ${nightAmountsArray}::bigint[],
              ${slabUptoArray}::bigint[],
              ${aggregateRatesArray}::integer[],
              ${itcEligibleArray}::boolean[],
              ${componentNightOrdinalsArray}::integer[],
              ${componentOrdinalsArray}::smallint[],
              ${componentIdentitiesArray}::text[],
              ${componentRatesArray}::integer[]
            )
          `;
          const row = rows[0];
          if (rows.length !== 1 || !row || !UUID.test(row.applicability_id)
              || !HASH.test(row.evidence_hash) || typeof row.created !== "boolean"
              || row.evidence_hash !== resolved.evidenceHash) {
            throw new IndiaGstAccommodationQuotedRateApplicabilityRecorderConflictError(
              "Quoted rate-applicability capability returned invalid evidence",
            );
          }
          return {
            status: row.created ? 201 : 200,
            body: {
              applicabilityId: row.applicability_id,
              evidenceHash: row.evidence_hash,
              created: row.created,
            },
          };
        },
      );
      return { ...result.body, replayed: result.replayed } as
        IndiaGstAccommodationQuotedRateApplicabilityRecorderResult;
    } catch (error) {
      return mapDbError(error);
    }
  }
}
