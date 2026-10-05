const MAX_MINOR = 9_223_372_036_854_775_807n;
const MAX_INPUT_LINES = 512;
const MAX_TAX_DEFINITIONS = 64;
const MAX_ROOM_NIGHTS = 366;
const MAX_APPLIES_TO = 64;
const MAX_COMPOUND_DEPENDENCIES = 16;
const MAX_SLABS = 64;
const MAX_RATIONAL_BITS = 4_096;
const COUNTRY = /^[A-Z]{2}$/;
const STABLE_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const TAX_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const REVENUE_GROUP = /^[a-z][a-z0-9_]{0,63}$/;

type PriceDisplay = "tax_inclusive" | "tax_exclusive";
type RoundingMode = "line" | "document";
type TaxMode = "percent" | "fixed_per_night" | "fixed_per_person_night" | "slab_percent";
type JsonObject = Record<string, unknown>;

interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

interface NormalizedLine {
  readonly lineId: string;
  readonly revenueGroup: string;
  readonly amountMinor: bigint;
  readonly nights: number;
  readonly personNights: number;
  readonly roomNightAmountsMinor: readonly bigint[];
}

interface Slab {
  readonly uptoMinor: bigint | null;
  readonly rateBasisPoints: number;
}

interface TaxDefinition {
  readonly code: string;
  readonly name: string;
  readonly mode: TaxMode;
  readonly appliesTo: ReadonlySet<string>;
  readonly compoundOn: readonly string[];
  readonly rateBasisPoints: number | null;
  readonly amountMinor: bigint | null;
  readonly slabs: readonly Slab[];
}

interface InternalTax {
  readonly definition: TaxDefinition;
  readonly lineTaxes: ReadonlyMap<string, Rational>;
  readonly nightTaxes: ReadonlyMap<string, readonly Rational[]>;
  readonly lineBases: ReadonlyMap<string, Rational>;
  readonly nightBases: ReadonlyMap<string, readonly Rational[]>;
  readonly lineRates: ReadonlyMap<string, readonly number[]>;
}

export interface TaxEvaluationLineInput {
  readonly [key: string]: unknown;
  readonly lineId: string;
  readonly revenueGroup: string;
  readonly amountMinor: bigint;
  readonly nights: number;
  readonly personNights: number;
  readonly roomNightAmountsMinor: readonly bigint[];
}

export interface TaxEvaluationInput {
  readonly jurisdictionKey: string;
  readonly content: unknown;
  readonly lines: readonly TaxEvaluationLineInput[];
}

export interface TaxEvaluationComponent {
  readonly lineId: string;
  readonly revenueGroup: string;
  readonly baseMinor: bigint;
  readonly taxMinor: bigint | null;
  readonly rateBasisPoints: number | null;
}

export interface TaxEvaluationTax {
  readonly code: string;
  readonly name: string;
  readonly taxMinor: bigint;
  readonly components: readonly TaxEvaluationComponent[];
}

export interface TaxEvaluationResult {
  readonly schemaVersion: 1;
  readonly jurisdictionKey: string;
  readonly country: string;
  readonly priceDisplay: PriceDisplay;
  readonly rounding: RoundingMode;
  readonly inputTotalMinor: bigint;
  readonly baseTotalMinor: bigint;
  readonly taxTotalMinor: bigint;
  readonly grandTotalMinor: bigint;
  readonly taxes: readonly TaxEvaluationTax[];
}

export class TaxEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxEvaluationError";
  }
}

function fail(message: string): never {
  throw new TaxEvaluationError(message);
}

