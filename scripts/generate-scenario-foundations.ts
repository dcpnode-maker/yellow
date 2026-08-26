import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, win32 } from "node:path";

export const SCENARIO_COMPILER_VERSION = "1.0.0";
export const DEFAULT_SCENARIO_START_DATE = "2024-01-01";
export const DEFAULT_SCENARIO_DAY_COUNT = 1_096;
export const DEFAULT_SCENARIO_SEED = "yellow-uat-v1";
export const DEFAULT_SCENARIO_OUTPUT_ROOT = "D:\\Yellow\\generated\\scenario-foundations\\v1";
export const MAX_SCENARIO_DAY_COUNT = 1_096;

type RoomClass = { code: string; label: string };

type RoomType = {
  code: string;
  classCode: string;
  label: string;
  quantity: number;
  adultCapacity: number;
  childCapacity: number;
  accessible: boolean;
  connectsToTypeCodes: string[];
};

type BoardPlan = { code: string; normalized: "room_only" | "breakfast" | "half_board" | "full_board"; label: string; inclusions: string[] };
type Policy = { code: string; refundability: "refundable" | "non_refundable"; description: string };
type Package = { code: string; label: string; inclusions: string[] };
type PartyShape = { code: string; adults: number; childAges: number[] };
type CorporatePattern = { code: string; syntheticAccount: string; stayNights: [number, number] };
type GroupPattern = { code: string; kind: "group" | "block"; rooms: [number, number]; authority: "future_scenario_intent"; targetPhase: 11 };
type LongStayPattern = { code: string; nights: [number, number] };
type Season = { code: string; startMonthDay: string; endMonthDay: string; demandBasisPoints: number };
type Source = { code: string; capability: "current_intent" | "future_phase_9" };

export type ScenarioManifest = {
  schemaVersion: 1;
  scenarioKey: string;
  synthetic: true;
  property: {
    displayName: string;
    countryCode: "IN" | "CA";
    currency: "INR" | "CAD";
    timeZone: string;
  };
  roomClasses: RoomClass[];
  roomTypes: RoomType[];
  boardPlans: BoardPlan[];
  policies: Policy[];
  packages: Package[];
  sources: Source[];
  partyShapes: PartyShape[];
  corporatePatterns: CorporatePattern[];
  groupPatterns: GroupPattern[];
  longStayPatterns: LongStayPattern[];
  seasons: Season[];
  edgeCases: string[];
  authority: {
    taxFiscal: "pending_policy";
    groupsBlocks: "future_phase";
    databaseAuthority: false;
    importedReservations: false;
    purpose: "future_uat_input";
  };
};

export type GeneratedScenario = {
  format: "yellow_scenario_foundation";
  compilerVersion: string;
  sourceVersion: number;
  sourceHashSha256: string;
  scenarioKey: string;
  synthetic: true;
  seed: string;
  property: ScenarioManifest["property"];
  dateWindow: { startLocalDate: string; endLocalDateExclusive: string; dayCount: number; timeZone: string };
  capability: ScenarioManifest["authority"];
  catalogue: Omit<ScenarioManifest, "schemaVersion" | "scenarioKey" | "synthetic" | "property" | "authority">;
  dailyDemandInputs: Array<{
    localDate: string;
    dayIndex: number;
    weekday: number;
    seasonCode: string;
    demandBasisPoints: number;
    roomTypeCode: string;
    boardPlanCode: string;
    policyCode: string;
    sourceCode: string;
    partyShapeCode: string;
    stayNightsHint: number;
  }>;
  disclaimer: "synthetic_future_uat_input_not_imported_reservation_or_production_data";
};

