import {
  ExtensionRegistry,
  type AuditEnvelope,
  type ExtensionInstance,
  type Tx,
} from "../../kernel";
import { RateNotFoundError, RateValidationError } from "./configuration";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RULE_KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const UPPER_CODE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const CHANNEL_CODE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const AUTHORING_MODES = Object.freeze(["guided", "expert", "ai"] as const);

export const RATE_TARGET_COMMERCIAL_KEYS = Object.freeze([
  "companyPartyId",
  "marketGroupCode",
  "marketCode",
  "sourcePartyId",
  "sourceCode",
  "channelCode",
  "segmentCode",
  "agentPartyId",
  "campaignCode",
] as const);

type RateTargetCommercialKey = (typeof RATE_TARGET_COMMERCIAL_KEYS)[number];
export type RateTargetAuthoringMode = (typeof AUTHORING_MODES)[number];

export interface RateTargetCommercial {
  readonly companyPartyId?: string;
  readonly marketGroupCode?: string;
  readonly marketCode?: string;
  readonly sourcePartyId?: string;
  readonly sourceCode?: string;
  readonly channelCode?: string;
  readonly segmentCode?: string;
  readonly agentPartyId?: string;
  readonly campaignCode?: string;
}

export type RateTargetPhysical =
  | Readonly<{ kind: "property" }>
  | Readonly<{ kind: "class"; classCode: string; unitTypeIds: readonly string[] }>
  | Readonly<{ kind: "unit_type"; unitTypeId: string }>
  | Readonly<{ kind: "sellable"; sellableUnitId: string }>;

export interface RateTargetRule {
  readonly key: string;
  readonly effect: "include" | "exclude";
  readonly priority: number;
  readonly physical: RateTargetPhysical;
  readonly commercial: RateTargetCommercial;
}

export interface CreateRateTargetDraftInput {
  readonly ratePlanId: string;
  readonly authoringMode: RateTargetAuthoringMode;
  readonly rules: readonly RateTargetRule[];
  readonly envelope: AuditEnvelope;
}

export interface RateTargetDraft {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly authoringMode: RateTargetAuthoringMode;
  readonly rules: readonly RateTargetRule[];
  readonly extensionVersion: number;
  readonly status: "draft";
}

export interface RateTargetContext {
  readonly propertyNode: string;
  readonly unitTypeId: string;
  readonly sellableUnitId: string | null;
  readonly commercial: RateTargetCommercial;
}

export interface ResolveRateTargetDraftInput extends RateTargetContext {
  readonly ratePlanId: string;
  readonly extensionVersion: number;
}

export interface RateTargetResolution {
  readonly state: "included" | "excluded" | "not_applicable" | "conflict";
  readonly winningRuleKey: string | null;
  readonly matchedRuleKeys: readonly string[];
  readonly conflictingRuleKeys: readonly string[];
}

interface RateTargetExtensionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly version: number;
  readonly content: unknown;
  readonly status: string;
}

interface NormalizedContent {
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly authoringMode: RateTargetAuthoringMode;
  readonly rules: readonly RateTargetRule[];
}

type JsonObject = Record<string, unknown>;

