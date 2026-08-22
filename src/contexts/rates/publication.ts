import {
  ApprovalService,
  ExtensionRegistry,
  recordFact,
  type ApprovalRequest,
  type AuditEnvelope,
  type EventBus,
  type ExtensionInstance,
  type Tx,
} from "../../kernel";
import {
  composeRateQuote,
  deriveRateCompositionContext,
  normalizeRateCompositionSpec,
  type RateCompositionResult,
  type RateCompositionSpec,
} from "./composition";
import {
  deriveRateEvaluationContext,
  evaluateRateModel,
  isDirectRateEvaluatorModel,
  normalizeRateEvaluatorSpec,
  type RateEvaluationContext,
  type RateEvaluatorSpec,
} from "./evaluators";
import { RateModelService, type RateModelDraft } from "./models";
import {
  RateRecommendationRegistry,
  type RateRecommendationBinding,
} from "./recommendations";
import {
  RateTargetService,
  type RateTargetCommercial,
  type RateTargetResolution,
} from "./targeting";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STABLE_KEY = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const MINOR = /^(0|-?[1-9][0-9]*)$/;
const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MIN_BIGINT = -9_223_372_036_854_775_808n;
const RELEASE_TYPE = "rate_plan_release";

type JsonObject = Record<string, unknown>;
type ReleaseStatus = "draft" | "active" | "retired";

export const RATE_PLAN_RELEASE_EXTENSION_SCHEMA = Object.freeze({
  $id: "pms:rate_plan_release:1",
  type: "object",
  required: [
    "property_node",
    "rate_plan_id",
    "model_draft_id",
    "model_draft_version",
    "target_draft_id",
    "target_draft_version",
    "evaluator",
    "composition",
    "rms_binding",
    "undo_of_version",
  ],
  additionalProperties: false,
  properties: {
    property_node: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    rate_plan_id: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    model_draft_id: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    model_draft_version: { type: "integer", minimum: 1 },
    target_draft_id: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    target_draft_version: { type: "integer", minimum: 1 },
    evaluator: { type: "object" },
    composition: { type: "object" },
    rms_binding: {
      type: ["object", "null"],
      required: ["adapter_key", "adapter_version", "maximum_age_seconds", "outage_fallback"],
      additionalProperties: false,
      properties: {
        adapter_key: { type: "string", pattern: "^[a-z0-9][a-z0-9._:-]{0,127}$" },
        adapter_version: { type: "integer", minimum: 1 },
        maximum_age_seconds: { type: "integer", minimum: 1 },
        outage_fallback: { enum: ["local_evaluator"] },
      },
    },
    undo_of_version: { type: ["integer", "null"], minimum: 1 },
  },
} as const);

export class RatePublicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatePublicationError";
  }
}

export class RatePublicationNotFoundError extends RatePublicationError {
  constructor(message: string) {
    super(message);
    this.name = "RatePublicationNotFoundError";
  }
}

export class RatePublicationConflictError extends RatePublicationError {
  constructor(message: string) {
    super(message);
    this.name = "RatePublicationConflictError";
  }
}

export interface CreateRatePublicationDraftInput {
  readonly ratePlanId: string;
  readonly modelDraftVersion: number;
  readonly targetDraftVersion: number;
  readonly evaluatorSpec: unknown;
  readonly compositionSpec: unknown;
  readonly rmsBinding?: unknown;
  readonly envelope: AuditEnvelope;
}

export interface RatePlanRelease {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly modelDraftId: string;
  readonly modelDraftVersion: number;
  readonly targetDraftId: string;
  readonly targetDraftVersion: number;
  readonly evaluatorSpec: RateEvaluatorSpec;
  readonly compositionSpec: RateCompositionSpec;
  readonly rmsBinding: RateRmsBinding | null;
  readonly contentHash: string;
  readonly extensionVersion: number;
  readonly status: ReleaseStatus;
  readonly undoOfVersion: number | null;
}

export interface RateRmsBinding extends RateRecommendationBinding {}

export interface EvaluateRateReleaseNightInput {
  readonly propertyTimeZone: string;
  readonly bookingInstant: string;
  readonly stayStartInstant: string;
  readonly stayEndInstant: string;
  readonly nightDate: string;
  readonly occupancyBasisPoints?: number;
  readonly occupancyEvidenceRef?: string;
  readonly barLevel?: string;
  readonly targetContext: Readonly<{
    unitTypeId: string;
    sellableUnitId: string | null;
    commercial: RateTargetCommercial;
  }>;
}

export interface RateReleaseNightEvaluation {
  readonly release: RatePlanRelease;
  readonly targetResolution: RateTargetResolution;
  readonly evaluationContext: RateEvaluationContext;
  readonly result: ReturnType<typeof evaluateRateModel>;
}

export interface RatePublicationPreviewCell {
  readonly key: string;
  readonly evaluationContext: Readonly<Record<string, unknown>>;
  readonly targetContext: Readonly<{
    unitTypeId: string;
    sellableUnitId: string | null;
    commercial: RateTargetCommercial;
  }>;
  readonly guests: unknown;
  readonly selectedPromotionCodes: unknown;
  readonly policyEvidence: unknown;
  readonly mandatoryPolicyEvidence: unknown;
  readonly availabilityEvidence: unknown;
  readonly channelCode: unknown;
  readonly channelMappingEvidenceRef: unknown;
}

export interface RatePublicationCellResult {
  readonly key: string;
  readonly targetResolution: RateTargetResolution;
  readonly evaluationContext: RateEvaluationContext;
  readonly result: RateCompositionResult;
}

export interface RatePublicationSimulation {
  readonly cells: readonly RatePublicationCellResult[];
  readonly quotedCount: number;
  readonly blockedCount: number;
  readonly unpricedCount: number;
  readonly conflictCount: number;
  readonly workUnits: number;
  readonly contentHash: string;
  readonly previewHash: string;
}

export interface SimulateRatePublicationInput {
  readonly releaseId: string;
  readonly previewCells: readonly unknown[];
}

export interface RequestRatePublicationApprovalInput extends SimulateRatePublicationInput {
  readonly requestedBy: string;
  readonly envelope: AuditEnvelope;
}