const ROOT_KEYS = ["schemaVersion", "scenarioKey", "synthetic", "property", "roomClasses", "roomTypes", "boardPlans", "policies", "packages", "sources", "partyShapes", "corporatePatterns", "groupPatterns", "longStayPatterns", "seasons", "edgeCases", "authority"] as const;

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${path} must contain exactly: ${wanted.join(", ")}.`);
  }
}

function text(value: unknown, path: string, pattern?: RegExp): string {
  if (typeof value !== "string" || value.length === 0 || (pattern !== undefined && !pattern.test(value))) {
    throw new Error(`${path} is invalid.`);
  }
  return value;
}

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${path} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value as number;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be boolean.`);
  return value;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${path} must be a non-empty array.`);
  return value;
}

function textList(value: unknown, path: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new Error(`${path} must be an array.`);
  const result = value.map((item, index) => text(item, `${path}[${index}]`, /^[a-z][a-z0-9_]*$/));
  if (new Set(result).size !== result.length) throw new Error(`${path} contains duplicates.`);
  return result;
}

function codeList(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  const result = value.map((item, index) => text(item, `${path}[${index}]`, /^[A-Z][A-Z0-9_]*$/));
  if (new Set(result).size !== result.length) throw new Error(`${path} contains duplicates.`);
  return result;
}

function pair(value: unknown, path: string, minimum: number, maximum: number): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${path} must be a two-value range.`);
  const result: [number, number] = [integer(value[0], `${path}[0]`, minimum, maximum), integer(value[1], `${path}[1]`, minimum, maximum)];
  if (result[0] > result[1]) throw new Error(`${path} must be ascending.`);
  return result;
}

