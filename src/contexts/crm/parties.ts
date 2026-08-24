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
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const E164 = /^\+[1-9][0-9]{6,14}$/;
const MAX_DUPLICATES = 50;

export type PartyKind = "person" | "org";
export type PartyContactKind = "email" | "phone" | "whatsapp";
export type PartyRole = "guest" | "company" | "agent" | "source" | "vendor" | "owner" | "staff" | "contact";
export type DuplicateReason = "display_name" | PartyContactKind;

const CONTACT_KINDS: readonly PartyContactKind[] = ["email", "phone", "whatsapp"];
const PARTY_ROLES: readonly PartyRole[] = [
  "guest", "company", "agent", "source", "vendor", "owner", "staff", "contact",
];

export interface PartyContactInput {
  readonly kind: PartyContactKind;
  readonly value: string;
  readonly isPrimary?: boolean;
}

export interface PartyContactHint extends Readonly<Record<string, JsonValue>> {
  readonly kind: PartyContactKind;
  readonly hint: string;
  readonly isPrimary: boolean;
}

export interface PartyProfile extends Readonly<Record<string, JsonValue>> {
  readonly partyId: string;
  readonly kind: PartyKind;
  readonly displayName: string;
  readonly legalName: string | null;
  readonly status: "active";
  readonly roles: readonly PartyRole[];
  readonly contacts: readonly PartyContactHint[];
}

export interface DuplicateCandidate extends Readonly<Record<string, JsonValue>> {
  readonly partyId: string;
  readonly displayNameHint: string;
  readonly reasons: readonly DuplicateReason[];
  readonly contacts: readonly PartyContactHint[];
}

export interface SearchPartyProfilesInput {
  readonly tenantId: string;
  readonly query: string;
  readonly limit?: number;
}

export interface CreatePartyProfileInput {
  readonly kind: PartyKind;
  readonly displayName: string;
  readonly legalName?: string | null;
  readonly roles: readonly PartyRole[];
  readonly contacts: readonly PartyContactInput[];
  readonly acknowledgedDuplicatePartyIds: readonly string[];
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface CreatePartyProfileResult {
  readonly party: PartyProfile;
  readonly replayed: boolean;
}

export interface PartyProfileServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface PartyRow {
  readonly id: string;
  readonly kind: string;
  readonly display_name: string;
  readonly legal_name: string | null;
  readonly status: string;
  readonly score?: number;
}

interface RoleRow {
  readonly party_id: string;
  readonly role: string;
}

interface ContactRow {
  readonly party_id: string;
  readonly kind: string;
  readonly value: string;
  readonly is_primary: boolean;
}

interface DuplicateRow extends PartyRow {
  readonly display_name_match: boolean;
}

interface NormalizedContact {
  readonly kind: PartyContactKind;
  readonly value: string;
  readonly isPrimary: boolean;
}

interface NormalizedCreate {
  readonly kind: PartyKind;
  readonly displayName: string;
  readonly legalName: string | null;
  readonly roles: readonly PartyRole[];
  readonly contacts: readonly NormalizedContact[];
  readonly acknowledgedDuplicatePartyIds: readonly string[];
  readonly idempotencyKey: string;
}

interface StoredCreateBody extends Readonly<Record<string, JsonValue>> {
  readonly partyId: string;
  readonly kind: PartyKind;
  readonly roles: readonly PartyRole[];
  readonly contacts: readonly PartyContactHint[];
}

export class PartyProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartyProfileValidationError";
  }
}

export class PartyDuplicateReviewRequiredError extends Error {
  readonly candidates: readonly DuplicateCandidate[];

  constructor(candidates: readonly DuplicateCandidate[]) {
    super("Current possible duplicates must be reviewed and acknowledged exactly");
    this.name = "PartyDuplicateReviewRequiredError";
    this.candidates = candidates;
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new PartyProfileValidationError(`${name} must be a UUID`);
  }
  return value;
}

function normalizedName(name: string, value: unknown, maximum: number): string {
  if (typeof value !== "string") throw new PartyProfileValidationError(`${name} must be a string`);
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (normalized.length === 0 || normalized.length > maximum || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new PartyProfileValidationError(`${name} must contain 1-${maximum} visible characters`);
  }
  return normalized;
}

