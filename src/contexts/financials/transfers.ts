import {
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import type { FolioService } from "./folios";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const TOKEN = /^[\x21-\x7e]{1,512}$/;

export interface FolioTransferInput {
  readonly tenantId: string;
  readonly sourceFolioId: string;
  readonly destinationFolioId?: string;
  readonly newWindowName?: string;
  readonly groupIds: readonly string[];
  readonly reason: string;
  readonly generation: string;
  readonly previewRevision: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface FolioTransferMemberEffect extends Readonly<Record<string, JsonValue>> {
  readonly rootLineId: string;
  readonly groupId: string;
  readonly amountMinor: string;
  readonly sourceEffectMinor: string;
  readonly destinationEffectMinor: string;
  readonly txCode: string;
  readonly description: string | null;
  readonly quantity: string;
}

export interface FolioTransferPreviewResult extends Readonly<Record<string, JsonValue>> {
  readonly sourceFolioId: string;
  readonly destinationFolioId: string | null;
  readonly destinationName: string | null;
  readonly destinationWindowNo: number;
  readonly currency: string;
  readonly sourceBeforeMinor: string;
  readonly sourceAfterMinor: string;
  readonly destinationBeforeMinor: string;
  readonly destinationAfterMinor: string;
  readonly stayTotalMinor: string;
  readonly unchangedStayTotalMinor: string;
  readonly memberEffects: readonly FolioTransferMemberEffect[];
  readonly generation: string;
  readonly previewRevision: string;
}

export interface FolioTransferResult extends FolioTransferPreviewResult {
  readonly journalId: string;
  readonly businessDate: string;
  readonly replayed: boolean;
}

export interface FolioTransferServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
  readonly folios: FolioService;
}

interface NormalizedTransfer {
  readonly tenantId: string;
  readonly sourceFolioId: string;
  readonly destinationFolioId?: string;
  readonly newWindowName?: string;
  readonly groupIds: readonly string[];
  readonly reason: string;
  readonly generation: string;
  readonly previewRevision: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface FamilyRow {
  readonly id: string;
  readonly account_id: string;
  readonly reservation_id: string | null;
  readonly folio_no: string | null;
  readonly window_no: number;
  readonly name: string | null;
  readonly status: string;
  readonly property_node: string;
  readonly account_status: string;
  readonly account_role: string;
  readonly currency: string;
  readonly balance_minor: string;
}

interface RootRow {
  readonly group_id: string;
  readonly root_line_id: string;
  readonly current_folio_id: string;
  readonly amount_minor: string;
  readonly tx_code: string;
  readonly description: string | null;
  readonly quantity: string;
  readonly member_count: number;
}

interface CapabilityRow {
  readonly journal_id: string;
  readonly property_node: string;
  readonly business_date: string | Date;
  readonly currency: string;
  readonly source_folio_id: string;
  readonly destination_folio_id: string;
  readonly root_line_id: string;
  readonly amount_minor: string;
  readonly tx_code: string;
  readonly description: string | null;
  readonly quantity: string;
}

interface TransferBody extends Readonly<Record<string, JsonValue>> {
  readonly journalId: string;
  readonly businessDate: string;
  readonly sourceFolioId: string;
  readonly destinationFolioId: string;
  readonly destinationName: string | null;
  readonly destinationWindowNo: number;
  readonly currency: string;
  readonly sourceBeforeMinor: string;
  readonly sourceAfterMinor: string;
  readonly destinationBeforeMinor: string;
  readonly destinationAfterMinor: string;
  readonly stayTotalMinor: string;
  readonly unchangedStayTotalMinor: string;
  readonly memberEffects: readonly FolioTransferMemberEffect[];
  readonly generation: string;
  readonly previewRevision: string;
}

export class FolioTransferValidationError extends Error {
  constructor(message: string) { super(message); this.name = "FolioTransferValidationError"; }
}

export class FolioTransferNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "FolioTransferNotFoundError"; }
}

