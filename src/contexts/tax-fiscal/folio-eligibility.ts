import type { Tx } from "../../kernel";
import {
  parsePositiveTaxAttributionSnapshot,
  TaxAttributionSnapshotError,
  type PositiveTaxAttributionSnapshotV1,
} from "./attribution";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CURRENCY = /^[A-Z]{3}$/;

export interface PositiveTaxFolioEligibilityInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
}

export interface PositiveTaxFolioEligibilityResult {
  readonly lineageId: string;
  readonly bindingId: string;
  readonly attributionId: string;
  readonly reservationId: string;
  readonly segmentId: string;
  readonly folioId: string;
  readonly guestAccountId: string;
  readonly propertyNode: string;
  readonly quoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly snapshot: PositiveTaxAttributionSnapshotV1;
}

interface EligibilityRow {
  readonly lineage_id: string;
  readonly binding_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly property_node: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly currency: string;
  readonly attribution_property_node: string;
  readonly attribution_schema_version: number;
  readonly attribution_origin_kind: string;
  readonly attribution_origin_quote_hash: string;
  readonly attribution_snapshot_hash: string;
  readonly attribution_currency: string;
  readonly snapshot: unknown;
  readonly reservation_property_node: string;
  readonly reservation_currency: string;
  readonly primary_party: string;
  readonly segment_reservation_id: string;
  readonly segment_seq: number;
  readonly folio_id: string | null;
  readonly folio_account_id: string | null;
  readonly window_no: number | null;
  readonly folio_status: string | null;
  readonly account_id: string | null;
  readonly account_property_node: string | null;
  readonly account_role: string | null;
  readonly account_party_id: string | null;
  readonly account_currency: string | null;
  readonly account_status: string | null;
}

interface CanonicalEligibility {
  readonly row: EligibilityRow;
  readonly result: PositiveTaxFolioEligibilityResult;
}

export class PositiveTaxFolioEligibilityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxFolioEligibilityValidationError";
  }
}

export class PositiveTaxFolioEligibilityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxFolioEligibilityNotFoundError";
  }
}

export class PositiveTaxFolioEligibilityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxFolioEligibilityConflictError";
  }
}

function exactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new PositiveTaxFolioEligibilityValidationError(`${subject} must be a plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true)) {
    throw new PositiveTaxFolioEligibilityValidationError(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new PositiveTaxFolioEligibilityValidationError(`${subject} must be a canonical UUID`);
  }
  return value;
}

function normalize(input: PositiveTaxFolioEligibilityInput): PositiveTaxFolioEligibilityInput {
  const source = exactPlainRecord(
    input,
    ["tenantId", "propertyNode", "reservationId"],
    "eligibility input",
  );
  return Object.freeze({
    tenantId: uuid(source.tenantId, "tenantId"),
    propertyNode: uuid(source.propertyNode, "propertyNode"),
    reservationId: uuid(source.reservationId, "reservationId"),
  });
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new PositiveTaxFolioEligibilityConflictError(`${subject} is invalid`);
  }
  return value;
}

function parseStoredSnapshot(value: unknown): PositiveTaxAttributionSnapshotV1 {
  try {
    return parsePositiveTaxAttributionSnapshot(value);
  } catch (error) {
    if (error instanceof TaxAttributionSnapshotError) {
      throw new PositiveTaxFolioEligibilityConflictError(
        "Stored tax-attribution snapshot is not canonical",
      );
    }
    throw error;
  }
}

function canonical(row: EligibilityRow, input: PositiveTaxFolioEligibilityInput): CanonicalEligibility {
  const lineageId = storedUuid(row.lineage_id, "stored lineage id");
  const bindingId = storedUuid(row.binding_id, "stored hold binding id");
  const attributionId = storedUuid(row.attribution_id, "stored attribution id");
  const reservationId = storedUuid(row.reservation_id, "stored reservation id");
  const segmentId = storedUuid(row.segment_id, "stored segment id");
  const primaryParty = storedUuid(row.primary_party, "stored reservation primary Party");
  if (reservationId !== input.reservationId || row.property_node !== input.propertyNode ||
      row.reservation_property_node !== input.propertyNode ||
      row.attribution_property_node !== input.propertyNode ||
      row.segment_reservation_id !== reservationId || row.segment_seq !== 1 ||
      !SHA256.test(row.origin_quote_hash) || !SHA256.test(row.snapshot_hash) ||
      !CURRENCY.test(row.currency) || row.reservation_currency !== row.currency ||
      row.attribution_schema_version !== 1 || row.attribution_origin_kind !== "rate_quote" ||
      row.attribution_origin_quote_hash !== row.origin_quote_hash ||
      row.attribution_snapshot_hash !== row.snapshot_hash ||
      row.attribution_currency !== row.currency) {
    throw new PositiveTaxFolioEligibilityConflictError(
      "Quoted-tax reservation lineage is inconsistent",
    );
  }

  if (row.folio_id === null) {
    throw new PositiveTaxFolioEligibilityNotFoundError(
      "Quoted-tax reservation has no primary folio",
    );
  }
  const folioId = storedUuid(row.folio_id, "stored primary folio id");
  const folioAccountId = storedUuid(row.folio_account_id, "stored folio account id");
  const accountId = storedUuid(row.account_id, "stored guest account id");
  if (row.window_no !== 1 || row.folio_status !== "open" || folioAccountId !== accountId ||
      row.account_property_node !== input.propertyNode || row.account_role !== "guest" ||
      row.account_party_id !== primaryParty || row.account_currency !== row.currency ||
      row.account_status !== "open") {
    throw new PositiveTaxFolioEligibilityConflictError(
      "Primary folio or guest-account eligibility is inconsistent",
    );
  }

  const snapshot = parseStoredSnapshot(row.snapshot);
  if (snapshot.origin.kind !== "rate_quote" ||
      snapshot.origin.quoteHash !== row.origin_quote_hash ||
      snapshot.snapshotHash !== row.snapshot_hash || snapshot.currency !== row.currency) {
    throw new PositiveTaxFolioEligibilityConflictError(
      "Stored tax-attribution metadata does not match its canonical snapshot",
    );
  }

  return Object.freeze({
    row,
    result: Object.freeze({
      lineageId,
      bindingId,
      attributionId,
      reservationId,
      segmentId,
      folioId,
      guestAccountId: accountId,
      propertyNode: input.propertyNode,
      quoteHash: row.origin_quote_hash,
      snapshotHash: row.snapshot_hash,
      currency: row.currency,
      snapshot,
    }),
  });
}

async function read(
  tx: Tx,
  input: PositiveTaxFolioEligibilityInput,
): Promise<CanonicalEligibility> {
  const rows = await tx<EligibilityRow[]>`
    SELECT lineage.id::text AS lineage_id,
           lineage.binding_id::text AS binding_id,
           lineage.attribution_id::text AS attribution_id,
           lineage.reservation_id::text AS reservation_id,
           lineage.segment_id::text AS segment_id,
           lineage.property_node::text AS property_node,
           lineage.origin_quote_hash,
           lineage.snapshot_hash,
           lineage.currency::text AS currency,
           attribution.property_node::text AS attribution_property_node,
           attribution.schema_version::int AS attribution_schema_version,
           attribution.origin_kind AS attribution_origin_kind,
           attribution.origin_quote_hash AS attribution_origin_quote_hash,
           attribution.snapshot_hash AS attribution_snapshot_hash,
           attribution.currency::text AS attribution_currency,
           attribution.snapshot,
           reservation.property_node::text AS reservation_property_node,
           reservation.currency::text AS reservation_currency,
           reservation.primary_party::text AS primary_party,
           segment.reservation_id::text AS segment_reservation_id,
           segment.seq::int AS segment_seq,
           folio.id::text AS folio_id,
           folio.account_id::text AS folio_account_id,
           folio.window_no::int AS window_no,
           folio.status AS folio_status,
           account.id::text AS account_id,
           account.property_node::text AS account_property_node,
           account.role AS account_role,
           account.party_id::text AS account_party_id,
           account.currency::text AS account_currency,
           account.status AS account_status
    FROM tax_attribution_reservation_binding AS lineage
    JOIN tax_attribution_hold_binding AS hold_binding
      ON hold_binding.tenant_id = lineage.tenant_id
     AND hold_binding.id = lineage.binding_id
     AND hold_binding.property_node = lineage.property_node
     AND hold_binding.hold_id = lineage.hold_id
     AND hold_binding.attribution_id = lineage.attribution_id
     AND hold_binding.sellable_unit_id = lineage.sellable_unit_id
     AND hold_binding.period = lineage.period
     AND hold_binding.origin_quote_hash = lineage.origin_quote_hash
     AND hold_binding.snapshot_hash = lineage.snapshot_hash
     AND hold_binding.currency = lineage.currency
    JOIN tax_attribution_snapshot AS attribution
      ON attribution.tenant_id = lineage.tenant_id
     AND attribution.id = lineage.attribution_id
    JOIN reservation
      ON reservation.tenant_id = lineage.tenant_id
     AND reservation.id = lineage.reservation_id
    JOIN reservation_segment AS segment
      ON segment.tenant_id = lineage.tenant_id
     AND segment.id = lineage.segment_id
    LEFT JOIN folio
      ON folio.tenant_id = lineage.tenant_id
     AND folio.reservation_id = lineage.reservation_id
     AND folio.window_no = 1
    LEFT JOIN account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    WHERE lineage.tenant_id = ${input.tenantId}::uuid
      AND lineage.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND lineage.property_node = ${input.propertyNode}::uuid
      AND lineage.reservation_id = ${input.reservationId}::uuid
    ORDER BY lineage.id, folio.id
  `;
  if (rows.length === 0) {
    throw new PositiveTaxFolioEligibilityNotFoundError(
      "Quoted-tax reservation lineage is unavailable",
    );
  }
  if (rows.length !== 1 || !rows[0]) {
    throw new PositiveTaxFolioEligibilityConflictError(
      "Quoted-tax reservation eligibility is ambiguous",
    );
  }
  return canonical(rows[0], input);
}

function sameIdentity(
  before: PositiveTaxFolioEligibilityResult,
  after: PositiveTaxFolioEligibilityResult,
): boolean {
  return before.lineageId === after.lineageId && before.bindingId === after.bindingId &&
    before.attributionId === after.attributionId && before.reservationId === after.reservationId &&
    before.segmentId === after.segmentId && before.folioId === after.folioId &&
    before.guestAccountId === after.guestAccountId && before.propertyNode === after.propertyNode &&
    before.quoteHash === after.quoteHash && before.snapshotHash === after.snapshotHash &&
    before.currency === after.currency;
}

export class PositiveTaxFolioEligibilityService {
  async resolve(
    tx: Tx,
    input: PositiveTaxFolioEligibilityInput,
  ): Promise<PositiveTaxFolioEligibilityResult> {
    if (typeof tx !== "function") {
      throw new PositiveTaxFolioEligibilityValidationError(
        "tenant transaction is unavailable",
      );
    }
    const normalized = normalize(input);
    const before = await read(tx, normalized);

    await tx`
      SELECT public.lock_financial_rows(
        ${normalized.tenantId}::uuid,
        ARRAY[${before.result.guestAccountId}::uuid]::uuid[],
        ${before.result.folioId}::uuid
      )
    `;

    const after = await read(tx, normalized);
    if (!sameIdentity(before.result, after.result)) {
      throw new PositiveTaxFolioEligibilityConflictError(
        "Quoted-tax folio eligibility changed during lock acquisition",
      );
    }
    return after.result;
  }
}