function codedObjects<T>(value: unknown, path: string, parse: (item: Record<string, unknown>, itemPath: string) => T): T[] {
  const result = list(value, path).map((item, index) => parse(objectAt(item, `${path}[${index}]`), `${path}[${index}]`));
  const codes = result.map((item) => (item as { code: string }).code);
  if (new Set(codes).size !== codes.length) throw new Error(`${path} contains duplicate codes.`);
  return result;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${path} must be one of: ${allowed.join(", ")}.`);
  return value as T;
}

function validTimeZone(value: unknown, path: string): string {
  const zone = text(value, path);
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
  } catch {
    throw new Error(`${path} must be a valid IANA timezone.`);
  }
  if (!zone.includes("/") && zone !== "UTC") throw new Error(`${path} must be a named IANA timezone.`);
  return zone;
}

export function validateScenarioManifest(input: unknown): ScenarioManifest {
  assertNoSensitiveAuthority(input);
  const root = objectAt(input, "manifest");
  exactKeys(root, ROOT_KEYS, "manifest");
  if (root.schemaVersion !== 1) throw new Error("manifest.schemaVersion must be 1.");
  if (root.synthetic !== true) throw new Error("manifest.synthetic must be true.");
  const scenarioKey = text(root.scenarioKey, "manifest.scenarioKey", /^[a-z][a-z0-9-]{2,47}$/);

  const property = objectAt(root.property, "manifest.property");
  exactKeys(property, ["displayName", "countryCode", "currency", "timeZone"], "manifest.property");
  const countryCode = enumValue(property.countryCode, ["IN", "CA"] as const, "manifest.property.countryCode");
  const currency = enumValue(property.currency, ["INR", "CAD"] as const, "manifest.property.currency");
  if ((countryCode === "IN" && currency !== "INR") || (countryCode === "CA" && currency !== "CAD")) throw new Error("Property country and currency do not match the scenario contract.");
  const parsedProperty: ScenarioManifest["property"] = {
    displayName: text(property.displayName, "manifest.property.displayName"),
    countryCode,
    currency,
    timeZone: validTimeZone(property.timeZone, "manifest.property.timeZone"),
  };

  const roomClasses = codedObjects(root.roomClasses, "manifest.roomClasses", (item, path): RoomClass => {
    exactKeys(item, ["code", "label"], path);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), label: text(item.label, `${path}.label`) };
  });
  if (roomClasses.length < 4) throw new Error("Manifest must define at least four room classes.");
  const roomTypes = codedObjects(root.roomTypes, "manifest.roomTypes", (item, path): RoomType => {
    exactKeys(item, ["code", "classCode", "label", "quantity", "adultCapacity", "childCapacity", "accessible", "connectsToTypeCodes"], path);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), classCode: text(item.classCode, `${path}.classCode`, /^[A-Z][A-Z0-9_]*$/), label: text(item.label, `${path}.label`), quantity: integer(item.quantity, `${path}.quantity`, 1, 500), adultCapacity: integer(item.adultCapacity, `${path}.adultCapacity`, 1, 12), childCapacity: integer(item.childCapacity, `${path}.childCapacity`, 0, 12), accessible: boolean(item.accessible, `${path}.accessible`), connectsToTypeCodes: codeList(item.connectsToTypeCodes, `${path}.connectsToTypeCodes`) };
  });
  if (roomTypes.length < 4) throw new Error("Manifest must define at least four room types.");
  const roomClassCodes = new Set(roomClasses.map((item) => item.code));
  const roomTypeCodes = new Set(roomTypes.map((item) => item.code));
  for (const roomType of roomTypes) {
    if (!roomClassCodes.has(roomType.classCode)) throw new Error(`Room type ${roomType.code} references unknown class ${roomType.classCode}.`);
    for (const target of roomType.connectsToTypeCodes) {
      if (target === roomType.code) throw new Error(`Room type ${roomType.code} cannot connect to itself.`);
      if (!roomTypeCodes.has(target)) throw new Error(`Room type ${roomType.code} references unknown connecting type ${target}.`);
    }
  }
  if (!roomTypes.some((item) => item.accessible) || !roomTypes.some((item) => item.connectsToTypeCodes.length > 0)) throw new Error("Room types must include accessible and connecting inventory.");

  const boardPlans = codedObjects(root.boardPlans, "manifest.boardPlans", (item, path): BoardPlan => {
    exactKeys(item, ["code", "normalized", "label", "inclusions"], path);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), normalized: enumValue(item.normalized, ["room_only", "breakfast", "half_board", "full_board"] as const, `${path}.normalized`), label: text(item.label, `${path}.label`), inclusions: textList(item.inclusions, `${path}.inclusions`, true) };
  });
  if (new Set(boardPlans.map((item) => item.normalized)).size !== 4) throw new Error("Board plans must cover room-only, breakfast, half-board and full-board intent.");
  const policies = codedObjects(root.policies, "manifest.policies", (item, path): Policy => {
    exactKeys(item, ["code", "refundability", "description"], path);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), refundability: enumValue(item.refundability, ["refundable", "non_refundable"] as const, `${path}.refundability`), description: text(item.description, `${path}.description`) };
  });
  if (!policies.some((item) => item.refundability === "refundable") || !policies.some((item) => item.refundability === "non_refundable")) throw new Error("Policies must cover both refundability choices.");
  const packages = codedObjects(root.packages, "manifest.packages", (item, path): Package => {
    exactKeys(item, ["code", "label", "inclusions"], path);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), label: text(item.label, `${path}.label`), inclusions: textList(item.inclusions, `${path}.inclusions`) };
  });
  const sources = codedObjects(root.sources, "manifest.sources", (item, path): Source => {
    exactKeys(item, ["code", "capability"], path);
    return { code: text(item.code, `${path}.code`, /^[a-z][a-z0-9_]*$/), capability: enumValue(item.capability, ["current_intent", "future_phase_9"] as const, `${path}.capability`) };
  });
  const partyShapes = codedObjects(root.partyShapes, "manifest.partyShapes", (item, path): PartyShape => {
    exactKeys(item, ["code", "adults", "childAges"], path);
    if (!Array.isArray(item.childAges)) throw new Error(`${path}.childAges must be an array.`);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), adults: integer(item.adults, `${path}.adults`, 1, 12), childAges: item.childAges.map((age, index) => integer(age, `${path}.childAges[${index}]`, 0, 17)) };
  });
  if (!partyShapes.some((item) => item.childAges.length > 0)) throw new Error("Party shapes must include children.");
  const corporatePatterns = codedObjects(root.corporatePatterns, "manifest.corporatePatterns", (item, path): CorporatePattern => {
    exactKeys(item, ["code", "syntheticAccount", "stayNights"], path);
    const syntheticAccount = text(item.syntheticAccount, `${path}.syntheticAccount`);
    if (!syntheticAccount.startsWith("Fictional ")) throw new Error(`${path}.syntheticAccount must be explicitly fictional.`);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), syntheticAccount, stayNights: pair(item.stayNights, `${path}.stayNights`, 1, 365) };
  });
  const groupPatterns = codedObjects(root.groupPatterns, "manifest.groupPatterns", (item, path): GroupPattern => {
    exactKeys(item, ["code", "kind", "rooms", "authority", "targetPhase"], path);
    if (item.targetPhase !== 11) throw new Error(`${path}.targetPhase must be 11.`);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), kind: enumValue(item.kind, ["group", "block"] as const, `${path}.kind`), rooms: pair(item.rooms, `${path}.rooms`, 1, 500), authority: enumValue(item.authority, ["future_scenario_intent"] as const, `${path}.authority`), targetPhase: 11 };
  });
  const longStayPatterns = codedObjects(root.longStayPatterns, "manifest.longStayPatterns", (item, path): LongStayPattern => {
    exactKeys(item, ["code", "nights"], path);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), nights: pair(item.nights, `${path}.nights`, 7, 365) };
  });
  const seasons = codedObjects(root.seasons, "manifest.seasons", (item, path): Season => {
    exactKeys(item, ["code", "startMonthDay", "endMonthDay", "demandBasisPoints"], path);
    return { code: text(item.code, `${path}.code`, /^[A-Z][A-Z0-9_]*$/), startMonthDay: validMonthDay(item.startMonthDay, `${path}.startMonthDay`), endMonthDay: validMonthDay(item.endMonthDay, `${path}.endMonthDay`), demandBasisPoints: integer(item.demandBasisPoints, `${path}.demandBasisPoints`, 1_000, 20_000) };
  });
  const edgeCases = textList(root.edgeCases, "manifest.edgeCases");

  const authority = objectAt(root.authority, "manifest.authority");
  exactKeys(authority, ["taxFiscal", "groupsBlocks", "databaseAuthority", "importedReservations", "purpose"], "manifest.authority");
  if (authority.taxFiscal !== "pending_policy" || authority.groupsBlocks !== "future_phase" || authority.databaseAuthority !== false || authority.importedReservations !== false || authority.purpose !== "future_uat_input") throw new Error("Manifest authority markers must remain non-authoritative.");

  return { schemaVersion: 1, scenarioKey, synthetic: true, property: parsedProperty, roomClasses, roomTypes, boardPlans, policies, packages, sources, partyShapes, corporatePatterns, groupPatterns, longStayPatterns, seasons, edgeCases, authority: { taxFiscal: "pending_policy", groupsBlocks: "future_phase", databaseAuthority: false, importedReservations: false, purpose: "future_uat_input" } };
}

function assertNoSensitiveAuthority(value: unknown, path = "manifest"): void {
  if (typeof value === "string") {
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) || /\b(?:\d[ -]?){12,19}\b/.test(value)) throw new Error(`${path} contains contact or payment-like data.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveAuthority(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    if (/(?:email|phone|whatsapp|password|credential|secret|token|pan|cvv|cardnumber)/i.test(key)) throw new Error(`${path}.${key} is forbidden in synthetic scenario sources.`);
    if (typeof nested === "number" && /(?:tax|gst|hst|pst|fiscal|statutory|ratePercent|percentage)/i.test(key)) throw new Error(`${path}.${key} cannot assert a legal or fiscal numeric value.`);
    assertNoSensitiveAuthority(nested, `${path}.${key}`);
  }
}