export class FolioTransferConflictError extends Error {
  constructor(message: string) { super(message); this.name = "FolioTransferConflictError"; }
}

function plainRecord(name: string, value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length > 0) {
    throw new FolioTransferValidationError(`${name} must be a plain object`);
  }
}

function uuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new FolioTransferValidationError(`${name} must be a lowercase UUID`);
  }
  return value;
}

function postgresUuidArray(values: readonly string[]): string {
  return `{${values.join(",")}}`;
}

function canonicalBusinessDate(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  throw new FolioTransferConflictError("Transfer capability returned an invalid business date");
}

function normalize(input: FolioTransferInput): NormalizedTransfer {
  plainRecord("Transfer input", input);
  const allowed = new Set([
    "tenantId", "sourceFolioId", "destinationFolioId", "newWindowName", "groupIds",
    "reason", "generation", "previewRevision", "idempotencyKey", "envelope",
  ]);
  const unsupported = Object.getOwnPropertyNames(input).filter((key) => !allowed.has(key)).sort();
  if (unsupported.length > 0) {
    throw new FolioTransferValidationError(`Transfer input contains unsupported fields: ${unsupported.join(", ")}`);
  }
  plainRecord("envelope", input.envelope);
  const envelopeKeys = ["actorId", "tenantId", "propertyNode", "requestId", "operation"].sort();
  const actualEnvelopeKeys = Object.getOwnPropertyNames(input.envelope).sort();
  if (actualEnvelopeKeys.length !== envelopeKeys.length ||
      actualEnvelopeKeys.some((key, index) => key !== envelopeKeys[index])) {
    throw new FolioTransferValidationError("envelope shape is invalid");
  }
  const tenantId = uuid("tenantId", input.tenantId);
  if (uuid("envelope.tenantId", input.envelope.tenantId) !== tenantId) {
    throw new FolioTransferValidationError("tenantId must match the audit envelope tenant");
  }
  uuid("envelope.actorId", input.envelope.actorId);
  uuid("envelope.propertyNode", input.envelope.propertyNode);
  uuid("envelope.requestId", input.envelope.requestId);
  if (input.envelope.operation !== "journal.posted") {
    throw new FolioTransferValidationError("audit operation must be journal.posted");
  }
  const hasDestination = input.destinationFolioId !== undefined;
  const hasNewWindow = input.newWindowName !== undefined;
  if (hasDestination === hasNewWindow) {
    throw new FolioTransferValidationError("exactly one destination folio or new window name is required");
  }
  const destinationFolioId = hasDestination ? uuid("destinationFolioId", input.destinationFolioId) : undefined;
  if (destinationFolioId === input.sourceFolioId) {
    throw new FolioTransferValidationError("source and destination folios must differ");
  }
  let newWindowName: string | undefined;
  if (hasNewWindow) {
    if (typeof input.newWindowName !== "string") throw new FolioTransferValidationError("newWindowName must be text");
    newWindowName = input.newWindowName.trim();
    if (Array.from(newWindowName).length < 1 || Array.from(newWindowName).length > 80 ||
        /[\u0000-\u001f\u007f]/u.test(newWindowName)) {
      throw new FolioTransferValidationError("newWindowName must contain 1-80 visible characters");
    }
  }
  if (!Array.isArray(input.groupIds) || input.groupIds.length < 1 || input.groupIds.length > 50) {
    throw new FolioTransferValidationError("groupIds must contain 1-50 UUIDs");
  }
  const groupIds = input.groupIds.map((value, index) => uuid(`groupIds[${index}]`, value));
  if (new Set(groupIds).size !== groupIds.length) {
    throw new FolioTransferValidationError("groupIds must be unique");
  }
  if (typeof input.reason !== "string") throw new FolioTransferValidationError("reason must be text");
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500 || /[\u0000-\u001f\u007f]/u.test(reason)) {
    throw new FolioTransferValidationError("reason must contain 1-500 visible characters");
  }
  if (typeof input.generation !== "string" || !TOKEN.test(input.generation)) {
    throw new FolioTransferValidationError("generation must be a bounded opaque token");
  }
  if (typeof input.previewRevision !== "string" || input.previewRevision.length > 512 ||
      (input.previewRevision.length > 0 && !TOKEN.test(input.previewRevision))) {
    throw new FolioTransferValidationError("previewRevision must be a bounded opaque token");
  }
  if (typeof input.idempotencyKey !== "string" || !KEY.test(input.idempotencyKey)) {
    throw new FolioTransferValidationError("idempotencyKey must contain 8-200 visible ASCII characters");
  }
  return Object.freeze({
    tenantId,
    sourceFolioId: uuid("sourceFolioId", input.sourceFolioId),
    ...(destinationFolioId ? { destinationFolioId } : {}),
    ...(newWindowName ? { newWindowName } : {}),
    groupIds: Object.freeze([...groupIds].sort()),
    reason,
    generation: input.generation,
    previewRevision: input.previewRevision,
    idempotencyKey: input.idempotencyKey,
    envelope: input.envelope,
  });
}

