import { types as utilTypes } from "node:util";

import {
  deriveIndiaGstAccommodationComponentFamily,
  type IndiaGstAccommodationComponentFamilyResult,
} from "./india-gst-accommodation-component-family";
import type { IndiaGstAccommodationHistoricalResolutionResult } from "./india-gst-accommodation-historical-resolution";
import { deriveIndiaGstAccommodationRateChangeDate } from "./india-gst-accommodation-rate-change-date";
import type { IndiaGstAccommodationSupplyNatureResult } from "./india-gst-accommodation-supply-nature";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/;
const STATE_CODES = new Set(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "26", "27", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38"]);
const UTGST_CODES = new Set(["04", "26", "31", "35", "38"]);

const INPUT_KEYS = ["tenantId", "historicalResolution", "supplyNature", "componentFamily"] as const;
const RESOLUTION_KEYS = ["property", "businessDay", "assignment", "selectedExtension", "rateVersionPair", "evidenceHash"] as const;
const PROPERTY_KEYS = ["propertyNode", "propertyTimezone"] as const;
const DAY_KEYS = ["businessDate", "fromInstant", "toInstant"] as const;
const ASSIGNMENT_KEYS = ["jurisdictionKey", "effectiveFrom", "effectiveTo"] as const;
const VERSION_KEYS = ["extensionId", "key", "version", "status", "effectiveFromInstant", "effectiveToInstant", "content", "contentHash", "gstRoomSlabs"] as const;
const FAMILY_KEYS = ["propertyNode", "reservationId", "folioId", "supplyDate", "jurisdiction", "supplierRegistrationId", "placeOfSupplyStateCode", "supplyNature", "determinationBasis", "sezDirection", "componentFamily", "legalSources", "predecessorCandidateHash", "evidenceHash"] as const;
const JURISDICTION_KEYS = ["extensionId", "key", "version", "contentHash"] as const;
const LEGAL_KEYS = ["supplyNature", "componentFamily"] as const;
const SLAB_KEYS = ["uptoMinor", "rate", "itcEligible"] as const;

type RecordValue = Record<string, unknown>;
type ComponentFamily = "igst" | "cgst_sgst" | "cgst_utgst";

export interface IndiaGstAccommodationLevyInputBundleInput {
  readonly tenantId: string;
  readonly historicalResolution: IndiaGstAccommodationHistoricalResolutionResult;
  readonly supplyNature: IndiaGstAccommodationSupplyNatureResult;
  readonly componentFamily: IndiaGstAccommodationComponentFamilyResult;
}

export interface IndiaGstAccommodationLevyInputBundleResult {
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly supplyDate: string;
  readonly selectedVersion: Readonly<{
    readonly extensionId: string;
    readonly key: "in-gst-lodging";
    readonly version: 1 | 2;
    readonly status: "retired" | "active";
    readonly effectiveFromInstant: string;
    readonly effectiveToInstant: string | null;
    readonly contentHash: string;
  }>;
  readonly gstRoomSlabs: readonly [
    Readonly<{ readonly uptoMinor: 750000; readonly rate: 0.12 | 0.05; readonly itcEligible: boolean }>,
    Readonly<{ readonly uptoMinor: null; readonly rate: 0.18; readonly itcEligible: true }>,
  ];
  readonly componentFamily: ComponentFamily;
  readonly legalSources: Readonly<{
    readonly supplyNature: "IGST_ACT_8_2" | "IGST_ACT_7_3" | "IGST_ACT_7_5_B";
    readonly componentFamily: "IGST_ACT_5_1" | "CGST_ACT_9_1_AND_SGST_ACT" | "CGST_ACT_9_1_AND_UTGST_ACT_7_1";
  }>;
  readonly predecessorHashes: Readonly<{
    readonly historicalResolution: string;
    readonly rateVersionPair: string;
    readonly componentFamily: string;
    readonly supplyNatureCandidate: string;
  }>;
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationLevyInputBundleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationLevyInputBundleValidationError";
  }
}

function fail(message: string): never { throw new IndiaGstAccommodationLevyInputBundleValidationError(message); }

