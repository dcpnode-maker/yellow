import {
  compileRateAuthoringCommand,
  type CanonicalRateAuthoringCommand,
  RateAuthoringError,
} from "./authoring";
import { RATE_MODEL_CATALOGUE, type RateModelKey } from "./models";

const MAX_INTENT_LENGTH = 2_000;
const MAX_TEXT_ITEMS = 12;
const MAX_TEXT_LENGTH = 240;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const CODE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const CHANNEL = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MINOR = /^(?:0|[1-9][0-9]*)$/;

type JsonObject = Record<string, unknown>;

export type RateIntentStatus = "ready" | "needs_clarification" | "rejected";

export interface RateIntentAdapterMetadata {
  readonly key: string;
  readonly external: boolean;
}

export interface RateIntentAdapterInput {
  readonly intent: string;
  readonly currentCommand: Readonly<{
    model: unknown;
    target: unknown;
    evaluator: unknown;
    composition: unknown;
    rmsBinding: unknown;
  }>;
  readonly catalogue: readonly Readonly<{ key: RateModelKey; version: 1; label: string }>[];
}

export interface RateIntentProposalAdapter {
  readonly metadata: RateIntentAdapterMetadata;
  propose(input: RateIntentAdapterInput): Promise<unknown>;
}

export interface InterpretRateIntentInput {
  readonly intent: string;
  readonly currentCommand: unknown;
}

export interface RateIntentResult {
  readonly status: RateIntentStatus;
  readonly proposal: CanonicalRateAuthoringCommand | null;
  readonly changes: readonly string[];
  readonly assumptions: readonly string[];
  readonly questions: readonly string[];
  readonly warnings: readonly string[];
  readonly rejections: readonly string[];
  readonly guardrails: readonly string[];
  readonly adapter: RateIntentAdapterMetadata;
}

export class RateIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateIntentError";
  }
}

const GUARDRAILS = Object.freeze([
  "Proposal only: interpreting intent never writes database state.",
  "Exact money, currency, tenant and property authority remain server-validated.",
  "Availability, restrictions, tax, fiscal, statutory and audit safeguards cannot be disabled.",
  "Apply, save, server preview, independent approval and publish remain separate operator actions.",
]);

const MODEL_TERMS: readonly Readonly<{ key: RateModelKey; pattern: RegExp; label: string }>[] = Object.freeze([
  { key: "calendar", pattern: /\bcalendar(?:-based)?\b/i, label: "Calendar" },
  { key: "bar-ladder", pattern: /\b(?:bar ladder|best available rate|bar pricing)\b/i, label: "BAR ladder" },
  { key: "derived", pattern: /\bderived(?: rate| pricing)?\b/i, label: "Derived" },
  { key: "room-matrix", pattern: /\b(?:room matrix|room-matrix|matrix pricing)\b/i, label: "Room matrix" },
  { key: "occupancy-los", pattern: /\b(?:occupancy|length of stay|los pricing)\b/i, label: "Occupancy and length of stay" },
  { key: "contract-negotiated", pattern: /\b(?:contract|negotiated)(?: rate| pricing)?\b/i, label: "Contract and negotiated" },
  { key: "package", pattern: /\bpackage(?: rate| pricing)?\b/i, label: "Package" },
  { key: "rms-api-managed", pattern: /\b(?:rms|revenue management|api-managed|api managed)\b/i, label: "RMS / API" },
  { key: "expert-composition", pattern: /\b(?:expert composition|composed model|multi-model)\b/i, label: "Expert composition" },
]);

function object(value: unknown, subject: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RateIntentError(`${subject} must be an object`);
  }
  return value as JsonObject;
}

function exactKeys(
  value: JsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
  subject: string,
): void {
  const keys = Object.keys(value);
  if (required.some((key) => !keys.includes(key)) ||
      keys.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new RateIntentError(`${subject} has missing or unsupported fields`);
  }
}

function normalizedIntent(value: unknown): string {
  if (typeof value !== "string") throw new RateIntentError("intent must be text");
  const normalized = value.normalize("NFKC").trim().replace(/[ \t]+/g, " ");
  if (normalized.length < 1 || normalized.length > MAX_INTENT_LENGTH || CONTROL_CHARACTERS.test(normalized)) {
    throw new RateIntentError(`intent must contain 1 to ${MAX_INTENT_LENGTH} safe characters`);
  }
  return normalized;
}