export interface PublishRatePublicationInput extends SimulateRatePublicationInput {
  readonly approvalId: string;
  readonly envelope: AuditEnvelope;
}

export interface CreateRatePublicationUndoInput {
  readonly sourceReleaseId: string;
  readonly envelope: AuditEnvelope;
}

interface ReleaseRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly key: string;
  readonly version: number;
  readonly content: unknown;
  readonly status: ReleaseStatus;
}

interface ReleaseContent {
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly modelDraftId: string;
  readonly modelDraftVersion: number;
  readonly targetDraftId: string;
  readonly targetDraftVersion: number;
  readonly evaluatorSpec: RateEvaluatorSpec;
  readonly compositionSpec: RateCompositionSpec;
  readonly rmsBinding: RateRmsBinding | null;
  readonly undoOfVersion: number | null;
  readonly encoded: Readonly<JsonObject>;
}

interface LoadedRelease {
  readonly release: RatePlanRelease;
  readonly encoded: Readonly<JsonObject>;
}

interface ApprovalRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly kind: string;
  readonly subject_type: string;
  readonly subject_id: string;
  readonly payload: Readonly<JsonObject>;
  readonly status: string;
  readonly decided_by: string | null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): JsonObject {
  if (!isObject(value)) throw new RatePublicationError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const names = new Set(allowed);
  if (Object.keys(value).some((key) => !names.has(key))) {
    throw new RatePublicationError(`${subject} contains unsupported fields`);
  }
}

function requireFields(value: JsonObject, required: readonly string[], subject: string): void {
  for (const field of required) {
    if (!Object.hasOwn(value, field)) throw new RatePublicationError(`${subject} requires ${field}`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new RatePublicationError(`${name} must be a UUID`);
  }
  return value;
}

function requireVersion(name: string, value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new RatePublicationError(`${name} must be a positive integer`);
  }
  return value as number;
}

function requireOperation(envelope: AuditEnvelope, operation: string): void {
  if (envelope.operation !== operation) {
    throw new RatePublicationError(`audit operation must be ${operation}`);
  }
}

function exactJson(value: unknown, subject: string): unknown {
  if (typeof value === "bigint") {
    if (value < MIN_BIGINT || value > MAX_BIGINT) {
      throw new RatePublicationError(`${subject} bigint must fit signed-range minor units`);
    }
    return { $minor: value.toString() };
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new RatePublicationError(`${subject} numbers must be safe integers; money must use bigint`);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => exactJson(item, `${subject}[${index}]`));
  if (isObject(value)) {
    const result: JsonObject = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item === undefined) throw new RatePublicationError(`${subject}.${key} must not be undefined`);
      result[key] = exactJson(item, `${subject}.${key}`);
    }
    return result;
  }
  throw new RatePublicationError(`${subject} is not exact JSON data`);
}

