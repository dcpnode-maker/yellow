import {
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const CURRENCY = /^[A-Z]{3}$/;
const ELIGIBLE_STATUSES = ["reserved", "due_in", "in_house", "due_out"] as const;

export type FolioEligibleReservationStatus = typeof ELIGIBLE_STATUSES[number];

export interface OpenPrimaryFolioInput {
  readonly tenantId: string;
  readonly reservationId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface OpenPrimaryFolioResult {
  readonly folioId: string;
  readonly accountId: string;
  readonly reservationId: string;
  readonly folioNo: string;
  readonly windowNo: 1;
  readonly changed: boolean;
  readonly replayed: boolean;
}

export interface FolioServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedOpenPrimary {
  readonly tenantId: string;
  readonly reservationId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface ReservationRow {
  readonly id: string;
  readonly status: string;
  readonly property_node: string;
  readonly primary_party: string;
  readonly currency: string;
}

interface AccountRow {
  readonly id: string;
  readonly property_node: string | null;
  readonly role: string;
  readonly party_id: string | null;
  readonly currency: string;
  readonly status: string;
}

interface FolioRow {
  readonly id: string;
  readonly account_id: string;
  readonly reservation_id: string | null;
  readonly folio_no: string | null;
  readonly window_no: number;
  readonly status: string;
}

interface SeriesRow {
  readonly id: string;
  readonly next_no: number | bigint;
}

interface AllocatedSeriesRow {
  readonly folio_no: string;
}

interface OpenPrimaryBody extends Readonly<Record<string, JsonValue>> {
  readonly folioId: string;
  readonly accountId: string;
  readonly reservationId: string;
  readonly folioNo: string;
  readonly windowNo: 1;
  readonly changed: boolean;
}

export class FolioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolioValidationError";
  }
}

export class FolioNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolioNotFoundError";
  }
}

export class FolioConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolioConflictError";
  }
}

function requireExactKeys(name: string, value: object, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key)).sort();
  if (unexpected.length > 0) {
    throw new FolioValidationError(`${name} contains unsupported fields: ${unexpected.join(", ")}`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new FolioValidationError(`${name} must be a UUID`);
  }
  return value;
}

function normalize(input: OpenPrimaryFolioInput): NormalizedOpenPrimary {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new FolioValidationError("Primary folio input must be an object");
  }
  requireExactKeys("Primary folio input", input, [
    "tenantId", "reservationId", "idempotencyKey", "envelope",
  ]);
  if (typeof input.envelope !== "object" || input.envelope === null || Array.isArray(input.envelope)) {
    throw new FolioValidationError("envelope must be an audit envelope");
  }
  requireExactKeys("envelope", input.envelope, [
    "actorId", "tenantId", "propertyNode", "requestId", "operation",
  ]);
  const tenantId = requireUuid("tenantId", input.tenantId);
  const envelopeTenantId = requireUuid("envelope.tenantId", input.envelope.tenantId);
  if (tenantId !== envelopeTenantId) {
    throw new FolioValidationError("tenantId must match the audit envelope tenant");
  }
  requireUuid("envelope.actorId", input.envelope.actorId);
  requireUuid("envelope.propertyNode", input.envelope.propertyNode);
  requireUuid("envelope.requestId", input.envelope.requestId);
  if (input.envelope.operation !== "folio.opened") {
    throw new FolioValidationError("audit operation must be folio.opened");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new FolioValidationError("idempotencyKey must contain 8-200 visible ASCII characters");
  }
  return Object.freeze({
    tenantId,
    reservationId: requireUuid("reservationId", input.reservationId),
    idempotencyKey: input.idempotencyKey,
    envelope: input.envelope,
  });
}

function eligibleStatus(value: string): FolioEligibleReservationStatus {
  if (ELIGIBLE_STATUSES.includes(value as FolioEligibleReservationStatus)) {
    return value as FolioEligibleReservationStatus;
  }
  throw new FolioConflictError("Reservation status is not eligible for a primary folio");
}

function storedFolio(row: FolioRow, canonicalAccountId: string): OpenPrimaryBody {
  if (!UUID.test(row.id) || row.account_id !== canonicalAccountId || row.reservation_id === null ||
      !UUID.test(row.reservation_id) || row.window_no !== 1 || row.folio_no === null ||
      row.folio_no.length === 0 || row.status !== "open") {
    throw new FolioConflictError("Existing primary folio has an inconsistent canonical relationship");
  }
  return Object.freeze({
    folioId: row.id,
    accountId: row.account_id,
    reservationId: row.reservation_id,
    folioNo: row.folio_no,
    windowNo: 1,
    changed: false,
  });
}