function exact(value: unknown, expected: readonly string[], subject: string, frozen: boolean): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      || (frozen && !Object.isFrozen(value))) return fail(`${subject} must be an exact ${frozen ? "frozen " : ""}plain object`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined
        || descriptor.enumerable !== true || !("value" in descriptor)
        || (frozen && (descriptor.configurable !== false || descriptor.writable !== false)))) return fail(`${subject} shape is invalid`);
  return value as RecordValue;
}

function frozenGraph(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  if (utilTypes.isProxy(value) || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) fail("predecessor evidence must be deeply frozen and symbol-free");
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) fail("predecessor evidence must contain plain objects only");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "length" && Array.isArray(value)) continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) fail(`predecessor evidence field ${key} is invalid`);
    frozenGraph(descriptor.value, seen);
  }
}

function uuid(value: unknown, subject: string): string { return typeof value === "string" && UUID.test(value) ? value : fail(`${subject} must be a canonical UUID`); }
function hash(value: unknown, subject: string): string { return typeof value === "string" && SHA256.test(value) ? value : fail(`${subject} must be a canonical SHA-256`); }

function date(value: unknown, subject: string): string {
  if (typeof value !== "string") return fail(`${subject} is invalid`);
  const match = DATE.exec(value);
  if (!match) return fail(`${subject} is invalid`);
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0) ? value : fail(`${subject} is invalid`);
}

function instant(value: unknown, subject: string): string {
  if (typeof value !== "string") return fail(`${subject} is invalid`);
  const match = INSTANT.exec(value);
  if (!match) return fail(`${subject} is invalid`);
  date(`${match[1]}-${match[2]}-${match[3]}`, subject);
  return Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6]) <= 59 ? value : fail(`${subject} is invalid`);
}

function canonicalJson(value: unknown, ancestors = new Set<object>(), depth = 0): string {
  if (depth > 64) return fail("levy evidence is too deeply nested");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(Object.is(value, -0) ? 0 : value) : fail("levy evidence contains a non-finite number");
  if (typeof value !== "object" || utilTypes.isProxy(value) || ancestors.has(value)) return fail("levy evidence is not canonical JSON");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Object.keys(value);
      const names = Object.getOwnPropertyNames(value);
      if (Object.getOwnPropertySymbols(value).length !== 0 || keys.length !== value.length || names.length !== value.length + 1
          || names[value.length] !== "length" || keys.some((key, index) => key !== String(index))) return fail("levy evidence arrays must be exact and dense");
      return `[${value.map((item) => canonicalJson(item, ancestors, depth + 1)).join(",")}]`;
    }
    if ((Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
        || Object.getOwnPropertySymbols(value).length !== 0 || Object.getOwnPropertyNames(value).length !== Object.keys(value).length) return fail("levy evidence objects must be exact plain records");
    return `{${Object.keys(value).sort().map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor)) return fail("levy evidence objects must contain data fields only");
      return `${JSON.stringify(key)}:${canonicalJson(descriptor.value, ancestors, depth + 1)}`;
    }).join(",")}}`;
  } finally { ancestors.delete(value); }
}

function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(canonicalJson(value)).digest("hex"); }
function insertionDigest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }

function resolution(raw: unknown, tenantId: string): Readonly<{ propertyNode: string; supplyDate: string; selected: RecordValue; pairHash: string; resolutionHash: string }> {
  frozenGraph(raw);
  const value = exact(raw, RESOLUTION_KEYS, "historical resolution", true);
  const property = exact(value.property, PROPERTY_KEYS, "historical property", true);
  const propertyNode = uuid(property.propertyNode, "historical property node");
  if (typeof property.propertyTimezone !== "string" || property.propertyTimezone.length === 0 || property.propertyTimezone !== property.propertyTimezone.trim()) fail("historical property timezone is invalid");
  const day = exact(value.businessDay, DAY_KEYS, "historical business day", true);
  const supplyDate = date(day.businessDate, "historical business date");
  const fromInstant = instant(day.fromInstant, "historical business-day lower bound");
  const toInstant = instant(day.toInstant, "historical business-day upper bound");
  if (fromInstant >= toInstant) fail("historical business-day bounds are invalid");
  const assignment = exact(value.assignment, ASSIGNMENT_KEYS, "historical assignment", true);
  if (assignment.jurisdictionKey !== "in-gst-lodging") fail("historical assignment jurisdiction is invalid");
  if (assignment.effectiveFrom !== null && date(assignment.effectiveFrom, "assignment lower date") > supplyDate) fail("historical assignment excludes the supply date");
  if (assignment.effectiveTo !== null && date(assignment.effectiveTo, "assignment upper date") <= supplyDate) fail("historical assignment excludes the supply date");

  let pairHash: string;
  try { pairHash = deriveIndiaGstAccommodationRateChangeDate({ tenantId, rateVersionPair: value.rateVersionPair as never }).pairEvidenceHash; }
  catch { return fail("historical rate-version pair is invalid"); }
  const selected = exact(value.selectedExtension, VERSION_KEYS, "selected rate version", true);
  const pair = value.rateVersionPair as RecordValue;
  const containing = [pair.predecessor, pair.successor].filter((candidate) => {
    const member = candidate as RecordValue;
    return typeof member.effectiveFromInstant === "string" && member.effectiveFromInstant <= fromInstant
      && (member.effectiveToInstant === null || (typeof member.effectiveToInstant === "string" && member.effectiveToInstant >= toInstant));
  });
  if (containing.length !== 1 || canonicalJson(containing[0]) !== canonicalJson(selected)) fail("selected rate version is not the sole pair member containing the business day");
  const expectedResolutionHash = digest({ tenantId, property: value.property, businessDay: value.businessDay, assignment: value.assignment, selectedExtension: value.selectedExtension, rateVersionPair: value.rateVersionPair });
  const resolutionHash = hash(value.evidenceHash, "historical resolution evidence hash");
  if (resolutionHash !== expectedResolutionHash) fail("historical resolution hash does not bind its evidence");
  return Object.freeze({ propertyNode, supplyDate, selected, pairHash, resolutionHash });
}

function family(raw: unknown, tenantId: string): RecordValue {
  frozenGraph(raw);
  const value = exact(raw, FAMILY_KEYS, "component-family evidence", true);
  uuid(value.propertyNode, "component-family property node"); uuid(value.reservationId, "reservation id"); uuid(value.folioId, "folio id"); date(value.supplyDate, "component-family supply date");
  const jurisdiction = exact(value.jurisdiction, JURISDICTION_KEYS, "component-family jurisdiction", true);
  uuid(jurisdiction.extensionId, "jurisdiction extension id"); hash(jurisdiction.contentHash, "jurisdiction content hash");
  if (jurisdiction.key !== "in-gst-lodging" || typeof jurisdiction.version !== "string" || !/^[1-9][0-9]*$/.test(jurisdiction.version)) fail("component-family jurisdiction identity is invalid");
  const legal = exact(value.legalSources, LEGAL_KEYS, "component-family legal sources", true);
  const family = value.componentFamily as ComponentFamily;
  const nature = value.supplyNature;
  const basis = value.determinationBasis;
  const direction = value.sezDirection;
  const pos = value.placeOfSupplyStateCode;
  uuid(value.supplierRegistrationId, "supplier registration id");
  if (typeof pos !== "string" || !STATE_CODES.has(pos)
      || !(["igst", "cgst_sgst", "cgst_utgst"] as const).includes(family)
      || !["intra_state", "inter_state"].includes(String(nature))
      || !["ordinary_registered_state_comparison", "sez_override"].includes(String(basis))
      || !["none", "to_sez", "by_sez", "to_and_by_sez"].includes(String(direction))
      || !["IGST_ACT_8_2", "IGST_ACT_7_3", "IGST_ACT_7_5_B"].includes(String(legal.supplyNature))
      || !["IGST_ACT_5_1", "CGST_ACT_9_1_AND_SGST_ACT", "CGST_ACT_9_1_AND_UTGST_ACT_7_1"].includes(String(legal.componentFamily))) fail("component-family statutory evidence is invalid");
  if (nature === "inter_state") {
    if (family !== "igst" || legal.componentFamily !== "IGST_ACT_5_1"
        || (legal.supplyNature !== "IGST_ACT_7_3" && legal.supplyNature !== "IGST_ACT_7_5_B")
        || (basis === "ordinary_registered_state_comparison" && (direction !== "none" || legal.supplyNature !== "IGST_ACT_7_3"))
        || (basis === "sez_override" && (direction === "none" || legal.supplyNature !== "IGST_ACT_7_5_B"))) fail("inter-state component-family semantics are inconsistent");
  } else if (basis !== "ordinary_registered_state_comparison" || direction !== "none" || legal.supplyNature !== "IGST_ACT_8_2"
      || (UTGST_CODES.has(pos) && (family !== "cgst_utgst" || legal.componentFamily !== "CGST_ACT_9_1_AND_UTGST_ACT_7_1"))
      || (!UTGST_CODES.has(pos) && (family !== "cgst_sgst" || legal.componentFamily !== "CGST_ACT_9_1_AND_SGST_ACT"))) fail("intra-state component-family semantics are inconsistent");
  hash(value.predecessorCandidateHash, "component-family predecessor hash");
  const evidenceHash = hash(value.evidenceHash, "component-family evidence hash");
  const { evidenceHash: _omitted, ...body } = value;
  if (evidenceHash !== insertionDigest({ tenantId, ...body })) fail("component-family evidence hash does not bind its evidence");
  return value;
}