function textItems(value: unknown, subject: string): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_TEXT_ITEMS) {
    throw new RateIntentError(`${subject} must contain at most ${MAX_TEXT_ITEMS} text items`);
  }
  const result = value.map((entry) => {
    if (typeof entry !== "string") throw new RateIntentError(`${subject} must contain only text`);
    const text = entry.normalize("NFKC").trim().replace(/\s+/g, " ");
    if (text.length < 1 || text.length > MAX_TEXT_LENGTH || CONTROL_CHARACTERS.test(text)) {
      throw new RateIntentError(`${subject} contains invalid text`);
    }
    return text;
  });
  return Object.freeze([...new Set(result)]);
}

function transport(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(transport);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, transport(entry)]));
  }
  return value;
}

function safeCurrent(command: CanonicalRateAuthoringCommand): RateIntentAdapterInput["currentCommand"] {
  return Object.freeze({
    model: transport(command.model),
    target: transport(command.target),
    evaluator: transport(command.evaluator),
    composition: transport(command.composition),
    rmsBinding: transport(command.rmsBinding),
  });
}

function adapterMetadata(value: RateIntentAdapterMetadata): RateIntentAdapterMetadata {
  if (!value || typeof value.key !== "string" || !/^[a-z0-9][a-z0-9._:-]{0,63}$/.test(value.key) ||
      typeof value.external !== "boolean") {
    throw new RateIntentError("intent adapter metadata is invalid");
  }
  return Object.freeze({ key: value.key, external: value.external });
}

function result(
  metadata: RateIntentAdapterMetadata,
  status: RateIntentStatus,
  details: Partial<Omit<RateIntentResult, "status" | "adapter" | "guardrails">> = {},
): RateIntentResult {
  return Object.freeze({
    status,
    proposal: details.proposal ?? null,
    changes: Object.freeze([...(details.changes ?? [])]),
    assumptions: Object.freeze([...(details.assumptions ?? [])]),
    questions: Object.freeze([...(details.questions ?? [])]),
    warnings: Object.freeze([...(details.warnings ?? [])]),
    rejections: Object.freeze([...(details.rejections ?? [])]),
    guardrails: GUARDRAILS,
    adapter: metadata,
  });
}

