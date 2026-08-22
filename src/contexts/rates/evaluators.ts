import type { RateModelKey } from "./models";
import type { RateTargetResolution } from "./targeting";

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MIN_BIGINT = -9_223_372_036_854_775_808n;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURRENCY = /^[A-Z]{3}$/;
const STABLE_KEY = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const RULE_KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const BAR_LEVEL = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_MS = 86_400_000;

export const DIRECT_RATE_EVALUATOR_MODELS = Object.freeze([
  "simple-fixed",
  "calendar",
  "bar-ladder",
  "derived",
  "room-matrix",
  "occupancy-los",
  "contract-negotiated",
] as const);

export type DirectRateEvaluatorModel = (typeof DIRECT_RATE_EVALUATOR_MODELS)[number];
export type RateEvaluatorModel = DirectRateEvaluatorModel | "expert-composition";

export class RateEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateEvaluationError";
  }
}

export interface RateDayRange {
  readonly minDays: number;
  readonly maxDays: number;
}

export interface RateNightRange {
  readonly minNights: number;
  readonly maxNights: number;
}

export interface RateOccupancyRange {
  readonly minBasisPoints: number;
  readonly maxBasisPoints: number;
}

export interface RateEvaluatorCondition {
  readonly stayStart?: string;
  readonly stayEnd?: string;
  readonly dowMask?: number;
  readonly bookingWindow?: RateDayRange;
  readonly los?: RateNightRange;
  readonly occupancy?: RateOccupancyRange;
  readonly barLevel?: string;
}

export type RateEvaluatorBase =
  | Readonly<{ kind: "fixed"; amountMinor: bigint }>
  | Readonly<{ kind: "calendar"; cells: readonly RateCalendarCell[] }>
  | Readonly<{
    kind: "reference";
    sourceKind: "bar" | "parent";
    sourceId: string;
    sourceVersion: number;
  }>;

export type RateCalendarCell =
  | Readonly<{ stayDate: string; state: "open"; amountMinor: bigint }>
  | Readonly<{ stayDate: string; state: "closed" }>;

export type RateEvaluatorAdjustment =
  | Readonly<{ kind: "replace"; amountMinor: bigint }>
  | Readonly<{ kind: "delta"; amountMinor: bigint }>
  | Readonly<{ kind: "basis_points"; basisPoints: number }>;

export interface RateEvaluatorRule {
  readonly key: string;
  readonly stage: number;
  readonly priority: number;
  readonly when: RateEvaluatorCondition;
  readonly adjustment: RateEvaluatorAdjustment;
  readonly targetRuleKey?: string;
}

export interface RateEvaluatorSpec {
  readonly modelKey: RateEvaluatorModel;
  readonly currency: string;
  readonly base: RateEvaluatorBase;
  readonly gate: RateEvaluatorCondition;
  readonly rules: readonly RateEvaluatorRule[];
  readonly floorMinor: bigint | null;
  readonly ceilingMinor: bigint | null;
  readonly eligibleTargetRuleKeys: readonly string[];
}

export interface RateReferenceEvidence {
  readonly sourceKind: "bar" | "parent";
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly currency: string;
  readonly amountMinor: bigint;
}

export interface RateEvaluationContext {
  readonly propertyTimeZone: string;
  readonly bookingInstant: string;
  readonly stayStartInstant: string;
  readonly stayEndInstant: string;
  readonly bookingDate: string;
  readonly stayStartDate: string;
  readonly stayEndDate: string;
  readonly nightDate: string;
  readonly nightDowMask: number;
  readonly bookingWindowDays: number;
  readonly losNights: number;
  readonly occupancyBasisPoints: number | null;
  readonly occupancyEvidenceRef: string | null;
  readonly barLevel: string | null;
  readonly reference: RateReferenceEvidence | null;
  readonly targetResolution: RateTargetResolution | null;
}

export type RateEvaluationState = "priced" | "unpriced" | "conflict";

export interface RateEvaluationResult {
  readonly state: RateEvaluationState;
  readonly amountMinor: bigint | null;
  readonly currency: string;
  readonly reason: string | null;
  readonly baseEvidence: Readonly<Record<string, unknown>> | null;
  readonly appliedRuleKeys: readonly string[];
  readonly appliedGuards: readonly ("floor" | "ceiling")[];
  readonly conflictingRuleKeys: readonly string[];
  readonly conflictStage: number | null;
  readonly targetRuleKey: string | null;
  readonly occupancyEvidenceRef: string | null;
  readonly workUnits: number;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): JsonObject {
  if (!isObject(value)) throw new RateEvaluationError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const names = new Set(allowed);
  if (Object.keys(value).some((key) => !names.has(key))) {
    throw new RateEvaluationError(`${subject} contains unsupported fields`);
  }
}

