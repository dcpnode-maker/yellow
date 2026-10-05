import {
  ExtensionRegistry,
  type AuditEnvelope,
  type ExtensionInstance,
  type Tx,
} from "../../kernel";
import { RateNotFoundError, RateValidationError } from "./configuration";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MODEL_CAPABILITY = /^[a-z][a-z0-9-]{0,63}$/;
const AUTHORING_MODES = Object.freeze(["guided", "expert", "ai"] as const);

export const RATE_MODEL_KEYS = Object.freeze([
  "simple-fixed",
  "calendar",
  "bar-ladder",
  "derived",
  "room-matrix",
  "occupancy-los",
  "contract-negotiated",
  "package",
  "rms-api-managed",
  "expert-composition",
] as const);

export type RateModelKey = (typeof RATE_MODEL_KEYS)[number];
export type RateModelAuthoringMode = (typeof AUTHORING_MODES)[number];

export interface RateModelCatalogueEntry {
  readonly key: RateModelKey;
  readonly version: 1;
  readonly label: string;
  readonly description: string;
  readonly capabilities: readonly string[];
}

function catalogueEntry(
  key: RateModelKey,
  label: string,
  description: string,
  capabilities: readonly string[],
): RateModelCatalogueEntry {
  if (capabilities.length === 0 || capabilities.some((value) => !MODEL_CAPABILITY.test(value))) {
    throw new Error(`Rate-model catalogue ${key} has invalid capabilities`);
  }
  if (new Set(capabilities).size !== capabilities.length) {
    throw new Error(`Rate-model catalogue ${key} has duplicate capabilities`);
  }
  return Object.freeze({
    key,
    version: 1,
    label,
    description,
    capabilities: Object.freeze([...capabilities]),
  });
}

export const RATE_MODEL_CATALOGUE: readonly RateModelCatalogueEntry[] = Object.freeze([
  catalogueEntry(
    "simple-fixed",
    "Simple fixed",
    "One exact governed price across an explicit scope.",
    ["exact-price", "date-scope"],
  ),
  catalogueEntry(
    "calendar",
    "Calendar",
    "Explicit day cells with governed open, closed and exact-price values.",
    ["calendar-cells", "exact-price", "open-close"],
  ),
  catalogueEntry(
    "bar-ladder",
    "BAR ladder",
    "A best-available-rate base with typed adjustment steps and guards.",
    ["bar-adjustment", "exact-price", "floor-ceiling"],
  ),
  catalogueEntry(
    "derived",
    "Derived",
    "A versioned relationship to another rate plan with typed adjustment.",
    ["parent-plan", "typed-adjustment"],
  ),
  catalogueEntry(
    "room-matrix",
    "Room matrix",
    "One model with explicit deltas across physical selling scopes.",
    ["physical-scope", "typed-adjustment"],
  ),
  catalogueEntry(
    "occupancy-los",
    "Occupancy and length of stay",
    "Typed occupancy, booking-window and stay-length response bands.",
    ["booking-window", "length-of-stay", "occupancy-bands"],
  ),
  catalogueEntry(
    "contract-negotiated",
    "Contract and negotiated",
    "Eligibility-governed pricing for company, agent and segment agreements.",
    ["commercial-eligibility", "effective-dates"],
  ),
  catalogueEntry(
    "package",
    "Package",
    "A rate composed with versioned package and policy references.",
    ["package-composition", "policy-composition"],
  ),
  catalogueEntry(
    "rms-api-managed",
    "RMS or API managed",
    "Governed external recommendations with bounds and explicit fallback.",
    ["external-recommendation", "fallback", "floor-ceiling"],
  ),
  catalogueEntry(
    "expert-composition",
    "Expert composition",
    "A bounded composition of registered model families with conflict review.",
    ["conflict-review", "registered-composition"],
  ),
]);

export const RATE_MODEL_EXTENSION_SCHEMA = Object.freeze({
  $id: "pms:rate_model:1",
  type: "object",
  required: ["version", "label", "description", "capabilities"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    label: { type: "string" },
    description: { type: "string" },
    capabilities: { type: "array", items: { type: "string" } },
  },
} as const);

export const RATE_PLAN_MODEL_EXTENSION_SCHEMA = Object.freeze({
  $id: "pms:rate_plan_model:1",
  type: "object",
  required: [
    "property_node",
    "rate_plan_id",
    "model_key",
    "model_version",
    "authoring_mode",
    "component_model_keys",
  ],
  additionalProperties: false,
  properties: {
    property_node: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    rate_plan_id: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    model_key: { enum: [...RATE_MODEL_KEYS] },
    model_version: { type: "integer", minimum: 1 },
    authoring_mode: { enum: [...AUTHORING_MODES] },
    component_model_keys: { type: "array", items: { enum: [...RATE_MODEL_KEYS] } },
  },
} as const);

