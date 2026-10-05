import type {
  AuditEnvelope,
  JsonValue,
  PostgresIdempotency,
  Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const FORBIDDEN_NAME_CHARACTER = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u;
const READ_PERMISSION = "identity.property-profile:read";
const WRITE_PERMISSION = "identity.property-profile:write";
const OPERATION = "property.identity.changed";

export interface PropertyIdentityProfile extends Readonly<Record<string, JsonValue>> {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string | null;
  readonly version: number;
  readonly effectiveAt: string | null;
  readonly effectiveBusinessDate: string | null;
}

export interface ReadPropertyIdentityProfileInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
}

export interface RenamePropertyIdentityInput {
  readonly expectedVersion: number;
  readonly name: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface RenamePropertyIdentityResult {
  readonly property: PropertyIdentityProfile;
  readonly changed: boolean;
  readonly replayed: boolean;
}

interface ProfileRow {
  readonly property_node: string;
  readonly property_name: string;
  readonly timezone: string;
  readonly currency: string | null;
  readonly name_version: number;
  readonly effective_at: Date | null;
  readonly effective_business_date: string | null;
  readonly changed?: boolean;
}

interface StoredRenameBody extends Readonly<Record<string, JsonValue>> {
  readonly property: PropertyIdentityProfile;
  readonly changed: boolean;
}

export class PropertyIdentityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyIdentityValidationError";
  }
}

export class PropertyIdentityAuthorizationError extends Error {
  constructor() {
    super("Property identity authority is unavailable");
    this.name = "PropertyIdentityAuthorizationError";
  }
}

export class PropertyIdentityConflictError extends Error {
  constructor(message = "Property identity version is stale") {
    super(message);
    this.name = "PropertyIdentityConflictError";
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new PropertyIdentityValidationError(`${name} must be a UUID`);
  }
  return value;
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") {
    throw new PropertyIdentityValidationError("name must be a string");
  }
  if (FORBIDDEN_NAME_CHARACTER.test(value)) throw new PropertyIdentityValidationError("name must contain 1-200 visible characters");
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const length = [...normalized].length;
  if (length < 1 || length > 200 || FORBIDDEN_NAME_CHARACTER.test(normalized)) {
    throw new PropertyIdentityValidationError("name must contain 1-200 visible characters");
  }
  return normalized;
}

function sqlState(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  for (const key of ["errno", "sqlState", "code"] as const) {
    const value = (error as Record<string, unknown>)[key];
    if (typeof value === "string" && /^[A-Z0-9]{5}$/.test(value)) return value;
  }
  return null;
}

function profile(row: ProfileRow): PropertyIdentityProfile {
  if (!Number.isSafeInteger(row.name_version) || row.name_version < 0) {
    throw new Error("Property identity version is incoherent");
  }
  return Object.freeze({
    id: row.property_node,
    name: row.property_name,
    timezone: row.timezone,
    currency: row.currency,
    version: row.name_version,
    effectiveAt: row.effective_at?.toISOString() ?? null,
    effectiveBusinessDate: row.effective_business_date,
  });
}

export class PropertyIdentityProfileService {
  readonly #idempotency: PostgresIdempotency;

  constructor(idempotency: PostgresIdempotency) {
    this.#idempotency = idempotency;
  }