function requireExactKeys(name: string, value: object, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key)).sort();
  if (unexpected.length > 0) {
    throw new PartyProfileValidationError(`${name} contains unsupported fields: ${unexpected.join(", ")}`);
  }
}

function normalizedContact(input: PartyContactInput, index: number): NormalizedContact {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new PartyProfileValidationError(`contacts[${index}] must be an object`);
  }
  requireExactKeys(`contacts[${index}]`, input, ["kind", "value", "isPrimary"]);
  if (!CONTACT_KINDS.includes(input.kind)) {
    throw new PartyProfileValidationError(`contacts[${index}].kind is invalid`);
  }
  if (typeof input.value !== "string") {
    throw new PartyProfileValidationError(`contacts[${index}].value must be a string`);
  }
  const value = input.kind === "email"
    ? input.value.normalize("NFKC").trim().toLowerCase()
    : input.value.trim();
  if (input.kind === "email") {
    if (value.length > 254 || !EMAIL.test(value)) {
      throw new PartyProfileValidationError(`contacts[${index}].value must be a valid email address`);
    }
  } else if (!E164.test(value)) {
    throw new PartyProfileValidationError(`contacts[${index}].value must be canonical E.164`);
  }
  if (input.isPrimary !== undefined && typeof input.isPrimary !== "boolean") {
    throw new PartyProfileValidationError(`contacts[${index}].isPrimary must be boolean`);
  }
  return Object.freeze({ kind: input.kind, value, isPrimary: input.isPrimary === true });
}

function normalizeCreate(input: CreatePartyProfileInput): NormalizedCreate {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new PartyProfileValidationError("Party create input must be an object");
  }
  requireExactKeys("Party create input", input, [
    "kind", "displayName", "legalName", "roles", "contacts",
    "acknowledgedDuplicatePartyIds", "idempotencyKey", "envelope",
  ]);
  if (input.envelope.operation !== "party.created") {
    throw new PartyProfileValidationError("audit operation must be party.created");
  }
  if (input.kind !== "person" && input.kind !== "org") {
    throw new PartyProfileValidationError("kind must be person or org");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new PartyProfileValidationError("idempotencyKey must contain 8-200 visible ASCII characters");
  }
  if (!Array.isArray(input.roles) || input.roles.length < 1 || input.roles.length > PARTY_ROLES.length) {
    throw new PartyProfileValidationError("roles must contain 1-8 entries");
  }
  const roleSet = new Set<PartyRole>();
  for (const role of input.roles) {
    if (!PARTY_ROLES.includes(role)) throw new PartyProfileValidationError("roles contain an invalid value");
    if (roleSet.has(role)) throw new PartyProfileValidationError("roles must be unique");
    roleSet.add(role);
  }
  if (!Array.isArray(input.contacts) || input.contacts.length > 6) {
    throw new PartyProfileValidationError("contacts must contain at most 6 entries");
  }
  const contacts = input.contacts.map(normalizedContact).sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.value.localeCompare(right.value));
  const contactKeys = new Set<string>();
  const primaryKinds = new Set<PartyContactKind>();
  for (const contact of contacts) {
    const key = `${contact.kind}:${contact.value}`;
    if (contactKeys.has(key)) throw new PartyProfileValidationError("contacts must be unique by kind and value");
    contactKeys.add(key);
    if (contact.isPrimary) {
      if (primaryKinds.has(contact.kind)) {
        throw new PartyProfileValidationError("only one primary contact is allowed per kind");
      }
      primaryKinds.add(contact.kind);
    }
  }
  if (!Array.isArray(input.acknowledgedDuplicatePartyIds) || input.acknowledgedDuplicatePartyIds.length > MAX_DUPLICATES) {
    throw new PartyProfileValidationError("acknowledgedDuplicatePartyIds must contain at most 50 entries");
  }
  const acknowledged = input.acknowledgedDuplicatePartyIds.map((id, index) =>
    requireUuid(`acknowledgedDuplicatePartyIds[${index}]`, id));
  if (new Set(acknowledged).size !== acknowledged.length) {
    throw new PartyProfileValidationError("acknowledgedDuplicatePartyIds must be unique");
  }
  const sortedAcknowledged = [...acknowledged].sort();
  if (!sameIds(acknowledged, sortedAcknowledged)) {
    throw new PartyProfileValidationError("acknowledgedDuplicatePartyIds must be sorted");
  }
  return Object.freeze({
    kind: input.kind,
    displayName: normalizedName("displayName", input.displayName, 200),
    legalName: input.legalName === undefined || input.legalName === null
      ? null
      : normalizedName("legalName", input.legalName, 300),
    roles: Object.freeze([...roleSet].sort()),
    contacts: Object.freeze(contacts),
    acknowledgedDuplicatePartyIds: Object.freeze(sortedAcknowledged),
    idempotencyKey: input.idempotencyKey,
  });
}

