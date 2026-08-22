import { SQL, type ReservedSQL } from "bun";
import {
  RATE_MODEL_CATALOGUE,
  RATE_MODEL_EXTENSION_SCHEMA,
  RATE_PLAN_MODEL_EXTENSION_SCHEMA,
} from "../src/contexts/rates/models";
import { uuidV5 } from "./lib/uuid-v5";

export const URL_NAMESPACE_UUID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
export const TENANT_NAME = "https://yellow.local/seed/tenant/yellow-demo";
export const PROPERTY_NAME = "org-node/yellow_demo.property";

export const SEED_TENANT = Object.freeze({
  id: "6d9b7ce2-2d14-5576-b8c3-80f06501a603",
  slug: "yellow-demo",
  name: "Yellow Demo",
  tier: "shared",
  residency: "me-central",
  status: "active",
});

export const SEED_PROPERTY = Object.freeze({
  id: "4518a22f-b455-54c6-a50a-4584383749b9",
  tenantId: SEED_TENANT.id,
  path: "yellow_demo.property",
  kind: "property",
  name: "Yellow Demo Property",
  timezone: "UTC",
  currency: "USD",
  config: {},
});

const SEED_ACTOR_ID = "00000000-0000-0000-0000-000000000960";

export const LAUNCH_EXTENSION_TYPES = Object.freeze([
  {
    type: "vertical_profile",
    jsonSchema: { $id: "pms:vertical_profile:1", type: "object", required: ["terminology", "claim_mode_default", "features"], properties: {
      terminology: { type: "object", additionalProperties: { type: "string" } },
      claim_mode_default: { enum: ["exclusive", "positional"] },
      features: { type: "object", properties: {
        dorm_beds: { type: "boolean" }, hourly_slots: { type: "boolean" }, long_stay_billing: { type: "boolean" },
        owner_statements: { type: "boolean" }, kiosk_checkin: { type: "boolean" }, meal_plans: { type: "boolean" },
      } },
      default_policies: { type: "array", items: { type: "string" } },
      housekeeping_cadence: { enum: ["daily", "on_departure", "weekly", "custom"] },
      default_unit_types: { type: "array", items: { type: "object", required: ["code", "name", "claim_mode"], properties: {
        code: { type: "string" }, name: { type: "string" }, claim_mode: { enum: ["exclusive", "positional"] },
        capacity: { type: "integer", minimum: 1 },
      } } },
    } },
  },
  {
    type: "tax_jurisdiction",
    jsonSchema: { $id: "pms:tax_jurisdiction:1", type: "object", required: ["country", "taxes"], properties: {
      country: { type: "string", pattern: "^[A-Z]{2}$" }, region: { type: "string" },
      price_display: { enum: ["tax_inclusive", "tax_exclusive"] }, rounding: { enum: ["line", "document"], default: "line" },
      taxes: { type: "array", items: { type: "object", required: ["code", "name", "mode"], properties: {
        code: { type: "string" }, name: { type: "string" },
        mode: { enum: ["percent", "fixed_per_night", "fixed_per_person_night", "slab_percent"] },
        rate: { type: "number" }, amount_minor: { type: "integer" }, applies_to: { type: "array", items: { type: "string" } },
        slabs: { type: "array", items: { type: "object", required: ["upto_minor", "rate"], properties: {
          upto_minor: { type: ["integer", "null"] }, rate: { type: "number" }, itc_eligible: { type: "boolean" },
        } } },
        slab_basis: { enum: ["declared_tariff_per_night", "transaction_value"] },
        compound_on: { type: "array", items: { type: "string" } },
      } } },
    } },
  },
  {
    type: "policy",
    jsonSchema: { $id: "pms:policy:1", type: "object", required: ["kind"], properties: {
      kind: { enum: ["cancellation", "deposit", "guarantee", "no_show"] },
      rules: { type: "array", items: { type: "object", properties: {
        before_hours: { type: "integer" }, penalty: { type: "object", properties: {
          basis: { enum: ["nights", "percent", "fixed"] }, value: { type: "number" },
        } },
      } } },
      deposit: { type: "object", properties: {
        basis: { enum: ["first_night", "percent", "fixed", "one_month"] }, value: { type: "number" },
        due: { enum: ["at_booking", "days_before_arrival"] }, days_before: { type: "integer" },
      } },
      guarantee: { enum: ["card_on_file", "deposit_paid", "company_letter", "none"] },
      no_show_charge: { type: "object", properties: {
        basis: { enum: ["first_night", "full_stay", "fixed"] }, value: { type: "number" },
      } },
    } },
  },
  {
    type: "statutory_adapter",
    jsonSchema: { $id: "pms:statutory_adapter:1", type: "object", required: ["country", "adapter_key", "schedule"], properties: {
      country: { type: "string", pattern: "^[A-Z]{2}$" }, adapter_key: { type: "string" },
      schedule: { enum: ["on_checkin", "daily_batch", "within_24h"] },
      required_identity_fields: { type: "array", items: { type: "string" } },
      transport: { enum: ["sftp", "https_form", "soap", "rest"] }, credential_ref: { type: "string" }, format: { type: "string" },
    } },
  },
  {
    type: "fiscal_provider",
    jsonSchema: { $id: "pms:fiscal_provider:1", type: "object", required: ["jurisdiction", "mode", "provider_key"], properties: {
      jurisdiction: { type: "string" }, mode: { enum: ["none", "in_house_clearance", "in_house_reporting", "provider_routed", "peppol"] },
      provider_key: { type: "string" }, document_formats: { type: "array", items: { type: "string" } },
      chain: { type: "object", properties: {
        hash_algo: { enum: ["sha256"] }, pih_required: { type: "boolean" }, qr: { enum: ["tlv_base64", "none"] },
      } },
      endpoints: { type: "object", additionalProperties: { type: "string" } }, credential_ref: { type: "string" },
    } },
  },
  {
    type: "automation_action",
    jsonSchema: { $id: "pms:automation_action:1", type: "object", required: ["action", "params_schema"], properties: {
      action: { type: "string" }, params_schema: { type: "object" }, idempotent: { type: "boolean" },
      allowed_triggers: { type: "array", items: { type: "string" } },
    } },
  },
  {
    type: "rate_model",
    jsonSchema: RATE_MODEL_EXTENSION_SCHEMA,
  },
  {
    type: "rate_plan_model",
    jsonSchema: RATE_PLAN_MODEL_EXTENSION_SCHEMA,
  },
] as const);