function object(value: unknown, subject: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${subject} must be an object`);
  }
  return value as JsonObject;
}

function onlyKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const accepted = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !accepted.has(key)).sort();
  if (unknown.length > 0) fail(`${subject} contains unknown field ${unknown[0]}`);
}

function required(value: JsonObject, keys: readonly string[], subject: string): void {
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) fail(`${subject}.${key} is required`);
  }
}

function string(value: unknown, subject: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    fail(`${subject} must be non-empty trimmed text`);
  }
  return value;
}

function integer(value: unknown, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(`${subject} must be a non-negative safe integer`);
  }
  return value as number;
}

function inputMinor(value: unknown, subject: string, allowZero = false): bigint {
  if (typeof value !== "bigint" || value < (allowZero ? 0n : 1n) || value > MAX_MINOR) {
    fail(`${subject} must be ${allowZero ? "a non-negative" : "a positive"} signed-range bigint minor-unit value`);
  }
  return value;
}

function configuredMinor(value: unknown, subject: string): bigint {
  const amount = integer(value, subject);
  return BigInt(amount);
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function rational(numerator: bigint, denominator = 1n, subject = "tax arithmetic"): Rational {
  if (numerator < 0n || denominator <= 0n) fail(`${subject} produced an invalid rational value`);
  if (numerator.toString(2).length > MAX_RATIONAL_BITS || denominator.toString(2).length > MAX_RATIONAL_BITS) {
    fail(`${subject} exceeds the rational complexity limit`);
  }
  if (numerator > MAX_MINOR * denominator) fail(`${subject} exceeds signed-range bigint minor units`);
  const divisor = gcd(numerator, denominator);
  return Object.freeze({ numerator: numerator / divisor, denominator: denominator / divisor });
}

function add(left: Rational, right: Rational, subject: string): Rational {
  const shared = gcd(left.denominator, right.denominator);
  const leftScale = right.denominator / shared;
  const rightScale = left.denominator / shared;
  return rational(
    left.numerator * leftScale + right.numerator * rightScale,
    left.denominator * leftScale,
    subject,
  );
}

function sum(values: Iterable<Rational>, subject: string): Rational {
  let total = rational(0n);
  for (const value of values) total = add(total, value, subject);
  return total;
}

function roundHalfUp(value: Rational): bigint {
  const quotient = value.numerator / value.denominator;
  const remainder = value.numerator % value.denominator;
  const rounded = quotient + (remainder * 2n >= value.denominator ? 1n : 0n);
  if (rounded > MAX_MINOR) fail("rounded tax exceeds signed-range bigint minor units");
  return rounded;
}

function addMinor(left: bigint, right: bigint, subject: string): bigint {
  const total = left + right;
  if (total < 0n || total > MAX_MINOR) fail(`${subject} exceeds signed-range bigint minor units`);
  return total;
}

function decimalFraction(value: number, subject: string): Rational {
  if (!Number.isFinite(value) || value < 0) fail(`${subject} must be finite and non-negative`);
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(value.toString().toLowerCase());
  if (!match) fail(`${subject} is not an exact decimal rate`);
  const whole = match[1]!;
  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? "0");
  if (!Number.isSafeInteger(exponent)) fail(`${subject} has unsafe precision`);
  const digits = BigInt(`${whole}${fraction}`);
  const scale = fraction.length - exponent;
  if (Math.abs(scale) > 100) fail(`${subject} has unsafe precision`);
  return scale >= 0
    ? rational(digits, 10n ** BigInt(scale), subject)
    : rational(digits * 10n ** BigInt(-scale), 1n, subject);
}

function basisPoints(value: unknown, subject: string): number {
  if (typeof value !== "number") fail(`${subject} must be a JSON number`);
  const rate = decimalFraction(value, subject);
  const scaled = rate.numerator * 10_000n;
  if (scaled % rate.denominator !== 0n) fail(`${subject} must convert exactly to integer basis points`);
  const points = scaled / rate.denominator;
  if (points > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${subject} basis points are unsafe`);
  return Number(points);
}

function percentageTax(base: Rational, points: number, priceDisplay: PriceDisplay, subject: string): Rational {
  const pointValue = BigInt(points);
  const denominator = priceDisplay === "tax_inclusive" ? 10_000n + pointValue : 10_000n;
  return rational(base.numerator * pointValue, base.denominator * denominator, subject);
}

function normalizeStringArray(value: unknown, subject: string, pattern: RegExp): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) fail(`${subject} must be a non-empty array`);
  const limit = subject.endsWith(".compound_on") ? MAX_COMPOUND_DEPENDENCIES : MAX_APPLIES_TO;
  if (value.length > limit) fail(`${subject} exceeds the ${limit}-entry limit`);
  const result = value.map((entry, index) => {
    const normalized = string(entry, `${subject}[${index}]`);
    if (!pattern.test(normalized)) fail(`${subject}[${index}] is not a stable identifier`);
    return normalized;
  });
  if (new Set(result).size !== result.length) fail(`${subject} contains duplicates`);
  return Object.freeze(result);
}