export function deriveIndiaGstAccommodationLevyInputBundle(raw: IndiaGstAccommodationLevyInputBundleInput): IndiaGstAccommodationLevyInputBundleResult {
  const input = exact(raw, INPUT_KEYS, "levy-input bundle input", false);
  const tenantId = uuid(input.tenantId, "tenant id");
  const historical = resolution(input.historicalResolution, tenantId);
  let rederivedFamily: IndiaGstAccommodationComponentFamilyResult;
  try { rederivedFamily = deriveIndiaGstAccommodationComponentFamily({ tenantId, supplyNature: input.supplyNature as IndiaGstAccommodationSupplyNatureResult }); }
  catch { return fail("supply-nature evidence cannot derive the component family"); }
  if (JSON.stringify(rederivedFamily) !== JSON.stringify(input.componentFamily)) fail("component-family evidence does not exactly match its supply-nature ancestry");
  const component = family(input.componentFamily, tenantId);
  const selected = historical.selected;
  const jurisdiction = component.jurisdiction as RecordValue;
  if (component.propertyNode !== historical.propertyNode || component.supplyDate !== historical.supplyDate
      || jurisdiction.extensionId !== selected.extensionId || jurisdiction.key !== selected.key
      || jurisdiction.version !== String(selected.version) || jurisdiction.contentHash !== selected.contentHash) fail("historical resolution and component family do not identify the same levy input");
  const slabs = selected.gstRoomSlabs as readonly unknown[];
  if (!Array.isArray(slabs) || slabs.length !== 2) fail("selected GST_ROOM schedule is invalid");
  exact(slabs[0], SLAB_KEYS, "selected lower GST_ROOM slab", true);
  exact(slabs[1], SLAB_KEYS, "selected upper GST_ROOM slab", true);
  const selectedVersion = Object.freeze({ extensionId: selected.extensionId as string, key: "in-gst-lodging" as const, version: selected.version as 1 | 2, status: selected.status as "retired" | "active", effectiveFromInstant: selected.effectiveFromInstant as string, effectiveToInstant: selected.effectiveToInstant as string | null, contentHash: selected.contentHash as string });
  const predecessorHashes = Object.freeze({ historicalResolution: historical.resolutionHash, rateVersionPair: historical.pairHash, componentFamily: component.evidenceHash as string, supplyNatureCandidate: component.predecessorCandidateHash as string });
  const body = Object.freeze({ propertyNode: historical.propertyNode, reservationId: component.reservationId as string, folioId: component.folioId as string, supplyDate: historical.supplyDate, selectedVersion, gstRoomSlabs: slabs as unknown as IndiaGstAccommodationLevyInputBundleResult["gstRoomSlabs"], componentFamily: component.componentFamily as ComponentFamily, legalSources: component.legalSources as IndiaGstAccommodationLevyInputBundleResult["legalSources"], predecessorHashes });
  return Object.freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}