  async #authorizedProfile(
    tx: Tx,
    input: ReadPropertyIdentityProfileInput,
    permission: typeof READ_PERMISSION | typeof WRITE_PERMISSION,
  ): Promise<ProfileRow> {
    requireUuid("tenantId", input.tenantId);
    requireUuid("propertyNode", input.propertyNode);
    requireUuid("actorId", input.actorId);
    const rows = await tx<ProfileRow[]>`
      SELECT property.id AS property_node,
             property.name AS property_name,
             property.timezone,
             property.currency,
             COALESCE((latest.payload ->> 'version')::integer, 0) AS name_version,
             latest.valid_from AS effective_at,
             latest.business_date::text AS effective_business_date
      FROM tenant AS target_tenant
      JOIN app_user AS actor
        ON actor.tenant_id = target_tenant.id
       AND actor.id = ${input.actorId}::uuid
       AND actor.status = 'active'
      JOIN user_role AS membership
        ON membership.tenant_id = actor.tenant_id
       AND membership.user_id = actor.id
      JOIN role AS actor_role
        ON actor_role.tenant_id = membership.tenant_id
       AND actor_role.id = membership.role_id
      JOIN role_permission AS grant_row
        ON grant_row.role_id = actor_role.id
       AND grant_row.permission_code = ${permission}
      JOIN org_node AS scope_node
        ON scope_node.tenant_id = membership.tenant_id
       AND scope_node.id = membership.scope_node
      JOIN org_node AS property
        ON property.tenant_id = target_tenant.id
       AND property.id = ${input.propertyNode}::uuid
       AND property.kind = 'property'
       AND scope_node.path @> property.path
      LEFT JOIN LATERAL (
        SELECT fact.payload, fact.valid_from, fact.business_date
        FROM fact_log AS fact
        WHERE fact.tenant_id = property.tenant_id
          AND fact.entity_type = 'org_node'
          AND fact.entity_id = property.id
          AND fact.fact_type = 'property.identity.changed'
          AND NOT EXISTS (
            SELECT 1 FROM fact_log AS successor
            WHERE successor.tenant_id = fact.tenant_id
              AND successor.entity_type = fact.entity_type
              AND successor.entity_id = fact.entity_id
              AND successor.fact_type = fact.fact_type
              AND successor.supersedes = fact.id
          )
        ORDER BY fact.recorded_at DESC, fact.id DESC
        LIMIT 1
      ) AS latest ON true
      WHERE target_tenant.id = ${input.tenantId}::uuid
        AND target_tenant.id = current_setting('app.tenant_id', true)::uuid
        AND target_tenant.status = 'active'
      ORDER BY actor_role.id, scope_node.id
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || rows.length !== 1) throw new PropertyIdentityAuthorizationError();
    return row;
  }

  async get(tx: Tx, input: ReadPropertyIdentityProfileInput): Promise<PropertyIdentityProfile> {
    return profile(await this.#authorizedProfile(tx, input, READ_PERMISSION));
  }

  async rename(tx: Tx, input: RenamePropertyIdentityInput): Promise<RenamePropertyIdentityResult> {
    if (input.envelope.operation !== OPERATION) {
      throw new PropertyIdentityValidationError(`audit operation must be ${OPERATION}`);
    }
    requireUuid("tenantId", input.envelope.tenantId);
    requireUuid("propertyNode", input.envelope.propertyNode);
    requireUuid("actorId", input.envelope.actorId);
    requireUuid("requestId", input.envelope.requestId);
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 ||
        input.expectedVersion > 2_147_483_647) {
      throw new PropertyIdentityValidationError("expectedVersion must be a non-negative 32-bit integer");
    }
    if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
      throw new PropertyIdentityValidationError("idempotency key must contain 8-200 visible ASCII characters");
    }
    const name = normalizeName(input.name);

    // Authorization precedes the idempotency lookup. The SECURITY DEFINER command
    // capability locks/revalidates authority for a new write; the dedicated
    // assertion below does the same after a receipt wait, including replays.
    await this.#authorizedProfile(tx, {
      tenantId: input.envelope.tenantId,
      propertyNode: input.envelope.propertyNode,
      actorId: input.envelope.actorId,
    }, WRITE_PERMISSION);

    try {
      const outcome = await this.#idempotency.execute<StoredRenameBody>(tx, {
        tenantId: input.envelope.tenantId,
        operation: "identity.property-profile.rename",
        key: input.idempotencyKey,
        request: {
          actorId: input.envelope.actorId,
          propertyNode: input.envelope.propertyNode,
          expectedVersion: input.expectedVersion,
          name,
        },
      }, async (commandTx) => {
        const rows = await commandTx<ProfileRow[]>`
          SELECT property_node, property_name, timezone, currency,
                 name_version, effective_at,
                 effective_business_date::text, changed
          FROM public.rename_property_identity(
            ${input.envelope.tenantId}::uuid,
            ${input.envelope.propertyNode}::uuid,
            ${input.envelope.actorId}::uuid,
            ${input.envelope.requestId}::uuid,
            ${input.expectedVersion}::integer,
            ${name}
          )
        `;
        const row = rows[0];
        if (!row || rows.length !== 1 || typeof row.changed !== "boolean") {
          throw new PropertyIdentityAuthorizationError();
        }
        return {
          status: 200,
          body: Object.freeze({ property: profile(row), changed: row.changed }),
        };
      });
      // execute() retains the idempotency row lock until this transaction commits.
      // Revalidate and lock live authority *after* that wait so a revoked actor or
      // grant cannot receive a replay, while a later revocation serializes behind
      // this authorized response.
      await tx`
        SELECT public.assert_property_identity_write_authority(
          ${input.envelope.tenantId}::uuid,
          ${input.envelope.propertyNode}::uuid,
          ${input.envelope.actorId}::uuid
        )
      `;
      return Object.freeze({
        property: outcome.body.property,
        changed: outcome.body.changed,
        replayed: outcome.replayed,
      });
    } catch (error) {
      const state = sqlState(error);
      if (state === "42501") throw new PropertyIdentityAuthorizationError();
      if (state === "40001") throw new PropertyIdentityConflictError();
      if (state === "22023") throw new PropertyIdentityValidationError("Property identity input is invalid");
      throw error;
    }
  }
}