function normalizeSlabs(value: unknown, subject: string): readonly Slab[] {
  if (!Array.isArray(value) || value.length === 0) fail(`${subject} must be a non-empty array`);
  if (value.length > MAX_SLABS) fail(`${subject} exceeds the ${MAX_SLABS}-band limit`);
  let previous = -1n;
  let finalBands = 0;
  const slabs = value.map((entry, index) => {
    const row = object(entry, `${subject}[${index}]`);
    onlyKeys(row, ["upto_minor", "rate", "itc_eligible"], `${subject}[${index}]`);
    required(row, ["upto_minor", "rate"], `${subject}[${index}]`);
    if (Object.hasOwn(row, "itc_eligible") && typeof row.itc_eligible !== "boolean") {
      fail(`${subject}[${index}].itc_eligible must be boolean`);
    }
    let uptoMinor: bigint | null;
    if (row.upto_minor === null) {
      finalBands += 1;
      if (index !== value.length - 1) fail(`${subject} null band must be final`);
      uptoMinor = null;
    } else {
      uptoMinor = configuredMinor(row.upto_minor, `${subject}[${index}].upto_minor`);
      if (uptoMinor <= previous) fail(`${subject} upper bounds must be strictly increasing`);
      previous = uptoMinor;
    }
    return Object.freeze({
      uptoMinor,
      rateBasisPoints: basisPoints(row.rate, `${subject}[${index}].rate`),
    });
  });
  if (finalBands !== 1) fail(`${subject} requires exactly one final null band`);
  return Object.freeze(slabs);
}

function normalizeTax(value: unknown, index: number): TaxDefinition {
  const subject = `content.taxes[${index}]`;
  const row = object(value, subject);
  onlyKeys(row, ["code", "name", "mode", "rate", "amount_minor", "applies_to", "slabs", "slab_basis", "compound_on"], subject);
  required(row, ["code", "name", "mode", "applies_to"], subject);
  const code = string(row.code, `${subject}.code`);
  if (!TAX_CODE.test(code)) fail(`${subject}.code is not a stable tax code`);
  const name = string(row.name, `${subject}.name`);
  const mode = row.mode;
  if (mode !== "percent" && mode !== "fixed_per_night" && mode !== "fixed_per_person_night" && mode !== "slab_percent") {
    fail(`${subject}.mode is unsupported`);
  }
  const appliesTo = normalizeStringArray(row.applies_to, `${subject}.applies_to`, REVENUE_GROUP);
  const compoundOn = row.compound_on === undefined
    ? Object.freeze([] as string[])
    : normalizeStringArray(row.compound_on, `${subject}.compound_on`, TAX_CODE);
  let rateBasisPoints: number | null = null;
  let amountMinor: bigint | null = null;
  let slabs = Object.freeze([] as Slab[]);
  if (mode === "percent") {
    required(row, ["rate"], subject);
    if (row.amount_minor !== undefined || row.slabs !== undefined || row.slab_basis !== undefined) fail(`${subject} percent shape is malformed`);
    rateBasisPoints = basisPoints(row.rate, `${subject}.rate`);
  } else if (mode === "slab_percent") {
    required(row, ["slabs", "slab_basis"], subject);
    if (row.rate !== undefined || row.amount_minor !== undefined) fail(`${subject} slab shape is malformed`);
    if (row.slab_basis !== "transaction_value") {
      fail(`${subject}.slab_basis requires explicit transaction_value room-night inputs in this engine version`);
    }
    slabs = normalizeSlabs(row.slabs, `${subject}.slabs`);
  } else {
    required(row, ["amount_minor"], subject);
    if (row.rate !== undefined || row.slabs !== undefined || row.slab_basis !== undefined || compoundOn.length > 0) {
      fail(`${subject} fixed shape is malformed`);
    }
    amountMinor = configuredMinor(row.amount_minor, `${subject}.amount_minor`);
  }
  return Object.freeze({
    code,
    name,
    mode,
    appliesTo: new Set(appliesTo),
    compoundOn,
    rateBasisPoints,
    amountMinor,
    slabs,
  });
}