function preflightRejections(intent: string): readonly string[] {
  const checks: readonly Readonly<{ pattern: RegExp; message: string }>[] = [
    {
      pattern: /\b(?:ignore|reveal|override)\b.{0,32}\b(?:previous instructions?|system prompt|developer message|hidden prompt)\b/i,
      message: "Prompt or instruction overrides are not part of rate configuration.",
    },
    {
      pattern: /\b(?:ignore|disable|bypass|remove|skip|override)\b.{0,48}\b(?:tax|gst|vat|compliance|fiscal|statutory|restriction|occupancy|tenant|rls|audit|approval|security)\b/i,
      message: "Mandatory compliance, tenancy, audit, approval, restriction and occupancy safeguards cannot be disabled.",
    },
    {
      pattern: /\b(?:auto(?:matically)?[ -]?(?:apply|save|approve|publish)|self[ -]?approve|publish without approval|skip approval)\b/i,
      message: "AI-assisted intent cannot apply, save, approve or publish automatically.",
    },
    {
      pattern: /\b(?:javascript|sql|shell command|execute code|eval\s*\(|custom executable formula)\b/i,
      message: "Executable code, SQL, tools and opaque formulas are not accepted as rate intent.",
    },
    {
      pattern: /\bBearer\s+[A-Za-z0-9._~-]{16,}|\bsk-[A-Za-z0-9_-]{16,}|\b(?:\d[ -]?){13,19}\b/i,
      message: "Credentials, API keys and payment-card data must not be included in rate intent.",
    },
  ];
  return Object.freeze(checks.filter(({ pattern }) => pattern.test(intent)).map(({ message }) => message));
}

function parseAdapterOutput(value: unknown): Readonly<{
  candidate: JsonObject | null;
  changes: readonly string[];
  assumptions: readonly string[];
  questions: readonly string[];
  warnings: readonly string[];
}> {
  const source = object(value, "intent adapter response");
  exactKeys(source, ["candidate", "changes", "assumptions", "questions", "warnings"], [], "intent adapter response");
  const candidate = source.candidate === null ? null : object(source.candidate, "intent adapter candidate");
  if (candidate) {
    exactKeys(candidate, ["model", "target", "evaluator", "composition", "rmsBinding"], [], "intent adapter candidate");
  }
  return Object.freeze({
    candidate,
    changes: textItems(source.changes, "intent adapter changes"),
    assumptions: textItems(source.assumptions, "intent adapter assumptions"),
    questions: textItems(source.questions, "intent adapter questions"),
    warnings: textItems(source.warnings, "intent adapter warnings"),
  });
}

export class RateIntentService {
  readonly #adapter: RateIntentProposalAdapter;
  readonly #metadata: RateIntentAdapterMetadata;

  constructor(adapter: RateIntentProposalAdapter = new LocalRateIntentProposalAdapter()) {
    this.#adapter = adapter;
    this.#metadata = adapterMetadata(adapter.metadata);
  }

  async interpret(input: InterpretRateIntentInput): Promise<RateIntentResult> {
    const source = object(input, "rate intent request");
    exactKeys(source, ["intent", "currentCommand"], [], "rate intent request");
    const intent = normalizedIntent(source.intent);
    let current: CanonicalRateAuthoringCommand;
    try {
      current = compileRateAuthoringCommand(source.currentCommand);
    } catch (error) {
      if (error instanceof RateAuthoringError) throw new RateIntentError("current rate command is invalid");
      throw error;
    }
    const rejections = preflightRejections(intent);
    if (rejections.length > 0) return result(this.#metadata, "rejected", { rejections });

    const adapterInput: RateIntentAdapterInput = Object.freeze({
      intent,
      currentCommand: safeCurrent(current),
      catalogue: Object.freeze(RATE_MODEL_CATALOGUE.map(({ key, version, label }) => Object.freeze({ key, version, label }))),
    });
    let proposed: unknown;
    try {
      proposed = await this.#adapter.propose(adapterInput);
    } catch {
      return result(this.#metadata, "needs_clarification", {
        questions: ["The proposal source could not interpret this safely. Please refine the intent or use Guided mode."],
      });
    }

    let parsed: ReturnType<typeof parseAdapterOutput>;
    try {
      parsed = parseAdapterOutput(proposed);
    } catch {
      return result(this.#metadata, "rejected", {
        rejections: ["The proposal source returned an unsupported response shape."],
      });
    }
    if (parsed.questions.length > 0 || parsed.candidate === null) {
      return result(this.#metadata, "needs_clarification", {
        changes: parsed.changes,
        assumptions: parsed.assumptions,
        questions: parsed.questions.length > 0
          ? parsed.questions
          : ["More exact rate instructions are required before Yellow can create a proposal."],
        warnings: parsed.warnings,
      });
    }

    try {
      const proposal = compileRateAuthoringCommand({
        authoringMode: "ai",
        ratePlanId: current.ratePlanId,
        ...parsed.candidate,
      });
      return result(this.#metadata, "ready", {
        proposal,
        changes: parsed.changes,
        assumptions: parsed.assumptions,
        warnings: parsed.warnings,
      });
    } catch {
      return result(this.#metadata, "rejected", {
        changes: parsed.changes,
        assumptions: parsed.assumptions,
        warnings: parsed.warnings,
        rejections: ["The proposed rate did not satisfy Yellow's typed rate and safety contract."],
      });
    }
  }
}

function mutableCandidate(input: RateIntentAdapterInput): JsonObject {
  return structuredClone(input.currentCommand) as JsonObject;
}

function nested(source: JsonObject, key: string): JsonObject {
  return object(source[key], key);
}

function setFixedModel(candidate: JsonObject): void {
  const model = nested(candidate, "model");
  const evaluator = nested(candidate, "evaluator");
  model.key = "simple-fixed";
  model.version = 1;
  model.componentModelKeys = [];
  evaluator.modelKey = "simple-fixed";
  evaluator.rules = [];
  evaluator.eligibleTargetRuleKeys = [];
  candidate.rmsBinding = null;
}

function firstTargetCommercial(candidate: JsonObject): JsonObject {
  const target = nested(candidate, "target");
  if (!Array.isArray(target.rules) || target.rules.length < 1) throw new RateIntentError("current target rules are missing");
  const first = object(target.rules[0], "current target rule");
  const commercial = object(first.commercial, "current commercial target");
  first.commercial = commercial;
  return commercial;
}