export const RATE_PLAN_TARGET_EXTENSION_SCHEMA = Object.freeze({
  $id: "pms:rate_plan_target:1",
  type: "object",
  required: ["property_node", "rate_plan_id", "authoring_mode", "rules"],
  additionalProperties: false,
  properties: {
    property_node: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    rate_plan_id: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    authoring_mode: { enum: [...AUTHORING_MODES] },
    rules: {
      type: "array",
      items: {
        type: "object",
        required: ["key", "effect", "priority", "physical", "commercial"],
        additionalProperties: false,
        properties: {
          key: { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{0,63}$" },
          effect: { enum: ["include", "exclude"] },
          priority: { type: "integer", minimum: 0 },
          physical: {
            type: "object",
            required: ["kind"],
            additionalProperties: false,
            properties: {
              kind: { enum: ["property", "class", "unit_type", "sellable"] },
              class_code: { type: "string" },
              unit_type_ids: { type: "array", items: { type: "string" } },
              unit_type_id: { type: "string" },
              sellable_unit_id: { type: "string" },
            },
          },
          commercial: {
            type: "object",
            additionalProperties: false,
            properties: {
              company_party_id: { type: "string" },
              market_group_code: { type: "string" },
              market_code: { type: "string" },
              source_party_id: { type: "string" },
              source_code: { type: "string" },
              channel_code: { type: "string" },
              segment_code: { type: "string" },
              agent_party_id: { type: "string" },
              campaign_code: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const);

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): JsonObject {
  if (!isObject(value)) throw new RateValidationError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: JsonObject, allowedKeys: readonly string[], subject: string): void {
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

function requireUpperCode(name: string, value: unknown): string {
  if (typeof value !== "string" || !UPPER_CODE.test(value)) {
    throw new RateValidationError(`${name} must be a canonical uppercase code`);
  }
  return value;
}

function requireChannelCode(value: unknown): string {
  if (typeof value !== "string" || !CHANNEL_CODE.test(value)) {
    throw new RateValidationError("channelCode must be a canonical lowercase code");
  }
  return value;
}

function requireAuthoringMode(value: unknown): RateTargetAuthoringMode {
  if (typeof value !== "string" || !AUTHORING_MODES.includes(value as RateTargetAuthoringMode)) {
    throw new RateValidationError("authoringMode must be guided, expert, or ai");
  }
  return value as RateTargetAuthoringMode;
}

function normalizeCommercial(value: unknown): RateTargetCommercial {
  const source = requireObject(value, "commercial target");
  requireOnlyKeys(source, RATE_TARGET_COMMERCIAL_KEYS, "commercial target");
  const result: Record<string, string> = {};
  for (const key of RATE_TARGET_COMMERCIAL_KEYS) {
    const candidate = source[key];
    if (candidate === undefined) continue;
    switch (key) {
      case "companyPartyId":
      case "sourcePartyId":
      case "agentPartyId":
        result[key] = requireUuid(key, candidate);
        break;
      case "channelCode":
        result[key] = requireChannelCode(candidate);
        break;
      default:
        result[key] = requireUpperCode(key, candidate);
    }
  }
  return Object.freeze(result) as RateTargetCommercial;
}

function normalizePhysical(value: unknown): RateTargetPhysical {
  const source = requireObject(value, "physical target");
  if (source.kind === "property") {
    requireOnlyKeys(source, ["kind"], "property target");
    return Object.freeze({ kind: "property" });
  }
  if (source.kind === "class") {
    requireOnlyKeys(source, ["kind", "classCode", "unitTypeIds"], "class target");
    const classCode = requireUpperCode("classCode", source.classCode);
    if (!Array.isArray(source.unitTypeIds) || source.unitTypeIds.length < 1 || source.unitTypeIds.length > 100) {
      throw new RateValidationError("class target requires 1 to 100 unitTypeIds");
    }
    const unitTypeIds = source.unitTypeIds.map((id) => requireUuid("class unitTypeId", id));
    if (new Set(unitTypeIds).size !== unitTypeIds.length) {
      throw new RateValidationError("class unitTypeIds must be unique");
    }
    return Object.freeze({
      kind: "class",
      classCode,
      unitTypeIds: Object.freeze([...unitTypeIds].sort()),
    });
  }
  if (source.kind === "unit_type") {
    requireOnlyKeys(source, ["kind", "unitTypeId"], "unit-type target");
    return Object.freeze({ kind: "unit_type", unitTypeId: requireUuid("unitTypeId", source.unitTypeId) });
  }
  if (source.kind === "sellable") {
    requireOnlyKeys(source, ["kind", "sellableUnitId"], "sellable target");
    return Object.freeze({
      kind: "sellable",
      sellableUnitId: requireUuid("sellableUnitId", source.sellableUnitId),
    });
  }
  throw new RateValidationError("physical target kind must be property, class, unit_type, or sellable");
}

function normalizeRule(value: unknown, index: number): RateTargetRule {
  const source = requireObject(value, `target rule ${index}`);
  requireOnlyKeys(source, ["key", "effect", "priority", "physical", "commercial"], `target rule ${index}`);
  if (typeof source.key !== "string" || !RULE_KEY.test(source.key)) {
    throw new RateValidationError(`target rule ${index} key must be stable lowercase text`);
  }
  if (source.effect !== "include" && source.effect !== "exclude") {
    throw new RateValidationError(`target rule ${index} effect must be include or exclude`);
  }
  if (!Number.isSafeInteger(source.priority) || (source.priority as number) < 0 || (source.priority as number) > 1000) {
    throw new RateValidationError(`target rule ${index} priority must be an integer from 0 to 1000`);
  }
  return Object.freeze({
    key: source.key,
    effect: source.effect,
    priority: source.priority as number,
    physical: normalizePhysical(source.physical),
    commercial: normalizeCommercial(source.commercial),
  });
}

function normalizeRules(value: unknown): readonly RateTargetRule[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 200) {
    throw new RateValidationError("target rules must contain 1 to 200 entries");
  }
  const rules = value.map(normalizeRule);
  if (new Set(rules.map(({ key }) => key)).size !== rules.length) {
    throw new RateValidationError("target rule keys must be unique");
  }
  const classMemberships = new Map<string, string>();
  for (const { physical } of rules) {
    if (physical.kind !== "class") continue;
    const membership = physical.unitTypeIds.join(",");
    const existing = classMemberships.get(physical.classCode);
    if (existing !== undefined && existing !== membership) {
      throw new RateValidationError("one classCode must have one exact unit-type membership per draft");
    }
    classMemberships.set(physical.classCode, membership);
  }
  return Object.freeze([...rules].sort((left, right) => left.key.localeCompare(right.key)));
}

function normalizeCreateInput(input: CreateRateTargetDraftInput): Omit<NormalizedContent, "propertyNode"> {
  const source = requireObject(input, "rate-target draft");
  requireOnlyKeys(source, ["ratePlanId", "authoringMode", "rules", "envelope"], "rate-target draft");
  return {
    ratePlanId: requireUuid("ratePlanId", source.ratePlanId),
    authoringMode: requireAuthoringMode(source.authoringMode),
    rules: normalizeRules(source.rules),
  };
}

const COMMERCIAL_TO_STORED: Readonly<Record<RateTargetCommercialKey, string>> = Object.freeze({
  companyPartyId: "company_party_id",
  marketGroupCode: "market_group_code",
  marketCode: "market_code",
  sourcePartyId: "source_party_id",
  sourceCode: "source_code",
  channelCode: "channel_code",
  segmentCode: "segment_code",
  agentPartyId: "agent_party_id",
  campaignCode: "campaign_code",
});

function storePhysical(value: RateTargetPhysical): JsonObject {
  switch (value.kind) {
    case "property": return { kind: "property" };
    case "class": return { kind: "class", class_code: value.classCode, unit_type_ids: value.unitTypeIds };
    case "unit_type": return { kind: "unit_type", unit_type_id: value.unitTypeId };
    case "sellable": return { kind: "sellable", sellable_unit_id: value.sellableUnitId };
  }
}

function storeCommercial(value: RateTargetCommercial): JsonObject {
  const result: JsonObject = {};
  for (const key of RATE_TARGET_COMMERCIAL_KEYS) {
    if (value[key] !== undefined) result[COMMERCIAL_TO_STORED[key]] = value[key];
  }
  return result;
}

function storeRules(rules: readonly RateTargetRule[]): readonly JsonObject[] {
  return rules.map((rule) => ({
    key: rule.key,
    effect: rule.effect,
    priority: rule.priority,
    physical: storePhysical(rule.physical),
    commercial: storeCommercial(rule.commercial),
  }));
}

function readStoredPhysical(value: unknown): RateTargetPhysical {
  const source = requireObject(value, "stored physical target");
  if (source.kind === "property") return normalizePhysical(source);
  if (source.kind === "class") {
    requireOnlyKeys(source, ["kind", "class_code", "unit_type_ids"], "stored class target");
    return normalizePhysical({ kind: "class", classCode: source.class_code, unitTypeIds: source.unit_type_ids });
  }
  if (source.kind === "unit_type") {
    requireOnlyKeys(source, ["kind", "unit_type_id"], "stored unit-type target");
    return normalizePhysical({ kind: "unit_type", unitTypeId: source.unit_type_id });
  }
  if (source.kind === "sellable") {
    requireOnlyKeys(source, ["kind", "sellable_unit_id"], "stored sellable target");
    return normalizePhysical({ kind: "sellable", sellableUnitId: source.sellable_unit_id });
  }
  throw new RateValidationError("stored physical target kind is invalid");
}

function readStoredCommercial(value: unknown): RateTargetCommercial {
  const source = requireObject(value, "stored commercial target");
  requireOnlyKeys(source, Object.values(COMMERCIAL_TO_STORED), "stored commercial target");
  const result: JsonObject = {};
  for (const key of RATE_TARGET_COMMERCIAL_KEYS) {
    const storedKey = COMMERCIAL_TO_STORED[key];
    if (source[storedKey] !== undefined) result[key] = source[storedKey];
  }
  return normalizeCommercial(result);
}

function readStoredRules(value: unknown): readonly RateTargetRule[] {
  if (!Array.isArray(value)) throw new RateValidationError("stored target rules must be an array");
  return normalizeRules(value.map((candidate, index) => {
    const source = requireObject(candidate, `stored target rule ${index}`);
    requireOnlyKeys(source, ["key", "effect", "priority", "physical", "commercial"], `stored target rule ${index}`);
    return {
      key: source.key,
      effect: source.effect,
      priority: source.priority,
      physical: readStoredPhysical(source.physical),
      commercial: readStoredCommercial(source.commercial),
    };
  }));
}

function normalizeStoredContent(value: unknown): NormalizedContent {
  const source = requireObject(value, "stored rate-target content");
  requireOnlyKeys(source, ["property_node", "rate_plan_id", "authoring_mode", "rules"], "stored rate-target content");
  return {
    propertyNode: requireUuid("stored property_node", source.property_node),
    ratePlanId: requireUuid("stored rate_plan_id", source.rate_plan_id),
    authoringMode: requireAuthoringMode(source.authoring_mode),
    rules: readStoredRules(source.rules),
  };
}

async function requireActivePlan(
  tx: Tx,
  tenantId: string,
  propertyNode: string,
  ratePlanId: string,
): Promise<void> {
  const rows = await tx<Array<{ id: string }>>`
    SELECT id FROM rate_plan
    WHERE id = ${ratePlanId}::uuid
      AND tenant_id = ${tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property_node = ${propertyNode}::uuid
      AND status = 'active'
  `;
  if (!rows[0]) throw new RateNotFoundError("Active rate plan was not found in the active property");
}

async function requireUnitTypes(
  tx: Tx,
  tenantId: string,
  propertyNode: string,
  ids: readonly string[],
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await tx<Array<{ id: string }>>`
    SELECT id FROM unit_type
    WHERE tenant_id = ${tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property_node = ${propertyNode}::uuid
      AND id IN ${tx(unique)}
  `;
  if (rows.length !== unique.length) {
    throw new RateNotFoundError("A targeted unit type was not found in the active property");
  }
}

async function requireSellables(
  tx: Tx,
  tenantId: string,
  propertyNode: string,
  ids: readonly string[],
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await tx<Array<{ id: string }>>`
    SELECT sellable.id
    FROM sellable_unit AS sellable
    JOIN unit_type AS unit ON unit.id = sellable.unit_type_id
      AND unit.tenant_id = sellable.tenant_id
    WHERE sellable.tenant_id = ${tenantId}::uuid
      AND sellable.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND unit.property_node = ${propertyNode}::uuid
      AND sellable.status = 'active'
      AND sellable.id IN ${tx(unique)}
  `;
  if (rows.length !== unique.length) {
    throw new RateNotFoundError("A targeted sellable was not found active in the property");
  }
}

async function requirePartiesByRole(
  tx: Tx,
  tenantId: string,
  role: "company" | "agent" | "source",
  ids: readonly string[],
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await tx<Array<{ id: string }>>`
    SELECT party.id
    FROM party
    JOIN party_role ON party_role.party_id = party.id
      AND party_role.tenant_id = party.tenant_id
    WHERE party.tenant_id = ${tenantId}::uuid
      AND party.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND party.status = 'active'
      AND party_role.role = ${role}
      AND party.id IN ${tx(unique)}
  `;
  if (rows.length !== unique.length) {
    throw new RateNotFoundError(`A targeted ${role} was not found active in the tenant`);
  }
}

async function validateReferences(
  tx: Tx,
  tenantId: string,
  propertyNode: string,
  rules: readonly RateTargetRule[],
): Promise<void> {
  const unitTypeIds = rules.flatMap(({ physical }) => {
    if (physical.kind === "unit_type") return [physical.unitTypeId];
    if (physical.kind === "class") return [...physical.unitTypeIds];
    return [];
  });
  const sellableIds = rules.flatMap(({ physical }) =>
    physical.kind === "sellable" ? [physical.sellableUnitId] : []
  );
  const companies = rules.flatMap(({ commercial }) => commercial.companyPartyId ? [commercial.companyPartyId] : []);
  const agents = rules.flatMap(({ commercial }) => commercial.agentPartyId ? [commercial.agentPartyId] : []);
  const sources = rules.flatMap(({ commercial }) => commercial.sourcePartyId ? [commercial.sourcePartyId] : []);
  await requireUnitTypes(tx, tenantId, propertyNode, unitTypeIds);
  await requireSellables(tx, tenantId, propertyNode, sellableIds);
  await requirePartiesByRole(tx, tenantId, "company", companies);
  await requirePartiesByRole(tx, tenantId, "agent", agents);
  await requirePartiesByRole(tx, tenantId, "source", sources);
}

function toDraft(
  instance: Pick<ExtensionInstance, "id" | "tenantId" | "version" | "status">,
  content: NormalizedContent,
): RateTargetDraft {
  if (instance.tenantId === null || instance.status !== "draft") {
    throw new RateValidationError("rate-target version is not a tenant draft");
  }
  return Object.freeze({
    id: instance.id,
    tenantId: instance.tenantId,
    propertyNode: content.propertyNode,
    ratePlanId: content.ratePlanId,
    authoringMode: content.authoringMode,
    rules: content.rules,
    extensionVersion: instance.version,
    status: "draft",
  });
}

function physicalRank(physical: RateTargetPhysical): number {
  switch (physical.kind) {
    case "property": return 0;
    case "class": return 1;
    case "unit_type": return 2;
    case "sellable": return 3;
  }
}

function physicalMatches(physical: RateTargetPhysical, context: RateTargetContext): boolean {
  switch (physical.kind) {
    case "property": return true;
    case "class": return physical.unitTypeIds.includes(context.unitTypeId);
    case "unit_type": return physical.unitTypeId === context.unitTypeId;
    case "sellable": return physical.sellableUnitId === context.sellableUnitId;
  }
}

function commercialMatches(commercial: RateTargetCommercial, context: RateTargetCommercial): boolean {
  return RATE_TARGET_COMMERCIAL_KEYS.every((key) =>
    commercial[key] === undefined || commercial[key] === context[key]
  );
}

export function resolveRateTargetRules(
  inputRules: readonly RateTargetRule[],
  inputContext: RateTargetContext,
  draftPropertyNode: string,
): RateTargetResolution {
  const rules = normalizeRules(inputRules);
  const contextSource = requireObject(inputContext, "rate-target context");
  requireOnlyKeys(contextSource, ["propertyNode", "unitTypeId", "sellableUnitId", "commercial"], "rate-target context");
  const context: RateTargetContext = Object.freeze({
    propertyNode: requireUuid("propertyNode", contextSource.propertyNode),
    unitTypeId: requireUuid("unitTypeId", contextSource.unitTypeId),
    sellableUnitId: contextSource.sellableUnitId === null
      ? null
      : requireUuid("sellableUnitId", contextSource.sellableUnitId),
    commercial: normalizeCommercial(contextSource.commercial),
  });
  if (context.propertyNode !== requireUuid("draftPropertyNode", draftPropertyNode)) {
    throw new RateValidationError("rate-target context property does not match its draft");
  }
  const matched = rules.filter((rule) =>
    physicalMatches(rule.physical, context) && commercialMatches(rule.commercial, context.commercial)
  ).sort((left, right) =>
    physicalRank(right.physical) - physicalRank(left.physical) ||
    Object.keys(right.commercial).length - Object.keys(left.commercial).length ||
    right.priority - left.priority ||
    left.key.localeCompare(right.key)
  );
  if (matched.length === 0) {
    return Object.freeze({
      state: "not_applicable",
      winningRuleKey: null,
      matchedRuleKeys: Object.freeze([]),
      conflictingRuleKeys: Object.freeze([]),
    });
  }
  const first = matched[0]!;
  const rank = physicalRank(first.physical);
  const dimensions = Object.keys(first.commercial).length;
  const top = matched.filter((rule) =>
    physicalRank(rule.physical) === rank &&
    Object.keys(rule.commercial).length === dimensions &&
    rule.priority === first.priority
  );
  const matchedRuleKeys = Object.freeze(matched.map(({ key }) => key));
  if (top.length > 1) {
    return Object.freeze({
      state: "conflict",
      winningRuleKey: null,
      matchedRuleKeys,
      conflictingRuleKeys: Object.freeze(top.map(({ key }) => key).sort()),
    });
  }
  return Object.freeze({
    state: first.effect === "include" ? "included" : "excluded",
    winningRuleKey: first.key,
    matchedRuleKeys,
    conflictingRuleKeys: Object.freeze([]),
  });
}

export class RateTargetService {
  readonly #registry: ExtensionRegistry;

  constructor(registry: ExtensionRegistry) {
    this.#registry = registry;
  }

  async createDraftVersion(tx: Tx, input: CreateRateTargetDraftInput): Promise<RateTargetDraft> {
    if (input.envelope.operation !== "rate_plan_target.drafted") {
      throw new RateValidationError("audit operation must be rate_plan_target.drafted");
    }
    const normalized = normalizeCreateInput(input);
    const propertyNode = requireUuid("propertyNode", input.envelope.propertyNode);
    await requireActivePlan(tx, input.envelope.tenantId, propertyNode, normalized.ratePlanId);
    await validateReferences(tx, input.envelope.tenantId, propertyNode, normalized.rules);
    const content = {
      property_node: propertyNode,
      rate_plan_id: normalized.ratePlanId,
      authoring_mode: normalized.authoringMode,
      rules: storeRules(normalized.rules),
    };
    const instance = await this.#registry.createVersion(tx, {
      type: "rate_plan_target",
      key: `rate-plan:${normalized.ratePlanId}`,
      content,
      status: "draft",
      envelope: input.envelope,
      factPayload: {
        property_node: propertyNode,
        rate_plan_id: normalized.ratePlanId,
        authoring_mode: normalized.authoringMode,
        rule_count: normalized.rules.length,
      },
    });
    return toDraft(instance, { ...normalized, propertyNode });
  }

  async listDraftVersions(
    tx: Tx,
    propertyNode: string,
    ratePlanId: string,
  ): Promise<readonly RateTargetDraft[]> {
    const normalizedProperty = requireUuid("propertyNode", propertyNode);
    const normalizedPlan = requireUuid("ratePlanId", ratePlanId);
    const tenantRows = await tx<Array<{ tenant_id: string }>>`
      SELECT current_setting('app.tenant_id', true)::uuid AS tenant_id
    `;
    const tenantId = tenantRows[0]?.tenant_id;
    if (!tenantId) throw new RateNotFoundError("Active tenant context was not found");
    await requireActivePlan(tx, tenantId, normalizedProperty, normalizedPlan);
    const rows = await tx<RateTargetExtensionRow[]>`
      SELECT id, tenant_id, version, content, status
      FROM extension
      WHERE tenant_id = ${tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = 'rate_plan_target'
        AND key = ${`rate-plan:${normalizedPlan}`}
        AND status = 'draft'
      ORDER BY version, id
    `;
    return Object.freeze(rows.map((row) => {
      const content = normalizeStoredContent(row.content);
      if (content.propertyNode !== normalizedProperty || content.ratePlanId !== normalizedPlan) {
        throw new RateValidationError("stored rate-target scope does not match its rate-plan key");
      }
      return toDraft({
        id: row.id,
        tenantId: row.tenant_id,
        version: row.version,
        status: row.status as ExtensionInstance["status"],
      }, content);
    }));
  }

  async resolveDraftVersion(tx: Tx, input: ResolveRateTargetDraftInput): Promise<RateTargetResolution> {
    const source = requireObject(input, "rate-target resolution");
    requireOnlyKeys(source, [
      "propertyNode",
      "ratePlanId",
      "extensionVersion",
      "unitTypeId",
      "sellableUnitId",
      "commercial",
    ], "rate-target resolution");
    const propertyNode = requireUuid("propertyNode", source.propertyNode);
    const ratePlanId = requireUuid("ratePlanId", source.ratePlanId);
    const unitTypeId = requireUuid("unitTypeId", source.unitTypeId);
    const sellableUnitId = source.sellableUnitId === null
      ? null
      : requireUuid("sellableUnitId", source.sellableUnitId);
    if (!Number.isSafeInteger(source.extensionVersion) || (source.extensionVersion as number) < 1) {
      throw new RateValidationError("extensionVersion must be a positive integer");
    }
    const commercial = normalizeCommercial(source.commercial);
    const tenantRows = await tx<Array<{ tenant_id: string }>>`
      SELECT current_setting('app.tenant_id', true)::uuid AS tenant_id
    `;
    const tenantId = tenantRows[0]?.tenant_id;
    if (!tenantId) throw new RateNotFoundError("Active tenant context was not found");
    await requireActivePlan(tx, tenantId, propertyNode, ratePlanId);
    await requireUnitTypes(tx, tenantId, propertyNode, [unitTypeId]);
    if (sellableUnitId !== null) {
      const rows = await tx<Array<{ id: string }>>`
        SELECT sellable.id
        FROM sellable_unit AS sellable
        JOIN unit_type AS unit ON unit.id = sellable.unit_type_id
          AND unit.tenant_id = sellable.tenant_id
        WHERE sellable.id = ${sellableUnitId}::uuid
          AND sellable.tenant_id = ${tenantId}::uuid
          AND sellable.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND sellable.status = 'active'
          AND unit.id = ${unitTypeId}::uuid
          AND unit.property_node = ${propertyNode}::uuid
      `;
      if (!rows[0]) throw new RateNotFoundError("Sellable and unit type were not found together in the property");
    }
    await validateReferences(tx, tenantId, propertyNode, [{
      key: "context",
      effect: "include",
      priority: 0,
      physical: { kind: "property" },
      commercial,
    }]);
    const rows = await tx<RateTargetExtensionRow[]>`
      SELECT id, tenant_id, version, content, status
      FROM extension
      WHERE tenant_id = ${tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = 'rate_plan_target'
        AND key = ${`rate-plan:${ratePlanId}`}
        AND version = ${source.extensionVersion as number}
        AND status = 'draft'
    `;
    const row = rows[0];
    if (!row) throw new RateNotFoundError("Rate-target draft was not found in the active plan");
    const content = normalizeStoredContent(row.content);
    if (content.propertyNode !== propertyNode || content.ratePlanId !== ratePlanId) {
      throw new RateValidationError("stored rate-target scope does not match its rate-plan key");
    }
    return resolveRateTargetRules(content.rules, {
      propertyNode,
      unitTypeId,
      sellableUnitId,
      commercial,
    }, content.propertyNode);
  }
}
