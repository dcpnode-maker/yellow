import { types as utilTypes } from "node:util";

import type { AuditEnvelope, JsonValue, PostgresIdempotency, Tx } from "../../kernel";
import {
  IndiaGstAccommodationFinalComponentTaxService,
} from "./india-gst-accommodation-final-component-tax";
import type {
  IndiaGstAccommodationQuotedRateApplicabilityInput,
} from "./india-gst-accommodation-quoted-rate-applicability";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const INTEGER = /^(?:0|[1-9][0-9]*)$/;
const MAX = 9223372036854775807n;
const EVENT = "india_gst.accommodation_final_component_tax_recorded";
const OPERATION = "tax-fiscal.india-accommodation-final-component-tax.record";
const INPUT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "folioId",
  "applicabilityId", "quotedRateApplicabilityInput", "expectedCurrentTaxId",
  "expectedCurrentEvidenceHash", "idempotencyKey", "envelope",
] as const;

export interface IndiaGstAccommodationFinalComponentTaxRecordingInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly applicabilityId: string;
  readonly quotedRateApplicabilityInput: IndiaGstAccommodationQuotedRateApplicabilityInput;
  readonly expectedCurrentTaxId: string | null;
  readonly expectedCurrentEvidenceHash: string | null;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface IndiaGstAccommodationFinalComponentTaxRecordingResult extends Readonly<Record<string, JsonValue>> {
  readonly taxId: string;
  readonly generation: number;
  readonly valuationId: string;
  readonly valuationGeneration: number;
  readonly transactionValueMinor: string;
  readonly taxMinor: string;
  readonly grandTotalMinor: string;
  readonly evidenceHash: string;
  readonly replayed: boolean;
}

export interface IndiaGstAccommodationFinalComponentTaxRecorderServiceOptions {
  readonly idempotency: PostgresIdempotency;
}

export class IndiaGstAccommodationFinalComponentTaxRecordingValidationError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationFinalComponentTaxRecordingValidationError"; }
}

export class IndiaGstAccommodationFinalComponentTaxRecordingConflictError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationFinalComponentTaxRecordingConflictError"; }
}

export class IndiaGstAccommodationFinalComponentTaxRecordingNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationFinalComponentTaxRecordingNotFoundError"; }
}

interface CapabilityRow {
  readonly tax_id: string;
  readonly generation: number;
  readonly valuation_id: string;
  readonly valuation_generation: number;
  readonly transaction_value_minor: string;
  readonly tax_minor: string;
  readonly grand_total_minor: string;
  readonly evidence_hash: string;
}

function fail(message: string): never {
  throw new IndiaGstAccommodationFinalComponentTaxRecordingValidationError(message);
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) return fail(`${subject} must be a lowercase UUID`);
  return value;
}

function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !HASH.test(value)) return fail(`${subject} must be lowercase SHA-256`);
  return value;
}

function exact(value: object, keys: readonly string[], subject: string): void {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((descriptor) => descriptor.enumerable !== true
        || descriptor.get !== undefined || descriptor.set !== undefined || !("value" in descriptor))) {
    fail(`${subject} shape is invalid`);
  }
}

function frozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || utilTypes.isProxy(value)
      || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("final component-tax recording input must be an exact deeply frozen graph");
  }
  if (seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null) fail("final component-tax recording input must contain plain records");
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (key === "length" && Array.isArray(value)) continue;
    if (descriptor.enumerable !== true || descriptor.get !== undefined || descriptor.set !== undefined
        || !("value" in descriptor)) fail("final component-tax recording input contains invalid descriptors");
    frozen(descriptor.value, seen);
  }
}

function generation(value: unknown, subject: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return fail(`${subject} is invalid`);
  return value;
}

function money(value: unknown, subject: string): string {
  if (typeof value !== "string" || !INTEGER.test(value) || BigInt(value) > MAX) return fail(`${subject} is invalid`);
  return value;
}

function mapDbError(error: unknown): never {
  const shaped = error as { readonly code?: string; readonly errno?: string };
  const code = shaped.code ?? shaped.errno;
  if (code === "42501") throw new IndiaGstAccommodationFinalComponentTaxRecordingNotFoundError("Final component-tax authority was not found");
  if (code === "55000" || code === "23505" || code === "23503") throw new IndiaGstAccommodationFinalComponentTaxRecordingConflictError("Final component-tax scope is stale or unavailable");
  if (code === "22023" || code === "22003" || code === "23514") throw new IndiaGstAccommodationFinalComponentTaxRecordingValidationError("Final component-tax evidence is invalid");
  throw error;
}

export class IndiaGstAccommodationFinalComponentTaxRecorderService {
  readonly #idempotency: PostgresIdempotency;

  constructor(options: IndiaGstAccommodationFinalComponentTaxRecorderServiceOptions) {
    this.#idempotency = options.idempotency;
  }