function integerMatch(intent: string, pattern: RegExp, minimum: number, maximum: number): number | null {
  const match = intent.match(pattern);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function codeMatch(intent: string, pattern: RegExp, transform: "upper" | "lower"): string | null {
  const match = intent.match(pattern);
  if (!match?.[1]) return null;
  const value = transform === "upper" ? match[1].toUpperCase() : match[1].toLowerCase();
  return (transform === "upper" ? CODE : CHANNEL).test(value) ? value : null;
}

function channelList(value: string): readonly string[] {
  return Object.freeze([...new Set(value.split(/\s*(?:,|\band\b)\s*/i)
    .map((entry) => entry.trim().toLowerCase().replace(/[.;:!?]+$/, ""))
    .filter((entry) => CHANNEL.test(entry)))].sort());
}

export class LocalRateIntentProposalAdapter implements RateIntentProposalAdapter {
  readonly metadata = Object.freeze({ key: "local-deterministic-v1", external: false });

  async propose(input: RateIntentAdapterInput): Promise<unknown> {
    const intent = input.intent;
    const candidate = mutableCandidate(input);
    const changes: string[] = [];
    const assumptions: string[] = [];
    const questions: string[] = [];
    const warnings: string[] = [];
    const evaluator = nested(candidate, "evaluator");
    const composition = nested(candidate, "composition");
    const model = nested(candidate, "model");

    const requestedModels = MODEL_TERMS.filter(({ pattern }) => pattern.test(intent));
    if (requestedModels.length > 1) {
      questions.push("Name one pricing model only; multiple model requests require Expert composition in Guided or Expert mode.");
    } else if (requestedModels.length === 1 && requestedModels[0]!.key !== model.key) {
      questions.push(`Choose ${requestedModels[0]!.label} in the Pricing step first so its required typed inputs are explicit.`);
    }

    if (/\b(?:simple fixed|fixed rate|fixed pricing)\b/i.test(intent)) {
      setFixedModel(candidate);
      changes.push("Use the Simple fixed pricing model.");
    }

    const amountPatterns: readonly Readonly<{ key: "base" | "floorMinor" | "ceilingMinor"; pattern: RegExp; label: string }>[] = [
      { key: "base", pattern: /\b(?:base\s+)?(?:rate|price|pricing)\s*(?:to|at|of|=)?\s*(0|[1-9][0-9]*)\s+minor\s+units?\b/i, label: "base price" },
      { key: "floorMinor", pattern: /\bfloor\s*(?:to|at|of|=)?\s*(0|[1-9][0-9]*)\s+minor\s+units?\b/i, label: "floor" },
      { key: "ceilingMinor", pattern: /\bceiling\s*(?:to|at|of|=)?\s*(0|[1-9][0-9]*)\s+minor\s+units?\b/i, label: "ceiling" },
    ];
    let exactMoneyFound = false;
    for (const item of amountPatterns) {
      const match = intent.match(item.pattern);
      if (!match?.[1] || !MINOR.test(match[1])) continue;
      if (item.key === "base") {
        const base = nested(evaluator, "base");
        if (base.kind !== "fixed") {
          questions.push("A single base amount can only be applied after selecting a fixed-compatible model.");
          continue;
        }
        base.amountMinor = match[1];
      } else {
        evaluator[item.key] = match[1];
      }
      exactMoneyFound = true;
      changes.push(`Set ${item.label} to ${match[1]} exact minor units.`);
    }
    const intentWithoutExactMoney = amountPatterns.reduce(
      (remaining, item) => remaining.replace(new RegExp(item.pattern.source, "gi"), ""),
      intent,
    );
    const moneyMention = intentWithoutExactMoney.match(/\b(?:base\s+)?(?:rate|price|pricing|floor|ceiling)\b[^.\n]{0,36}\b(?:[₹$€£]\s*)?[0-9]+(?:\.[0-9]+)?(?:\s*(?:USD|EUR|GBP|INR|AED|SAR))?/i)?.[0];
    if (moneyMention && !/minor\s+units?/i.test(moneyMention)) {
      questions.push("State money as an exact integer number of minor units; Yellow will not guess a currency scale.");
    }
    if (exactMoneyFound) assumptions.push(`Minor-unit amounts use the existing ${String(evaluator.currency)} plan currency.`);

    const commercial = firstTargetCommercial(candidate);
    const commercialFields: readonly Readonly<{ key: string; pattern: RegExp; label: string; transform: "upper" | "lower" }>[] = [
      { key: "marketGroupCode", pattern: /\bmarket\s+group\s+(?:code\s+)?([a-z0-9._-]+)\b/i, label: "market group", transform: "upper" },
      { key: "marketCode", pattern: /\bmarket\s+(?!group)(?:code\s+)?([a-z0-9._-]+)\b/i, label: "market", transform: "upper" },
      { key: "sourceCode", pattern: /\bsource\s+(?:code\s+)?([a-z0-9._-]+)\b/i, label: "source", transform: "upper" },
      { key: "segmentCode", pattern: /\bsegment\s+(?:code\s+)?([a-z0-9._-]+)\b/i, label: "segment", transform: "upper" },
      { key: "campaignCode", pattern: /\bcampaign\s+(?:code\s+)?([a-z0-9._-]+)\b/i, label: "campaign", transform: "upper" },
      { key: "channelCode", pattern: /\b(?:on\s+)?channel\s+(?:code\s+)?([a-z0-9._-]+)\b/i, label: "channel", transform: "lower" },
    ];
    for (const field of commercialFields) {
      const value = codeMatch(intent, field.pattern, field.transform);
      if (!value) continue;
      commercial[field.key] = value;
      changes.push(`Target ${field.label} ${value}.`);
    }

    const guests = nested(composition, "guestEligibility");
    const minAdults = integerMatch(intent, /\bminimum\s+([0-9]+)\s+adults?\b/i, 1, 99);
    const maxAdults = integerMatch(intent, /\bmaximum\s+([0-9]+)\s+adults?\b/i, 1, 99);
    const maxChildren = integerMatch(intent, /\bmaximum\s+([0-9]+)\s+children\b/i, 0, 30);
    if (minAdults !== null) {
      guests.minAdults = minAdults;
      changes.push(`Require at least ${minAdults} adult${minAdults === 1 ? "" : "s"}.`);
    }
    if (maxAdults !== null) {
      guests.maxAdults = maxAdults;
      changes.push(`Allow at most ${maxAdults} adult${maxAdults === 1 ? "" : "s"}.`);
    }
    if (maxChildren !== null) {
      guests.maxChildren = maxChildren;
      changes.push(`Allow at most ${maxChildren} children.`);
    }
    if (minAdults !== null || maxAdults !== null || maxChildren !== null) {
      guests.minTotalGuests = Number(guests.minAdults) + Number(guests.minChildren);
      guests.maxTotalGuests = Number(guests.maxAdults) + Number(guests.maxChildren);
    }

    if (/\bnon[ -]?refundable\b/i.test(intent)) {
      nested(composition, "policy").refundTreatment = "non_refundable";
      changes.push("Set refund treatment to non-refundable while retaining mandatory policy evidence.");
    }

    const distribution = nested(composition, "distribution");
    const onlyChannels = intent.match(/\b(?:only\s+(?:distribute|sell)|distribute\s+only)\s+(?:on|through)\s+channels?\s+([a-z0-9._-]+(?:\s*(?:,|and)\s*[a-z0-9._-]+)*)/i)?.[1];
    const deniedChannels = intent.match(/\b(?:exclude|deny)\s+channels?\s+([a-z0-9._-]+(?:\s*(?:,|and)\s*[a-z0-9._-]+)*)/i)?.[1];
    if (onlyChannels) {
      const channels = channelList(onlyChannels);
      if (channels.length > 0) {
        distribution.mode = "allowlist";
        distribution.channelCodes = channels;
        changes.push(`Allow distribution only through ${channels.join(", ")}.`);
      }
    } else if (deniedChannels) {
      const channels = channelList(deniedChannels);
      if (channels.length > 0) {
        distribution.mode = "denylist";
        distribution.channelCodes = channels;
        changes.push(`Exclude distribution through ${channels.join(", ")}.`);
      }
    }

    if (/\b(?:cta|ctd|closed to arrival|closed to departure|minimum stay|min stay|maximum stay|max stay|minimum advance|maximum advance)\b/i.test(intent)) {
      questions.push("CTA, CTD, minimum/maximum stay and advance rules belong in the Restrictions workspace and remain authoritative at live quote time.");
    }

    if (changes.length === 0 && questions.length === 0) {
      questions.push("Describe an exact price in minor units or a supported segment, channel, guest, refund or distribution change.");
    }
    if (questions.length > 0) {
      return { candidate: null, changes, assumptions, questions, warnings };
    }
    warnings.push("Review the complete canonical proposal before applying it; no state has been saved.");
    return { candidate, changes, assumptions, questions, warnings };
  }
}