function requireDate(name: string, value: unknown): string {
  if (typeof value !== "string" || !DATE.test(value)) {
    throw new RateEvaluationError(`${name} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RateEvaluationError(`${name} must be a real calendar date`);
  }
  return value;
}

function dateOrdinal(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`) / DAY_MS;
}

function requireCurrency(value: unknown): string {
  if (typeof value !== "string" || !CURRENCY.test(value)) {
    throw new RateEvaluationError("currency must be an uppercase three-letter code");
  }
  return value;
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new RateEvaluationError(`${name} must be a UUID`);
  }
  return value;
}

function requireStableKey(name: string, value: unknown): string {
  if (typeof value !== "string" || !STABLE_KEY.test(value)) {
    throw new RateEvaluationError(`${name} must be bounded stable text`);
  }
  return value;
}

function requireRuleKey(name: string, value: unknown): string {
  if (typeof value !== "string" || !RULE_KEY.test(value)) {
    throw new RateEvaluationError(`${name} must be stable lowercase text`);
  }
  return value;
}

function requireBarLevel(value: unknown): string {
  if (typeof value !== "string" || !BAR_LEVEL.test(value)) {
    throw new RateEvaluationError("barLevel must be a canonical uppercase code");
  }
  return value;
}

function requireInteger(name: string, value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RateEvaluationError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

function requireAmount(name: string, value: unknown): bigint {
  if (typeof value !== "bigint" || value < 0n || value > MAX_BIGINT) {
    throw new RateEvaluationError(`${name} must be a non-negative signed-bigint minor-unit value`);
  }
  return value;
}

function requireDelta(value: unknown): bigint {
  if (typeof value !== "bigint" || value < MIN_BIGINT || value > MAX_BIGINT) {
    throw new RateEvaluationError("delta amountMinor must be a signed-bigint minor-unit value");
  }
  return value;
}

function normalizeBound(
  value: unknown,
  subject: string,
  minimumName: string,
  maximumName: string,
  minimum: number,
  maximum: number,
): Readonly<Record<string, number>> {
  const source = requireObject(value, subject);
  requireOnlyKeys(source, [minimumName, maximumName], subject);
  if (!Object.hasOwn(source, minimumName) || !Object.hasOwn(source, maximumName)) {
    throw new RateEvaluationError(`${subject} requires both bounds`);
  }
  const lower = requireInteger(`${subject}.${minimumName}`, source[minimumName], minimum, maximum);
  const upper = requireInteger(`${subject}.${maximumName}`, source[maximumName], minimum, maximum);
  if (lower > upper) throw new RateEvaluationError(`${subject} bounds must be increasing`);
  return Object.freeze({ [minimumName]: lower, [maximumName]: upper });
}

function normalizeCondition(value: unknown, allowBarLevel: boolean, subject: string): RateEvaluatorCondition {
  const source = requireObject(value, subject);
  const allowed = ["stayStart", "stayEnd", "dowMask", "bookingWindow", "los", "occupancy"];
  if (allowBarLevel) allowed.push("barLevel");
  requireOnlyKeys(source, allowed, subject);
  const hasStayStart = Object.hasOwn(source, "stayStart");
  const hasStayEnd = Object.hasOwn(source, "stayEnd");
  if (hasStayStart !== hasStayEnd) {
    throw new RateEvaluationError(`${subject} stay dates require both start and end`);
  }
  const result: Record<string, unknown> = {};
  if (hasStayStart) {
    const stayStart = requireDate(`${subject}.stayStart`, source.stayStart);
    const stayEnd = requireDate(`${subject}.stayEnd`, source.stayEnd);
    if (stayStart >= stayEnd) throw new RateEvaluationError(`${subject} stay dates must be half-open and increasing`);
    result.stayStart = stayStart;
    result.stayEnd = stayEnd;
  }
  if (Object.hasOwn(source, "dowMask")) {
    result.dowMask = requireInteger(`${subject}.dowMask`, source.dowMask, 1, 127);
  }
  if (Object.hasOwn(source, "bookingWindow")) {
    result.bookingWindow = normalizeBound(source.bookingWindow, `${subject}.bookingWindow`, "minDays", "maxDays", 0, 730);
  }
  if (Object.hasOwn(source, "los")) {
    result.los = normalizeBound(source.los, `${subject}.los`, "minNights", "maxNights", 1, 730);
  }
  if (Object.hasOwn(source, "occupancy")) {
    result.occupancy = normalizeBound(
      source.occupancy,
      `${subject}.occupancy`,
      "minBasisPoints",
      "maxBasisPoints",
      0,
      10_000,
    );
  }
  if (allowBarLevel && Object.hasOwn(source, "barLevel")) {
    result.barLevel = requireBarLevel(source.barLevel);
  }
  return Object.freeze(result) as RateEvaluatorCondition;
}

function normalizeCalendarCell(value: unknown, index: number): RateCalendarCell {
  const source = requireObject(value, `calendar cell ${index}`);
  const stayDate = requireDate(`calendar cell ${index}.stayDate`, source.stayDate);
  if (source.state === "open") {
    requireOnlyKeys(source, ["stayDate", "state", "amountMinor"], `calendar cell ${index}`);
    if (!Object.hasOwn(source, "amountMinor")) {
      throw new RateEvaluationError(`calendar cell ${index} open state requires amountMinor`);
    }
    return Object.freeze({
      stayDate,
      state: "open",
      amountMinor: requireAmount(`calendar cell ${index}.amountMinor`, source.amountMinor),
    });
  }
  if (source.state === "closed") {
    requireOnlyKeys(source, ["stayDate", "state"], `calendar cell ${index}`);
    return Object.freeze({ stayDate, state: "closed" });
  }
  throw new RateEvaluationError(`calendar cell ${index}.state must be open or closed`);
}

function normalizeBase(value: unknown): RateEvaluatorBase {
  const source = requireObject(value, "rate evaluator base");
  if (source.kind === "fixed") {
    requireOnlyKeys(source, ["kind", "amountMinor"], "fixed base");
    return Object.freeze({ kind: "fixed", amountMinor: requireAmount("base.amountMinor", source.amountMinor) });
  }
  if (source.kind === "calendar") {
    requireOnlyKeys(source, ["kind", "cells"], "calendar base");
    if (!Array.isArray(source.cells) || source.cells.length < 1 || source.cells.length > 731) {
      throw new RateEvaluationError("calendar base requires 1 to 731 cells");
    }
    const cells = source.cells.map(normalizeCalendarCell);
    if (new Set(cells.map(({ stayDate }) => stayDate)).size !== cells.length) {
      throw new RateEvaluationError("calendar cell dates must be unique");
    }
    return Object.freeze({
      kind: "calendar",
      cells: Object.freeze([...cells].sort((left, right) => left.stayDate.localeCompare(right.stayDate))),
    });
  }
  if (source.kind === "reference") {
    requireOnlyKeys(source, ["kind", "sourceKind", "sourceId", "sourceVersion"], "reference base");
    if (source.sourceKind !== "bar" && source.sourceKind !== "parent") {
      throw new RateEvaluationError("reference sourceKind must be bar or parent");
    }
    return Object.freeze({
      kind: "reference",
      sourceKind: source.sourceKind,
      sourceId: requireUuid("base.sourceId", source.sourceId),
      sourceVersion: requireInteger("base.sourceVersion", source.sourceVersion, 1, Number.MAX_SAFE_INTEGER),
    });
  }
  throw new RateEvaluationError("base kind must be fixed, calendar, or reference");
}

function normalizeAdjustment(value: unknown): RateEvaluatorAdjustment {
  const source = requireObject(value, "rate adjustment");
  if (source.kind === "replace") {
    requireOnlyKeys(source, ["kind", "amountMinor"], "replace adjustment");
    return Object.freeze({ kind: "replace", amountMinor: requireAmount("replace amountMinor", source.amountMinor) });
  }
  if (source.kind === "delta") {
    requireOnlyKeys(source, ["kind", "amountMinor"], "delta adjustment");
    return Object.freeze({ kind: "delta", amountMinor: requireDelta(source.amountMinor) });
  }
  if (source.kind === "basis_points") {
    requireOnlyKeys(source, ["kind", "basisPoints"], "basis-point adjustment");
    return Object.freeze({
      kind: "basis_points",
      basisPoints: requireInteger("basisPoints", source.basisPoints, -10_000, 100_000),
    });
  }
  throw new RateEvaluationError("adjustment kind must be replace, delta, or basis_points");
}

function normalizeRule(value: unknown, index: number): RateEvaluatorRule {
  const source = requireObject(value, `rate rule ${index}`);
  requireOnlyKeys(source, ["key", "stage", "priority", "when", "adjustment", "targetRuleKey"], `rate rule ${index}`);
  const targetRuleKey = Object.hasOwn(source, "targetRuleKey")
    ? requireRuleKey(`rate rule ${index}.targetRuleKey`, source.targetRuleKey)
    : undefined;
  return Object.freeze({
    key: requireRuleKey(`rate rule ${index}.key`, source.key),
    stage: requireInteger(`rate rule ${index}.stage`, source.stage, 1, 8),
    priority: requireInteger(`rate rule ${index}.priority`, source.priority, 0, 1_000),
    when: normalizeCondition(source.when, true, `rate rule ${index}.when`),
    adjustment: normalizeAdjustment(source.adjustment),
    ...(targetRuleKey === undefined ? {} : { targetRuleKey }),
  });
}

function normalizeRules(value: unknown): readonly RateEvaluatorRule[] {
  if (!Array.isArray(value) || value.length > 200) {
    throw new RateEvaluationError("rules must be an array with at most 200 entries");
  }
  const rules = value.map(normalizeRule);
  if (new Set(rules.map(({ key }) => key)).size !== rules.length) {
    throw new RateEvaluationError("rate rule keys must be unique");
  }
  return Object.freeze([...rules].sort((left, right) => left.stage - right.stage || left.key.localeCompare(right.key)));
}

function requireModel(value: unknown): RateEvaluatorModel {
  if (typeof value !== "string") throw new RateEvaluationError("modelKey must be a supported evaluator model");
  if (value === "package" || value === "rms-api-managed") {
    throw new RateEvaluationError(`${value} evaluation is deferred to a later order`);
  }
  if (!DIRECT_RATE_EVALUATOR_MODELS.includes(value as DirectRateEvaluatorModel) && value !== "expert-composition") {
    throw new RateEvaluationError("modelKey must be a supported evaluator model");
  }
  return value as RateEvaluatorModel;
}

function conditionDimensionCount(condition: RateEvaluatorCondition): number {
  return Number(condition.stayStart !== undefined) +
    Number(condition.dowMask !== undefined) +
    Number(condition.bookingWindow !== undefined) +
    Number(condition.los !== undefined) +
    Number(condition.occupancy !== undefined) +
    Number(condition.barLevel !== undefined);
}

function validateModelContract(spec: RateEvaluatorSpec): void {
  const { modelKey, base, rules, eligibleTargetRuleKeys } = spec;
  if (modelKey !== "expert-composition" && rules.some(({ stage }) => stage !== 1)) {
    throw new RateEvaluationError("only expert-composition permits adjustment stages 2 through 8");
  }
  if (modelKey === "simple-fixed" && base.kind !== "fixed") {
    throw new RateEvaluationError("simple-fixed requires a fixed base");
  }
  if (modelKey === "calendar" && base.kind !== "calendar") {
    throw new RateEvaluationError("calendar requires a calendar base");
  }
  if (modelKey === "bar-ladder") {
    if (base.kind !== "reference" || base.sourceKind !== "bar" || rules.length < 1) {
      throw new RateEvaluationError("bar-ladder requires a BAR reference and at least one rule");
    }
    if (rules.some(({ when }) => when.barLevel === undefined)) {
      throw new RateEvaluationError("every bar-ladder rule requires a barLevel condition");
    }
  }
  if (modelKey === "derived" && (base.kind !== "reference" || base.sourceKind !== "parent")) {
    throw new RateEvaluationError("derived requires a parent reference");
  }
  if (modelKey === "room-matrix" && (rules.length < 1 || rules.some(({ targetRuleKey }) => targetRuleKey === undefined))) {
    throw new RateEvaluationError("room-matrix requires target-bound rules");
  }
  if (modelKey === "occupancy-los" && (rules.length < 1 || rules.some(({ when }) =>
    when.bookingWindow === undefined && when.los === undefined && when.occupancy === undefined
  ))) {
    throw new RateEvaluationError("occupancy-los rules require booking-window, LOS, or occupancy bounds");
  }
  if (modelKey === "contract-negotiated" && eligibleTargetRuleKeys.length < 1) {
    throw new RateEvaluationError("contract-negotiated requires eligible target rule keys");
  }
  if (modelKey !== "contract-negotiated" && modelKey !== "expert-composition" && eligibleTargetRuleKeys.length > 0) {
    throw new RateEvaluationError("eligible target rule keys are only valid for contract or expert models");
  }
}

export function normalizeRateEvaluatorSpec(value: unknown): RateEvaluatorSpec {
  const source = requireObject(value, "rate evaluator spec");
  requireOnlyKeys(source, [
    "modelKey",
    "currency",
    "base",
    "gate",
    "rules",
    "floorMinor",
    "ceilingMinor",
    "eligibleTargetRuleKeys",
  ], "rate evaluator spec");
  for (const required of ["modelKey", "currency", "base", "gate", "rules"]) {
    if (!Object.hasOwn(source, required)) throw new RateEvaluationError(`rate evaluator spec requires ${required}`);
  }
  const eligibleSource = source.eligibleTargetRuleKeys ?? [];
  if (!Array.isArray(eligibleSource) || eligibleSource.length > 100) {
    throw new RateEvaluationError("eligibleTargetRuleKeys must contain at most 100 keys");
  }
  const eligibleTargetRuleKeys = eligibleSource.map((key, index) =>
    requireRuleKey(`eligibleTargetRuleKeys ${index}`, key)
  );
  if (new Set(eligibleTargetRuleKeys).size !== eligibleTargetRuleKeys.length) {
    throw new RateEvaluationError("eligibleTargetRuleKeys must be unique");
  }
  const floorMinor = Object.hasOwn(source, "floorMinor") ? requireAmount("floorMinor", source.floorMinor) : null;
  const ceilingMinor = Object.hasOwn(source, "ceilingMinor") ? requireAmount("ceilingMinor", source.ceilingMinor) : null;
  if (floorMinor !== null && ceilingMinor !== null && floorMinor > ceilingMinor) {
    throw new RateEvaluationError("floorMinor cannot exceed ceilingMinor");
  }
  const spec = Object.freeze({
    modelKey: requireModel(source.modelKey),
    currency: requireCurrency(source.currency),
    base: normalizeBase(source.base),
    gate: normalizeCondition(source.gate, false, "rate evaluator gate"),
    rules: normalizeRules(source.rules),
    floorMinor,
    ceilingMinor,
    eligibleTargetRuleKeys: Object.freeze([...eligibleTargetRuleKeys].sort()),
  });
  validateModelContract(spec);
  return spec;
}

function requireInstant(name: string, value: unknown): { text: string; date: Date } {
  if (typeof value !== "string" || !INSTANT.test(value)) {
    throw new RateEvaluationError(`${name} must be a canonical UTC instant`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new RateEvaluationError(`${name} must be a canonical UTC instant`);
  }
  return { text: value, date };
}

function localDate(instant: Date, timeZone: string): string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    throw new RateEvaluationError("propertyTimeZone must be a supported IANA timezone");
  }
  const parts = new Map(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  const year = parts.get("year");
  const month = parts.get("month");
  const day = parts.get("day");
  if (!year || !month || !day) throw new RateEvaluationError("property timezone did not produce a local date");
  return `${year}-${month}-${day}`;
}

function normalizeReference(value: unknown): RateReferenceEvidence {
  const source = requireObject(value, "rate reference evidence");
  requireOnlyKeys(source, ["sourceKind", "sourceId", "sourceVersion", "currency", "amountMinor"], "rate reference evidence");
  if (source.sourceKind !== "bar" && source.sourceKind !== "parent") {
    throw new RateEvaluationError("reference sourceKind must be bar or parent");
  }
  return Object.freeze({
    sourceKind: source.sourceKind,
    sourceId: requireUuid("reference.sourceId", source.sourceId),
    sourceVersion: requireInteger("reference.sourceVersion", source.sourceVersion, 1, Number.MAX_SAFE_INTEGER),
    currency: requireCurrency(source.currency),
    amountMinor: requireAmount("reference.amountMinor", source.amountMinor),
  });
}

function normalizeTargetResolution(value: unknown): RateTargetResolution {
  if (!Object.isFrozen(value)) {
    throw new RateEvaluationError("targetResolution must be a frozen Order 066 result");
  }
  const source = requireObject(value, "target resolution");
  requireOnlyKeys(source, ["state", "winningRuleKey", "matchedRuleKeys", "conflictingRuleKeys"], "target resolution");
  if (!Array.isArray(source.matchedRuleKeys) || !Object.isFrozen(source.matchedRuleKeys) ||
      !Array.isArray(source.conflictingRuleKeys) || !Object.isFrozen(source.conflictingRuleKeys)) {
    throw new RateEvaluationError("target resolution evidence arrays must be frozen");
  }
  const matchedRuleKeys = source.matchedRuleKeys.map((key, index) => requireRuleKey(`matchedRuleKeys ${index}`, key));
  const conflictingRuleKeys = source.conflictingRuleKeys.map((key, index) => requireRuleKey(`conflictingRuleKeys ${index}`, key));
  if (new Set(matchedRuleKeys).size !== matchedRuleKeys.length ||
      new Set(conflictingRuleKeys).size !== conflictingRuleKeys.length) {
    throw new RateEvaluationError("target resolution evidence keys must be unique");
  }
  if (!["included", "excluded", "not_applicable", "conflict"].includes(String(source.state))) {
    throw new RateEvaluationError("target resolution state is invalid");
  }
  if (source.state === "included" || source.state === "excluded") {
    const winningRuleKey = requireRuleKey("target winningRuleKey", source.winningRuleKey);
    if (!matchedRuleKeys.includes(winningRuleKey) || conflictingRuleKeys.length !== 0) {
      throw new RateEvaluationError("target winner evidence is inconsistent");
    }
    return Object.freeze({
      state: source.state,
      winningRuleKey,
      matchedRuleKeys: Object.freeze([...matchedRuleKeys]),
      conflictingRuleKeys: Object.freeze([]),
    });
  }
  if (source.winningRuleKey !== null) {
    throw new RateEvaluationError("non-winning target state requires null winningRuleKey");
  }
  if (source.state === "not_applicable") {
    if (matchedRuleKeys.length !== 0 || conflictingRuleKeys.length !== 0) {
      throw new RateEvaluationError("not-applicable target evidence must be empty");
    }
    return Object.freeze({
      state: "not_applicable",
      winningRuleKey: null,
      matchedRuleKeys: Object.freeze([]),
      conflictingRuleKeys: Object.freeze([]),
    });
  }
  if (conflictingRuleKeys.length < 2 || conflictingRuleKeys.some((key) => !matchedRuleKeys.includes(key))) {
    throw new RateEvaluationError("conflicting target evidence is inconsistent");
  }
  return Object.freeze({
    state: "conflict",
    winningRuleKey: null,
    matchedRuleKeys: Object.freeze([...matchedRuleKeys]),
    conflictingRuleKeys: Object.freeze([...conflictingRuleKeys].sort()),
  });
}

export function deriveRateEvaluationContext(value: unknown): RateEvaluationContext {
  const source = requireObject(value, "rate evaluation context");
  requireOnlyKeys(source, [
    "propertyTimeZone",
    "bookingInstant",
    "stayStartInstant",
    "stayEndInstant",
    "nightDate",
    "occupancyBasisPoints",
    "occupancyEvidenceRef",
    "barLevel",
    "reference",
    "targetResolution",
  ], "rate evaluation context");
  if (typeof source.propertyTimeZone !== "string" || source.propertyTimeZone.length < 1 || source.propertyTimeZone.length > 100) {
    throw new RateEvaluationError("propertyTimeZone must be bounded text");
  }
  const booking = requireInstant("bookingInstant", source.bookingInstant);
  const stayStart = requireInstant("stayStartInstant", source.stayStartInstant);
  const stayEnd = requireInstant("stayEndInstant", source.stayEndInstant);
  if (booking.date.getTime() > stayStart.date.getTime() || stayStart.date.getTime() >= stayEnd.date.getTime()) {
    throw new RateEvaluationError("booking/stay instants must be ordered");
  }
  const bookingDate = localDate(booking.date, source.propertyTimeZone);
  const stayStartDate = localDate(stayStart.date, source.propertyTimeZone);
  const stayEndDate = localDate(stayEnd.date, source.propertyTimeZone);
  if (stayStartDate >= stayEndDate) {
    throw new RateEvaluationError("stay must span at least one property-local night");
  }
  const nightDate = requireDate("nightDate", source.nightDate);
  if (nightDate < stayStartDate || nightDate >= stayEndDate) {
    throw new RateEvaluationError("nightDate must fall inside the property-local half-open stay");
  }
  const bookingWindowDays = dateOrdinal(stayStartDate) - dateOrdinal(bookingDate);
  const losNights = dateOrdinal(stayEndDate) - dateOrdinal(stayStartDate);
  if (!Number.isSafeInteger(bookingWindowDays) || bookingWindowDays < 0 || bookingWindowDays > 730) {
    throw new RateEvaluationError("booking window must be 0 to 730 property-local days");
  }
  if (!Number.isSafeInteger(losNights) || losNights < 1 || losNights > 730) {
    throw new RateEvaluationError("LOS must be 1 to 730 property-local nights");
  }
  const hasOccupancy = source.occupancyBasisPoints !== undefined;
  const hasOccupancyEvidence = source.occupancyEvidenceRef !== undefined;
  if (hasOccupancy !== hasOccupancyEvidence) {
    throw new RateEvaluationError("occupancy basis points and evidence reference must be supplied together");
  }
  const occupancyBasisPoints = hasOccupancy
    ? requireInteger("occupancyBasisPoints", source.occupancyBasisPoints, 0, 10_000)
    : null;
  const occupancyEvidenceRef = hasOccupancyEvidence
    ? requireStableKey("occupancyEvidenceRef", source.occupancyEvidenceRef)
    : null;
  const nightDay = new Date(`${nightDate}T00:00:00.000Z`).getUTCDay();
  const nightDowMask = nightDay === 0 ? 64 : 1 << (nightDay - 1);
  const reference = source.reference === undefined ? null : normalizeReference(source.reference);
  const targetResolution = source.targetResolution === undefined ? null : normalizeTargetResolution(source.targetResolution);
  return Object.freeze({
    propertyTimeZone: source.propertyTimeZone,
    bookingInstant: booking.text,
    stayStartInstant: stayStart.text,
    stayEndInstant: stayEnd.text,
    bookingDate,
    stayStartDate,
    stayEndDate,
    nightDate,
    nightDowMask,
    bookingWindowDays,
    losNights,
    occupancyBasisPoints,
    occupancyEvidenceRef,
    barLevel: source.barLevel === undefined ? null : requireBarLevel(source.barLevel),
    reference,
    targetResolution,
  });
}

function conditionMatches(
  condition: RateEvaluatorCondition,
  context: RateEvaluationContext,
  work: { units: number },
): boolean {
  work.units += 1;
  if (condition.stayStart !== undefined) {
    work.units += 1;
    if (context.nightDate < condition.stayStart || context.nightDate >= condition.stayEnd!) return false;
  }
  if (condition.dowMask !== undefined) {
    work.units += 1;
    if ((condition.dowMask & context.nightDowMask) === 0) return false;
  }
  if (condition.bookingWindow !== undefined) {
    work.units += 1;
    if (context.bookingWindowDays < condition.bookingWindow.minDays ||
        context.bookingWindowDays > condition.bookingWindow.maxDays) return false;
  }
  if (condition.los !== undefined) {
    work.units += 1;
    if (context.losNights < condition.los.minNights || context.losNights > condition.los.maxNights) return false;
  }
  if (condition.occupancy !== undefined) {
    work.units += 1;
    if (context.occupancyBasisPoints === null ||
        context.occupancyBasisPoints < condition.occupancy.minBasisPoints ||
        context.occupancyBasisPoints > condition.occupancy.maxBasisPoints) return false;
  }
  if (condition.barLevel !== undefined) {
    work.units += 1;
    if (context.barLevel !== condition.barLevel) return false;
  }
  return true;
}

function result(
  state: RateEvaluationState,
  currency: string,
  workUnits: number,
  values: Partial<RateEvaluationResult> = {},
): RateEvaluationResult {
  return Object.freeze({
    state,
    amountMinor: null,
    currency,
    reason: null,
    baseEvidence: null,
    appliedRuleKeys: Object.freeze([]),
    appliedGuards: Object.freeze([]),
    conflictingRuleKeys: Object.freeze([]),
    conflictStage: null,
    targetRuleKey: null,
    occupancyEvidenceRef: null,
    workUnits,
    ...values,
  });
}

function requireEvaluationContext(value: unknown): RateEvaluationContext {
  if (!Object.isFrozen(value) || !isObject(value)) {
    throw new RateEvaluationError("context must come from deriveRateEvaluationContext");
  }
  requireOnlyKeys(value, [
    "propertyTimeZone",
    "bookingInstant",
    "stayStartInstant",
    "stayEndInstant",
    "bookingDate",
    "stayStartDate",
    "stayEndDate",
    "nightDate",
    "nightDowMask",
    "bookingWindowDays",
    "losNights",
    "occupancyBasisPoints",
    "occupancyEvidenceRef",
    "barLevel",
    "reference",
    "targetResolution",
  ], "derived rate evaluation context");
  const raw: JsonObject = {
    propertyTimeZone: value.propertyTimeZone,
    bookingInstant: value.bookingInstant,
    stayStartInstant: value.stayStartInstant,
    stayEndInstant: value.stayEndInstant,
    nightDate: value.nightDate,
  };
  if (value.occupancyBasisPoints !== null || value.occupancyEvidenceRef !== null) {
    raw.occupancyBasisPoints = value.occupancyBasisPoints;
    raw.occupancyEvidenceRef = value.occupancyEvidenceRef;
  }
  if (value.barLevel !== null) raw.barLevel = value.barLevel;
  if (value.reference !== null) raw.reference = value.reference;
  if (value.targetResolution !== null) raw.targetResolution = value.targetResolution;
  const rebuilt = deriveRateEvaluationContext(raw);
  for (const field of [
    "bookingDate",
    "stayStartDate",
    "stayEndDate",
    "nightDowMask",
    "bookingWindowDays",
    "losNights",
  ] as const) {
    if (value[field] !== rebuilt[field]) {
      throw new RateEvaluationError(`derived context ${field} does not match its canonical inputs`);
    }
  }
  return rebuilt;
}

function resolveBase(
  base: RateEvaluatorBase,
  currency: string,
  context: RateEvaluationContext,
  work: { units: number },
): { amountMinor: bigint; evidence: Readonly<Record<string, unknown>> } | { reason: string } {
  work.units += 1;
  if (base.kind === "fixed") {
    return { amountMinor: base.amountMinor, evidence: Object.freeze({ kind: "fixed" }) };
  }
  if (base.kind === "calendar") {
    for (const cell of base.cells) {
      work.units += 1;
      if (cell.stayDate !== context.nightDate) continue;
      if (cell.state === "closed") return { reason: "calendar_closed" };
      return {
        amountMinor: cell.amountMinor,
        evidence: Object.freeze({ kind: "calendar", stayDate: cell.stayDate, state: "open" }),
      };
    }
    return { reason: "calendar_missing" };
  }
  const reference = context.reference;
  if (!reference) throw new RateEvaluationError("reference evidence is required by this evaluator base");
  if (reference.sourceKind !== base.sourceKind || reference.sourceId !== base.sourceId ||
      reference.sourceVersion !== base.sourceVersion || reference.currency !== currency) {
    throw new RateEvaluationError("reference evidence does not match the evaluator source and currency");
  }
  return {
    amountMinor: reference.amountMinor,
    evidence: Object.freeze({
      kind: "reference",
      sourceKind: reference.sourceKind,
      sourceId: reference.sourceId,
      sourceVersion: reference.sourceVersion,
    }),
  };
}

function applyAdjustment(amount: bigint, adjustment: RateEvaluatorAdjustment): bigint {
  let next: bigint;
  if (adjustment.kind === "replace") {
    next = adjustment.amountMinor;
  } else if (adjustment.kind === "delta") {
    next = amount + adjustment.amountMinor;
  } else {
    const multiplier = BigInt(10_000 + adjustment.basisPoints);
    const product = amount * multiplier;
    next = (product + 5_000n) / 10_000n;
  }
  if (next < 0n || next > MAX_BIGINT) {
    throw new RateEvaluationError("rate adjustment produced a negative or overflowing amount");
  }
  return next;
}

export function evaluateRateModel(specValue: unknown, contextValue: unknown): RateEvaluationResult {
  const spec = normalizeRateEvaluatorSpec(specValue);
  const context = requireEvaluationContext(contextValue);
  const work = { units: 0 };
  if (!conditionMatches(spec.gate, context, work)) {
    return result("unpriced", spec.currency, work.units, { reason: "gate_unmatched" });
  }
  const target = context.targetResolution;
  if (target?.state === "conflict") {
    return result("conflict", spec.currency, work.units, {
      reason: "target_conflict",
      conflictingRuleKeys: Object.freeze([...target.conflictingRuleKeys]),
      conflictStage: 0,
    });
  }
  if (target?.state === "excluded") {
    return result("unpriced", spec.currency, work.units, { reason: "target_excluded" });
  }
  if (target?.state === "not_applicable") {
    return result("unpriced", spec.currency, work.units, { reason: "target_not_applicable" });
  }
  const winningTargetKey = target?.state === "included" ? target.winningRuleKey : null;
  if ((spec.modelKey === "room-matrix" || spec.modelKey === "contract-negotiated") && !winningTargetKey) {
    return result("unpriced", spec.currency, work.units, { reason: "target_missing" });
  }
  if (spec.modelKey === "contract-negotiated" &&
      (!winningTargetKey || !spec.eligibleTargetRuleKeys.includes(winningTargetKey))) {
    return result("unpriced", spec.currency, work.units, {
      reason: "contract_ineligible",
      targetRuleKey: winningTargetKey,
    });
  }
  const base = resolveBase(spec.base, spec.currency, context, work);
  if ("reason" in base) {
    return result("unpriced", spec.currency, work.units, {
      reason: base.reason,
      targetRuleKey: winningTargetKey,
    });
  }
  let amount = base.amountMinor;
  const appliedRuleKeys: string[] = [];
  const stages = [...new Set(spec.rules.map(({ stage }) => stage))].sort((left, right) => left - right);
  for (const stage of stages) {
    const matched: RateEvaluatorRule[] = [];
    for (const candidate of spec.rules) {
      if (candidate.stage !== stage) continue;
      work.units += 1;
      if (candidate.targetRuleKey !== undefined && candidate.targetRuleKey !== winningTargetKey) continue;
      if (conditionMatches(candidate.when, context, work)) matched.push(candidate);
    }
    if (matched.length === 0) continue;
    matched.sort((left, right) =>
      Number(right.targetRuleKey !== undefined) - Number(left.targetRuleKey !== undefined) ||
      conditionDimensionCount(right.when) - conditionDimensionCount(left.when) ||
      right.priority - left.priority ||
      left.key.localeCompare(right.key)
    );
    const first = matched[0]!;
    const targetBound = first.targetRuleKey !== undefined;
    const dimensions = conditionDimensionCount(first.when);
    const top = matched.filter((candidate) =>
      (candidate.targetRuleKey !== undefined) === targetBound &&
      conditionDimensionCount(candidate.when) === dimensions &&
      candidate.priority === first.priority
    );
    if (top.length > 1) {
      return result("conflict", spec.currency, work.units, {
        reason: "rule_conflict",
        baseEvidence: base.evidence,
        appliedRuleKeys: Object.freeze([...appliedRuleKeys]),
        conflictingRuleKeys: Object.freeze(top.map(({ key }) => key).sort()),
        conflictStage: stage,
        targetRuleKey: winningTargetKey,
        occupancyEvidenceRef: context.occupancyEvidenceRef,
      });
    }
    amount = applyAdjustment(amount, first.adjustment);
    appliedRuleKeys.push(first.key);
  }
  const appliedGuards: Array<"floor" | "ceiling"> = [];
  if (spec.floorMinor !== null && amount < spec.floorMinor) {
    amount = spec.floorMinor;
    appliedGuards.push("floor");
  }
  if (spec.ceilingMinor !== null && amount > spec.ceilingMinor) {
    amount = spec.ceilingMinor;
    appliedGuards.push("ceiling");
  }
  return result("priced", spec.currency, work.units, {
    amountMinor: amount,
    baseEvidence: base.evidence,
    appliedRuleKeys: Object.freeze(appliedRuleKeys),
    appliedGuards: Object.freeze(appliedGuards),
    targetRuleKey: winningTargetKey,
    occupancyEvidenceRef: context.occupancyEvidenceRef,
  });
}

export function isDirectRateEvaluatorModel(value: RateModelKey): value is DirectRateEvaluatorModel {
  return DIRECT_RATE_EVALUATOR_MODELS.includes(value as DirectRateEvaluatorModel);
}
