import type { TaxEvaluationResult } from "./evaluator";

const MAX_MINOR = 9_223_372_036_854_775_807n;
const MAX_NIGHTS = 366;
const MAX_TAXES = 64;
const MAX_COMPONENTS = 366;
const MAX_PERSONS_PER_NIGHT = 129;
const MAX_TEXT_LENGTH = 256;
const MAX_GRAPH_STRING_LENGTH = 16_384;
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const CURRENCY = /^[A-Z]{3}$/;
const COUNTRY = /^[A-Z]{2}$/;
const STABLE_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const TAX_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const REVENUE_GROUP = /^[a-z][a-z0-9_]{0,63}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ASSIGNMENT_REF = /^tax-assignment:[0-9a-f]{64}$/;
const JURISDICTION_REF = /^tax-jurisdiction:[0-9a-f]{64}$/;

type JsonRecord = Record<string, unknown>;
type PriceDisplay = "tax_inclusive" | "tax_exclusive";
type RoundingMode = "line" | "document";

export interface PositiveTaxAttributionRoomNightInput {
  readonly businessDate: string;
  readonly amountMinor: bigint;
}

export interface PositiveTaxAttributionAssignmentInput {
  readonly businessDate: string;
  readonly jurisdictionKey: string;
  readonly evidenceRef: string;
}

export interface CreatePositiveTaxAttributionSnapshotInput {
  readonly origin: Readonly<{ kind: "rate_quote"; quoteHash: string }>;
  readonly currency: string;
  readonly line: Readonly<{
    lineId: "room";
    revenueGroup: "room_revenue";
    amountMinor: bigint;
    nights: number;
    personNights: number;
    roomNights: readonly PositiveTaxAttributionRoomNightInput[];
  }>;
  readonly assignments: readonly PositiveTaxAttributionAssignmentInput[];
  readonly jurisdiction: Readonly<{
    extensionId: string;
    ownerTenantId: string | null;
    key: string;
    version: number;
    contentHash: string;
    evidenceRef: string;
  }>;
  readonly evaluation: TaxEvaluationResult;
}

export interface PositiveTaxAttributionSnapshotV1 {
  readonly schemaVersion: 1;
  readonly origin: Readonly<{ kind: "rate_quote"; quoteHash: string }>;
  readonly currency: string;
  readonly revenueLine: Readonly<{
    lineId: "room";
    revenueGroup: "room_revenue";
    inputAmountMinor: string;
    nights: string;
    personNights: string;
    roomNights: readonly Readonly<{
      index: string;
      businessDate: string;
      amountMinor: string;
    }>[];
  }>;
  readonly assignments: readonly Readonly<{
    index: string;
    businessDate: string;
    jurisdictionKey: string;
    evidenceRef: string;
  }>[];
  readonly jurisdiction: Readonly<{
    extensionId: string;
    ownerTenantId: string | null;
    key: string;
    version: string;
    contentHash: string;
    evidenceRef: string;
  }>;
  readonly evaluation: Readonly<{
    schemaVersion: 1;
    jurisdictionKey: string;
    country: string;
    priceDisplay: PriceDisplay;
    rounding: RoundingMode;
    inputTotalMinor: string;
    baseTotalMinor: string;
    taxTotalMinor: string;
    grandTotalMinor: string;
    taxes: readonly Readonly<{
      index: string;
      code: string;
      name: string;
      taxMinor: string;
      components: readonly Readonly<{
        index: string;
        lineId: "room";
        revenueGroup: "room_revenue";
        baseMinor: string;
        taxMinor: string | null;
        rateBasisPoints: string | null;
      }>[];
    }>[];
  }>;
  readonly snapshotHash: string;
}

type SnapshotWithoutHash = Omit<PositiveTaxAttributionSnapshotV1, "snapshotHash">;

export class TaxAttributionSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxAttributionSnapshotError";
  }
}

function fail(message: string): never {
  throw new TaxAttributionSnapshotError(message);
}