export class FolioService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: FolioServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async openPrimary(tx: Tx, input: OpenPrimaryFolioInput): Promise<OpenPrimaryFolioResult> {
    const normalized = normalize(input);
    const outcome = await this.#idempotency.execute<OpenPrimaryBody>(tx, {
      tenantId: normalized.tenantId,
      operation: "financials.folio.open",
      key: normalized.idempotencyKey,
      request: {
        actorId: normalized.envelope.actorId,
        propertyNode: normalized.envelope.propertyNode,
        reservationId: normalized.reservationId,
      },
    }, async (commandTx) => {
      await commandTx`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`${normalized.tenantId}:reservation:${normalized.reservationId}`}, 103)
        )
      `;
      const reservations = await commandTx<ReservationRow[]>`
        SELECT
          reservation.id,
          reservation.status,
          reservation.property_node,
          reservation.primary_party,
          reservation.currency::text
        FROM reservation
        JOIN org_node AS property
          ON property.id = reservation.property_node
         AND property.tenant_id = reservation.tenant_id
         AND property.kind = 'property'
        JOIN party AS primary_party
          ON primary_party.id = reservation.primary_party
         AND primary_party.tenant_id = reservation.tenant_id
        WHERE reservation.id = ${normalized.reservationId}::uuid
          AND reservation.tenant_id = ${normalized.tenantId}::uuid
          AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
        FOR UPDATE OF reservation
      `;
      const reservation = reservations[0];
      if (!reservation) {
        throw new FolioNotFoundError("Reservation was not found with canonical tenant relationships");
      }
      eligibleStatus(reservation.status);
      if (reservation.property_node !== normalized.envelope.propertyNode) {
        throw new FolioNotFoundError("Reservation was not found in the audit property");
      }
      if (!UUID.test(reservation.primary_party) || !CURRENCY.test(reservation.currency)) {
        throw new FolioConflictError("Reservation financial ownership is invalid");
      }

      const accountLockKey = [
        normalized.tenantId,
        reservation.property_node,
        "guest",
        reservation.primary_party,
        reservation.currency,
      ].join(":");
      await commandTx`
        SELECT pg_advisory_xact_lock(hashtextextended(${accountLockKey}, 103))
      `;

      const accounts = await commandTx<AccountRow[]>`
        SELECT id, property_node, role, party_id, currency::text, status
        FROM account
        WHERE tenant_id = ${normalized.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${reservation.property_node}::uuid
          AND role = 'guest'
          AND party_id = ${reservation.primary_party}::uuid
          AND currency = ${reservation.currency}::char(3)
        ORDER BY id
        FOR UPDATE
      `;
      if (accounts.length > 1) {
        throw new FolioConflictError("Canonical guest account is ambiguous");
      }

      let account = accounts[0];
      if (account && account.status !== "open") {
        throw new FolioConflictError("Canonical guest account is not open");
      }
      if (!account) {
        const created = await commandTx<AccountRow[]>`
          INSERT INTO account (
            tenant_id, property_node, role, party_id, name, currency, status
          )
          VALUES (
            ${normalized.tenantId}::uuid, ${reservation.property_node}::uuid, 'guest',
            ${reservation.primary_party}::uuid, 'Guest account', ${reservation.currency}::char(3), 'open'
          )
          RETURNING id, property_node, role, party_id, currency::text, status
        `;
        account = created[0];
        if (!account) throw new Error("PostgreSQL did not return the created guest account");
      }
      if (account.property_node !== reservation.property_node || account.role !== "guest" ||
          account.party_id !== reservation.primary_party || account.currency !== reservation.currency ||
          account.status !== "open") {
        throw new FolioConflictError("Canonical guest account relationship is inconsistent");
      }

      const existingFolios = await commandTx<FolioRow[]>`
        SELECT id, account_id, reservation_id, folio_no, window_no, status
        FROM folio
        WHERE tenant_id = ${normalized.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND reservation_id = ${normalized.reservationId}::uuid
          AND window_no = 1
        ORDER BY id
        FOR UPDATE
      `;
      if (existingFolios.length > 1) {
        throw new FolioConflictError("Reservation has ambiguous primary folios");
      }
      const existing = existingFolios[0];
      if (existing) {
        return { status: 200, body: storedFolio(existing, account.id) };
      }

      const series = await commandTx<SeriesRow[]>`
        SELECT id, next_no
        FROM document_series
        WHERE tenant_id = ${normalized.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${reservation.property_node}::uuid
          AND kind = 'folio'
          AND fiscal = false
        ORDER BY id
        FOR UPDATE
      `;
      if (series.length !== 1) {
        throw new FolioConflictError("Property must have exactly one non-fiscal folio series");
      }
      const folioSeries = series[0];
      if (!folioSeries || BigInt(folioSeries.next_no) < 1n) {
        throw new FolioConflictError("Folio series counter is invalid");
      }
      const allocated = await commandTx<AllocatedSeriesRow[]>`
        UPDATE document_series
        SET next_no = next_no + 1
        WHERE id = ${folioSeries.id}::uuid
          AND tenant_id = ${normalized.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${reservation.property_node}::uuid
          AND kind = 'folio'
          AND fiscal = false
        RETURNING prefix || (next_no - 1)::text AS folio_no
      `;
      const folioNo = allocated[0]?.folio_no;
      if (!folioNo) throw new Error("PostgreSQL did not allocate the folio reference");

      const folios = await commandTx<FolioRow[]>`
        INSERT INTO folio (
          tenant_id, account_id, reservation_id, folio_no, window_no, name, status
        )
        VALUES (
          ${normalized.tenantId}::uuid, ${account.id}::uuid,
          ${normalized.reservationId}::uuid, ${folioNo}, 1, 'Primary', 'open'
        )
        RETURNING id, account_id, reservation_id, folio_no, window_no, status
      `;
      const folio = folios[0];
      if (!folio) throw new Error("PostgreSQL did not return the opened primary folio");
      const payload = Object.freeze({
        folio_id: folio.id,
        account_id: account.id,
        reservation_id: normalized.reservationId,
        window_no: 1,
        folio_no: folioNo,
      });
      const fact = await recordFact(commandTx, {
        entityType: "folio",
        entityId: folio.id,
        envelope: normalized.envelope,
        payload,
      });
      await this.#events.publish(commandTx, {
        tenantId: normalized.tenantId,
        propertyNode: reservation.property_node,
        businessDate: fact.businessDate,
        aggregateType: "folio",
        aggregateId: folio.id,
        eventType: "folio.opened",
        actorId: normalized.envelope.actorId,
        correlationId: normalized.envelope.requestId,
        payload,
      });
      return {
        status: 201,
        body: Object.freeze({
          folioId: folio.id,
          accountId: account.id,
          reservationId: normalized.reservationId,
          folioNo,
          windowNo: 1,
          changed: true,
        }),
      };
    });
    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }
}