const verticalFeatures = Object.freeze({ dorm_beds: false, hourly_slots: false, long_stay_billing: false, owner_statements: false, kiosk_checkin: true, meal_plans: false });

export const LAUNCH_EXTENSIONS = Object.freeze([
  { type: "vertical_profile", key: "hotel", content: { terminology: { space: "Room", unit_type: "Room Type" }, claim_mode_default: "exclusive", features: { ...verticalFeatures, meal_plans: true }, default_policies: ["flex_24h", "deposit_first_night"], housekeeping_cadence: "daily", default_unit_types: [{ code: "STD", name: "Standard", claim_mode: "exclusive", capacity: 2 }, { code: "DLX", name: "Deluxe", claim_mode: "exclusive", capacity: 3 }] } },
  { type: "vertical_profile", key: "hostel", content: { terminology: { space: "Room", unit_type: "Bed Category" }, claim_mode_default: "positional", features: { ...verticalFeatures, dorm_beds: true }, default_policies: ["flex_24h"], housekeeping_cadence: "daily", default_unit_types: [{ code: "DORM6", name: "6-Bed Mixed Dorm", claim_mode: "positional", capacity: 6 }, { code: "DORM6F", name: "6-Bed Female Dorm", claim_mode: "positional", capacity: 6 }, { code: "PRIV", name: "Private Room", claim_mode: "exclusive", capacity: 2 }] } },
  { type: "vertical_profile", key: "serviced_apartment", content: { terminology: { space: "Apartment", unit_type: "Apartment Type" }, claim_mode_default: "exclusive", features: { ...verticalFeatures, long_stay_billing: true, owner_statements: true, kiosk_checkin: false }, default_policies: ["long_stay_30d", "deposit_one_month"], housekeeping_cadence: "weekly", default_unit_types: [{ code: "STU", name: "Studio", claim_mode: "exclusive", capacity: 2 }, { code: "1BR", name: "1 Bedroom", claim_mode: "exclusive", capacity: 3 }] } },
  { type: "vertical_profile", key: "str", content: { terminology: { space: "Property", unit_type: "Listing" }, claim_mode_default: "exclusive", features: { ...verticalFeatures, owner_statements: true }, default_policies: ["str_strict_5d", "deposit_damage"], housekeeping_cadence: "on_departure", default_unit_types: [{ code: "UNIT", name: "Entire Unit", claim_mode: "exclusive", capacity: 6 }] } },
  { type: "tax_jurisdiction", key: "in-gst-lodging", content: { country: "IN", price_display: "tax_exclusive", rounding: "document", taxes: [{ code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent", slab_basis: "transaction_value", applies_to: ["room_revenue"], slabs: [{ upto_minor: 100000, rate: 0, itc_eligible: false }, { upto_minor: 750000, rate: 0.05, itc_eligible: false }, { upto_minor: null, rate: 0.18, itc_eligible: true }] }, { code: "GST_FNB", name: "GST on F&B (restaurant in hotel)", mode: "percent", rate: 0.05, applies_to: ["fnb_revenue"] }] } },
  { type: "tax_jurisdiction", key: "sa-vat", content: { country: "SA", price_display: "tax_inclusive", rounding: "line", taxes: [{ code: "VAT", name: "VAT", mode: "percent", rate: 0.15, applies_to: ["room_revenue", "fnb_revenue", "other_revenue"] }] } },
  { type: "tax_jurisdiction", key: "ae-vat", content: { country: "AE", price_display: "tax_inclusive", rounding: "line", taxes: [{ code: "VAT", name: "VAT", mode: "percent", rate: 0.05, applies_to: ["room_revenue", "fnb_revenue", "other_revenue"] }] } },
  { type: "policy", key: "flex_24h", content: { kind: "cancellation", rules: [{ before_hours: 24, penalty: { basis: "nights", value: 1 } }] } },
  { type: "policy", key: "flex_48h", content: { kind: "cancellation", rules: [{ before_hours: 48, penalty: { basis: "nights", value: 1 } }] } },
  { type: "policy", key: "str_strict_5d", content: { kind: "cancellation", rules: [{ before_hours: 120, penalty: { basis: "percent", value: 100 } }] } },
  { type: "policy", key: "non_refundable", content: { kind: "cancellation", rules: [{ before_hours: 0, penalty: { basis: "percent", value: 100 } }] } },
  { type: "policy", key: "deposit_first_night", content: { kind: "deposit", deposit: { basis: "first_night", due: "at_booking" } } },
  { type: "policy", key: "deposit_one_month", content: { kind: "deposit", deposit: { basis: "one_month", due: "at_booking" } } },
  { type: "policy", key: "deposit_damage", content: { kind: "deposit", deposit: { basis: "fixed", value: 10000, due: "at_booking" } } },
  { type: "policy", key: "long_stay_30d", content: { kind: "guarantee", guarantee: "deposit_paid" } },
  { type: "statutory_adapter", key: "it-alloggiati", content: { country: "IT", adapter_key: "it-alloggiati", schedule: "within_24h", required_identity_fields: ["document_number", "nationality", "birth_date"], transport: "https_form", format: "fixed_width_168" } },
  { type: "statutory_adapter", key: "pt-siba", content: { country: "PT", adapter_key: "pt-siba", schedule: "daily_batch", required_identity_fields: ["document_number", "nationality"], transport: "sftp", format: "siba" } },
  { type: "statutory_adapter", key: "in-form-c", content: { country: "IN", adapter_key: "in-form-c", schedule: "on_checkin", required_identity_fields: ["passport_number", "nationality", "visa_number"], transport: "rest", format: "e-frro" } },
  { type: "statutory_adapter", key: "hr-evisitor", content: { country: "HR", adapter_key: "hr-evisitor", schedule: "on_checkin", required_identity_fields: ["document_number", "nationality"], transport: "rest", format: "evisitor" } },
  { type: "fiscal_provider", key: "sa-zatca", content: { jurisdiction: "SA", mode: "in_house_clearance", provider_key: "zatca-phase2", document_formats: ["ubl21_xadhes"], chain: { hash_algo: "sha256", pih_required: true, qr: "tlv_base64" }, credential_ref: "vault:sa-zatca" } },
  { type: "fiscal_provider", key: "in-irp", content: { jurisdiction: "IN", mode: "in_house_reporting", provider_key: "india-irp", document_formats: ["irp_json_1_1"], chain: { hash_algo: "sha256", pih_required: false, qr: "none" }, credential_ref: "vault:in-irp" } },
  { type: "fiscal_provider", key: "ae-asp", content: { jurisdiction: "AE", mode: "provider_routed", provider_key: "ae-asp:tbd", document_formats: ["pint_ae"], credential_ref: "vault:ae-asp" } },
  ...[
    ["route_charge", ["posting.created"]], ["post_scheduled_charge", ["day.rolled"]],
    ["send_message", ["reservation.created", "reservation.confirmed"]], ["create_task", ["reservation.checked_out"]],
    ["apply_deposit_schedule", ["reservation.confirmed"]], ["set_restriction", ["occupancy.threshold"]],
    ["owner_statement_accrual", ["posting.created"]], ["escalate_approval", ["adjustment.requested"]],
  ].map(([action, allowedTriggers]) => ({
    type: "automation_action",
    key: action as string,
    content: { action, params_schema: { type: "object" }, idempotent: true, allowed_triggers: allowedTriggers },
  })),
  ...RATE_MODEL_CATALOGUE.map(({ key, ...content }) => ({
    type: "rate_model",
    key,
    content,
  })),
]);

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  tier: string;
  residency: string;
  status: string;
  created_at: Date | string;
}

interface PropertyRow {
  id: string;
  tenant_id: string;
  path: string;
  kind: string;
  name: string;
  timezone: string | null;
  currency: string | null;
  config: unknown;
}

interface IdentityRow {
  current_user: string;
  tenant_context: string | null;
  backend_pid: number;
}

interface RollbackEvidence {
  readonly backendPid?: number;
  readonly connectionUsable: boolean;
  readonly roleReset: boolean;
  readonly tenantContextCleared: boolean;
}

export interface SeedOptions {
  readonly databaseUrl: string;
  readonly logger?: (line: string) => void;
  /** Integration-test fault injection. Runs after tenant handling, before property handling. */
  readonly beforeProperty?: (connection: ReservedSQL) => Promise<void>;
}

export interface SeedResult {
  readonly tenant: "inserted" | "already exact";
  readonly property: "inserted" | "already exact";
  readonly registry: "inserted" | "already exact";
  readonly deploymentRole: string;
  readonly writeRole: "app_role";
  readonly backendPid: number;
  readonly roleReset: true;
  readonly tenantContextCleared: true;
  readonly reuseProbeCleared: true;
}

export class SeedError extends Error {
  readonly errno?: string;
  readonly backendPid?: number;
  readonly rollbackConnectionUsable?: boolean;
  readonly roleReset?: boolean;
  readonly tenantContextCleared?: boolean;

  constructor(message: string, options: {
    errno?: string;
    backendPid?: number;
    rollbackConnectionUsable?: boolean;
    roleReset?: boolean;
    tenantContextCleared?: boolean;
  } = {}) {
    super(message);
    this.name = "SeedError";
    Object.assign(this, options);
  }
}

const rollbackEvidence = new WeakMap<object, RollbackEvidence>();

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const errno = Reflect.get(error, "errno");
  return typeof errno === "string" && errno !== "" ? errno : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redact(value: string, databaseUrl: string): string {
  let result = value.split(databaseUrl).join("[REDACTED_DATABASE_URL]");
  try {
    const parsed = new URL(databaseUrl);
    for (const credential of [parsed.username, parsed.password, decodeURIComponent(parsed.username), decodeURIComponent(parsed.password)]) {
      if (credential) result = result.split(credential).join("[REDACTED]");
    }
  } catch {
    // The SQL client reports malformed URLs; the generic pattern still removes credentials.
  }
  return result.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@");
}

function publicError(error: unknown, databaseUrl: string): SeedError {
  const evidence = error && typeof error === "object" ? rollbackEvidence.get(error) : undefined;
  const errno = sqlState(error);
  return new SeedError(`${redact(errorMessage(error), databaseUrl)}${errno ? ` (SQLSTATE ${errno})` : ""}`, {
    errno,
    backendPid: evidence?.backendPid,
    rollbackConnectionUsable: evidence?.connectionUsable,
    roleReset: evidence?.roleReset,
    tenantContextCleared: evidence?.tenantContextCleared,
  });
}

function sameConfig(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
}

function tenantIsExact(row: TenantRow): boolean {
  return row.id === SEED_TENANT.id && row.slug === SEED_TENANT.slug && row.name === SEED_TENANT.name &&
    row.tier === SEED_TENANT.tier && row.residency === SEED_TENANT.residency && row.status === SEED_TENANT.status;
}

function propertyIsExact(row: PropertyRow): boolean {
  return row.id === SEED_PROPERTY.id && row.tenant_id === SEED_PROPERTY.tenantId && row.path === SEED_PROPERTY.path &&
    row.kind === SEED_PROPERTY.kind && row.name === SEED_PROPERTY.name && row.timezone === SEED_PROPERTY.timezone &&
    row.currency === SEED_PROPERTY.currency && sameConfig(row.config);
}

async function identity(connection: ReservedSQL): Promise<IdentityRow> {
  const rows = await connection<IdentityRow[]>`
    SELECT current_user,
           NULLIF(current_setting('app.tenant_id', true), '') AS tenant_context,
           pg_backend_pid() AS backend_pid
  `;
  const row = rows[0];
  if (!row || typeof row.backend_pid !== "number") throw new Error("PostgreSQL identity probe failed");
  return row;
}

async function assertReset(connection: ReservedSQL, deploymentRole: string, backendPid: number): Promise<void> {
  const row = await identity(connection);
  if (row.backend_pid !== backendPid) throw new Error("Seed connection affinity was lost");
  if (row.current_user !== deploymentRole) throw new Error(`Seed role did not reset to deployment role ${deploymentRole}`);
  if (row.tenant_context !== null) throw new Error("Transaction-local tenant context survived transaction end");
}

async function deriveAndValidateIds(): Promise<void> {
  const tenantId = await uuidV5(URL_NAMESPACE_UUID, TENANT_NAME);
  const propertyId = await uuidV5(tenantId, PROPERTY_NAME);
  if (tenantId !== SEED_TENANT.id || propertyId !== SEED_PROPERTY.id) {
    throw new Error("Derived seed UUIDs do not match the canonical seed identities");
  }
}

async function handleTenant(connection: ReservedSQL): Promise<SeedResult["tenant"]> {
  let rows = await connection<TenantRow[]>`
    SELECT id, slug, name, tier, residency, status, created_at
      FROM public.tenant
     WHERE id = ${SEED_TENANT.id} OR slug = ${SEED_TENANT.slug}
     ORDER BY id
  `;
  if (rows.length === 0) {
    rows = await connection<TenantRow[]>`
      INSERT INTO public.tenant (id, slug, name, tier, residency, status)
      VALUES (${SEED_TENANT.id}, ${SEED_TENANT.slug}, ${SEED_TENANT.name}, ${SEED_TENANT.tier}, ${SEED_TENANT.residency}, ${SEED_TENANT.status})
      RETURNING id, slug, name, tier, residency, status, created_at
    `;
    if (rows.length !== 1 || !rows[0] || !tenantIsExact(rows[0])) throw new Error("Inserted tenant is not canonical");
    return "inserted";
  }
  if (rows.length !== 1 || !rows[0] || !tenantIsExact(rows[0])) throw new Error("Tenant seed collision does not exactly match canonical values");
  return "already exact";
}

async function handleProperty(connection: ReservedSQL): Promise<SeedResult["property"]> {
  let rows = await connection<PropertyRow[]>`
    SELECT id, tenant_id, path::text AS path, kind, name, timezone, currency, config
      FROM public.org_node
     WHERE id = ${SEED_PROPERTY.id}
        OR (tenant_id = ${SEED_PROPERTY.tenantId} AND path = ${SEED_PROPERTY.path}::ltree)
     ORDER BY id
  `;
  if (rows.length === 0) {
    rows = await connection<PropertyRow[]>`
      INSERT INTO public.org_node (id, tenant_id, path, kind, name, timezone, currency, config)
      VALUES (${SEED_PROPERTY.id}, ${SEED_PROPERTY.tenantId}, ${SEED_PROPERTY.path}::ltree, ${SEED_PROPERTY.kind}, ${SEED_PROPERTY.name}, ${SEED_PROPERTY.timezone}, ${SEED_PROPERTY.currency}, ${JSON.stringify(SEED_PROPERTY.config)}::text::jsonb)
      RETURNING id, tenant_id, path::text AS path, kind, name, timezone, currency, config
    `;
    if (rows.length !== 1 || !rows[0] || !propertyIsExact(rows[0])) throw new Error("Inserted property is not canonical");
    return "inserted";
  }
  if (rows.length !== 1 || !rows[0] || !propertyIsExact(rows[0])) throw new Error("Property seed collision does not exactly match canonical values");
  return "already exact";
}

async function writeSeedAudit(
  connection: ReservedSQL,
  entityType: "extension_type" | "extension",
  entityId: string,
  operation: "extension_type.registered" | "extension.seeded",
  payload: Record<string, unknown>,
): Promise<void> {
  const requestId = await uuidV5(entityId, `https://yellow.local/seed/audit/${operation}`);
  const encodedPayload = JSON.stringify({ ...payload, request_id: requestId });
  const rows = await connection<Array<{ id: string }>>`
    INSERT INTO fact_log (
      tenant_id, entity_type, entity_id, fact_type, valid_from,
      business_date, actor_id, payload
    )
    SELECT
      ${SEED_TENANT.id}::uuid,
      ${entityType},
      ${entityId}::uuid,
      ${operation},
      transaction_timestamp(),
      (transaction_timestamp() AT TIME ZONE property.timezone)::date,
      ${SEED_ACTOR_ID}::uuid,
      ${encodedPayload}::text::jsonb
    FROM org_node AS property
    WHERE property.id = ${SEED_PROPERTY.id}::uuid
      AND property.tenant_id = ${SEED_TENANT.id}::uuid
      AND property.kind = 'property'
    RETURNING id
  `;
  if (rows.length !== 1) throw new Error(`Seed audit property missing for ${entityType} ${entityId}`);
}

async function handleLaunchRegistry(connection: ReservedSQL): Promise<SeedResult["registry"]> {
  let inserted = 0;
  for (const definition of LAUNCH_EXTENSION_TYPES) {
    const encodedSchema = JSON.stringify(definition.jsonSchema);
    const existing = await connection<Array<{ exact: boolean }>>`
      SELECT json_schema = ${encodedSchema}::text::jsonb AS exact
      FROM extension_type
      WHERE type = ${definition.type}
      FOR UPDATE
    `;
    if (existing.length > 1 || existing[0]?.exact === false) {
      throw new Error(`Extension type seed collision for ${definition.type}`);
    }
    if (existing.length === 0) {
      await connection`
        INSERT INTO extension_type (type, json_schema)
        VALUES (${definition.type}, ${encodedSchema}::text::jsonb)
      `;
      const subjectId = await uuidV5(URL_NAMESPACE_UUID, `https://yellow.local/extension-type/${definition.type}`);
      await writeSeedAudit(connection, "extension_type", subjectId, "extension_type.registered", {
        type: definition.type,
        json_schema: definition.jsonSchema,
      });
      inserted += 1;
    }
  }

  for (const instance of LAUNCH_EXTENSIONS) {
    const id = await uuidV5(URL_NAMESPACE_UUID, `https://yellow.local/extension/${instance.type}/${instance.key}/1`);
    const encodedContent = JSON.stringify(instance.content);
    const existing = await connection<Array<{ exact: boolean }>>`
      SELECT
        id = ${id}::uuid
        AND tenant_id IS NULL
        AND type = ${instance.type}
        AND key = ${instance.key}
        AND version = 1
        AND content = ${encodedContent}::text::jsonb
        AND status = 'active' AS exact
      FROM extension
      WHERE id = ${id}::uuid
         OR (tenant_id IS NULL AND type = ${instance.type} AND key = ${instance.key} AND version = 1)
      FOR UPDATE
    `;
    if (existing.length > 1 || existing[0]?.exact === false) {
      throw new Error(`Extension instance seed collision for ${instance.type}/${instance.key}`);
    }
    if (existing.length === 0) {
      await connection`
        INSERT INTO extension (id, tenant_id, type, key, version, content, status)
        VALUES (${id}::uuid, NULL, ${instance.type}, ${instance.key}, 1, ${encodedContent}::text::jsonb, 'active')
      `;
      await writeSeedAudit(connection, "extension", id, "extension.seeded", {
        type: instance.type,
        key: instance.key,
        version: 1,
        content: instance.content,
        status: "active",
      });
      inserted += 1;
    }
  }
  return inserted === 0 ? "already exact" : "inserted";
}

export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  const { databaseUrl, logger = console.log } = options;
  let pool: SQL | undefined;
  let connection: ReservedSQL | undefined;
  let failure: unknown;
  let result: SeedResult | undefined;

  try {
    await deriveAndValidateIds();
    pool = new SQL(databaseUrl);
    connection = await pool.reserve();
    const before = await identity(connection);
    const deploymentRole = before.current_user;
    const backendPid = before.backend_pid;

    await connection.unsafe("BEGIN");
    try {
      await connection.unsafe("SET LOCAL ROLE app_role");
      const role = await identity(connection);
      if (role.current_user !== "app_role" || role.backend_pid !== backendPid) {
        throw new Error("Seed transaction did not assume app_role on the reserved backend");
      }

      const tenant = await handleTenant(connection);
      const contextRows = await connection<{ tenant_context: string }[]>`
        SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true) AS tenant_context
      `;
      if (contextRows[0]?.tenant_context !== SEED_TENANT.id) throw new Error("Seed transaction did not establish exact tenant context");

      await options.beforeProperty?.(connection);
      const property = await handleProperty(connection);
      await connection.unsafe("RESET ROLE");
      const registry = await handleLaunchRegistry(connection);
      await connection.unsafe("SET LOCAL ROLE app_role");
      await handleTenant(connection);
      await handleProperty(connection);
      await connection.unsafe("COMMIT");

      await assertReset(connection, deploymentRole, backendPid);
      // A second transaction on the same reservation proves pool/backend reuse begins clean.
      await connection.unsafe("BEGIN");
      await assertReset(connection, deploymentRole, backendPid);
      await connection.unsafe("ROLLBACK");
      await assertReset(connection, deploymentRole, backendPid);

      logger(`seed tenant: ${tenant}`);
      logger(`seed property: ${property}`);
      logger(`seed summary: status=${tenant === "already exact" && property === "already exact" && registry === "already exact" ? "no-op" : "applied"} backend_pid=${backendPid}`);
      result = { tenant, property, registry, deploymentRole, writeRole: "app_role", backendPid, roleReset: true, tenantContextCleared: true, reuseProbeCleared: true };
    } catch (error) {
      let evidence: RollbackEvidence = { connectionUsable: false, roleReset: false, tenantContextCleared: false };
      try {
        await connection.unsafe("ROLLBACK");
        const after = await identity(connection);
        evidence = {
          backendPid: after.backend_pid,
          connectionUsable: after.backend_pid === backendPid,
          roleReset: after.current_user === deploymentRole,
          tenantContextCleared: after.tenant_context === null,
        };
      } catch {
        // Preserve the transaction's original error.
      }
      if (error && typeof error === "object") rollbackEvidence.set(error, evidence);
      throw error;
    }
  } catch (error) {
    failure = error;
  } finally {
    if (connection) {
      try { connection.release(); } catch (error) { if (failure === undefined) failure = error; }
    }
    if (pool) {
      try { await pool.close(); } catch (error) { if (failure === undefined) failure = error; }
    }
  }

  if (failure !== undefined) throw publicError(failure, databaseUrl);
  if (!result) throw new SeedError("Seed completed without a result");
  return result;
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }
  try {
    await runSeed({ databaseUrl });
  } catch (error) {
    console.error(`seed failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await runCli();