function inspectDataGraph(value: unknown, ancestors = new Set<object>(), depth = 0): void {
  if (depth > 32) fail("input is too deeply nested");
  if (typeof value === "string") {
    if (value.length > MAX_GRAPH_STRING_LENGTH) fail("input contains oversized text");
    return;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "bigint") return;
  if (typeof value !== "object") fail("input contains a non-data value");
  if (ancestors.has(value)) fail("input must not contain cycles");
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail("arrays must use the canonical prototype");
  } else if (prototype !== Object.prototype && prototype !== null) {
    fail("objects must be plain records");
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) fail("input must not contain symbol keys");
  ancestors.add(value);
  try {
    const keys = Object.keys(value);
    const ownNames = Object.getOwnPropertyNames(value);
    if (Array.isArray(value)) {
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index))
          || ownNames.length !== value.length + 1 || ownNames[ownNames.length - 1] !== "length") {
        fail("arrays must be dense and contain no named fields");
      }
    } else if (ownNames.length !== keys.length) {
      fail("objects must not contain non-enumerable fields");
    }
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        fail("input must contain enumerable data fields only");
      }
      inspectDataGraph(descriptor.value, ancestors, depth + 1);
    }
  } finally {
    ancestors.delete(value);
  }
}

function record(value: unknown, subject: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${subject} must be an object`);
  return value as JsonRecord;
}

function exact(value: JsonRecord, keys: readonly string[], subject: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${subject} has unexpected or missing fields`);
  }
}

function array(value: unknown, subject: string, maximum: number, allowEmpty = false): readonly unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > maximum) {
    fail(`${subject} must contain ${allowEmpty ? "at most" : "1 to"} ${maximum} entries`);
  }
  return value;
}

function text(value: unknown, subject: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TEXT_LENGTH || value !== value.trim()) {
    fail(`${subject} must be non-empty trimmed text`);
  }
  return value;
}

function matchingText(value: unknown, pattern: RegExp, subject: string): string {
  const result = text(value, subject);
  if (!pattern.test(result)) fail(`${subject} is not canonical`);
  return result;
}

function runtimeMinor(value: unknown, subject: string, positive = false): string {
  if (typeof value !== "bigint" || value < (positive ? 1n : 0n) || value > MAX_MINOR) {
    fail(`${subject} must be a ${positive ? "positive" : "non-negative"} signed-range bigint`);
  }
  return value.toString();
}

function runtimeInteger(value: unknown, subject: string, positive = false): string {
  if (!Number.isSafeInteger(value) || (value as number) < (positive ? 1 : 0)) {
    fail(`${subject} must be a ${positive ? "positive" : "non-negative"} safe integer`);
  }
  return String(value);
}

function decimal(value: unknown, subject: string, positive = false): string {
  if (typeof value !== "string" || !DECIMAL.test(value)) fail(`${subject} must be canonical decimal text`);
  const parsed = BigInt(value);
  if (parsed > MAX_MINOR || (positive && parsed === 0n)) {
    fail(`${subject} exceeds its supported range`);
  }
  return value;
}

function safeIntegerDecimal(value: unknown, subject: string, positive = false): string {
  const result = decimal(value, subject, positive);
  if (BigInt(result) > MAX_SAFE_INTEGER_BIGINT) fail(`${subject} exceeds the safe-integer range`);
  return result;
}

function decimalBigInt(value: string): bigint {
  return BigInt(value);
}

