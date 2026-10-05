import {
  normalizeRateCompositionSpec,
  type RateCompositionSpec,
} from "./composition";
import {
  normalizeRateEvaluatorSpec,
  type RateEvaluatorSpec,
} from "./evaluators";
import {
  RATE_MODEL_CATALOGUE,
  RATE_MODEL_KEYS,
  type RateModelAuthoringMode,
  type RateModelKey,
} from "./models";
import type { RateRmsBinding } from "./publication";
import type { RateTargetRule } from "./targeting";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RULE_KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const UPPER_CODE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const CHANNEL_CODE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const STABLE_KEY = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const MINOR = /^(0|-?[1-9][0-9]*)$/;
const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MIN_BIGINT = -9_223_372_036_854_775_808n;

type JsonObject = Record<string, unknown>;

export class RateAuthoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateAuthoringError";
  }
}

export interface CanonicalRateAuthoringCommand {
  readonly authoringMode: RateModelAuthoringMode;
  readonly ratePlanId: string;
  readonly model: Readonly<{
    key: RateModelKey;
    version: 1;
    componentModelKeys: readonly RateModelKey[];
  }>;
  readonly target: Readonly<{ rules: readonly RateTargetRule[] }>;
  readonly evaluator: RateEvaluatorSpec;
  readonly composition: RateCompositionSpec;
  readonly rmsBinding: RateRmsBinding | null;
}

function object(value: unknown, subject: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RateAuthoringError(`${subject} must be an object`);
  }
  return value as JsonObject;
}