export interface CreateRateModelDraftInput {
  readonly ratePlanId: string;
  readonly modelKey: RateModelKey;
  readonly modelVersion: number;
  readonly authoringMode: RateModelAuthoringMode;
  readonly componentModelKeys: readonly RateModelKey[];
  readonly envelope: AuditEnvelope;
}

export interface RateModelDraft {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly modelKey: RateModelKey;
  readonly modelVersion: 1;
  readonly authoringMode: RateModelAuthoringMode;
  readonly componentModelKeys: readonly RateModelKey[];
  readonly extensionVersion: number;
  readonly status: "draft";
}

interface RateModelExtensionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly version: number;
  readonly content: unknown;
  readonly status: string;
}

interface NormalizedSelection {
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly modelKey: RateModelKey;
  readonly modelVersion: 1;
  readonly authoringMode: RateModelAuthoringMode;
  readonly componentModelKeys: readonly RateModelKey[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  subject: string,
): void {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new RateValidationError(`${subject} contains unsupported fields`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new RateValidationError(`${name} must be a UUID`);
  }
  return value;
}

function requireModel(key: unknown, version: unknown): RateModelCatalogueEntry {
  if (typeof key !== "string" || !RATE_MODEL_KEYS.includes(key as RateModelKey)) {
    throw new RateValidationError("modelKey must name a registered rate model");
  }
  if (version !== 1) throw new RateValidationError("modelVersion must be the registered version 1");
  const model = RATE_MODEL_CATALOGUE.find((candidate) => candidate.key === key);
  if (!model || model.version !== version) {
    throw new RateValidationError("rate model key and version are not registered");
  }
  return model;
}

function requireAuthoringMode(value: unknown): RateModelAuthoringMode {
  if (typeof value !== "string" || !AUTHORING_MODES.includes(value as RateModelAuthoringMode)) {
    throw new RateValidationError("authoringMode must be guided, expert, or ai");
  }
  return value as RateModelAuthoringMode;
}

function normalizeComponents(modelKey: RateModelKey, value: unknown): readonly RateModelKey[] {
  if (!Array.isArray(value)) throw new RateValidationError("componentModelKeys must be an array");
  if (value.some((key) => typeof key !== "string" || !RATE_MODEL_KEYS.includes(key as RateModelKey))) {
    throw new RateValidationError("componentModelKeys must contain only registered model keys");
  }
  const keys = value as RateModelKey[];
  if (new Set(keys).size !== keys.length) {
    throw new RateValidationError("componentModelKeys must not contain duplicates");
  }
  if (modelKey !== "expert-composition") {
    if (keys.length !== 0) throw new RateValidationError("only expert-composition accepts component models");
    return Object.freeze([]);
  }
  if (keys.length < 1 || keys.length > 8) {
    throw new RateValidationError("expert-composition requires 1 to 8 component models");
  }
  if (keys.includes("expert-composition")) {
    throw new RateValidationError("expert-composition cannot recursively contain itself");
  }
  return Object.freeze([...keys].sort((left, right) => left.localeCompare(right)));
}

function normalizeCreateInput(input: CreateRateModelDraftInput): Omit<NormalizedSelection, "propertyNode"> {
  if (!isObject(input)) throw new RateValidationError("rate-model draft must be an object");
  requireOnlyKeys(input, [
    "ratePlanId",
    "modelKey",
    "modelVersion",
    "authoringMode",
    "componentModelKeys",
    "envelope",
  ], "rate-model draft");
  const ratePlanId = requireUuid("ratePlanId", input.ratePlanId);
  const model = requireModel(input.modelKey, input.modelVersion);
  return {
    ratePlanId,
    modelKey: model.key,
    modelVersion: model.version,
    authoringMode: requireAuthoringMode(input.authoringMode),
    componentModelKeys: normalizeComponents(model.key, input.componentModelKeys),
  };
}

function normalizeStoredContent(value: unknown): NormalizedSelection {
  if (!isObject(value)) throw new RateValidationError("stored rate-model content must be an object");
  requireOnlyKeys(value, [
    "property_node",
    "rate_plan_id",
    "model_key",
    "model_version",
    "authoring_mode",
    "component_model_keys",
  ], "stored rate-model content");
  const propertyNode = requireUuid("stored property_node", value.property_node);
  const ratePlanId = requireUuid("stored rate_plan_id", value.rate_plan_id);
  const model = requireModel(value.model_key, value.model_version);
  return {
    propertyNode,
    ratePlanId,
    modelKey: model.key,
    modelVersion: model.version,
    authoringMode: requireAuthoringMode(value.authoring_mode),
    componentModelKeys: normalizeComponents(model.key, value.component_model_keys),
  };
}

async function requireActivePlan(
  tx: Tx,
  tenantId: string,
  propertyNode: string,
  ratePlanId: string,
): Promise<void> {
  const rows = await tx<Array<{ id: string }>>`
    SELECT id
    FROM rate_plan
    WHERE id = ${ratePlanId}::uuid
      AND tenant_id = ${tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property_node = ${propertyNode}::uuid
      AND status = 'active'
  `;
  if (!rows[0]) throw new RateNotFoundError("Active rate plan was not found in the active property");
}

function toDraft(
  instance: Pick<ExtensionInstance, "id" | "tenantId" | "version" | "status">,
  selection: NormalizedSelection,
): RateModelDraft {
  if (instance.tenantId === null || instance.status !== "draft") {
    throw new RateValidationError("rate-model version is not a tenant draft");
  }
  return Object.freeze({
    id: instance.id,
    tenantId: instance.tenantId,
    propertyNode: selection.propertyNode,
    ratePlanId: selection.ratePlanId,
    modelKey: selection.modelKey,
    modelVersion: selection.modelVersion,
    authoringMode: selection.authoringMode,
    componentModelKeys: Object.freeze([...selection.componentModelKeys]),
    extensionVersion: instance.version,
    status: "draft",
  });
}

export class RateModelService {
  readonly #registry: ExtensionRegistry;