function calendarDate(value: unknown, subject: string): string {
  if (typeof value !== "string") fail(`${subject} must be YYYY-MM-DD`);
  const match = DATE.exec(value);
  if (!match) fail(`${subject} must be YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > (monthDays[month - 1] ?? 0)) {
    fail(`${subject} is not a calendar date`);
  }
  return value;
}

function nextDate(previous: string, current: string): boolean {
  return Date.parse(`${current}T00:00:00.000Z`) - Date.parse(`${previous}T00:00:00.000Z`) === 86_400_000;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const source = value as JsonRecord;
  return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(source[key])}`).join(",")}}`;
}

function sha256(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalJson(value)).digest("hex");
}

function normalizeWithoutHash(value: unknown): SnapshotWithoutHash {
  const source = record(value, "snapshot");
  exact(source, ["schemaVersion", "origin", "currency", "revenueLine", "assignments", "jurisdiction", "evaluation"], "snapshot");
  if (source.schemaVersion !== 1) fail("snapshot.schemaVersion must be 1");

  const originSource = record(source.origin, "snapshot.origin");
  exact(originSource, ["kind", "quoteHash"], "snapshot.origin");
  if (originSource.kind !== "rate_quote") fail("snapshot origin must be rate_quote");
  const origin = Object.freeze({
    kind: "rate_quote" as const,
    quoteHash: matchingText(originSource.quoteHash, SHA256, "snapshot.origin.quoteHash"),
  });
  const currency = matchingText(source.currency, CURRENCY, "snapshot.currency");

  const lineSource = record(source.revenueLine, "snapshot.revenueLine");
  exact(lineSource, ["lineId", "revenueGroup", "inputAmountMinor", "nights", "personNights", "roomNights"], "snapshot.revenueLine");
  if (lineSource.lineId !== "room" || lineSource.revenueGroup !== "room_revenue") {
    fail("snapshot revenue line must be the Order239 room revenue line");
  }
  const inputAmountMinor = decimal(lineSource.inputAmountMinor, "snapshot.revenueLine.inputAmountMinor", true);
  const nights = decimal(lineSource.nights, "snapshot.revenueLine.nights", true);
  const personNights = safeIntegerDecimal(lineSource.personNights, "snapshot.revenueLine.personNights", true);
  const roomNightSources = array(lineSource.roomNights, "snapshot.revenueLine.roomNights", MAX_NIGHTS);
  const roomNights = roomNightSources.map((entry, index) => {
    const item = record(entry, `snapshot.revenueLine.roomNights[${index}]`);
    exact(item, ["index", "businessDate", "amountMinor"], `snapshot.revenueLine.roomNights[${index}]`);
    if (item.index !== String(index)) fail("snapshot room-night indexes must be consecutive");
    const businessDate = calendarDate(item.businessDate, `snapshot.revenueLine.roomNights[${index}].businessDate`);
    if (index > 0 && !nextDate(calendarDate((roomNightSources[index - 1] as JsonRecord).businessDate, "previous room date"), businessDate)) {
      fail("snapshot room-night dates must be consecutive");
    }
    return Object.freeze({ index: String(index), businessDate, amountMinor: decimal(item.amountMinor, `snapshot.revenueLine.roomNights[${index}].amountMinor`, true) });
  });
  if (decimalBigInt(nights) !== BigInt(roomNights.length)) fail("snapshot nights must equal the room-night count");
  const personCount = decimalBigInt(personNights);
  const nightCount = decimalBigInt(nights);
  if (personCount < nightCount || personCount % nightCount !== 0n
      || personCount > nightCount * BigInt(MAX_PERSONS_PER_NIGHT)) {
    fail("snapshot person-nights are incoherent");
  }
  const roomTotal = roomNights.reduce((sum, night) => sum + decimalBigInt(night.amountMinor), 0n);
  if (roomTotal !== decimalBigInt(inputAmountMinor) || roomTotal > MAX_MINOR) fail("snapshot room-night amounts do not reconcile");
  const revenueLine = Object.freeze({
    lineId: "room" as const,
    revenueGroup: "room_revenue" as const,
    inputAmountMinor,
    nights,
    personNights,
    roomNights: Object.freeze(roomNights),
  });

  const assignmentSources = array(source.assignments, "snapshot.assignments", MAX_NIGHTS);
  if (assignmentSources.length !== roomNights.length) fail("snapshot assignments must cover every room night");
  const assignmentRefs = new Set<string>();
  const assignments = assignmentSources.map((entry, index) => {
    const item = record(entry, `snapshot.assignments[${index}]`);
    exact(item, ["index", "businessDate", "jurisdictionKey", "evidenceRef"], `snapshot.assignments[${index}]`);
    if (item.index !== String(index)) fail("snapshot assignment indexes must be consecutive");
    const businessDate = calendarDate(item.businessDate, `snapshot.assignments[${index}].businessDate`);
    if (businessDate !== roomNights[index]!.businessDate) fail("snapshot assignment date does not match its room night");
    const evidenceRef = matchingText(item.evidenceRef, ASSIGNMENT_REF, `snapshot.assignments[${index}].evidenceRef`);
    if (assignmentRefs.has(evidenceRef)) fail("snapshot assignments contain duplicate evidence");
    assignmentRefs.add(evidenceRef);
    return Object.freeze({
      index: String(index),
      businessDate,
      jurisdictionKey: matchingText(item.jurisdictionKey, STABLE_KEY, `snapshot.assignments[${index}].jurisdictionKey`),
      evidenceRef,
    });
  });

  const jurisdictionSource = record(source.jurisdiction, "snapshot.jurisdiction");
  exact(jurisdictionSource, ["extensionId", "ownerTenantId", "key", "version", "contentHash", "evidenceRef"], "snapshot.jurisdiction");
  const jurisdiction = Object.freeze({
    extensionId: matchingText(jurisdictionSource.extensionId, UUID, "snapshot.jurisdiction.extensionId"),
    ownerTenantId: jurisdictionSource.ownerTenantId === null
      ? null
      : matchingText(jurisdictionSource.ownerTenantId, UUID, "snapshot.jurisdiction.ownerTenantId"),
    key: matchingText(jurisdictionSource.key, STABLE_KEY, "snapshot.jurisdiction.key"),
    version: safeIntegerDecimal(jurisdictionSource.version, "snapshot.jurisdiction.version", true),
    contentHash: matchingText(jurisdictionSource.contentHash, SHA256, "snapshot.jurisdiction.contentHash"),
    evidenceRef: matchingText(jurisdictionSource.evidenceRef, JURISDICTION_REF, "snapshot.jurisdiction.evidenceRef"),
  });
  if (assignments.some((assignment) => assignment.jurisdictionKey !== jurisdiction.key)) {
    fail("snapshot assignments do not match the jurisdiction");
  }

  const evaluationSource = record(source.evaluation, "snapshot.evaluation");
  exact(evaluationSource, ["schemaVersion", "jurisdictionKey", "country", "priceDisplay", "rounding", "inputTotalMinor", "baseTotalMinor", "taxTotalMinor", "grandTotalMinor", "taxes"], "snapshot.evaluation");
  if (evaluationSource.schemaVersion !== 1) fail("snapshot evaluation schemaVersion must be 1");
  const jurisdictionKey = matchingText(evaluationSource.jurisdictionKey, STABLE_KEY, "snapshot.evaluation.jurisdictionKey");
  if (jurisdictionKey !== jurisdiction.key) fail("snapshot evaluation jurisdiction does not match its lineage");
  const country = matchingText(evaluationSource.country, COUNTRY, "snapshot.evaluation.country");
  if (evaluationSource.priceDisplay !== "tax_inclusive" && evaluationSource.priceDisplay !== "tax_exclusive") {
    fail("snapshot evaluation priceDisplay is unsupported");
  }
  const priceDisplay = evaluationSource.priceDisplay;
  if (evaluationSource.rounding !== "line" && evaluationSource.rounding !== "document") {
    fail("snapshot evaluation rounding is unsupported");
  }
  const rounding = evaluationSource.rounding;
  const inputTotalMinor = decimal(evaluationSource.inputTotalMinor, "snapshot.evaluation.inputTotalMinor", true);
  const baseTotalMinor = decimal(evaluationSource.baseTotalMinor, "snapshot.evaluation.baseTotalMinor");
  const taxTotalMinor = decimal(evaluationSource.taxTotalMinor, "snapshot.evaluation.taxTotalMinor");
  const grandTotalMinor = decimal(evaluationSource.grandTotalMinor, "snapshot.evaluation.grandTotalMinor");
  if (inputTotalMinor !== revenueLine.inputAmountMinor) fail("snapshot evaluation input does not match the revenue line");

  const taxSources = array(evaluationSource.taxes, "snapshot.evaluation.taxes", MAX_TAXES);
  const taxCodes = new Set<string>();
  const taxes = taxSources.map((entry, taxIndex) => {
    const taxSource = record(entry, `snapshot.evaluation.taxes[${taxIndex}]`);
    exact(taxSource, ["index", "code", "name", "taxMinor", "components"], `snapshot.evaluation.taxes[${taxIndex}]`);
    if (taxSource.index !== String(taxIndex)) fail("snapshot tax indexes must be consecutive");
    const code = matchingText(taxSource.code, TAX_CODE, `snapshot.evaluation.taxes[${taxIndex}].code`);
    if (taxCodes.has(code)) fail("snapshot tax codes must be unique");
    taxCodes.add(code);
    const taxMinor = decimal(taxSource.taxMinor, `snapshot.evaluation.taxes[${taxIndex}].taxMinor`);
    const componentSources = array(taxSource.components, `snapshot.evaluation.taxes[${taxIndex}].components`, MAX_COMPONENTS, true);
    const components = componentSources.map((component, componentIndex) => {
      const componentSource = record(component, `snapshot.evaluation.taxes[${taxIndex}].components[${componentIndex}]`);
      exact(componentSource, ["index", "lineId", "revenueGroup", "baseMinor", "taxMinor", "rateBasisPoints"], `snapshot.evaluation.taxes[${taxIndex}].components[${componentIndex}]`);
      if (componentSource.index !== String(componentIndex)) fail("snapshot component indexes must be consecutive");
      if (componentSource.lineId !== revenueLine.lineId || componentSource.revenueGroup !== revenueLine.revenueGroup) {
        fail("snapshot component does not cite the attributed revenue line");
      }
      const componentTax = componentSource.taxMinor === null
        ? null
        : decimal(componentSource.taxMinor, `snapshot.evaluation.taxes[${taxIndex}].components[${componentIndex}].taxMinor`);
      const rate = componentSource.rateBasisPoints === null
        ? null
        : safeIntegerDecimal(componentSource.rateBasisPoints, `snapshot.evaluation.taxes[${taxIndex}].components[${componentIndex}].rateBasisPoints`);
      if ((rounding === "line") !== (componentTax !== null)) fail("snapshot component tax shape conflicts with its rounding mode");
      return Object.freeze({
        index: String(componentIndex),
        lineId: "room" as const,
        revenueGroup: "room_revenue" as const,
        baseMinor: decimal(componentSource.baseMinor, `snapshot.evaluation.taxes[${taxIndex}].components[${componentIndex}].baseMinor`),
        taxMinor: componentTax,
        rateBasisPoints: rate,
      });
    });
    if (rounding === "line") {
      const componentTotal = components.reduce((sum, component) => sum + decimalBigInt(component.taxMinor!), 0n);
      if (componentTotal !== decimalBigInt(taxMinor)) fail("snapshot component taxes do not reconcile");
    }
    return Object.freeze({
      index: String(taxIndex),
      code,
      name: text(taxSource.name, `snapshot.evaluation.taxes[${taxIndex}].name`),
      taxMinor,
      components: Object.freeze(components),
    });
  });

  const taxSum = taxes.reduce((sum, tax) => sum + decimalBigInt(tax.taxMinor), 0n);
  const inputTotal = decimalBigInt(inputTotalMinor);
  const baseTotal = decimalBigInt(baseTotalMinor);
  const taxTotal = decimalBigInt(taxTotalMinor);
  const grandTotal = decimalBigInt(grandTotalMinor);
  if (taxSum !== taxTotal || taxSum > MAX_MINOR) fail("snapshot tax totals do not reconcile");
  if (baseTotal + taxTotal !== grandTotal || grandTotal > MAX_MINOR) fail("snapshot base, tax and grand totals do not reconcile");
  if (priceDisplay === "tax_exclusive" && (baseTotal !== inputTotal || grandTotal !== inputTotal + taxTotal)) {
    fail("snapshot exclusive totals do not reconcile");
  }
  if (priceDisplay === "tax_inclusive" && (grandTotal !== inputTotal || baseTotal + taxTotal !== inputTotal)) {
    fail("snapshot inclusive totals do not reconcile");
  }
  const evaluation = Object.freeze({
    schemaVersion: 1 as const,
    jurisdictionKey,
    country,
    priceDisplay,
    rounding,
    inputTotalMinor,
    baseTotalMinor,
    taxTotalMinor,
    grandTotalMinor,
    taxes: Object.freeze(taxes),
  });

  return Object.freeze({
    schemaVersion: 1 as const,
    origin,
    currency,
    revenueLine,
    assignments: Object.freeze(assignments),
    jurisdiction,
    evaluation,
  });
}

function creationToJson(value: unknown): unknown {
  const source = record(value, "input");
  exact(source, ["origin", "currency", "line", "assignments", "jurisdiction", "evaluation"], "input");
  const origin = record(source.origin, "input.origin");
  exact(origin, ["kind", "quoteHash"], "input.origin");
  const line = record(source.line, "input.line");
  exact(line, ["lineId", "revenueGroup", "amountMinor", "nights", "personNights", "roomNights"], "input.line");
  const roomNights = array(line.roomNights, "input.line.roomNights", MAX_NIGHTS).map((entry, index) => {
    const item = record(entry, `input.line.roomNights[${index}]`);
    exact(item, ["businessDate", "amountMinor"], `input.line.roomNights[${index}]`);
    return { index: String(index), businessDate: item.businessDate, amountMinor: runtimeMinor(item.amountMinor, `input.line.roomNights[${index}].amountMinor`, true) };
  });
  const assignments = array(source.assignments, "input.assignments", MAX_NIGHTS).map((entry, index) => {
    const item = record(entry, `input.assignments[${index}]`);
    exact(item, ["businessDate", "jurisdictionKey", "evidenceRef"], `input.assignments[${index}]`);
    return { index: String(index), businessDate: item.businessDate, jurisdictionKey: item.jurisdictionKey, evidenceRef: item.evidenceRef };
  });
  const jurisdiction = record(source.jurisdiction, "input.jurisdiction");
  exact(jurisdiction, ["extensionId", "ownerTenantId", "key", "version", "contentHash", "evidenceRef"], "input.jurisdiction");
  const evaluation = record(source.evaluation, "input.evaluation");
  exact(evaluation, ["schemaVersion", "jurisdictionKey", "country", "priceDisplay", "rounding", "inputTotalMinor", "baseTotalMinor", "taxTotalMinor", "grandTotalMinor", "taxes"], "input.evaluation");
  const taxes = array(evaluation.taxes, "input.evaluation.taxes", MAX_TAXES).map((entry, taxIndex) => {
    const tax = record(entry, `input.evaluation.taxes[${taxIndex}]`);
    exact(tax, ["code", "name", "taxMinor", "components"], `input.evaluation.taxes[${taxIndex}]`);
    const components = array(tax.components, `input.evaluation.taxes[${taxIndex}].components`, MAX_COMPONENTS, true).map((entryValue, componentIndex) => {
      const component = record(entryValue, `input.evaluation.taxes[${taxIndex}].components[${componentIndex}]`);
      exact(component, ["lineId", "revenueGroup", "baseMinor", "taxMinor", "rateBasisPoints"], `input.evaluation.taxes[${taxIndex}].components[${componentIndex}]`);
      return {
        index: String(componentIndex),
        lineId: component.lineId,
        revenueGroup: component.revenueGroup,
        baseMinor: runtimeMinor(component.baseMinor, `input.evaluation.taxes[${taxIndex}].components[${componentIndex}].baseMinor`),
        taxMinor: component.taxMinor === null ? null : runtimeMinor(component.taxMinor, `input.evaluation.taxes[${taxIndex}].components[${componentIndex}].taxMinor`),
        rateBasisPoints: component.rateBasisPoints === null ? null : runtimeInteger(component.rateBasisPoints, `input.evaluation.taxes[${taxIndex}].components[${componentIndex}].rateBasisPoints`),
      };
    });
    return {
      index: String(taxIndex),
      code: tax.code,
      name: tax.name,
      taxMinor: runtimeMinor(tax.taxMinor, `input.evaluation.taxes[${taxIndex}].taxMinor`),
      components,
    };
  });
  return {
    schemaVersion: 1,
    origin: { kind: origin.kind, quoteHash: origin.quoteHash },
    currency: source.currency,
    revenueLine: {
      lineId: line.lineId,
      revenueGroup: line.revenueGroup,
      inputAmountMinor: runtimeMinor(line.amountMinor, "input.line.amountMinor", true),
      nights: runtimeInteger(line.nights, "input.line.nights", true),
      personNights: runtimeInteger(line.personNights, "input.line.personNights", true),
      roomNights,
    },
    assignments,
    jurisdiction: {
      extensionId: jurisdiction.extensionId,
      ownerTenantId: jurisdiction.ownerTenantId,
      key: jurisdiction.key,
      version: runtimeInteger(jurisdiction.version, "input.jurisdiction.version", true),
      contentHash: jurisdiction.contentHash,
      evidenceRef: jurisdiction.evidenceRef,
    },
    evaluation: {
      schemaVersion: evaluation.schemaVersion,
      jurisdictionKey: evaluation.jurisdictionKey,
      country: evaluation.country,
      priceDisplay: evaluation.priceDisplay,
      rounding: evaluation.rounding,
      inputTotalMinor: runtimeMinor(evaluation.inputTotalMinor, "input.evaluation.inputTotalMinor", true),
      baseTotalMinor: runtimeMinor(evaluation.baseTotalMinor, "input.evaluation.baseTotalMinor"),
      taxTotalMinor: runtimeMinor(evaluation.taxTotalMinor, "input.evaluation.taxTotalMinor"),
      grandTotalMinor: runtimeMinor(evaluation.grandTotalMinor, "input.evaluation.grandTotalMinor"),
      taxes,
    },
  };
}

export function createPositiveTaxAttributionSnapshot(
  input: CreatePositiveTaxAttributionSnapshotInput,
): PositiveTaxAttributionSnapshotV1 {
  inspectDataGraph(input);
  const withoutHash = normalizeWithoutHash(creationToJson(input));
  return Object.freeze({ ...withoutHash, snapshotHash: sha256(withoutHash) });
}

export function parsePositiveTaxAttributionSnapshot(input: unknown): PositiveTaxAttributionSnapshotV1 {
  inspectDataGraph(input);
  const source = record(input, "snapshot");
  exact(source, ["schemaVersion", "origin", "currency", "revenueLine", "assignments", "jurisdiction", "evaluation", "snapshotHash"], "snapshot");
  const suppliedHash = matchingText(source.snapshotHash, SHA256, "snapshot.snapshotHash");
  const withoutHash = normalizeWithoutHash({
    schemaVersion: source.schemaVersion,
    origin: source.origin,
    currency: source.currency,
    revenueLine: source.revenueLine,
    assignments: source.assignments,
    jurisdiction: source.jurisdiction,
    evaluation: source.evaluation,
  });
  const expectedHash = sha256(withoutHash);
  if (suppliedHash !== expectedHash) fail("snapshot hash does not match its canonical content");
  return Object.freeze({ ...withoutHash, snapshotHash: expectedHash });
}
