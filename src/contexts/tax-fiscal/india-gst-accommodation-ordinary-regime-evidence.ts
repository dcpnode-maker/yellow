import { types as utilTypes } from "node:util";

import type { AuditEnvelope, Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const EVENT = "india_gst.accommodation_ordinary_regime_recorded";
const REGIME = "ordinary_rule47_30_day";
const SOURCE = "governed_rule47_ordinary_regime_record";
const LEGAL_BASIS = "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT";
const INPUT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "serviceProvisionSnapshotId",
  "regime", "ordinaryRegimeSource", "legalBasis", "ordinaryRegimeEvidenceSha256",
  "idempotencyKey", "envelope",
] as const;

export interface IndiaGstAccommodationOrdinaryRegimeEvidenceInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly regime: typeof REGIME;
  readonly ordinaryRegimeSource: typeof SOURCE;
  readonly legalBasis: typeof LEGAL_BASIS;
  readonly ordinaryRegimeEvidenceSha256: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

/** Persisted source identity, without per-command replay metadata. */
export interface IndiaGstAccommodationOrdinaryRegimeEvidence {
  readonly ordinaryRegimeEvidenceId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly regime: typeof REGIME;
  readonly ordinaryRegimeSource: typeof SOURCE;
  readonly legalBasis: typeof LEGAL_BASIS;
  readonly ordinaryRegimeEvidenceSha256: string;
  readonly evidenceHash: string;
}

export interface IndiaGstAccommodationOrdinaryRegimeEvidenceResult
  extends IndiaGstAccommodationOrdinaryRegimeEvidence {
  readonly created: boolean;
  readonly replayed: boolean;
}

export class IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError";
  }
}

export class IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError";
  }
}

export class IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError";
  }
}

interface CapabilityRow {
  readonly ordinary_regime_evidence_id: string;
  readonly service_provision_snapshot_id: string;
  readonly evidence_hash: string;
  readonly created: boolean;
}

function fail(message: string): never {
  throw new IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError(message);
}

function exact(value: unknown, keys: readonly string[], subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(`${subject} must be an exact plain record`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined
        || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    fail(`${subject} shape is invalid`);
  }
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value)
      || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("ordinary-regime evidence input must be an exact deeply frozen graph");
  }
  if (seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null) {
    fail("ordinary-regime evidence input must contain only plain records");
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) {
      fail("ordinary-regime evidence input contains invalid descriptors");
    }
    deeplyFrozen(descriptor.value, seen);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) fail(`${subject} must be a lowercase UUID`);
  return value;
}

function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) fail(`${subject} must be lowercase SHA-256`);
  return value;
}

function mapDbError(error: unknown): never {
  if ((typeof error !== "object" || error === null) && typeof error !== "function") {
    throw error;
  }
  const shaped = error as {
    readonly errno?: unknown;
    readonly sqlState?: unknown;
    readonly code?: unknown;
  };
  const rawState = shaped.errno ?? shaped.sqlState ?? shaped.code;
  const code = typeof rawState === "string" || typeof rawState === "number"
    ? String(rawState)
    : undefined;
  if (code === "42501") {
    throw new IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError(
      "Ordinary-regime evidence authority was not found",
    );
  }
  if (code === "55000" || code === "23505" || code === "23503") {
    throw new IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError(
      "Ordinary-regime evidence scope is stale or unavailable",
    );
  }
  if (code === "22023" || code === "22003" || code === "23514") {
    throw new IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError(
      "Ordinary-regime evidence is invalid",
    );
  }
  throw error;
}

export class IndiaGstAccommodationOrdinaryRegimeEvidenceService {
  async record(
    tx: Tx,
    input: IndiaGstAccommodationOrdinaryRegimeEvidenceInput,
  ): Promise<IndiaGstAccommodationOrdinaryRegimeEvidenceResult> {
    if (typeof tx !== "function") fail("tenant transaction is unavailable");
    deeplyFrozen(input);
    exact(input, INPUT_KEYS, "ordinary-regime evidence input");
    const tenantId = uuid(input.tenantId, "tenantId");
    const propertyNode = uuid(input.propertyNode, "propertyNode");
    const reservationId = uuid(input.reservationId, "reservationId");
    const serviceProvisionSnapshotId = uuid(input.serviceProvisionSnapshotId, "serviceProvisionSnapshotId");
    const ordinaryRegimeEvidenceSha256 = hash(
      input.ordinaryRegimeEvidenceSha256,
      "ordinaryRegimeEvidenceSha256",
    );
    if (input.regime !== REGIME || input.ordinaryRegimeSource !== SOURCE || input.legalBasis !== LEGAL_BASIS) {
      fail("ordinary Rule47 regime, source and legal basis must be affirmatively supplied");
    }
    if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
      fail("idempotencyKey is invalid");
    }
    exact(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "audit envelope");
    const actorId = uuid(input.envelope.actorId, "envelope.actorId");
    const requestId = uuid(input.envelope.requestId, "envelope.requestId");
    if (input.envelope.tenantId !== tenantId || input.envelope.propertyNode !== propertyNode
        || input.envelope.operation !== EVENT) {
      fail("audit envelope is invalid");
    }
    try {
      const rows = await tx<CapabilityRow[]>`
        SELECT *
        FROM public.record_india_gst_accommodation_ordinary_regime_evidence(
          ${tenantId}::uuid, ${propertyNode}::uuid, ${reservationId}::uuid,
          ${serviceProvisionSnapshotId}::uuid, ${REGIME}, ${SOURCE}, ${LEGAL_BASIS},
          ${ordinaryRegimeEvidenceSha256}, ${requestId}::uuid, ${actorId}::uuid,
          ${input.idempotencyKey}
        )
      `;
      const row = rows[0];
      if (rows.length !== 1 || !row || !UUID.test(row.ordinary_regime_evidence_id)
          || row.service_provision_snapshot_id !== serviceProvisionSnapshotId
          || !SHA256.test(row.evidence_hash) || typeof row.created !== "boolean") {
        throw new IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError(
          "Ordinary-regime capability returned invalid evidence",
        );
      }
      return Object.freeze({
        ordinaryRegimeEvidenceId: row.ordinary_regime_evidence_id,
        serviceProvisionSnapshotId,
        regime: REGIME,
        ordinaryRegimeSource: SOURCE,
        legalBasis: LEGAL_BASIS,
        ordinaryRegimeEvidenceSha256,
        evidenceHash: row.evidence_hash,
        created: row.created,
        replayed: !row.created,
      });
    } catch (error) {
      return mapDbError(error);
    }
  }
}
