import type { AuditEnvelope, JsonValue, PostgresIdempotency, Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const READ = "identity.property-mode:read", WRITE = "identity.property-mode:write";
const OPERATION = "property.operating-mode.changed";
export type PropertyOperatingMode = "hotel" | "str" | "both";
export interface PropertyMode extends Readonly<Record<string, JsonValue>> {
  readonly propertyNode: string;
  readonly mode: PropertyOperatingMode | null;
  readonly version: number;
  readonly effectiveAt: string | null;
  readonly effectiveBusinessDate: string | null;
  readonly canWrite: boolean;
}
export interface PropertyModeIdentity { readonly tenantId: string; readonly propertyNode: string; readonly actorId: string }
export interface SetPropertyModeInput {
  readonly expectedVersion: number; readonly mode: PropertyOperatingMode;
  readonly idempotencyKey: string; readonly envelope: AuditEnvelope;
}
export interface SetPropertyModeResult { readonly propertyMode: PropertyMode; readonly changed: boolean; readonly replayed: boolean }
export class PropertyModeValidationError extends Error {}
export class PropertyModeAuthorizationError extends Error {}
export class PropertyModeConflictError extends Error {}
export class PropertyModeIncoherentError extends Error {}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isMode(value: unknown): value is PropertyOperatingMode { return value === "hotel" || value === "str" || value === "both"; }
function version(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2147483647; }
export function parsePropertyModeBody(value: unknown): { expectedVersion: number; mode: PropertyOperatingMode } {
  if (!object(value) || Object.keys(value).sort().join(",") !== "expectedVersion,mode" ||
      !version(value.expectedVersion) || !isMode(value.mode)) throw new PropertyModeValidationError("Invalid property mode input");
  return { expectedVersion: value.expectedVersion, mode: value.mode };
}
function identity(input: PropertyModeIdentity): void {
  if (![input.tenantId, input.propertyNode, input.actorId].every(value => typeof value === "string" && UUID.test(value)))
    throw new PropertyModeValidationError("Invalid property mode identity");
}
interface StateRow { readonly config: unknown; readonly facts: unknown; readonly can_write: boolean }
interface ChangedRow { readonly property_node: string; readonly mode: PropertyOperatingMode; readonly version: number;
  readonly effective_at: Date | null; readonly effective_business_date: string | null; readonly changed: boolean }
interface StoredBody extends Readonly<Record<string, JsonValue>> { readonly propertyMode: PropertyMode; readonly changed: boolean }

/** Independently validate persisted config against the complete audit lineage. */
function readState(row: StateRow, propertyNode: string, tokenCanWrite: boolean): PropertyMode {
  if (!object(row.config) || (row.config.workspace !== undefined && !object(row.config.workspace)) || !Array.isArray(row.facts))
    throw new PropertyModeIncoherentError("Property mode state incoherent");
  const storedMode = object(row.config.workspace) ? row.config.workspace.operating_mode : undefined;
  if (storedMode !== undefined && !isMode(storedMode)) throw new PropertyModeIncoherentError("Property mode configuration incoherent");
  const facts: Array<{ id: string; supersedes: unknown; actorId: string; payload: Record<string, unknown>; effectiveAt: string; businessDate: string }> = [];
  for (const value of row.facts) {
    if (!object(value) || typeof value.id !== "string" || !UUID.test(value.id) || typeof value.actorId !== "string" || !UUID.test(value.actorId) ||
        !object(value.payload) || !version(value.payload.version) || value.payload.version === 0 ||
        typeof value.effectiveAt !== "string" || !Number.isFinite(Date.parse(value.effectiveAt)) ||
        typeof value.businessDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.businessDate) ||
        value.versionText !== String(value.payload.version) ||
        value.businessDateCoherent !== true || value.openEnded !== true) throw new PropertyModeIncoherentError("Property mode history incoherent");
    facts.push(value as unknown as typeof facts[number]);
  }
  facts.sort((a, b) => (a.payload.version as number) - (b.payload.version as number));
  let previousId: string | null = null, previousMode: PropertyOperatingMode | null = null;
  let effectiveAt: string | null = null, effectiveBusinessDate: string | null = null;
  for (const [index, fact] of facts.entries()) {
    const payload = fact.payload;
    if (Object.keys(payload).sort().join(",") !== "mode,previous_mode,request_id,version" ||
        payload.version !== index + 1 || fact.supersedes !== previousId || payload.previous_mode !== previousMode ||
        !isMode(payload.mode) || payload.mode === previousMode || typeof payload.request_id !== "string" || !UUID.test(payload.request_id))
      throw new PropertyModeIncoherentError("Property mode history incoherent");
    previousId = fact.id; previousMode = payload.mode;
    effectiveAt = new Date(fact.effectiveAt).toISOString(); effectiveBusinessDate = fact.businessDate;
  }
  if ((storedMode ?? null) !== previousMode) throw new PropertyModeIncoherentError("Property mode config/history mismatch");
  return Object.freeze({ propertyNode, mode: previousMode, version: facts.length, effectiveAt, effectiveBusinessDate,
    canWrite: tokenCanWrite && row.can_write });
}