function asKind(value: string): PartyKind {
  if (value === "person" || value === "org") return value;
  throw new Error("Stored Party kind is invalid");
}

function asRole(value: string): PartyRole {
  if (PARTY_ROLES.includes(value as PartyRole)) return value as PartyRole;
  throw new Error("Stored Party role is invalid");
}

function asContactKind(value: string): PartyContactKind {
  if (CONTACT_KINDS.includes(value as PartyContactKind)) return value as PartyContactKind;
  throw new Error("Stored Party contact kind is invalid");
}

function maskName(value: string): string {
  const characters = Array.from(value);
  return `${characters.slice(0, Math.min(2, characters.length)).join("")}…`;
}

function maskContact(kind: PartyContactKind, value: string): string {
  if (kind === "email") {
    const separator = value.lastIndexOf("@");
    const domain = separator >= 0 ? value.slice(separator + 1) : "";
    return `${Array.from(value)[0] ?? "•"}•••@${domain}`;
  }
  return `••••${value.slice(-4)}`;
}

function hints(rows: readonly ContactRow[]): readonly PartyContactHint[] {
  return Object.freeze(rows.map((row) => {
    const kind = asContactKind(row.kind);
    return Object.freeze({ kind, hint: maskContact(kind, row.value), isPrimary: row.is_primary });
  }).sort((left, right) => left.kind.localeCompare(right.kind) || left.hint.localeCompare(right.hint)));
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function searchLimit(value: unknown): number {
  if (value === undefined) return 20;
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 50) {
    throw new PartyProfileValidationError("limit must be an integer from 1 to 50");
  }
  return value as number;
}

async function relatedRows(tx: Tx, tenantId: string, partyIds: readonly string[]): Promise<{
  readonly roles: readonly RoleRow[];
  readonly contacts: readonly ContactRow[];
}> {
  if (partyIds.length === 0) return { roles: [], contacts: [] };
  const roles = await tx<RoleRow[]>`
    SELECT party_id, role
    FROM party_role
    WHERE tenant_id = ${tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND party_id IN ${tx(partyIds)}
    ORDER BY party_id, role
  `;
  const contacts = await tx<ContactRow[]>`
    SELECT party_id, kind, value, is_primary
    FROM contact_point
    WHERE tenant_id = ${tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND party_id IN ${tx(partyIds)}
    ORDER BY party_id, kind, value, id
  `;
  return { roles, contacts };
}

function profile(row: PartyRow, roles: readonly RoleRow[], contacts: readonly ContactRow[]): PartyProfile {
  if (row.status !== "active") throw new Error("Stored Party status is not active");
  return Object.freeze({
    partyId: row.id,
    kind: asKind(row.kind),
    displayName: row.display_name,
    legalName: row.legal_name,
    status: "active",
    roles: Object.freeze(roles.filter(({ party_id }) => party_id === row.id).map(({ role }) => asRole(role))),
    contacts: hints(contacts.filter(({ party_id }) => party_id === row.id)),
  });
}