function exactKeys(
  source: JsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
  subject: string,
): void {
  const names = Object.keys(source);
  if (required.some((key) => !names.includes(key)) ||
      names.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new RateAuthoringError(`${subject} has missing or unsupported fields`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new RateAuthoringError(`${subject} must be a UUID`);
  }
  return value;
}

function integer(value: unknown, minimum: number, maximum: number, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RateAuthoringError(`${subject} must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

function minor(value: unknown, subject: string, allowNegative = false): bigint {
  if (typeof value !== "string" || !MINOR.test(value)) {
    throw new RateAuthoringError(`${subject} must be a canonical decimal minor-unit string`);
  }
  const amount = BigInt(value);
  if (amount < MIN_BIGINT || amount > MAX_BIGINT || (!allowNegative && amount < 0n)) {
    throw new RateAuthoringError(`${subject} is outside its exact signed-bigint range`);
  }
  return amount;
}

function authoringMode(value: unknown): RateModelAuthoringMode {
  if (value !== "guided" && value !== "expert" && value !== "ai") {
    throw new RateAuthoringError("authoringMode must be guided, expert, or ai");
  }
  return value;
}

function modelSelection(value: unknown): CanonicalRateAuthoringCommand["model"] {
  const source = object(value, "model selection");
  exactKeys(source, ["key", "version", "componentModelKeys"], [], "model selection");
  if (typeof source.key !== "string" || !RATE_MODEL_KEYS.includes(source.key as RateModelKey)) {
    throw new RateAuthoringError("model key must name a registered catalogue model");
  }
  const key = source.key as RateModelKey;
  if (source.version !== 1 || !RATE_MODEL_CATALOGUE.some((entry) => entry.key === key && entry.version === 1)) {
    throw new RateAuthoringError("model version is not registered");
  }
  if (!Array.isArray(source.componentModelKeys) ||
      source.componentModelKeys.some((entry) => typeof entry !== "string" || !RATE_MODEL_KEYS.includes(entry as RateModelKey))) {
    throw new RateAuthoringError("componentModelKeys must contain registered model keys");
  }
  const components = source.componentModelKeys as RateModelKey[];
  if (new Set(components).size !== components.length) {
    throw new RateAuthoringError("componentModelKeys must be unique");
  }
  if (key === "expert-composition") {
    if (components.length < 1 || components.length > 8 || components.includes("expert-composition")) {
      throw new RateAuthoringError("expert composition requires 1 to 8 non-recursive components");
    }
  } else if (components.length !== 0) {
    throw new RateAuthoringError("only expert composition accepts component models");
  }
  return Object.freeze({ key, version: 1, componentModelKeys: Object.freeze([...components].sort()) });
}

function commercial(value: unknown, subject: string): Readonly<Record<string, string>> {
  const source = object(value, subject);
  const fields = [
    "companyPartyId", "marketGroupCode", "marketCode", "sourcePartyId", "sourceCode",
    "channelCode", "segmentCode", "agentPartyId", "campaignCode",
  ] as const;
  exactKeys(source, [], fields, subject);
  const result: Record<string, string> = {};
  for (const field of fields) {
    const candidate = source[field];
    if (candidate === undefined) continue;
    if (field === "companyPartyId" || field === "sourcePartyId" || field === "agentPartyId") {
      result[field] = uuid(candidate, `${subject}.${field}`);
    } else if (field === "channelCode") {
      if (typeof candidate !== "string" || !CHANNEL_CODE.test(candidate)) {
        throw new RateAuthoringError(`${subject}.${field} must be a canonical lowercase code`);
      }
      result[field] = candidate;
    } else {
      if (typeof candidate !== "string" || !UPPER_CODE.test(candidate)) {
        throw new RateAuthoringError(`${subject}.${field} must be a canonical uppercase code`);
      }
      result[field] = candidate;
    }
  }
  return Object.freeze(result);
}

function physical(value: unknown, subject: string): RateTargetRule["physical"] {
  const source = object(value, subject);
  if (source.kind === "property") {
    exactKeys(source, ["kind"], [], subject);
    return Object.freeze({ kind: "property" });
  }
  if (source.kind === "class") {
    exactKeys(source, ["kind", "classCode", "unitTypeIds"], [], subject);
    if (typeof source.classCode !== "string" || !UPPER_CODE.test(source.classCode) ||
        !Array.isArray(source.unitTypeIds) || source.unitTypeIds.length < 1 || source.unitTypeIds.length > 100) {
      throw new RateAuthoringError(`${subject} class target is invalid`);
    }
    const ids = source.unitTypeIds.map((id, index) => uuid(id, `${subject}.unitTypeIds ${index}`));
    if (new Set(ids).size !== ids.length) throw new RateAuthoringError(`${subject}.unitTypeIds must be unique`);
    return Object.freeze({ kind: "class", classCode: source.classCode, unitTypeIds: Object.freeze(ids.sort()) });
  }
  if (source.kind === "unit_type") {
    exactKeys(source, ["kind", "unitTypeId"], [], subject);
    return Object.freeze({ kind: "unit_type", unitTypeId: uuid(source.unitTypeId, `${subject}.unitTypeId`) });
  }
  if (source.kind === "sellable") {
    exactKeys(source, ["kind", "sellableUnitId"], [], subject);
    return Object.freeze({ kind: "sellable", sellableUnitId: uuid(source.sellableUnitId, `${subject}.sellableUnitId`) });
  }
  throw new RateAuthoringError(`${subject}.kind must be property, class, unit_type, or sellable`);
}

function targetRules(value: unknown): readonly RateTargetRule[] {
  const source = object(value, "target");
  exactKeys(source, ["rules"], [], "target");
  if (!Array.isArray(source.rules) || source.rules.length < 1 || source.rules.length > 200) {
    throw new RateAuthoringError("target.rules must contain 1 to 200 rules");
  }
  const rules = source.rules.map((value, index): RateTargetRule => {
    const rule = object(value, `target rule ${index}`);
    exactKeys(rule, ["key", "effect", "priority", "physical", "commercial"], [], `target rule ${index}`);
    if (typeof rule.key !== "string" || !RULE_KEY.test(rule.key)) {
      throw new RateAuthoringError(`target rule ${index}.key must be stable lowercase text`);
    }
    if (rule.effect !== "include" && rule.effect !== "exclude") {
      throw new RateAuthoringError(`target rule ${index}.effect must be include or exclude`);
    }
    return Object.freeze({
      key: rule.key,
      effect: rule.effect,
      priority: integer(rule.priority, 0, 1000, `target rule ${index}.priority`),
      physical: physical(rule.physical, `target rule ${index}.physical`),
      commercial: commercial(rule.commercial, `target rule ${index}.commercial`),
    });
  });
  if (new Set(rules.map(({ key }) => key)).size !== rules.length) {
    throw new RateAuthoringError("target rule keys must be unique");
  }
  return Object.freeze([...rules].sort((left, right) => left.key.localeCompare(right.key)));
}

function evaluatorTransport(value: unknown): JsonObject {
  const source = object(value, "evaluator");
  const result: JsonObject = { ...source };
  const base = object(source.base, "evaluator.base");
  if (base.kind === "fixed") {
    result.base = { ...base, amountMinor: minor(base.amountMinor, "evaluator.base.amountMinor") };
  } else if (base.kind === "calendar") {
    if (!Array.isArray(base.cells)) throw new RateAuthoringError("evaluator.base.cells must be an array");
    result.base = {
      ...base,
      cells: base.cells.map((value, index) => {
        const cell = object(value, `calendar cell ${index}`);
        return cell.state === "open"
          ? { ...cell, amountMinor: minor(cell.amountMinor, `calendar cell ${index}.amountMinor`) }
          : { ...cell };
      }),
    };
  } else {
    result.base = { ...base };
  }
  if (!Array.isArray(source.rules)) throw new RateAuthoringError("evaluator.rules must be an array");
  result.rules = source.rules.map((value, index) => {
    const rule = object(value, `evaluator rule ${index}`);
    const adjustment = object(rule.adjustment, `evaluator rule ${index}.adjustment`);
    return {
      ...rule,
      adjustment: adjustment.kind === "replace"
        ? { ...adjustment, amountMinor: minor(adjustment.amountMinor, `evaluator rule ${index}.amountMinor`) }
        : adjustment.kind === "delta"
          ? { ...adjustment, amountMinor: minor(adjustment.amountMinor, `evaluator rule ${index}.amountMinor`, true) }
          : { ...adjustment },
    };
  });
  result.floorMinor = source.floorMinor === null || source.floorMinor === undefined
    ? null
    : minor(source.floorMinor, "evaluator.floorMinor");
  result.ceilingMinor = source.ceilingMinor === null || source.ceilingMinor === undefined
    ? null
    : minor(source.ceilingMinor, "evaluator.ceilingMinor");
  return result;
}

function compositionTransport(value: unknown): JsonObject {
  const source = object(value, "composition");
  const result: JsonObject = { ...source };
  if (source.package !== null) {
    const packageSpec = object(source.package, "composition.package");
    if (!Array.isArray(packageSpec.elements)) throw new RateAuthoringError("composition.package.elements must be an array");
    result.package = {
      ...packageSpec,
      elements: packageSpec.elements.map((value, index) => {
        const element = object(value, `package element ${index}`);
        return { ...element, amountMinor: minor(element.amountMinor, `package element ${index}.amountMinor`) };
      }),
    };
  }
  if (!Array.isArray(source.promotions)) throw new RateAuthoringError("composition.promotions must be an array");
  result.promotions = source.promotions.map((value, index) => {
    const promotion = object(value, `promotion ${index}`);
    const discount = object(promotion.discount, `promotion ${index}.discount`);
    return {
      ...promotion,
      discount: discount.kind === "amount"
        ? { ...discount, amountMinor: minor(discount.amountMinor, `promotion ${index}.amountMinor`) }
        : { ...discount },
    };
  });
  return result;
}

function rmsBinding(value: unknown): RateRmsBinding | null {
  if (value === null) return null;
  const source = object(value, "rmsBinding");
  exactKeys(source, ["adapterKey", "adapterVersion", "maximumAgeSeconds", "outageFallback"], [], "rmsBinding");
  if (typeof source.adapterKey !== "string" || !STABLE_KEY.test(source.adapterKey)) {
    throw new RateAuthoringError("rmsBinding.adapterKey must be bounded stable lowercase text");
  }
  if (source.outageFallback !== "local_evaluator") {
    throw new RateAuthoringError("rmsBinding.outageFallback must be local_evaluator");
  }
  return Object.freeze({
    adapterKey: source.adapterKey,
    adapterVersion: integer(source.adapterVersion, 1, Number.MAX_SAFE_INTEGER, "rmsBinding.adapterVersion"),
    maximumAgeSeconds: integer(source.maximumAgeSeconds, 1, 86_400, "rmsBinding.maximumAgeSeconds"),
    outageFallback: "local_evaluator",
  });
}

export function compileRateAuthoringCommand(value: unknown): CanonicalRateAuthoringCommand {
  const source = object(value, "rate authoring command");
  exactKeys(source, [
    "authoringMode", "ratePlanId", "model", "target", "evaluator", "composition", "rmsBinding",
  ], [], "rate authoring command");
  const mode = authoringMode(source.authoringMode);
  const selectedModel = modelSelection(source.model);
  const evaluator = normalizeRateEvaluatorSpec(evaluatorTransport(source.evaluator));
  const composition = normalizeRateCompositionSpec(compositionTransport(source.composition));
  if (evaluator.currency !== composition.currency) {
    throw new RateAuthoringError("evaluator and composition currency must match");
  }
  return Object.freeze({
    authoringMode: mode,
    ratePlanId: uuid(source.ratePlanId, "ratePlanId"),
    model: selectedModel,
    target: Object.freeze({ rules: targetRules(source.target) }),
    evaluator,
    composition,
    rmsBinding: rmsBinding(source.rmsBinding),
  });
}

function canonical(value: unknown): unknown {
  if (typeof value === "bigint") return { $minor: value.toString() };
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

export function canonicalRateAuthoringJson(
  command: CanonicalRateAuthoringCommand,
  options: Readonly<{ omitAuthoringMode?: boolean }> = {},
): string {
  const source: JsonObject = { ...command };
  if (options.omitAuthoringMode) delete source.authoringMode;
  return JSON.stringify(canonical(source));
}