export class PropertyModeService {
  readonly #idempotency: PostgresIdempotency;
  constructor(idempotency: PostgresIdempotency) { this.#idempotency = idempotency; }

  async #authorized(tx: Tx, input: PropertyModeIdentity, permission: typeof READ | typeof WRITE, tokenCanWrite: boolean): Promise<PropertyMode> {
    identity(input);
    const rows = await tx<StateRow[]>`
      WITH authority AS (
        SELECT DISTINCT permission.permission_code FROM tenant t
        JOIN app_user actor ON actor.tenant_id=t.id AND actor.id=${input.actorId}::uuid AND actor.status='active'
        JOIN user_role membership ON membership.tenant_id=actor.tenant_id AND membership.user_id=actor.id
        JOIN role r ON r.tenant_id=membership.tenant_id AND r.id=membership.role_id
        JOIN role_permission permission ON permission.role_id=r.id
        JOIN org_node scope ON scope.tenant_id=membership.tenant_id AND scope.id=membership.scope_node
        JOIN org_node property ON property.tenant_id=t.id AND property.id=${input.propertyNode}::uuid AND property.kind='property' AND scope.path @> property.path
        WHERE t.id=${input.tenantId}::uuid AND t.id=current_setting('app.tenant_id',true)::uuid AND t.status='active'
      )
      SELECT property.config,EXISTS(SELECT 1 FROM authority WHERE permission_code=${WRITE}) can_write,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'supersedes',f.supersedes,'actorId',f.actor_id,
          'payload',f.payload,'versionText',f.payload->>'version','effectiveAt',f.valid_from,'businessDate',f.business_date,
          'businessDateCoherent',f.business_date=(f.valid_from AT TIME ZONE property.timezone)::date,'openEnded',f.valid_to IS NULL))
          FROM fact_log f WHERE f.tenant_id=property.tenant_id AND f.entity_type='org_node' AND f.entity_id=property.id
            AND f.fact_type='property.operating-mode.changed'),'[]'::jsonb) facts
      FROM org_node property WHERE property.tenant_id=${input.tenantId}::uuid AND property.id=${input.propertyNode}::uuid
        AND property.kind='property' AND EXISTS(SELECT 1 FROM authority WHERE permission_code=${permission})
    `;
    if (!rows[0] || rows.length !== 1) throw new PropertyModeAuthorizationError("Property mode authority unavailable");
    return readState(rows[0], input.propertyNode, tokenCanWrite);
  }
  get(tx: Tx, input: PropertyModeIdentity & { readonly tokenCanWrite?: boolean }): Promise<PropertyMode> {
    return this.#authorized(tx, input, READ, input.tokenCanWrite === true);
  }
  async set(tx: Tx, input: SetPropertyModeInput): Promise<SetPropertyModeResult> {
    const parsed = parsePropertyModeBody({ expectedVersion: input.expectedVersion, mode: input.mode });
    const actor = { tenantId: input.envelope.tenantId, propertyNode: input.envelope.propertyNode, actorId: input.envelope.actorId };
    identity(actor);
    if (input.envelope.operation !== OPERATION || !UUID.test(input.envelope.requestId) ||
        typeof input.idempotencyKey !== "string" || !KEY.test(input.idempotencyKey))
      throw new PropertyModeValidationError("Invalid property mode envelope");
    await this.#authorized(tx, actor, WRITE, true);
    try {
      const outcome = await this.#idempotency.execute<StoredBody>(tx, {
        tenantId: actor.tenantId, operation: "identity.property-mode.set", key: input.idempotencyKey,
        request: { actorId: actor.actorId, propertyNode: actor.propertyNode, ...parsed },
      }, async commandTx => {
        const rows = await commandTx<ChangedRow[]>`SELECT property_node,mode,version,effective_at,effective_business_date::text,changed
          FROM public.set_property_operating_mode(${actor.tenantId}::uuid,${actor.propertyNode}::uuid,${actor.actorId}::uuid,
            ${input.envelope.requestId}::uuid,${parsed.expectedVersion}::integer,${parsed.mode})`;
        const row = rows[0];
        if (!row || rows.length !== 1 || !isMode(row.mode) || !version(row.version) || typeof row.changed !== "boolean")
          throw new PropertyModeIncoherentError("Property mode capability result incoherent");
        return { status: 200, body: { propertyMode: Object.freeze({ propertyNode: row.property_node, mode: row.mode, version: row.version,
          effectiveAt: row.effective_at?.toISOString() ?? null, effectiveBusinessDate: row.effective_business_date, canWrite: true }), changed: row.changed } };
      });
      // The receipt may have waited. Retain current authority locks through commit, even on replay.
      await tx`SELECT public.assert_property_mode_write_authority(${actor.tenantId}::uuid,${actor.propertyNode}::uuid,${actor.actorId}::uuid)`;
      return Object.freeze({ propertyMode: outcome.body.propertyMode, changed: outcome.body.changed, replayed: outcome.replayed });
    } catch (error) {
      const state = (error as { errno?: string; code?: string }).errno ?? (error as { code?: string }).code;
      if (state === "42501") throw new PropertyModeAuthorizationError("Property mode authority unavailable");
      if (state === "40001") throw new PropertyModeConflictError("Property mode version stale");
      if (state === "22023") throw new PropertyModeValidationError("Invalid property mode input");
      if (state === "55000") throw new PropertyModeIncoherentError("Property mode state incoherent");
      throw error;
    }
  }
}