function validMonthDay(value: unknown, path: string): string {
  const monthDay = text(value, path, /^\d{2}-\d{2}$/);
  const [monthText, dayText] = monthDay.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  const probe = new Date(Date.UTC(2000, month - 1, day));
  if (probe.getUTCMonth() + 1 !== month || probe.getUTCDate() !== day) throw new Error(`${path} is not a valid month-day.`);
  return monthDay;
}

type CivilDate = { year: number; month: number; day: number };

function parseLocalDate(value: string): CivilDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("startDate must use YYYY-MM-DD.");
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new Error("startDate is not a valid bounded calendar date.");
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function addCivilDays(start: CivilDate, dayCount: number): CivilDate {
  let { year, month, day } = start;
  for (let index = 0; index < dayCount; index += 1) {
    day += 1;
    if (day > daysInMonth(year, month)) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  return { year, month, day };
}

function formatCivilDate(date: CivilDate): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function localDateAt(start: CivilDate, dayIndex: number): string {
  return formatCivilDate(addCivilDays(start, dayIndex));
}

function weekday(date: CivilDate): number {
  let { year, month } = date;
  const day = date.day;
  if (month < 3) {
    month += 12;
    year -= 1;
  }
  const zeroBasedSaturday = (day + Math.floor((13 * (month + 1)) / 5) + year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400)) % 7;
  return (zeroBasedSaturday + 6) % 7;
}