  async record(tx: Tx, input: IndiaGstAccommodationFinalComponentTaxRecordingInput): Promise<IndiaGstAccommodationFinalComponentTaxRecordingResult> {
    if (typeof tx !== "function" || typeof input !== "object" || input === null || Array.isArray(input)
        || utilTypes.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype
        || Object.getOwnPropertySymbols(input).length !== 0) fail("final component-tax recording input is invalid");
    frozen(input);
    exact(input, INPUT_KEYS, "final component-tax recording input");
    const tenant = uuid(input.tenantId, "tenantId");
    const property = uuid(input.propertyNode, "propertyNode");
    const reservation = uuid(input.reservationId, "reservationId");
    const folio = uuid(input.folioId, "folioId");
    const applicability = uuid(input.applicabilityId, "applicabilityId");
    const actor = uuid(input.envelope.actorId, "envelope.actorId");
    const requestId = uuid(input.envelope.requestId, "envelope.requestId");
    if (input.envelope.tenantId !== tenant || input.envelope.propertyNode !== property
        || input.envelope.operation !== EVENT) fail("audit envelope is invalid");
    if (typeof input.idempotencyKey !== "string" || !KEY.test(input.idempotencyKey)) fail("idempotency key is invalid");
    const expected = input.expectedCurrentTaxId === null ? null : uuid(input.expectedCurrentTaxId, "expectedCurrentTaxId");
    const expectedHash = input.expectedCurrentEvidenceHash === null
      ? null : hash(input.expectedCurrentEvidenceHash, "expectedCurrentEvidenceHash");
    if ((expected === null) !== (expectedHash === null)) fail("expected current tax id and hash must be supplied together");
    if (input.quotedRateApplicabilityInput.tenantId !== tenant
        || input.quotedRateApplicabilityInput.propertyNode !== property
        || input.quotedRateApplicabilityInput.reservationId !== reservation
        || input.quotedRateApplicabilityInput.folioId !== folio) fail("quoted rate-applicability scope conflicts with recording scope");

    try {
      const calculated = await new IndiaGstAccommodationFinalComponentTaxService().calculate(tx, Object.freeze({
        tenantId: tenant,
        propertyNode: property,
        reservationId: reservation,
        folioId: folio,
        quotedRateApplicabilityInput: input.quotedRateApplicabilityInput,
      }));
      const lineageId = uuid(input.quotedRateApplicabilityInput.reservationLineageId, "reservationLineageId");
      const attributionId = uuid(input.quotedRateApplicabilityInput.attributionId, "attributionId");
      const predecessorExtensionId = uuid(input.quotedRateApplicabilityInput.section14Input.rateVersionPair.predecessor.extensionId, "predecessorExtensionId");
      const successorExtensionId = uuid(input.quotedRateApplicabilityInput.section14Input.rateVersionPair.successor.extensionId, "successorExtensionId");
      const idempotent = await this.#idempotency.execute<Record<string, JsonValue>>(tx, {
        tenantId: tenant,
        operation: OPERATION,
        key: input.idempotencyKey,
        request: {
          tenant, property, reservation, folio, applicabilityId: applicability,
          lineageId, attributionId,
          predecessorExtensionId, successorExtensionId,
          valuationId: calculated.valuationId,
          valuationGeneration: calculated.generation,
          calculatedEvidenceHash: calculated.evidenceHash,
          expected, expectedHash,
        },
      }, async (q) => {
        const rows = await q<CapabilityRow[]>`
          SELECT * FROM public.record_india_gst_accommodation_final_component_tax(
            ${tenant}::uuid, ${property}::uuid, ${reservation}::uuid, ${folio}::uuid,
            ${applicability}::uuid,
            ${requestId}::uuid, ${actor}::uuid, ${expected}::uuid, ${expectedHash}
          )
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row) throw new IndiaGstAccommodationFinalComponentTaxRecordingConflictError("Final component-tax capability returned invalid evidence");
        const body = {
          taxId: uuid(row.tax_id, "recorded tax id"),
          generation: generation(row.generation, "recorded tax generation"),
          valuationId: uuid(row.valuation_id, "recorded valuation id"),
          valuationGeneration: generation(row.valuation_generation, "recorded valuation generation"),
          transactionValueMinor: money(row.transaction_value_minor, "recorded transaction value"),
          taxMinor: money(row.tax_minor, "recorded tax"),
          grandTotalMinor: money(row.grand_total_minor, "recorded grand total"),
          evidenceHash: hash(row.evidence_hash, "recorded evidence hash"),
        };
        if (body.valuationId !== calculated.valuationId || body.valuationGeneration !== calculated.generation
            || body.transactionValueMinor !== calculated.roomNights.reduce((sum, night) => sum + BigInt(night.transactionValueMinor), 0n).toString()
            || body.taxMinor !== calculated.taxMinor || body.grandTotalMinor !== calculated.grandTotalMinor
            || body.evidenceHash !== calculated.evidenceHash) {
          throw new IndiaGstAccommodationFinalComponentTaxRecordingConflictError("Database-derived final component-tax evidence diverges from the independent calculation");
        }
        return { status: 201, body };
      });
      return { ...idempotent.body, replayed: idempotent.replayed } as IndiaGstAccommodationFinalComponentTaxRecordingResult;
    } catch (error) {
      return mapDbError(error);
    }
  }
}