function normalizeContent(value: unknown): {
  readonly country: string;
  readonly priceDisplay: PriceDisplay;
  readonly rounding: RoundingMode;
  readonly taxes: readonly TaxDefinition[];
} {
  const content = object(value, "content");
  onlyKeys(content, ["country", "region", "price_display", "rounding", "taxes"], "content");
  required(content, ["country", "price_display", "rounding", "taxes"], "content");
  const country = string(content.country, "content.country");
  if (!COUNTRY.test(country)) fail("content.country must be a two-letter uppercase country code");
  if (Object.hasOwn(content, "region")) string(content.region, "content.region");
  if (content.price_display !== "tax_inclusive" && content.price_display !== "tax_exclusive") {
    fail("content.price_display is unsupported");
  }
  if (content.rounding !== "line" && content.rounding !== "document") fail("content.rounding is unsupported");
  if (!Array.isArray(content.taxes) || content.taxes.length === 0) fail("content.taxes must be a non-empty array");
  if (content.taxes.length > MAX_TAX_DEFINITIONS) {
    fail(`content.taxes exceeds the ${MAX_TAX_DEFINITIONS}-definition limit`);
  }
  const taxes = content.taxes.map(normalizeTax);
  const positions = new Map<string, number>();
  taxes.forEach((tax, index) => {
    if (positions.has(tax.code)) fail(`content.taxes contains duplicate code ${tax.code}`);
    positions.set(tax.code, index);
  });
  taxes.forEach((tax, index) => {
    for (const dependency of tax.compoundOn) {
      const position = positions.get(dependency);
      if (position === undefined) fail(`tax ${tax.code} compounds on missing code ${dependency}`);
      if (position >= index) fail(`tax ${tax.code} may compound only on an earlier tax code`);
    }
  });
  if (content.rounding === "document" && taxes.some((tax) => tax.compoundOn.length > 0)) {
    fail("document rounding with compounding requires an explicit allocation policy");
  }
  return Object.freeze({
    country,
    priceDisplay: content.price_display,
    rounding: content.rounding,
    taxes: Object.freeze(taxes),
  });
}

function normalizeLines(value: unknown): readonly NormalizedLine[] {
  if (!Array.isArray(value) || value.length === 0) fail("lines must be a non-empty array");
  if (value.length > MAX_INPUT_LINES) fail(`lines exceeds the ${MAX_INPUT_LINES}-line limit`);
  const ids = new Set<string>();
  const lines = value.map((entry, index) => {
    const subject = `lines[${index}]`;
    const row = object(entry, subject);
    onlyKeys(row, ["lineId", "revenueGroup", "amountMinor", "nights", "personNights", "roomNightAmountsMinor"], subject);
    required(row, ["lineId", "revenueGroup", "amountMinor", "nights", "personNights", "roomNightAmountsMinor"], subject);
    const lineId = string(row.lineId, `${subject}.lineId`);
    if (!STABLE_KEY.test(lineId)) fail(`${subject}.lineId is not a stable identifier`);
    if (ids.has(lineId)) fail(`lines contains duplicate lineId ${lineId}`);
    ids.add(lineId);
    const revenueGroup = string(row.revenueGroup, `${subject}.revenueGroup`);
    if (!REVENUE_GROUP.test(revenueGroup)) fail(`${subject}.revenueGroup is not a stable identifier`);
    const amountMinor = inputMinor(row.amountMinor, `${subject}.amountMinor`);
    const nights = integer(row.nights, `${subject}.nights`);
    const personNights = integer(row.personNights, `${subject}.personNights`);
    if (!Array.isArray(row.roomNightAmountsMinor)) fail(`${subject}.roomNightAmountsMinor must be an array`);
    if (row.roomNightAmountsMinor.length > MAX_ROOM_NIGHTS) {
      fail(`${subject}.roomNightAmountsMinor exceeds the ${MAX_ROOM_NIGHTS}-night limit`);
    }
    const roomNights = row.roomNightAmountsMinor.map((amount, night) => inputMinor(amount, `${subject}.roomNightAmountsMinor[${night}]`));
    if (revenueGroup === "room_revenue") {
      if (nights === 0 || roomNights.length !== nights) fail(`${subject} room revenue requires one amount for each night`);
      let total = 0n;
      for (const amount of roomNights) total = addMinor(total, amount, `${subject} room-night total`);
      if (total !== amountMinor) fail(`${subject} room-night amounts must equal amountMinor`);
    } else if (roomNights.length !== 0) {
      fail(`${subject} non-room revenue cannot carry room-night amounts`);
    }
    return Object.freeze({
      lineId,
      revenueGroup,
      amountMinor,
      nights,
      personNights,
      roomNightAmountsMinor: Object.freeze(roomNights),
    });
  });
  return Object.freeze(lines);
}