function seasonFor(seasons: Season[], localDate: string): Season {
  const monthDay = localDate.slice(5);
  const season = seasons.find((candidate) => candidate.startMonthDay <= candidate.endMonthDay ? monthDay >= candidate.startMonthDay && monthDay <= candidate.endMonthDay : monthDay >= candidate.startMonthDay || monthDay <= candidate.endMonthDay);
  if (season === undefined) throw new Error(`No season covers local date ${localDate}.`);
  return season;
}

function deterministicNumber(sourceHash: string, seed: string, localDate: string): number {
  const digest = createHash("sha256").update(`${sourceHash}\u0000${SCENARIO_COMPILER_VERSION}\u0000${seed}\u0000${localDate}`, "utf8").digest();
  return digest.readUInt32BE(0);
}

function pick<T>(items: readonly T[], value: number): T {
  const selected = items[value % items.length];
  if (selected === undefined) throw new Error("Cannot select from an empty catalogue.");
  return selected;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalValue(nested)]));
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function sha256(bytes: string): string {
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

export function compileScenarioFoundation(input: unknown, startDate = DEFAULT_SCENARIO_START_DATE, dayCount = DEFAULT_SCENARIO_DAY_COUNT, seed = DEFAULT_SCENARIO_SEED): GeneratedScenario {
  const manifest = validateScenarioManifest(input);
  const start = parseLocalDate(startDate);
  integer(dayCount, "dayCount", 1, MAX_SCENARIO_DAY_COUNT);
  text(seed, "seed", /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
  const sourceHashSha256 = sha256(canonicalJson(manifest));
  const dailyDemandInputs = Array.from({ length: dayCount }, (_, dayIndex) => {
    const localDate = localDateAt(start, dayIndex);
    const season = seasonFor(manifest.seasons, localDate);
    const entropy = deterministicNumber(sourceHashSha256, seed, localDate);
    const demandBasisPoints = Math.max(1_000, Math.min(20_000, season.demandBasisPoints + (entropy % 2_001) - 1_000));
    return {
      localDate,
      dayIndex,
      weekday: weekday(addCivilDays(start, dayIndex)),
      seasonCode: season.code,
      demandBasisPoints,
      roomTypeCode: pick(manifest.roomTypes, entropy >>> 1).code,
      boardPlanCode: pick(manifest.boardPlans, entropy >>> 4).code,
      policyCode: pick(manifest.policies, entropy >>> 7).code,
      sourceCode: pick(manifest.sources, entropy >>> 10).code,
      partyShapeCode: pick(manifest.partyShapes, entropy >>> 13).code,
      stayNightsHint: 1 + ((entropy >>> 16) % 14),
    };
  });
  const { schemaVersion, scenarioKey, synthetic, property, authority, ...catalogue } = manifest;
  return { format: "yellow_scenario_foundation", compilerVersion: SCENARIO_COMPILER_VERSION, sourceVersion: schemaVersion, sourceHashSha256, scenarioKey, synthetic, seed, property, dateWindow: { startLocalDate: startDate, endLocalDateExclusive: localDateAt(start, dayCount), dayCount, timeZone: property.timeZone }, capability: authority, catalogue, dailyDemandInputs, disclaimer: "synthetic_future_uat_input_not_imported_reservation_or_production_data" };
}

export function validateOutputRoot(outputRoot: string): string {
  text(outputRoot, "outputRoot");
  const absolute = isAbsolute(outputRoot) || win32.isAbsolute(outputRoot);
  if (!absolute || outputRoot.split(/[\\/]/).includes("..")) throw new Error("outputRoot must be an absolute traversal-free directory.");
  const normalized = resolve(outputRoot);
  if (normalized === resolve(normalized, "..")) throw new Error("outputRoot cannot be a filesystem root.");
  return normalized;
}

export function scenarioOutputPath(outputRoot: string, scenarioKey: string, contentHash: string): string {
  const root = validateOutputRoot(outputRoot);
  text(scenarioKey, "scenarioKey", /^[a-z][a-z0-9-]{2,47}$/);
  text(contentHash, "contentHash", /^[a-f0-9]{64}$/);
  const destination = resolve(root, scenarioKey, `${contentHash}.json`);
  const boundary = relative(root, destination);
  if (boundary.startsWith("..") || isAbsolute(boundary)) throw new Error("Generated path escapes outputRoot.");
  return destination;
}

export function materializeScenarioFoundation(input: unknown, options: { startDate?: string; dayCount?: number; seed?: string; outputRoot?: string } = {}): { path: string; hash: string; bytes: string; wrote: boolean } {
  const generated = compileScenarioFoundation(input, options.startDate, options.dayCount, options.seed);
  const bytes = canonicalJson(generated);
  const hash = sha256(bytes);
  const path = scenarioOutputPath(options.outputRoot ?? DEFAULT_SCENARIO_OUTPUT_ROOT, generated.scenarioKey, hash);
  const root = validateOutputRoot(options.outputRoot ?? DEFAULT_SCENARIO_OUTPUT_ROOT);
  mkdirSync(root, { recursive: true });
  assertNotSymlinked(root, "outputRoot");
  mkdirSync(dirname(path), { recursive: true });
  assertNotSymlinked(dirname(path), "scenario output directory");
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== bytes) throw new Error(`Content-addressed output drift at ${path}.`);
    return { path, hash, bytes, wrote: false };
  }
  try {
    writeFileSync(path, bytes, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !existsSync(path) || readFileSync(path, "utf8") !== bytes) throw error;
    return { path, hash, bytes, wrote: false };
  }
  return { path, hash, bytes, wrote: true };
}