function hash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function familyGeneration(family: readonly FamilyRow[]): string {
  const canonical = family.map((folio) => `${folio.id}:${folio.window_no}:${folio.balance_minor}`).join("|");
  return new Bun.CryptoHasher("md5").update(canonical).digest("hex");
}

function add(left: string, right: bigint): string { return (BigInt(left) + right).toString(); }

export class FolioTransferService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #folios: FolioService;

  constructor(options: FolioTransferServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
    this.#folios = options.folios;
  }

  async preview(tx: Tx, input: FolioTransferInput): Promise<FolioTransferPreviewResult>;
  async preview(tx: Tx, input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>>;
  async preview(
    tx: Tx, input: FolioTransferInput | Readonly<Record<string, unknown>>,
  ): Promise<FolioTransferPreviewResult> {
    return this.#loadPreview(tx, normalize(input as FolioTransferInput));
  }

  async transfer(tx: Tx, input: FolioTransferInput): Promise<FolioTransferResult>;
  async transfer(tx: Tx, input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>>;
  async transfer(
    tx: Tx, input: FolioTransferInput | Readonly<Record<string, unknown>>,
  ): Promise<FolioTransferResult> {
    const normalized = normalize(input as FolioTransferInput);
    const outcome = await this.#idempotency.execute<TransferBody>(tx, {
      tenantId: normalized.tenantId,
      operation: "financials.folio.transfer",
      key: normalized.idempotencyKey,
      request: {
        actorId: normalized.envelope.actorId,
        propertyNode: normalized.envelope.propertyNode,
        sourceFolioId: normalized.sourceFolioId,
        destinationFolioId: normalized.destinationFolioId ?? null,
        newWindowName: normalized.newWindowName ?? null,
        groupIds: normalized.groupIds,
        reason: normalized.reason,
        generation: normalized.generation,
        previewRevision: normalized.previewRevision,
      },
    }, async (commandTx) => {
      const preview = await this.#loadPreview(commandTx, normalized);
      if (normalized.previewRevision.length === 0 || preview.previewRevision !== normalized.previewRevision) {
        throw new FolioTransferConflictError("Transfer preview is stale");
      }

      let destinationFolioId = normalized.destinationFolioId;
      if (!destinationFolioId && normalized.newWindowName) {
        const sourceBinding = (await commandTx<Array<{ reservation_id: string | null }>>`
          SELECT reservation_id FROM folio
          WHERE tenant_id=${normalized.tenantId}::uuid
            AND tenant_id=current_setting('app.tenant_id', true)::uuid
            AND id=${normalized.sourceFolioId}::uuid
        `)[0];
        if (!sourceBinding?.reservation_id) {
          throw new FolioTransferConflictError("Source reservation binding disappeared");
        }
        const windowKey = `folio-transfer-window:${hash(normalized.idempotencyKey).slice(0, 48)}`;
        const opened = await this.#folios.openAdditional(commandTx, {
          tenantId: normalized.tenantId,
          reservationId: sourceBinding.reservation_id,
          sourceFolioId: normalized.sourceFolioId,
          name: normalized.newWindowName,
          idempotencyKey: windowKey,
          envelope: Object.freeze({ ...normalized.envelope, operation: "folio.opened" }),
        });
        if (opened.windowNo !== preview.destinationWindowNo || opened.name !== preview.destinationName ||
            opened.currency !== preview.currency) {
          throw new FolioTransferConflictError("New destination window diverged from the preview");
        }
        destinationFolioId = opened.folioId;
      }
      if (!destinationFolioId) throw new Error("Transfer destination was not resolved");
      const rootLineIds = preview.memberEffects.map((effect) => effect.rootLineId).sort();
      const rows = await commandTx<CapabilityRow[]>`
        SELECT * FROM public.create_folio_transfer(
          ${normalized.tenantId}::uuid,
          ${normalized.sourceFolioId}::uuid,
          ${destinationFolioId}::uuid,
          ${postgresUuidArray(rootLineIds)}::uuid[],
          ${normalized.envelope.actorId}::uuid,
          ${normalized.reason}
        )
      `;
      if (rows.length !== rootLineIds.length || rows.length < 1) {
        throw new FolioTransferConflictError("Transfer capability returned an incomplete result");
      }
      const first = rows[0]!;
      const businessDate = canonicalBusinessDate(first.business_date);
      const returnedRoots = rows.map((row) => row.root_line_id).sort();
      const coherent = UUID.test(first.journal_id) && first.property_node === normalized.envelope.propertyNode &&
        first.source_folio_id === normalized.sourceFolioId && first.destination_folio_id === destinationFolioId &&
        first.currency === preview.currency && returnedRoots.every((root, index) => root === rootLineIds[index]) &&
        rows.every((row) => row.journal_id === first.journal_id && row.property_node === first.property_node &&
          canonicalBusinessDate(row.business_date) === businessDate && row.currency === first.currency &&
          row.source_folio_id === first.source_folio_id && row.destination_folio_id === first.destination_folio_id);
      if (!coherent) throw new FolioTransferConflictError("Transfer capability returned inconsistent metadata");
      for (const effect of preview.memberEffects) {
        const row = rows.find((candidate) => candidate.root_line_id === effect.rootLineId);
        if (!row || row.amount_minor !== effect.amountMinor || row.tx_code !== effect.txCode ||
            row.description !== effect.description || row.quantity !== effect.quantity) {
          throw new FolioTransferConflictError("Transfer capability changed a previewed member effect");
        }
      }

      const payload = Object.freeze({
        journal_id: first.journal_id,
        source_folio_id: normalized.sourceFolioId,
        destination_folio_id: destinationFolioId,
        root_line_ids: Object.freeze(rootLineIds),
        reason: normalized.reason,
      });
      const fact = await recordFact(commandTx, {
        entityType: "journal", entityId: first.journal_id, envelope: normalized.envelope, payload,
      });
      if (fact.businessDate !== businessDate) {
        throw new Error("Audit and transfer business dates diverged");
      }
      await this.#events.publish(commandTx, {
        tenantId: normalized.tenantId,
        propertyNode: first.property_node,
        businessDate,
        aggregateType: "journal",
        aggregateId: first.journal_id,
        eventType: "journal.posted",
        actorId: normalized.envelope.actorId,
        correlationId: normalized.envelope.requestId,
        payload,
      });
      return {
        status: 201,
        body: Object.freeze({
          ...preview,
          journalId: first.journal_id,
          businessDate,
          destinationFolioId,
        }),
      };
    });
    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }

  async #loadPreview(tx: Tx, input: NormalizedTransfer): Promise<FolioTransferPreviewResult> {
    const family = await tx<FamilyRow[]>`
      WITH source AS MATERIALIZED (
        SELECT f.tenant_id, f.id, f.account_id, f.reservation_id, a.property_node, a.currency
        FROM folio f JOIN account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
        WHERE f.tenant_id=${input.tenantId}::uuid
          AND f.tenant_id=current_setting('app.tenant_id', true)::uuid
          AND f.id=${input.sourceFolioId}::uuid
      )
      SELECT f.id, f.account_id, f.reservation_id, f.folio_no, f.window_no, f.name, f.status,
             a.property_node, a.status AS account_status, a.role AS account_role, a.currency::text,
             COALESCE(b.balance_minor,0)::text AS balance_minor
      FROM source s
      JOIN folio f ON f.tenant_id=s.tenant_id AND f.reservation_id=s.reservation_id
      JOIN account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
      LEFT JOIN folio_balance b ON b.tenant_id=f.tenant_id AND b.folio_id=f.id
      ORDER BY f.window_no, f.id
    `;
    const source = family.find((folio) => folio.id === input.sourceFolioId);
    if (!source || source.property_node !== input.envelope.propertyNode) {
      throw new FolioTransferNotFoundError("Source folio was not found in the audit property");
    }
    if (!source.reservation_id || source.status !== "open" || source.account_status !== "open" ||
        source.account_role !== "guest" || family.length < 1 || family.length > 20 ||
        family.some((folio) => folio.account_id !== source.account_id || folio.reservation_id !== source.reservation_id ||
          folio.property_node !== source.property_node || folio.currency !== source.currency ||
          folio.account_status !== "open" || folio.account_role !== "guest")) {
      throw new FolioTransferConflictError("Folio family is not open and canonical");
    }
    if (familyGeneration(family) !== input.generation) {
      throw new FolioTransferConflictError("Folio workspace generation is stale");
    }
    const destination = input.destinationFolioId
      ? family.find((folio) => folio.id === input.destinationFolioId)
      : undefined;
    if (input.destinationFolioId && (!destination || destination.status !== "open")) {
      throw new FolioTransferNotFoundError("Destination is not an open sibling folio");
    }
    if (input.newWindowName && (family.length >= 20 || family.some((folio) =>
      folio.name?.trim().toLocaleLowerCase("en-US") === input.newWindowName?.toLocaleLowerCase("en-US")))) {
      throw new FolioTransferConflictError("New destination window is unavailable");
    }

    const roots = await tx<RootRow[]>`
      WITH requested(group_id) AS (
        SELECT unnest(${postgresUuidArray(input.groupIds)}::uuid[])
      ), governed AS MATERIALIZED (
        SELECT requested.group_id, original.id AS original_journal_id,
               correction.id AS correction_journal_id
        FROM requested
        JOIN journal original ON original.tenant_id=${input.tenantId}::uuid
          AND original.tenant_id=current_setting('app.tenant_id', true)::uuid
          AND original.id=requested.group_id AND original.kind='charge' AND original.reverses IS NULL
          AND original.source='{"interface":"financials.charge.post"}'::jsonb
          AND original.property_node=${source.property_node}::uuid AND original.currency=${source.currency}::char(3)
        LEFT JOIN journal correction ON correction.tenant_id=original.tenant_id
          AND correction.reverses=original.id AND correction.kind='adjustment'
      ), roots AS MATERIALIZED (
        SELECT governed.group_id, line.id AS root_line_id, line.tx_code, line.description,
               line.quantity::text, count(*) OVER (PARTITION BY governed.group_id)::int AS member_count
        FROM governed JOIN posting_line line ON line.tenant_id=${input.tenantId}::uuid
          AND line.journal_id=governed.original_journal_id AND line.seq=1
          AND line.account_id=${source.account_id}::uuid
        UNION ALL
        SELECT governed.group_id, line.id, line.tx_code, line.description, line.quantity::text, 2
        FROM governed JOIN posting_line line ON line.tenant_id=${input.tenantId}::uuid
          AND line.journal_id=governed.correction_journal_id AND line.seq=1
          AND line.account_id=${source.account_id}::uuid
        WHERE governed.correction_journal_id IS NOT NULL
      ), allocations AS MATERIALIZED (
        SELECT roots.group_id, roots.root_line_id, roots.tx_code, roots.description, roots.quantity,
               line.folio_id AS current_folio_id, sum(line.amount_minor)::text AS amount_minor
        FROM roots JOIN posting_line line ON line.tenant_id=${input.tenantId}::uuid
          AND line.account_id=${source.account_id}::uuid
          AND COALESCE(line.folio_transfer_root_line_id,line.id)=roots.root_line_id
        WHERE line.folio_id IS NOT NULL
        GROUP BY roots.group_id, roots.root_line_id, roots.tx_code, roots.description,
                 roots.quantity, line.folio_id
        HAVING sum(line.amount_minor)<>0
      ), counts AS (
        SELECT group_id, count(*)::int AS member_count FROM roots GROUP BY group_id
      )
      SELECT allocations.*, counts.member_count
      FROM allocations JOIN counts USING (group_id)
      ORDER BY allocations.group_id, allocations.root_line_id
    `;
    if (new Set(roots.map((root) => root.group_id)).size !== input.groupIds.length ||
        roots.some((root) => root.current_folio_id !== input.sourceFolioId) ||
        input.groupIds.some((groupId) => {
          const members = roots.filter((root) => root.group_id === groupId);
          return members.length < 1 || members.length > 2 || members.some((root) => root.member_count !== members.length);
        })) {
      throw new FolioTransferConflictError("One or more transfer groups are stale, split or ineligible");
    }
    const memberEffects = Object.freeze(roots.map((root) => Object.freeze({
      rootLineId: root.root_line_id,
      groupId: root.group_id,
      amountMinor: root.amount_minor,
      sourceEffectMinor: (-BigInt(root.amount_minor)).toString(),
      destinationEffectMinor: root.amount_minor,
      txCode: root.tx_code,
      description: root.description,
      quantity: root.quantity,
    })));
    const moved = memberEffects.reduce((sum, effect) => sum + BigInt(effect.amountMinor), 0n);
    const sourceBeforeMinor = source.balance_minor;
    const destinationBeforeMinor = destination?.balance_minor ?? "0";
    const stayTotalMinor = family.reduce((sum, folio) => sum + BigInt(folio.balance_minor), 0n).toString();
    const destinationWindowNo = destination?.window_no ?? Math.max(...family.map((folio) => folio.window_no)) + 1;
    const revision = hash({
      generation: input.generation,
      source: input.sourceFolioId,
      destination: destination?.id ?? null,
      destinationName: input.newWindowName ?? null,
      destinationWindowNo,
      reason: input.reason,
      sourceBeforeMinor,
      destinationBeforeMinor,
      stayTotalMinor,
      members: memberEffects,
    });
    return Object.freeze({
      sourceFolioId: input.sourceFolioId,
      destinationFolioId: destination?.id ?? null,
      destinationName: destination?.name ?? input.newWindowName ?? null,
      destinationWindowNo,
      currency: source.currency,
      sourceBeforeMinor,
      sourceAfterMinor: add(sourceBeforeMinor, -moved),
      destinationBeforeMinor,
      destinationAfterMinor: add(destinationBeforeMinor, moved),
      stayTotalMinor,
      unchangedStayTotalMinor: stayTotalMinor,
      memberEffects,
      generation: input.generation,
      previewRevision: revision,
    });
  }
}