function compoundedLineBase(
  line: NormalizedLine,
  tax: TaxDefinition,
  prior: ReadonlyMap<string, InternalTax>,
  rounding: RoundingMode,
): Rational {
  const additions = tax.compoundOn.map((code) => {
    const earlier = prior.get(code)!;
    const exact = earlier.lineTaxes.get(line.lineId) ?? rational(0n);
    return rounding === "line" ? rational(roundedLineTax(earlier, line.lineId)) : exact;
  });
  return add(rational(line.amountMinor), sum(additions, `tax ${tax.code} compound basis`), `tax ${tax.code} line basis`);
}

function compoundedNightBases(
  line: NormalizedLine,
  tax: TaxDefinition,
  prior: ReadonlyMap<string, InternalTax>,
  rounding: RoundingMode,
): readonly Rational[] {
  return Object.freeze(line.roomNightAmountsMinor.map((amount, index) => {
    const additions = tax.compoundOn.map((code) => {
      const values = prior.get(code)!.nightTaxes.get(line.lineId);
      if (!values || values.length !== line.roomNightAmountsMinor.length) {
        fail(`tax ${tax.code} cannot attribute compound code ${code} by room night`);
      }
      const exact = values[index]!;
      return rounding === "line" ? rational(roundHalfUp(exact)) : exact;
    });
    return add(rational(amount), sum(additions, `tax ${tax.code} room-night compound basis`), `tax ${tax.code} room-night basis`);
  }));
}

function slabRate(slabs: readonly Slab[], amount: Rational): number {
  for (const slab of slabs) {
    if (slab.uptoMinor === null || amount.numerator <= slab.uptoMinor * amount.denominator) {
      return slab.rateBasisPoints;
    }
  }
  return fail("slab configuration has no final band");
}

function calculateTax(
  definition: TaxDefinition,
  lines: readonly NormalizedLine[],
  priceDisplay: PriceDisplay,
  rounding: RoundingMode,
  prior: ReadonlyMap<string, InternalTax>,
): InternalTax {
  const lineTaxes = new Map<string, Rational>();
  const nightTaxes = new Map<string, readonly Rational[]>();
  const lineBases = new Map<string, Rational>();
  const nightBases = new Map<string, readonly Rational[]>();
  const lineRates = new Map<string, readonly number[]>();
  for (const line of lines) {
    if (!definition.appliesTo.has(line.revenueGroup)) continue;
    const base = compoundedLineBase(line, definition, prior, rounding);
    lineBases.set(line.lineId, base);
    if (definition.mode === "percent") {
      const points = definition.rateBasisPoints!;
      const tax = percentageTax(base, points, priceDisplay, `tax ${definition.code}`);
      lineTaxes.set(line.lineId, tax);
      if (line.roomNightAmountsMinor.length > 0) {
        const bases = compoundedNightBases(line, definition, prior, rounding);
        nightBases.set(line.lineId, bases);
        nightTaxes.set(line.lineId, Object.freeze(bases.map((night) => percentageTax(night, points, priceDisplay, `tax ${definition.code}`))));
        lineRates.set(line.lineId, Object.freeze(bases.map(() => points)));
      } else {
        lineRates.set(line.lineId, Object.freeze([points]));
      }
    } else if (definition.mode === "slab_percent") {
      if (line.revenueGroup !== "room_revenue" || line.roomNightAmountsMinor.length === 0) {
        fail(`tax ${definition.code} slab_percent requires room-revenue room-night amounts`);
      }
      const bases = compoundedNightBases(line, definition, prior, rounding);
      nightBases.set(line.lineId, bases);
      const rates = bases.map((night) => slabRate(definition.slabs, night));
      const taxes = bases.map((night, index) => percentageTax(night, rates[index]!, priceDisplay, `tax ${definition.code}`));
      nightTaxes.set(line.lineId, Object.freeze(taxes));
      lineTaxes.set(line.lineId, sum(taxes, `tax ${definition.code} line total`));
      lineRates.set(line.lineId, Object.freeze(rates));
    } else {
      const quantity = definition.mode === "fixed_per_night" ? line.nights : line.personNights;
      const tax = rational(definition.amountMinor! * BigInt(quantity), 1n, `tax ${definition.code}`);
      lineTaxes.set(line.lineId, tax);
      lineRates.set(line.lineId, Object.freeze([]));
      if (definition.mode === "fixed_per_night" && line.roomNightAmountsMinor.length > 0) {
        nightBases.set(line.lineId, Object.freeze(line.roomNightAmountsMinor.map((amount) => rational(amount))));
        nightTaxes.set(line.lineId, Object.freeze(line.roomNightAmountsMinor.map(() => rational(definition.amountMinor!))));
      }
    }
  }
  return Object.freeze({ definition, lineTaxes, nightTaxes, lineBases, nightBases, lineRates });
}