  constructor(registry: ExtensionRegistry) {
    this.#registry = registry;
  }

  async createDraftVersion(tx: Tx, input: CreateRateModelDraftInput): Promise<RateModelDraft> {
    if (input.envelope.operation !== "rate_plan_model.drafted") {
      throw new RateValidationError("audit operation must be rate_plan_model.drafted");
    }
    const selection = normalizeCreateInput(input);
    const propertyNode = requireUuid("propertyNode", input.envelope.propertyNode);
    await requireActivePlan(
      tx,
      input.envelope.tenantId,
      propertyNode,
      selection.ratePlanId,
    );
    const content = {
      property_node: propertyNode,
      rate_plan_id: selection.ratePlanId,
      model_key: selection.modelKey,
      model_version: selection.modelVersion,
      authoring_mode: selection.authoringMode,
      component_model_keys: selection.componentModelKeys,
    };
    const instance = await this.#registry.createVersion(tx, {
      type: "rate_plan_model",
      key: `rate-plan:${selection.ratePlanId}`,
      content,
      status: "draft",
      envelope: input.envelope,
      factPayload: {
        property_node: propertyNode,
        rate_plan_id: selection.ratePlanId,
        model_key: selection.modelKey,
        model_version: selection.modelVersion,
        authoring_mode: selection.authoringMode,
      },
    });
    return toDraft(instance, { ...selection, propertyNode });
  }

  async listDraftVersions(
    tx: Tx,
    propertyNode: string,
    ratePlanId: string,
  ): Promise<readonly RateModelDraft[]> {
    const normalizedProperty = requireUuid("propertyNode", propertyNode);
    const normalizedPlan = requireUuid("ratePlanId", ratePlanId);
    const tenantRows = await tx<Array<{ tenant_id: string }>>`
      SELECT current_setting('app.tenant_id', true)::uuid AS tenant_id
    `;
    const tenantId = tenantRows[0]?.tenant_id;
    if (!tenantId) throw new RateNotFoundError("Active tenant context was not found");
    await requireActivePlan(tx, tenantId, normalizedProperty, normalizedPlan);
    const rows = await tx<RateModelExtensionRow[]>`
      SELECT id, tenant_id, version, content, status
      FROM extension
      WHERE tenant_id = ${tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = 'rate_plan_model'
        AND key = ${`rate-plan:${normalizedPlan}`}
        AND status = 'draft'
      ORDER BY version, id
    `;
    return Object.freeze(rows.map((row) => {
      const selection = normalizeStoredContent(row.content);
      if (selection.propertyNode !== normalizedProperty || selection.ratePlanId !== normalizedPlan) {
        throw new RateValidationError("stored rate-model scope does not match its rate plan key");
      }
      return toDraft({
        id: row.id,
        tenantId: row.tenant_id,
        version: row.version,
        status: row.status as ExtensionInstance["status"],
      }, selection);
    }));
  }
}