function assertNotSymlinked(path: string, label: string): void {
  const normalize = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
  if (normalize(realpathSync.native(path)) !== normalize(resolve(path))) throw new Error(`${label} cannot resolve through a symbolic link.`);
}

export function parseScenarioCliOptions(args: string[]): { scenarios: Array<"india" | "canada">; startDate: string; dayCount: number; seed: string; outputRoot?: string } {
  let scenarios: Array<"india" | "canada"> = ["india", "canada"];
  let startDate = DEFAULT_SCENARIO_START_DATE;
  let dayCount = DEFAULT_SCENARIO_DAY_COUNT;
  let seed = DEFAULT_SCENARIO_SEED;
  let outputRoot: string | undefined;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${flag ?? "argument"}.`);
    if (flag === undefined || seen.has(flag)) throw new Error(`Duplicate or missing argument ${flag ?? "argument"}.`);
    seen.add(flag);
    if (flag === "--scenario") scenarios = value === "both" ? ["india", "canada"] : [enumValue(value, ["india", "canada"] as const, "--scenario")];
    else if (flag === "--start-date") startDate = value;
    else if (flag === "--days") dayCount = Number(value);
    else if (flag === "--seed") seed = value;
    else if (flag === "--output-root") outputRoot = value;
    else throw new Error(`Unknown argument ${flag}.`);
  }
  parseLocalDate(startDate);
  integer(dayCount, "dayCount", 1, MAX_SCENARIO_DAY_COUNT);
  text(seed, "seed", /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
  if (outputRoot !== undefined) validateOutputRoot(outputRoot);
  return { scenarios, startDate, dayCount, seed, ...(outputRoot === undefined ? {} : { outputRoot }) };
}

if (import.meta.main) {
  const options = parseScenarioCliOptions(process.argv.slice(2));
  for (const scenario of options.scenarios) {
    const manifestPath = `fixtures/scenario-foundations/v1/${scenario}.json`;
    const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8")) as unknown;
    const result = materializeScenarioFoundation(manifest, options);
    console.log(`${result.wrote ? "wrote" : "unchanged"} ${result.path}`);
  }
}