function roundedLineTax(tax: InternalTax, lineId: string): bigint {
  const nights = tax.nightTaxes.get(lineId);
  if (nights) {
    let total = 0n;
    for (const night of nights) total = addMinor(total, roundHalfUp(night), `tax ${tax.definition.code} line rounding`);
    return total;
  }
  const value = tax.lineTaxes.get(lineId);
  return value ? roundHalfUp(value) : 0n;
}

function commonRate(rates: readonly number[]): number | null {
  if (rates.length === 0) return null;
  return rates.every((rate) => rate === rates[0]) ? rates[0]! : null;
}

export function evaluateTaxJurisdiction(input: TaxEvaluationInput): TaxEvaluationResult {
  const raw = object(input, "input");
  onlyKeys(raw, ["jurisdictionKey", "content", "lines"], "input");
  required(raw, ["jurisdictionKey", "content", "lines"], "input");
  const jurisdictionKey = string(raw.jurisdictionKey, "input.jurisdictionKey");
  if (!STABLE_KEY.test(jurisdictionKey)) fail("input.jurisdictionKey is not a stable identifier");
  const content = normalizeContent(raw.content);
  const lines = normalizeLines(raw.lines);
  let inputTotalMinor = 0n;
  for (const line of lines) inputTotalMinor = addMinor(inputTotalMinor, line.amountMinor, "input total");

  const calculated = new Map<string, InternalTax>();
  const taxes: TaxEvaluationTax[] = [];
  let taxTotalMinor = 0n;
  for (const definition of content.taxes) {
    const internal = calculateTax(definition, lines, content.priceDisplay, content.rounding, calculated);
    calculated.set(definition.code, internal);
    let taxMinor: bigint;
    if (content.rounding === "document") {
      taxMinor = roundHalfUp(sum(internal.lineTaxes.values(), `tax ${definition.code} document total`));
    } else {
      taxMinor = 0n;
      for (const line of lines) {
        taxMinor = addMinor(taxMinor, roundedLineTax(internal, line.lineId), `tax ${definition.code} total`);
      }
    }
    taxTotalMinor = addMinor(taxTotalMinor, taxMinor, "tax total");
    const components = lines.flatMap((line): TaxEvaluationComponent[] => {
      const value = internal.lineTaxes.get(line.lineId);
      if (!value) return [];
      const nightValues = internal.nightTaxes.get(line.lineId);
      const bases = internal.nightBases.get(line.lineId);
      if (nightValues && bases) {
        const rates = internal.lineRates.get(line.lineId) ?? [];
        return nightValues.map((nightTax, index) => Object.freeze({
          lineId: line.lineId,
          revenueGroup: line.revenueGroup,
          baseMinor: roundHalfUp(bases[index]!),
          taxMinor: content.rounding === "line" ? roundHalfUp(nightTax) : null,
          rateBasisPoints: rates[index] ?? null,
        }));
      }
      return [Object.freeze({
        lineId: line.lineId,
        revenueGroup: line.revenueGroup,
        baseMinor: roundHalfUp(internal.lineBases.get(line.lineId)!),
        taxMinor: content.rounding === "line" ? roundedLineTax(internal, line.lineId) : null,
        rateBasisPoints: commonRate(internal.lineRates.get(line.lineId) ?? []),
      })];
    });
    taxes.push(Object.freeze({
      code: definition.code,
      name: definition.name,
      taxMinor,
      components: Object.freeze(components),
    }));
  }

  let baseTotalMinor: bigint;
  let grandTotalMinor: bigint;
  if (content.priceDisplay === "tax_exclusive") {
    baseTotalMinor = inputTotalMinor;
    grandTotalMinor = addMinor(inputTotalMinor, taxTotalMinor, "grand total");
  } else {
    if (taxTotalMinor > inputTotalMinor) fail("included tax exceeds the supplied gross amount");
    baseTotalMinor = inputTotalMinor - taxTotalMinor;
    grandTotalMinor = inputTotalMinor;
  }
  return Object.freeze({
    schemaVersion: 1,
    jurisdictionKey,
    country: content.country,
    priceDisplay: content.priceDisplay,
    rounding: content.rounding,
    inputTotalMinor,
    baseTotalMinor,
    taxTotalMinor,
    grandTotalMinor,
    taxes: Object.freeze(taxes),
  });
}