function decodeExactJson(value: unknown, subject: string): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RatePublicationError(`${subject} contains an unsafe or fractional number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => decodeExactJson(item, `${subject}[${index}]`));
  if (!isObject(value)) throw new RatePublicationError(`${subject} is not exact JSON data`);
  if (Object.hasOwn(value, "$minor")) {
    if (Object.keys(value).length !== 1 || typeof value.$minor !== "string" || !MINOR.test(value.$minor)) {
      throw new RatePublicationError(`${subject} contains a noncanonical minor-unit tag`);
    }
    const amount = BigInt(value.$minor);
    if (amount < MIN_BIGINT || amount > MAX_BIGINT) {
      throw new RatePublicationError(`${subject} minor units overflow signed bigint`);
    }
    return amount;
  }
  const result: JsonObject = {};
  for (const key of Object.keys(value).sort()) result[key] = decodeExactJson(value[key], `${subject}.${key}`);
  return result;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new RatePublicationError("value cannot be represented as canonical JSON");
  return encoded;
}

function hashJson(value: unknown): string {
  const encoded = exactJson(value, "hash input");
  return new Bun.CryptoHasher("sha256").update(stableJson(encoded)).digest("hex");
}

function parseRmsBinding(value: unknown): RateRmsBinding | null {
  if (value === null) return null;
  const source = requireObject(value, "stored RMS binding");
  const fields = ["adapter_key", "adapter_version", "maximum_age_seconds", "outage_fallback"];
  requireOnlyKeys(source, fields, "stored RMS binding");
  requireFields(source, fields, "stored RMS binding");
  if (typeof source.adapter_key !== "string" || !STABLE_KEY.test(source.adapter_key)) {
    throw new RatePublicationError("stored RMS adapter_key must be bounded stable lowercase text");
  }
  const maximumAgeSeconds = requireVersion("stored RMS maximum_age_seconds", source.maximum_age_seconds);
  if (maximumAgeSeconds > 86_400) {
    throw new RatePublicationError("stored RMS maximum_age_seconds must not exceed 86400");
  }
  if (source.outage_fallback !== "local_evaluator") {
    throw new RatePublicationError("stored RMS outage fallback must be local_evaluator");
  }
  return Object.freeze({
    adapterKey: source.adapter_key,
    adapterVersion: requireVersion("stored RMS adapter_version", source.adapter_version),
    maximumAgeSeconds,
    outageFallback: "local_evaluator",
  });
}

function normalizeRmsBinding(value: unknown): RateRmsBinding | null {
  if (value === undefined || value === null) return null;
  const source = requireObject(value, "RMS binding");
  const fields = ["adapterKey", "adapterVersion", "maximumAgeSeconds", "outageFallback"];
  requireOnlyKeys(source, fields, "RMS binding");
  requireFields(source, fields, "RMS binding");
  if (typeof source.adapterKey !== "string" || !STABLE_KEY.test(source.adapterKey)) {
    throw new RatePublicationError("RMS adapterKey must be bounded stable lowercase text");
  }
  const maximumAgeSeconds = requireVersion("RMS maximumAgeSeconds", source.maximumAgeSeconds);
  if (maximumAgeSeconds > 86_400) {
    throw new RatePublicationError("RMS maximumAgeSeconds must not exceed 86400");
  }
  if (source.outageFallback !== "local_evaluator") {
    throw new RatePublicationError("RMS outageFallback must be local_evaluator");
  }
  return Object.freeze({
    adapterKey: source.adapterKey,
    adapterVersion: requireVersion("RMS adapterVersion", source.adapterVersion),
    maximumAgeSeconds,
    outageFallback: "local_evaluator",
  });
}

function parseReleaseContent(value: unknown): ReleaseContent {
  const source = requireObject(value, "stored rate release");
  const fields = [
    "property_node",
    "rate_plan_id",
    "model_draft_id",
    "model_draft_version",
    "target_draft_id",
    "target_draft_version",
    "evaluator",
    "composition",
    "rms_binding",
    "undo_of_version",
  ];
  requireOnlyKeys(source, fields, "stored rate release");
  requireFields(source, fields, "stored rate release");
  const evaluatorSpec = normalizeRateEvaluatorSpec(decodeExactJson(source.evaluator, "stored evaluator"));
  const compositionSpec = normalizeRateCompositionSpec(decodeExactJson(source.composition, "stored composition"));
  const content = {
    propertyNode: requireUuid("stored property_node", source.property_node),
    ratePlanId: requireUuid("stored rate_plan_id", source.rate_plan_id),
    modelDraftId: requireUuid("stored model_draft_id", source.model_draft_id),
    modelDraftVersion: requireVersion("stored model_draft_version", source.model_draft_version),
    targetDraftId: requireUuid("stored target_draft_id", source.target_draft_id),
    targetDraftVersion: requireVersion("stored target_draft_version", source.target_draft_version),
    evaluatorSpec,
    compositionSpec,
    rmsBinding: parseRmsBinding(source.rms_binding),
    undoOfVersion: source.undo_of_version === null
      ? null
      : requireVersion("stored undo_of_version", source.undo_of_version),
  };
  const encoded = encodeReleaseContent(content);
  if (stableJson(encoded) !== stableJson(source)) {
    throw new RatePublicationError("stored rate release does not match its canonical exact representation");
  }
  return Object.freeze({ ...content, encoded });
}

function encodeReleaseContent(input: Omit<ReleaseContent, "encoded">): Readonly<JsonObject> {
  return Object.freeze({
    property_node: input.propertyNode,
    rate_plan_id: input.ratePlanId,
    model_draft_id: input.modelDraftId,
    model_draft_version: input.modelDraftVersion,
    target_draft_id: input.targetDraftId,
    target_draft_version: input.targetDraftVersion,
    evaluator: exactJson(input.evaluatorSpec, "evaluator"),
    composition: exactJson(input.compositionSpec, "composition"),
    rms_binding: input.rmsBinding === null ? null : {
      adapter_key: input.rmsBinding.adapterKey,
      adapter_version: input.rmsBinding.adapterVersion,
      maximum_age_seconds: input.rmsBinding.maximumAgeSeconds,
      outage_fallback: input.rmsBinding.outageFallback,
    },
    undo_of_version: input.undoOfVersion,
  });
}

function toRelease(row: ReleaseRow, content: ReleaseContent): RatePlanRelease {
  if (row.key !== `rate-plan:${content.ratePlanId}`) {
    throw new RatePublicationError("stored rate release key does not match its rate plan");
  }
  return Object.freeze({
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: content.propertyNode,
    ratePlanId: content.ratePlanId,
    modelDraftId: content.modelDraftId,
    modelDraftVersion: content.modelDraftVersion,
    targetDraftId: content.targetDraftId,
    targetDraftVersion: content.targetDraftVersion,
    evaluatorSpec: content.evaluatorSpec,
    compositionSpec: content.compositionSpec,
    rmsBinding: content.rmsBinding,
    contentHash: hashJson(content.encoded),
    extensionVersion: row.version,
    status: row.status,
    undoOfVersion: content.undoOfVersion,
  });
}

function rowFromInstance(instance: ExtensionInstance): ReleaseRow {
  if (instance.tenantId === null) throw new RatePublicationError("rate releases must be tenant scoped");
  return {
    id: instance.id,
    tenant_id: instance.tenantId,
    key: instance.key,
    version: instance.version,
    content: instance.content,
    status: instance.status,
  };
}

function factEnvelope(envelope: AuditEnvelope, operation: string): AuditEnvelope {
  return Object.freeze({ ...envelope, operation });
}

function approvalPayload(release: RatePlanRelease, simulation: RatePublicationSimulation): Readonly<JsonObject> {
  return Object.freeze({
    rate_plan_id: release.ratePlanId,
    extension_version: release.extensionVersion,
    content_hash: simulation.contentHash,
    preview_hash: simulation.previewHash,
    preview_cell_count: simulation.cells.length,
  });
}

function normalizePreviewCell(value: unknown, index: number): RatePublicationPreviewCell {
  const source = requireObject(value, `preview cell ${index}`);
  const fields = [
    "key",
    "evaluationContext",
    "targetContext",
    "guests",
    "selectedPromotionCodes",
    "policyEvidence",
    "mandatoryPolicyEvidence",
    "availabilityEvidence",
    "channelCode",
    "channelMappingEvidenceRef",
  ];
  requireOnlyKeys(source, fields, `preview cell ${index}`);
  requireFields(source, fields, `preview cell ${index}`);
  if (typeof source.key !== "string" || !STABLE_KEY.test(source.key)) {
    throw new RatePublicationError(`preview cell ${index}.key must be bounded stable lowercase text`);
  }
  const evaluation = requireObject(source.evaluationContext, `preview cell ${index}.evaluationContext`);
  requireOnlyKeys(evaluation, [
    "propertyTimeZone",
    "bookingInstant",
    "stayStartInstant",
    "stayEndInstant",
    "nightDate",
    "occupancyBasisPoints",
    "occupancyEvidenceRef",
    "barLevel",
  ], `preview cell ${index}.evaluationContext`);
  const target = requireObject(source.targetContext, `preview cell ${index}.targetContext`);
  requireOnlyKeys(target, ["unitTypeId", "sellableUnitId", "commercial"], `preview cell ${index}.targetContext`);
  requireFields(target, ["unitTypeId", "sellableUnitId", "commercial"], `preview cell ${index}.targetContext`);
  return Object.freeze({
    key: source.key,
    evaluationContext: Object.freeze({ ...evaluation }),
    targetContext: Object.freeze({
      unitTypeId: requireUuid(`preview cell ${index}.unitTypeId`, target.unitTypeId),
      sellableUnitId: target.sellableUnitId === null
        ? null
        : requireUuid(`preview cell ${index}.sellableUnitId`, target.sellableUnitId),
      commercial: requireObject(target.commercial, `preview cell ${index}.commercial`) as RateTargetCommercial,
    }),
    guests: source.guests,
    selectedPromotionCodes: source.selectedPromotionCodes,
    policyEvidence: source.policyEvidence,
    mandatoryPolicyEvidence: source.mandatoryPolicyEvidence,
    availabilityEvidence: source.availabilityEvidence,
    channelCode: source.channelCode,
    channelMappingEvidenceRef: source.channelMappingEvidenceRef,
  });
}

function normalizePreviewCells(value: unknown): readonly RatePublicationPreviewCell[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) {
    throw new RatePublicationError("previewCells must contain 1 to 500 cells");
  }
  const cells = value.map(normalizePreviewCell);
  if (new Set(cells.map(({ key }) => key)).size !== cells.length) {
    throw new RatePublicationError("preview cell keys must be unique");
  }
  return Object.freeze([...cells].sort((left, right) => left.key.localeCompare(right.key)));
}

function normalizeReleaseNightInput(value: unknown): EvaluateRateReleaseNightInput {
  const source = requireObject(value, "rate release night input");
  const fields = [
    "propertyTimeZone",
    "bookingInstant",
    "stayStartInstant",
    "stayEndInstant",
    "nightDate",
    "occupancyBasisPoints",
    "occupancyEvidenceRef",
    "barLevel",
    "targetContext",
  ];
  requireOnlyKeys(source, fields, "rate release night input");
  requireFields(source, [
    "propertyTimeZone", "bookingInstant", "stayStartInstant", "stayEndInstant", "nightDate", "targetContext",
  ], "rate release night input");
  const rawContext: JsonObject = {
    propertyTimeZone: source.propertyTimeZone,
    bookingInstant: source.bookingInstant,
    stayStartInstant: source.stayStartInstant,
    stayEndInstant: source.stayEndInstant,
    nightDate: source.nightDate,
  };
  if (Object.hasOwn(source, "occupancyBasisPoints") || Object.hasOwn(source, "occupancyEvidenceRef")) {
    rawContext.occupancyBasisPoints = source.occupancyBasisPoints;
    rawContext.occupancyEvidenceRef = source.occupancyEvidenceRef;
  }
  if (Object.hasOwn(source, "barLevel")) rawContext.barLevel = source.barLevel;
  const context = deriveRateEvaluationContext(rawContext);
  const target = requireObject(source.targetContext, "rate release night targetContext");
  requireOnlyKeys(target, ["unitTypeId", "sellableUnitId", "commercial"], "rate release night targetContext");
  requireFields(target, ["unitTypeId", "sellableUnitId", "commercial"], "rate release night targetContext");
  return Object.freeze({
    propertyTimeZone: context.propertyTimeZone,
    bookingInstant: context.bookingInstant,
    stayStartInstant: context.stayStartInstant,
    stayEndInstant: context.stayEndInstant,
    nightDate: context.nightDate,
    ...(context.occupancyBasisPoints === null ? {} : {
      occupancyBasisPoints: context.occupancyBasisPoints,
      occupancyEvidenceRef: context.occupancyEvidenceRef!,
    }),
    ...(context.barLevel === null ? {} : { barLevel: context.barLevel }),
    targetContext: Object.freeze({
      unitTypeId: requireUuid("targetContext.unitTypeId", target.unitTypeId),
      sellableUnitId: target.sellableUnitId === null
        ? null
        : requireUuid("targetContext.sellableUnitId", target.sellableUnitId),
      commercial: requireObject(target.commercial, "targetContext.commercial") as RateTargetCommercial,
    }),
  });
}

async function activeTenantId(tx: Tx): Promise<string> {
  const rows = await tx<Array<{ tenant_id: string | null }>>`
    SELECT nullif(current_setting('app.tenant_id', true), '')::uuid AS tenant_id
  `;
  const tenantId = rows[0]?.tenant_id;
  if (!tenantId) throw new RatePublicationNotFoundError("Active tenant context was not found");
  return tenantId;
}

async function requireActivePlan(
  tx: Tx,
  tenantId: string,
  propertyNode: string,
  ratePlanId: string,
): Promise<{ readonly currency: string }> {
  const rows = await tx<Array<{ currency: string }>>`
    SELECT currency
    FROM rate_plan
    WHERE id = ${ratePlanId}::uuid
      AND tenant_id = ${tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property_node = ${propertyNode}::uuid
      AND status = 'active'
  `;
  const plan = rows[0];
  if (!plan) throw new RatePublicationNotFoundError("Active rate plan was not found in the property");
  return plan;
}

async function validatePolicyReferences(
  tx: Tx,
  tenantId: string,
  spec: RateCompositionSpec,
): Promise<void> {
  const references = [
    ["cancellation", spec.policy.cancellationPolicyId],
    ["deposit", spec.policy.depositPolicyId],
    ["guarantee", spec.policy.guaranteePolicyId],
    ["no_show", spec.policy.noShowPolicyId],
  ] as const;
  for (const [kind, id] of references) {
    if (id === null) continue;
    const rows = await tx<Array<{ kind: string }>>`
      SELECT kind FROM policy
      WHERE id = ${id}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND kind = ${kind}
    `;
    if (!rows[0]) throw new RatePublicationNotFoundError(`${kind} policy was not found in the active tenant`);
  }
}

function validateModelCompatibility(
  model: RateModelDraft,
  evaluator: RateEvaluatorSpec,
  composition: RateCompositionSpec,
  rmsBinding: RateRmsBinding | null,
): void {
  if (model.modelKey === "rms-api-managed") {
    if (evaluator.modelKey !== "rms-api-managed" || rmsBinding === null) {
      throw new RatePublicationError("RMS/API managed publication requires its exact evaluator and RMS binding");
    }
    if (evaluator.floorMinor === null || evaluator.ceilingMinor === null) {
      throw new RatePublicationError("RMS/API managed publication requires explicit floor and ceiling guards");
    }
    return;
  }
  if (rmsBinding !== null) {
    throw new RatePublicationError("RMS binding is only valid for the RMS/API managed model");
  }
  if (model.modelKey === "package") {
    if (composition.package === null) throw new RatePublicationError("package model requires a package composition");
    if (!isDirectRateEvaluatorModel(evaluator.modelKey) && evaluator.modelKey !== "expert-composition") {
      throw new RatePublicationError("package model requires a governed local evaluator");
    }
    return;
  }
  if (model.modelKey !== evaluator.modelKey) {
    throw new RatePublicationError("selected model draft and evaluator model must match");
  }
  if (model.modelKey === "expert-composition" && model.componentModelKeys.length < 1) {
    throw new RatePublicationError("expert composition requires registered component models");
  }
}

export class RatePublicationService {
  readonly #registry: ExtensionRegistry;
  readonly #approvals: ApprovalService;
  readonly #events: EventBus;
  readonly #models: RateModelService;
  readonly #targets: RateTargetService;
  readonly #recommendations: RateRecommendationRegistry;

  constructor(
    registry: ExtensionRegistry,
    approvals: ApprovalService,
    events: EventBus,
    recommendations: RateRecommendationRegistry = new RateRecommendationRegistry(),
  ) {
    this.#registry = registry;
    this.#approvals = approvals;
    this.#events = events;
    this.#models = new RateModelService(registry);
    this.#targets = new RateTargetService(registry);
    this.#recommendations = recommendations;
  }

  async createDraftVersion(tx: Tx, input: CreateRatePublicationDraftInput): Promise<RatePlanRelease> {
    requireOperation(input.envelope, "rate_plan_release.drafted");
    const source = requireObject(input, "rate release draft");
    requireOnlyKeys(source, [
      "ratePlanId",
      "modelDraftVersion",
      "targetDraftVersion",
      "evaluatorSpec",
      "compositionSpec",
      "rmsBinding",
      "envelope",
    ], "rate release draft");
    const tenantId = await activeTenantId(tx);
    if (tenantId !== input.envelope.tenantId) throw new RatePublicationNotFoundError("Audit tenant does not match active tenant");
    const propertyNode = requireUuid("propertyNode", input.envelope.propertyNode);
    const ratePlanId = requireUuid("ratePlanId", source.ratePlanId);
    const modelDraftVersion = requireVersion("modelDraftVersion", source.modelDraftVersion);
    const targetDraftVersion = requireVersion("targetDraftVersion", source.targetDraftVersion);
    const plan = await requireActivePlan(tx, tenantId, propertyNode, ratePlanId);
    const model = (await this.#models.listDraftVersions(tx, propertyNode, ratePlanId))
      .find(({ extensionVersion }) => extensionVersion === modelDraftVersion);
    if (!model) throw new RatePublicationNotFoundError("Exact rate-model draft version was not found");
    const target = (await this.#targets.listDraftVersions(tx, propertyNode, ratePlanId))
      .find(({ extensionVersion }) => extensionVersion === targetDraftVersion);
    if (!target) throw new RatePublicationNotFoundError("Exact rate-target draft version was not found");
    const evaluatorSpec = normalizeRateEvaluatorSpec(source.evaluatorSpec);
    const compositionSpec = normalizeRateCompositionSpec(source.compositionSpec);
    const rmsBinding = normalizeRmsBinding(source.rmsBinding);
    validateModelCompatibility(model, evaluatorSpec, compositionSpec, rmsBinding);
    if (evaluatorSpec.base.kind === "reference") {
      const referenced = await this.#loadRelease(tx, evaluatorSpec.base.sourceId, false);
      if (referenced.release.status === "draft" ||
          referenced.release.extensionVersion !== evaluatorSpec.base.sourceVersion ||
          referenced.release.propertyNode !== propertyNode ||
          referenced.release.evaluatorSpec.currency !== plan.currency) {
        throw new RatePublicationConflictError(
          "Rate reference must name an exact published release in the same property and currency",
        );
      }
    }
    if (evaluatorSpec.currency !== plan.currency || compositionSpec.currency !== plan.currency) {
      throw new RatePublicationError("release currencies must match the active rate plan currency");
    }
    await validatePolicyReferences(tx, tenantId, compositionSpec);
    const content = {
      propertyNode,
      ratePlanId,
      modelDraftId: model.id,
      modelDraftVersion,
      targetDraftId: target.id,
      targetDraftVersion,
      evaluatorSpec,
      compositionSpec,
      rmsBinding,
      undoOfVersion: null,
    };
    const encoded = encodeReleaseContent(content);
    const instance = await this.#registry.createVersion(tx, {
      type: RELEASE_TYPE,
      key: `rate-plan:${ratePlanId}`,
      content: encoded,
      status: "draft",
      envelope: input.envelope,
      factPayload: {
        property_node: propertyNode,
        rate_plan_id: ratePlanId,
        model_draft_id: model.id,
        model_draft_version: modelDraftVersion,
        target_draft_id: target.id,
        target_draft_version: targetDraftVersion,
      },
    });
    return toRelease(rowFromInstance(instance), parseReleaseContent(instance.content));
  }

  async simulateDraft(tx: Tx, input: SimulateRatePublicationInput): Promise<RatePublicationSimulation> {
    const source = requireObject(input, "rate release simulation");
    requireOnlyKeys(source, ["releaseId", "previewCells"], "rate release simulation");
    const loaded = await this.#loadRelease(tx, requireUuid("releaseId", source.releaseId), false);
    if (loaded.release.status !== "draft") throw new RatePublicationConflictError("Only a draft release can be simulated");
    return this.#simulateLoaded(tx, loaded, source.previewCells);
  }

  async requestPublicationApproval(
    tx: Tx,
    input: RequestRatePublicationApprovalInput,
  ): Promise<{ readonly approval: ApprovalRequest; readonly simulation: RatePublicationSimulation }> {
    requireOperation(input.envelope, "rate_plan_release.approval_requested");
    const source = requireObject(input, "rate release approval request");
    requireOnlyKeys(source, ["releaseId", "previewCells", "requestedBy", "envelope"], "rate release approval request");
    const loaded = await this.#loadRelease(tx, requireUuid("releaseId", source.releaseId), true);
    this.#requireEnvelopeScope(input.envelope, loaded.release);
    if (loaded.release.status !== "draft") throw new RatePublicationConflictError("Only a draft release can request approval");
    const simulation = await this.#simulateLoaded(tx, loaded, source.previewCells);
    if (simulation.conflictCount !== 0) {
      throw new RatePublicationConflictError("Conflicted rate release cannot request approval");
    }
    const approval = await this.#approvals.request(tx, {
      kind: RELEASE_TYPE,
      subjectType: "extension",
      subjectId: loaded.release.id,
      requestedBy: requireUuid("requestedBy", source.requestedBy),
      payload: approvalPayload(loaded.release, simulation),
      envelope: input.envelope,
    });
    return Object.freeze({ approval, simulation });
  }

  async publishDraft(
    tx: Tx,
    input: PublishRatePublicationInput,
  ): Promise<{
    readonly release: RatePlanRelease;
    readonly simulation: RatePublicationSimulation;
    readonly previousActiveVersion: number | null;
  }> {
    requireOperation(input.envelope, "rate_plan_release.published");
    const source = requireObject(input, "rate release publication");
    requireOnlyKeys(source, ["releaseId", "approvalId", "previewCells", "envelope"], "rate release publication");
    const releaseId = requireUuid("releaseId", source.releaseId);
    const approvalId = requireUuid("approvalId", source.approvalId);
    const discovered = await this.#loadRelease(tx, releaseId, false);
    const lockKey = `rate-plan-release:${discovered.release.tenantId}:${discovered.release.ratePlanId}`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const loaded = await this.#loadRelease(tx, releaseId, true);
    this.#requireEnvelopeScope(input.envelope, loaded.release);
    if (loaded.release.status !== "draft") throw new RatePublicationConflictError("Release is no longer a draft");
    const latest = await tx<Array<{ version: number }>>`
      SELECT max(version)::int AS version
      FROM extension
      WHERE tenant_id = ${loaded.release.tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = ${RELEASE_TYPE}
        AND key = ${`rate-plan:${loaded.release.ratePlanId}`}
    `;
    if (latest[0]?.version !== loaded.release.extensionVersion) {
      throw new RatePublicationConflictError("Only the latest rate release draft can be published");
    }
    const simulation = await this.#simulateLoaded(tx, loaded, source.previewCells);
    if (simulation.conflictCount !== 0) throw new RatePublicationConflictError("Conflicted rate release cannot be published");
    const approvalRows = await tx<ApprovalRow[]>`
      SELECT id, tenant_id, kind, subject_type, subject_id, payload, status, decided_by
      FROM approval_request
      WHERE id = ${approvalId}::uuid
        AND tenant_id = ${loaded.release.tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
      FOR UPDATE
    `;
    const approval = approvalRows[0];
    if (!approval || approval.status !== "approved" || approval.kind !== RELEASE_TYPE ||
        approval.subject_type !== "extension" || approval.subject_id !== loaded.release.id ||
        approval.decided_by !== input.envelope.actorId) {
      throw new RatePublicationConflictError("Exact approved rate release request was not found");
    }
    if (stableJson(approval.payload) !== stableJson(approvalPayload(loaded.release, simulation))) {
      throw new RatePublicationConflictError("Approved rate release payload is stale or does not match this preview");
    }
    const activeRows = await tx<ReleaseRow[]>`
      SELECT id, tenant_id, key, version, content, status
      FROM extension
      WHERE tenant_id = ${loaded.release.tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = ${RELEASE_TYPE}
        AND key = ${`rate-plan:${loaded.release.ratePlanId}`}
        AND status = 'active'
      FOR UPDATE
    `;
    if (activeRows.length > 1) throw new RatePublicationConflictError("Rate plan has more than one active release");
    const previous = activeRows[0];
    if (previous) {
      await tx`UPDATE extension SET status = 'retired' WHERE id = ${previous.id}::uuid AND status = 'active'`;
      await recordFact(tx, {
        entityType: "extension",
        entityId: previous.id,
        envelope: factEnvelope(input.envelope, "rate_plan_release.retired"),
        payload: {
          rate_plan_id: loaded.release.ratePlanId,
          extension_version: previous.version,
          replaced_by_version: loaded.release.extensionVersion,
        },
      });
    }
    const updated = await tx<ReleaseRow[]>`
      UPDATE extension
      SET status = 'active'
      WHERE id = ${loaded.release.id}::uuid AND status = 'draft'
      RETURNING id, tenant_id, key, version, content, status
    `;
    const active = updated[0];
    if (!active) throw new RatePublicationConflictError("Rate release was published concurrently");
    const fact = await recordFact(tx, {
      entityType: "extension",
      entityId: active.id,
      envelope: input.envelope,
      payload: {
        rate_plan_id: loaded.release.ratePlanId,
        extension_version: loaded.release.extensionVersion,
        approval_id: approval.id,
        content_hash: simulation.contentHash,
        preview_hash: simulation.previewHash,
        preview_cell_count: simulation.cells.length,
      },
    });
    await this.#events.publish(tx, {
      tenantId: loaded.release.tenantId,
      propertyNode: loaded.release.propertyNode,
      businessDate: fact.businessDate,
      aggregateType: "extension",
      aggregateId: active.id,
      eventType: "extension.activated",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: {
        type: RELEASE_TYPE,
        key: active.key,
        version: active.version,
      },
    });
    const content = parseReleaseContent(active.content);
    return Object.freeze({
      release: toRelease(active, content),
      simulation,
      previousActiveVersion: previous?.version ?? null,
    });
  }

  async createUndoDraftVersion(tx: Tx, input: CreateRatePublicationUndoInput): Promise<RatePlanRelease> {
    requireOperation(input.envelope, "rate_plan_release.undo_drafted");
    const source = requireObject(input, "rate release undo");
    requireOnlyKeys(source, ["sourceReleaseId", "envelope"], "rate release undo");
    const loaded = await this.#loadRelease(tx, requireUuid("sourceReleaseId", source.sourceReleaseId), true);
    this.#requireEnvelopeScope(input.envelope, loaded.release);
    if (loaded.release.status !== "active" && loaded.release.status !== "retired") {
      throw new RatePublicationConflictError("Undo source must be an active or retired release");
    }
    await requireActivePlan(tx, loaded.release.tenantId, loaded.release.propertyNode, loaded.release.ratePlanId);
    const content = encodeReleaseContent({
      propertyNode: loaded.release.propertyNode,
      ratePlanId: loaded.release.ratePlanId,
      modelDraftId: loaded.release.modelDraftId,
      modelDraftVersion: loaded.release.modelDraftVersion,
      targetDraftId: loaded.release.targetDraftId,
      targetDraftVersion: loaded.release.targetDraftVersion,
      evaluatorSpec: loaded.release.evaluatorSpec,
      compositionSpec: loaded.release.compositionSpec,
      rmsBinding: loaded.release.rmsBinding,
      undoOfVersion: loaded.release.extensionVersion,
    });
    const instance = await this.#registry.createVersion(tx, {
      type: RELEASE_TYPE,
      key: `rate-plan:${loaded.release.ratePlanId}`,
      content,
      status: "draft",
      envelope: input.envelope,
      factPayload: {
        property_node: loaded.release.propertyNode,
        rate_plan_id: loaded.release.ratePlanId,
        undo_of_version: loaded.release.extensionVersion,
      },
    });
    return toRelease(rowFromInstance(instance), parseReleaseContent(instance.content));
  }

  async evaluateReleaseNight(
    tx: Tx,
    releaseId: string,
    input: EvaluateRateReleaseNightInput,
  ): Promise<RateReleaseNightEvaluation> {
    const loaded = await this.#loadRelease(tx, requireUuid("releaseId", releaseId), false);
    return this.#evaluateLoadedNight(tx, loaded, normalizeReleaseNightInput(input), new Set(), 0);
  }

  async listReleaseVersions(tx: Tx, propertyNode: string, ratePlanId: string): Promise<readonly RatePlanRelease[]> {
    const tenantId = await activeTenantId(tx);
    const property = requireUuid("propertyNode", propertyNode);
    const plan = requireUuid("ratePlanId", ratePlanId);
    await requireActivePlan(tx, tenantId, property, plan);
    const rows = await tx<ReleaseRow[]>`
      SELECT id, tenant_id, key, version, content, status
      FROM extension
      WHERE tenant_id = ${tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = ${RELEASE_TYPE}
        AND key = ${`rate-plan:${plan}`}
      ORDER BY version, id
    `;
    return Object.freeze(rows.map((row) => {
      const content = parseReleaseContent(row.content);
      if (content.propertyNode !== property || content.ratePlanId !== plan) {
        throw new RatePublicationError("stored rate release scope does not match its key");
      }
      return toRelease(row, content);
    }));
  }

  async getActiveRelease(tx: Tx, propertyNode: string, ratePlanId: string): Promise<RatePlanRelease> {
    const releases = (await this.listReleaseVersions(tx, propertyNode, ratePlanId))
      .filter(({ status }) => status === "active");
    if (releases.length === 0) throw new RatePublicationNotFoundError("Active rate release was not found");
    if (releases.length > 1) throw new RatePublicationConflictError("Rate plan has more than one active release");
    return releases[0]!;
  }

  async #loadRelease(tx: Tx, id: string, lock: boolean): Promise<LoadedRelease> {
    const tenantId = await activeTenantId(tx);
    const rows = lock
      ? await tx<ReleaseRow[]>`
          SELECT id, tenant_id, key, version, content, status
          FROM extension
          WHERE id = ${id}::uuid
            AND tenant_id = ${tenantId}::uuid
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND type = ${RELEASE_TYPE}
          FOR UPDATE
        `
      : await tx<ReleaseRow[]>`
          SELECT id, tenant_id, key, version, content, status
          FROM extension
          WHERE id = ${id}::uuid
            AND tenant_id = ${tenantId}::uuid
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND type = ${RELEASE_TYPE}
        `;
    const row = rows[0];
    if (!row) throw new RatePublicationNotFoundError("Rate release was not found in the active tenant");
    const content = parseReleaseContent(row.content);
    const plan = await requireActivePlan(tx, tenantId, content.propertyNode, content.ratePlanId);
    if (content.evaluatorSpec.currency !== plan.currency || content.compositionSpec.currency !== plan.currency) {
      throw new RatePublicationError("stored release currencies do not match the active rate plan");
    }
    const model = (await this.#models.listDraftVersions(tx, content.propertyNode, content.ratePlanId))
      .find(({ id: candidateId, extensionVersion }) =>
        candidateId === content.modelDraftId && extensionVersion === content.modelDraftVersion
      );
    if (!model) throw new RatePublicationNotFoundError("Stored rate-model draft reference was not found");
    const target = (await this.#targets.listDraftVersions(tx, content.propertyNode, content.ratePlanId))
      .find(({ id: candidateId, extensionVersion }) =>
        candidateId === content.targetDraftId && extensionVersion === content.targetDraftVersion
      );
    if (!target) throw new RatePublicationNotFoundError("Stored rate-target draft reference was not found");
    validateModelCompatibility(model, content.evaluatorSpec, content.compositionSpec, content.rmsBinding);
    await validatePolicyReferences(tx, tenantId, content.compositionSpec);
    return Object.freeze({ release: toRelease(row, content), encoded: content.encoded });
  }

  async #evaluateLoadedNight(
    tx: Tx,
    loaded: LoadedRelease,
    input: EvaluateRateReleaseNightInput,
    ancestors: ReadonlySet<string>,
    depth: number,
  ): Promise<RateReleaseNightEvaluation> {
    if (depth >= 16) throw new RatePublicationConflictError("Rate release reference depth exceeds 16");
    if (ancestors.has(loaded.release.id)) throw new RatePublicationConflictError("Rate release reference cycle detected");
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(loaded.release.id);
    const targetResolution = await this.#targets.resolveDraftVersion(tx, {
      propertyNode: loaded.release.propertyNode,
      ratePlanId: loaded.release.ratePlanId,
      extensionVersion: loaded.release.targetDraftVersion,
      unitTypeId: input.targetContext.unitTypeId,
      sellableUnitId: input.targetContext.sellableUnitId,
      commercial: input.targetContext.commercial,
    });
    const rawContext: JsonObject = {
      propertyTimeZone: input.propertyTimeZone,
      bookingInstant: input.bookingInstant,
      stayStartInstant: input.stayStartInstant,
      stayEndInstant: input.stayEndInstant,
      nightDate: input.nightDate,
      targetResolution,
    };
    if (input.occupancyBasisPoints !== undefined || input.occupancyEvidenceRef !== undefined) {
      rawContext.occupancyBasisPoints = input.occupancyBasisPoints;
      rawContext.occupancyEvidenceRef = input.occupancyEvidenceRef;
    }
    if (input.barLevel !== undefined) rawContext.barLevel = input.barLevel;
    const base = loaded.release.evaluatorSpec.base;
    if (base.kind === "reference") {
      const referenced = await this.#loadRelease(tx, base.sourceId, false);
      if (referenced.release.status === "draft" || referenced.release.extensionVersion !== base.sourceVersion) {
        throw new RatePublicationConflictError("Rate reference must name an exact published release version");
      }
      if (referenced.release.propertyNode !== loaded.release.propertyNode ||
          referenced.release.evaluatorSpec.currency !== loaded.release.evaluatorSpec.currency) {
        throw new RatePublicationConflictError("Rate reference must remain in the same property and currency");
      }
      const reference = await this.#evaluateLoadedNight(tx, referenced, input, nextAncestors, depth + 1);
      if (reference.result.state !== "priced" || reference.result.amountMinor === null) {
        throw new RatePublicationConflictError("Referenced release did not produce one exact room-night price");
      }
      rawContext.reference = Object.freeze({
        sourceKind: base.sourceKind,
        sourceId: referenced.release.id,
        sourceVersion: referenced.release.extensionVersion,
        currency: referenced.release.evaluatorSpec.currency,
        amountMinor: reference.result.amountMinor,
      });
    }
    if (loaded.release.evaluatorSpec.modelKey === "rms-api-managed") {
      const binding = loaded.release.rmsBinding;
      if (binding === null || input.targetContext.sellableUnitId === null) {
        throw new RatePublicationError("RMS evaluation requires a published binding and exact sellable unit");
      }
      rawContext.recommendation = await this.#recommendations.resolve(binding, {
        tenantId: loaded.release.tenantId,
        propertyNode: loaded.release.propertyNode,
        ratePlanId: loaded.release.ratePlanId,
        releaseId: loaded.release.id,
        releaseVersion: loaded.release.extensionVersion,
        sellableUnitId: input.targetContext.sellableUnitId,
        unitTypeId: input.targetContext.unitTypeId,
        nightDate: input.nightDate,
        currency: loaded.release.evaluatorSpec.currency,
        bookingInstant: input.bookingInstant,
      });
    }
    const evaluationContext = deriveRateEvaluationContext(rawContext);
    const result = evaluateRateModel(loaded.release.evaluatorSpec, evaluationContext);
    return Object.freeze({ release: loaded.release, targetResolution, evaluationContext, result });
  }

  #requireEnvelopeScope(envelope: AuditEnvelope, release: RatePlanRelease): void {
    if (envelope.tenantId !== release.tenantId || envelope.propertyNode !== release.propertyNode) {
      throw new RatePublicationNotFoundError("Audit envelope does not match the rate release scope");
    }
  }

  async #simulateLoaded(tx: Tx, loaded: LoadedRelease, value: unknown): Promise<RatePublicationSimulation> {
    const cells = normalizePreviewCells(value);
    const results: RatePublicationCellResult[] = [];
    let workUnits = 0;
    for (const cell of cells) {
      const evaluation = await this.#evaluateLoadedNight(tx, loaded, normalizeReleaseNightInput({
        ...cell.evaluationContext,
        targetContext: cell.targetContext,
      }), new Set(), 0);
      const compositionContext = deriveRateCompositionContext({
        rateEvaluatorSpec: loaded.release.evaluatorSpec,
        rateEvaluationContext: evaluation.evaluationContext,
        rateEvaluationResult: evaluation.result,
        guests: cell.guests,
        selectedPromotionCodes: cell.selectedPromotionCodes,
        policyEvidence: cell.policyEvidence,
        mandatoryPolicyEvidence: cell.mandatoryPolicyEvidence,
        availabilityEvidence: cell.availabilityEvidence,
        channelCode: cell.channelCode,
        channelMappingEvidenceRef: cell.channelMappingEvidenceRef,
      });
      const result = composeRateQuote(loaded.release.compositionSpec, compositionContext);
      workUnits += result.workUnits + evaluation.targetResolution.matchedRuleKeys.length +
        evaluation.targetResolution.conflictingRuleKeys.length + 1;
      results.push(Object.freeze({
        key: cell.key,
        targetResolution: evaluation.targetResolution,
        evaluationContext: evaluation.evaluationContext,
        result,
      }));
    }
    const frozenCells = Object.freeze(results);
    const count = (state: RateCompositionResult["state"]) => results.filter(({ result }) => result.state === state).length;
    return Object.freeze({
      cells: frozenCells,
      quotedCount: count("quoted"),
      blockedCount: count("blocked"),
      unpricedCount: count("unpriced"),
      conflictCount: count("conflict"),
      workUnits,
      contentHash: hashJson(loaded.encoded),
      previewHash: hashJson(frozenCells),
    });
  }
}