export class PartyProfileService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: PartyProfileServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async search(tx: Tx, input: SearchPartyProfilesInput): Promise<readonly PartyProfile[]> {
    const tenantId = requireUuid("tenantId", input.tenantId);
    const query = normalizedName("query", input.query, 120);
    if (query.length < 2) throw new PartyProfileValidationError("query must contain at least 2 characters");
    const limit = searchLimit(input.limit);
    const uuidQuery = UUID.test(query) ? query : null;
    const emailQuery = query.includes("@") ? query.normalize("NFKC").trim().toLowerCase() : null;
    const e164Query = E164.test(query) ? query : null;
    const isNameQuery = uuidQuery === null && emailQuery === null && e164Query === null;
    const prefixQuery = isNameQuery && query.length === 2
      ? `${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`
      : null;
    const rows = await tx<PartyRow[]>`
      WITH candidates AS MATERIALIZED (
        SELECT p.id, similarity(p.display_name, ${query})::float8 AS score
        FROM party AS p
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND p.status = 'active'
          AND ${isNameQuery}
          AND ((${prefixQuery}::text IS NULL AND p.display_name % ${query})
            OR (${prefixQuery}::text IS NOT NULL AND p.display_name ILIKE ${prefixQuery} ESCAPE '\\'))
        UNION ALL
        SELECT p.id, 2::float8 AS score
        FROM party AS p
        WHERE ${uuidQuery}::uuid IS NOT NULL
          AND p.id = ${uuidQuery}::uuid
          AND p.tenant_id = ${tenantId}::uuid
          AND p.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND p.status = 'active'
        UNION ALL
        SELECT p.id, 1.5::float8 AS score
        FROM contact_point AS cp
        JOIN party AS p ON p.id = cp.party_id AND p.tenant_id = cp.tenant_id
        WHERE cp.tenant_id = ${tenantId}::uuid
          AND cp.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND p.status = 'active'
          AND ((cp.kind = 'email' AND cp.value = ${emailQuery})
            OR (cp.kind IN ('phone','whatsapp') AND cp.value = ${e164Query}))
      ), ranked AS (
        SELECT id, max(score) AS score
        FROM candidates
        GROUP BY id
        ORDER BY max(score) DESC, id
        LIMIT ${limit}
      )
      SELECT p.id, p.kind, p.display_name, p.legal_name, p.status, ranked.score
      FROM ranked
      JOIN party AS p ON p.id = ranked.id
      ORDER BY ranked.score DESC, p.display_name, p.id
    `;
    const related = await relatedRows(tx, tenantId, rows.map(({ id }) => id));
    return Object.freeze(rows.map((row) => profile(row, related.roles, related.contacts)));
  }

  async #duplicates(tx: Tx, tenantId: string, normalized: NormalizedCreate): Promise<readonly DuplicateCandidate[]> {
    const displayKeys = await tx<{ display_name_key: string }[]>`
      SELECT lower(regexp_replace(btrim(${normalized.displayName}), '\\s+', ' ', 'g')) AS display_name_key
    `;
    const displayNameKey = displayKeys[0]?.display_name_key;
    if (!displayNameKey) throw new Error("PostgreSQL did not return the Party display-name key");
    const identityTokens = [
      `name:${displayNameKey}`,
      ...normalized.contacts.map(({ kind, value }) => `${kind}:${value}`),
    ].sort();
    for (const token of identityTokens) {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${token}`}, 101))`;
    }
    const emailValues = normalized.contacts.filter(({ kind }) => kind === "email").map(({ value }) => value);
    const phoneValues = normalized.contacts.filter(({ kind }) => kind !== "email").map(({ value }) => value);
    const rows = await tx<DuplicateRow[]>`
      SELECT p.id, p.kind, p.display_name, p.legal_name, p.status,
        lower(regexp_replace(btrim(p.display_name), '\\s+', ' ', 'g')) =
          ${displayNameKey} AS display_name_match
      FROM party AS p
      WHERE p.tenant_id = ${tenantId}::uuid
        AND p.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND p.status = 'active'
        AND (
          lower(regexp_replace(btrim(p.display_name), '\\s+', ' ', 'g')) = ${displayNameKey}
          OR EXISTS (
            SELECT 1 FROM contact_point AS cp
            WHERE cp.tenant_id = ${tenantId}::uuid
              AND cp.party_id = p.id
              AND ((cp.kind = 'email' AND cp.value IN (
                  SELECT jsonb_array_elements_text(${JSON.stringify(emailValues)}::text::jsonb)
                ))
                OR (cp.kind IN ('phone','whatsapp') AND cp.value IN (
                  SELECT jsonb_array_elements_text(${JSON.stringify(phoneValues)}::text::jsonb)
                )))
          )
        )
      ORDER BY p.id
      LIMIT ${MAX_DUPLICATES + 1}
    `;
    if (rows.length > MAX_DUPLICATES) {
      throw new PartyProfileValidationError("duplicate review exceeds 50 candidates; add a distinguishing contact");
    }
    const related = await relatedRows(tx, tenantId, rows.map(({ id }) => id));
    return Object.freeze(rows.map((row) => {
      const contacts = related.contacts.filter(({ party_id }) => party_id === row.id);
      const reasons = new Set<DuplicateReason>();
      if (row.display_name_match) reasons.add("display_name");
      for (const contact of contacts) {
        if (contact.kind === "email" && emailValues.includes(contact.value)) reasons.add("email");
        if ((contact.kind === "phone" || contact.kind === "whatsapp") && phoneValues.includes(contact.value)) {
          reasons.add(asContactKind(contact.kind));
        }
      }
      const matchingContacts = contacts.filter((contact) =>
        (contact.kind === "email" && emailValues.includes(contact.value))
        || ((contact.kind === "phone" || contact.kind === "whatsapp") && phoneValues.includes(contact.value))
      );
      return Object.freeze({
        partyId: row.id,
        displayNameHint: maskName(row.display_name),
        reasons: Object.freeze([...reasons].sort()),
        contacts: hints(matchingContacts),
      });
    }));
  }

  async create(tx: Tx, input: CreatePartyProfileInput): Promise<CreatePartyProfileResult> {
    const normalized = normalizeCreate(input);
    const outcome = await this.#idempotency.execute<StoredCreateBody>(tx, {
      tenantId: input.envelope.tenantId,
      operation: "profiles.party.create",
      key: normalized.idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        kind: normalized.kind,
        displayName: normalized.displayName,
        legalName: normalized.legalName,
        roles: normalized.roles,
        contacts: normalized.contacts,
        acknowledgedDuplicatePartyIds: normalized.acknowledgedDuplicatePartyIds,
      },
    }, async (commandTx) => {
      const duplicates = await this.#duplicates(commandTx, input.envelope.tenantId, normalized);
      const currentIds = duplicates.map(({ partyId }) => partyId);
      if (!sameIds(currentIds, normalized.acknowledgedDuplicatePartyIds)) {
        throw new PartyDuplicateReviewRequiredError(duplicates);
      }
      const parties = await commandTx<PartyRow[]>`
        INSERT INTO party (tenant_id, kind, display_name, legal_name)
        VALUES (
          ${input.envelope.tenantId}::uuid, ${normalized.kind},
          ${normalized.displayName}, ${normalized.legalName}
        )
        RETURNING id, kind, display_name, legal_name, status
      `;
      const party = parties[0];
      if (!party) throw new Error("PostgreSQL did not return the created Party");
      for (const role of normalized.roles) {
        await commandTx`
          INSERT INTO party_role (tenant_id, party_id, role)
          VALUES (${input.envelope.tenantId}::uuid, ${party.id}::uuid, ${role})
        `;
      }
      for (const contact of normalized.contacts) {
        await commandTx`
          INSERT INTO contact_point (tenant_id, party_id, kind, value, is_primary, verified)
          VALUES (
            ${input.envelope.tenantId}::uuid, ${party.id}::uuid, ${contact.kind},
            ${contact.value}, ${contact.isPrimary}, false
          )
        `;
      }
      const contactKinds = Object.freeze([...new Set(normalized.contacts.map(({ kind }) => kind))].sort());
      const fact = await recordFact(commandTx, {
        entityType: "party",
        entityId: party.id,
        envelope: input.envelope,
        payload: { party_id: party.id, kind: normalized.kind, roles: normalized.roles, contact_kinds: contactKinds },
      });
      await this.#events.publish(commandTx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "party",
        aggregateId: party.id,
        eventType: "party.created",
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: { party_id: party.id, kind: normalized.kind, roles: normalized.roles, contact_kinds: contactKinds },
      });
      return {
        status: 201,
        body: Object.freeze({
          partyId: party.id,
          kind: normalized.kind,
          roles: normalized.roles,
          contacts: hints(normalized.contacts.map((contact) => ({
            party_id: party.id,
            kind: contact.kind,
            value: contact.value,
            is_primary: contact.isPrimary,
          }))),
        }),
      };
    });
    return Object.freeze({
      replayed: outcome.replayed,
      party: Object.freeze({
        partyId: outcome.body.partyId,
        kind: outcome.body.kind,
        displayName: normalized.displayName,
        legalName: normalized.legalName,
        status: "active",
        roles: outcome.body.roles,
        contacts: outcome.body.contacts,
      }),
    });
  }
}
