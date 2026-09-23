import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE = /^[A-Z0-9][A-Z0-9_.-]{0,31}$/;
const MAX_LABEL_BYTES = 120;
const MAX_COLLECTION = 512;

type JsonRecord = Record<string, unknown>;

export type CommercialNode = Readonly<{ code: string; label: string }>;
export type CommercialLeaf = Readonly<{
  code: string;
  label: string;
  reason: null | "MISSING_INPUT" | "NO_MAPPING";
}>;

export type CommercialTaxonomy = Readonly<{
  version: number;
  demandGroups: readonly Readonly<CommercialNode & { segments: readonly CommercialNode[] }>[];
  distributionGroups: readonly Readonly<CommercialNode & {
    sources: readonly Readonly<CommercialNode & { channelCodes: readonly string[] }>[];
  }>[];
  companies: readonly Readonly<CommercialNode & { partyId: string; parentCode: string | null }>[];
  roomClasses: readonly Readonly<CommercialNode & { unitTypeIds: readonly string[] }>[];
  marketMappings: readonly Readonly<{ marketCode: string; segmentCode: string }>[];
}>;

export type CommercialAttribution = Readonly<{
  version: number;
  demand: Readonly<{ group: CommercialLeaf; segment: CommercialLeaf }>;
  distribution: Readonly<{ group: CommercialLeaf; source: CommercialLeaf; channelCode: CommercialLeaf }>;
  account: Readonly<{ company: CommercialLeaf }>;
  product: Readonly<{ roomClass: CommercialLeaf; unitTypeId: CommercialLeaf }>;
}>;

export type CommercialAttributionInput = Readonly<{
  marketCode?: string | null;
  sourceCode?: string | null;
  channelCode?: string | null;
  bookerPartyId?: string | null;
  unitTypeId?: string | null;
}>;

function object(value: unknown, subject: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${subject} must be an object`);
  return value as JsonRecord;
}

function onlyKeys(value: JsonRecord, allowed: readonly string[], subject: string): void {
  const accepted = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !accepted.has(key));
  if (unknown.length > 0) throw new TypeError(`${subject} contains unsupported field ${unknown[0]}`);
}

function array(value: unknown, subject: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length > MAX_COLLECTION) throw new TypeError(`${subject} must be a bounded array`);
  return value;
}

function code(value: unknown, subject: string): string {
  if (typeof value !== "string") throw new TypeError(`${subject} must be a code`);
  const normalized = value.trim().toUpperCase();
  if (!CODE.test(normalized)) throw new TypeError(`${subject} must be a stable code`);
  if (normalized === "UNMAPPED") throw new TypeError(`${subject} uses reserved code UNMAPPED`);
  return normalized;
}

function label(value: unknown, subject: string): string {
  if (typeof value !== "string") throw new TypeError(`${subject} must be a label`);
  const normalized = value.normalize("NFC").trim();
  if (normalized.length === 0 || new TextEncoder().encode(normalized).length > MAX_LABEL_BYTES || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError(`${subject} must be bounded display text`);
  }
  return normalized;
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new TypeError(`${subject} must be a UUID`);
  return value;
}

function unique<T>(items: readonly T[], key: (item: T) => string, subject: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) throw new TypeError(`${subject} contains duplicate ${value}`);
    seen.add(value);
  }
}

function node(value: unknown, subject: string): CommercialNode {
  const row = object(value, subject);
  return Object.freeze({ code: code(row.code, `${subject}.code`), label: label(row.label, `${subject}.label`) });
}

export function parseCommercialTaxonomy(content: unknown, version: number): CommercialTaxonomy {
  if (!Number.isInteger(version) || version < 1) throw new TypeError("commercial taxonomy version must be positive");
  const root = object(content, "commercial taxonomy");
  onlyKeys(root, ["demandGroups", "distributionGroups", "companies", "roomClasses", "marketMappings"], "commercial taxonomy");
  const demandGroups = array(root.demandGroups, "demandGroups").map((value, groupIndex) => {
    const row = object(value, `demandGroups[${groupIndex}]`);
    onlyKeys(row, ["code", "label", "segments"], `demandGroups[${groupIndex}]`);
    const parent = node(row, `demandGroups[${groupIndex}]`);
    const segments = array(row.segments, `demandGroups[${groupIndex}].segments`).map((item, segmentIndex) => {
      const segment = object(item, `demandGroups[${groupIndex}].segments[${segmentIndex}]`);
      onlyKeys(segment, ["code", "label"], `demandGroups[${groupIndex}].segments[${segmentIndex}]`);
      return node(segment, `demandGroups[${groupIndex}].segments[${segmentIndex}]`);
    });
    unique(segments, (item) => item.code, "market segments");
    return Object.freeze({ ...parent, segments: Object.freeze(segments) });
  });
  unique(demandGroups, (item) => item.code, "market segment groups");
  unique(demandGroups.flatMap((group) => group.segments), (item) => item.code, "market segments across groups");

  const distributionGroups = array(root.distributionGroups, "distributionGroups").map((value, groupIndex) => {
    const row = object(value, `distributionGroups[${groupIndex}]`);
    onlyKeys(row, ["code", "label", "sources"], `distributionGroups[${groupIndex}]`);
    const parent = node(row, `distributionGroups[${groupIndex}]`);
    const sources = array(row.sources, `distributionGroups[${groupIndex}].sources`).map((item, sourceIndex) => {
      const source = object(item, `distributionGroups[${groupIndex}].sources[${sourceIndex}]`);
      onlyKeys(source, ["code", "label", "channelCodes"], `distributionGroups[${groupIndex}].sources[${sourceIndex}]`);
      const base = node(source, `distributionGroups[${groupIndex}].sources[${sourceIndex}]`);
      const channelCodes = array(source.channelCodes, `source ${base.code}.channelCodes`).map((channel, index) =>
        code(channel, `source ${base.code}.channelCodes[${index}]`));
      unique(channelCodes, (item) => item, `source ${base.code} channels`);
      return Object.freeze({ ...base, channelCodes: Object.freeze(channelCodes) });
    });
    unique(sources, (item) => item.code, "distribution sources");
    return Object.freeze({ ...parent, sources: Object.freeze(sources) });
  });
  unique(distributionGroups, (item) => item.code, "distribution groups");
  unique(distributionGroups.flatMap((group) => group.sources), (item) => item.code, "distribution sources across groups");
  unique(distributionGroups.flatMap((group) => group.sources.flatMap((source) => source.channelCodes)),
    (item) => item, "channel mappings");

  const companies = array(root.companies, "companies").map((value, index) => {
    const row = object(value, `companies[${index}]`);
    onlyKeys(row, ["code", "label", "partyId", "parentCode"], `companies[${index}]`);
    const base = node(row, `companies[${index}]`);
    return Object.freeze({ ...base, partyId: uuid(row.partyId, `companies[${index}].partyId`),
      parentCode: row.parentCode === null || row.parentCode === undefined ? null : code(row.parentCode, `companies[${index}].parentCode`) });
  });
  unique(companies, (item) => item.code, "company codes");
  unique(companies, (item) => item.partyId, "company party mappings");
  const companyCodes = new Set(companies.map((item) => item.code));
  for (const company of companies) if (company.parentCode !== null && !companyCodes.has(company.parentCode)) {
    throw new TypeError(`company ${company.code} has unknown parent ${company.parentCode}`);
  }
  for (const company of companies) {
    const visited = new Set<string>([company.code]);
    let parentCode = company.parentCode;
    while (parentCode !== null) {
      if (visited.has(parentCode)) throw new TypeError(`company hierarchy contains a cycle at ${parentCode}`);
      visited.add(parentCode);
      parentCode = companies.find((candidate) => candidate.code === parentCode)?.parentCode ?? null;
    }
  }

  const roomClasses = array(root.roomClasses, "roomClasses").map((value, index) => {
    const row = object(value, `roomClasses[${index}]`);
    onlyKeys(row, ["code", "label", "unitTypeIds"], `roomClasses[${index}]`);
    const base = node(row, `roomClasses[${index}]`);
    const unitTypeIds = array(row.unitTypeIds, `roomClasses[${index}].unitTypeIds`).map((item, unitIndex) =>
      uuid(item, `roomClasses[${index}].unitTypeIds[${unitIndex}]`));
    unique(unitTypeIds, (item) => item, `room class ${base.code} unit types`);
    return Object.freeze({ ...base, unitTypeIds: Object.freeze(unitTypeIds) });
  });
  unique(roomClasses, (item) => item.code, "room class codes");
  unique(roomClasses.flatMap((item) => item.unitTypeIds), (item) => item, "unit type mappings across classes");

  const segmentCodes = new Set(demandGroups.flatMap((group) => group.segments.map((segment) => segment.code)));
  const marketMappings = array(root.marketMappings, "marketMappings").map((value, index) => {
    const row = object(value, `marketMappings[${index}]`);
    onlyKeys(row, ["marketCode", "segmentCode"], `marketMappings[${index}]`);
    const mapping = Object.freeze({ marketCode: code(row.marketCode, `marketMappings[${index}].marketCode`),
      segmentCode: code(row.segmentCode, `marketMappings[${index}].segmentCode`) });
    if (!segmentCodes.has(mapping.segmentCode)) throw new TypeError(`market mapping ${mapping.marketCode} has unknown segment ${mapping.segmentCode}`);
    return mapping;
  });
  unique(marketMappings, (item) => item.marketCode, "market-code mappings");

  return Object.freeze({ version, demandGroups: Object.freeze(demandGroups), distributionGroups: Object.freeze(distributionGroups),
    companies: Object.freeze(companies), roomClasses: Object.freeze(roomClasses), marketMappings: Object.freeze(marketMappings) });
}

function normalizedInput(value: unknown): Readonly<{ present: boolean; code: string | null }> {
  if (value === null || value === undefined || value === "") return Object.freeze({ present: false, code: null });
  if (typeof value !== "string") return Object.freeze({ present: true, code: null });
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) return Object.freeze({ present: false, code: null });
  return Object.freeze({ present: true, code: CODE.test(normalized) ? normalized : null });
}

function unmapped(inputPresent: boolean): CommercialLeaf {
  return Object.freeze({ code: "UNMAPPED", label: "Unmapped", reason: inputPresent ? "NO_MAPPING" : "MISSING_INPUT" });
}

function leaf(item: CommercialNode): CommercialLeaf {
  return Object.freeze({ code: item.code, label: item.label, reason: null });
}

export function resolveCommercialAttribution(taxonomy: CommercialTaxonomy, input: CommercialAttributionInput): CommercialAttribution {
  const marketInput = normalizedInput(input.marketCode);
  const sourceInput = normalizedInput(input.sourceCode);
  const channelInput = normalizedInput(input.channelCode);
  const marketMapping = taxonomy.marketMappings.find((item) => item.marketCode === marketInput.code);
  const segment = marketMapping === undefined ? undefined : taxonomy.demandGroups.flatMap((group) => group.segments)
    .find((item) => item.code === marketMapping.segmentCode);
  const demandGroup = segment === undefined ? undefined : taxonomy.demandGroups.find((group) => group.segments.some((item) => item.code === segment.code));

  if (sourceInput.present && channelInput.present && (sourceInput.code === null || channelInput.code === null)) {
    throw new TypeError("source and channel evidence must both be valid configured codes");
  }
  const bySource = sourceInput.code === null ? undefined : taxonomy.distributionGroups.flatMap((group) => group.sources)
    .find((item) => item.code === sourceInput.code);
  const byChannel = channelInput.code === null ? undefined : taxonomy.distributionGroups.flatMap((group) => group.sources)
    .find((item) => item.channelCodes.includes(channelInput.code as string));
  if (sourceInput.code !== null && bySource === undefined) {
    if (byChannel !== undefined) throw new TypeError(`source ${sourceInput.code} is not configured for channel ${channelInput.code}`);
  }
  if (channelInput.code !== null && byChannel === undefined) {
    if (bySource !== undefined) throw new TypeError(`channel ${channelInput.code} is not configured for source ${sourceInput.code}`);
  }
  if (bySource !== undefined && byChannel !== undefined && bySource.code !== byChannel.code) {
    throw new TypeError(`source ${bySource.code} conflicts with channel ${channelInput.code}`);
  }
  const source = sourceInput.present && channelInput.present
    ? (bySource !== undefined && byChannel !== undefined ? bySource : undefined)
    : bySource ?? byChannel;
  const distributionGroup = source === undefined ? undefined : taxonomy.distributionGroups.find((group) => group.sources.some((item) => item.code === source.code));

  const partyId = input.bookerPartyId ?? null;
  const company = partyId !== null && UUID.test(partyId) ? taxonomy.companies.find((item) => item.partyId === partyId) : undefined;
  const unitTypeId = input.unitTypeId ?? null;
  const roomClass = unitTypeId !== null && UUID.test(unitTypeId) ? taxonomy.roomClasses.find((item) => item.unitTypeIds.includes(unitTypeId)) : undefined;

  return Object.freeze({
    version: taxonomy.version,
    demand: Object.freeze({ group: demandGroup ? leaf(demandGroup) : unmapped(marketInput.present),
      segment: segment ? leaf(segment) : unmapped(marketInput.present) }),
    distribution: Object.freeze({ group: distributionGroup ? leaf(distributionGroup) : unmapped(sourceInput.present || channelInput.present),
      source: source ? leaf(source) : unmapped(sourceInput.present || channelInput.present),
      channelCode: !channelInput.present ? unmapped(false) : byChannel === undefined || channelInput.code === null
        ? unmapped(true) : Object.freeze({ code: channelInput.code, label: channelInput.code, reason: null }) }),
    account: Object.freeze({ company: company ? leaf(company) : unmapped(partyId !== null) }),
    product: Object.freeze({ roomClass: roomClass ? leaf(roomClass) : unmapped(unitTypeId !== null),
      unitTypeId: unitTypeId !== null && UUID.test(unitTypeId) && roomClass !== undefined
        ? Object.freeze({ code: unitTypeId, label: unitTypeId, reason: null }) : unmapped(unitTypeId !== null) }),
  });
}

type ExtensionRow = Readonly<{ version: number; content: unknown }>;

export class CommercialTaxonomyService {
  async load(tx: Tx, input: Readonly<{ tenantId: string; propertyNode: string }>): Promise<CommercialTaxonomy> {
    if (!UUID.test(input.tenantId) || !UUID.test(input.propertyNode)) throw new TypeError("tenantId and propertyNode must be UUIDs");
    const key = `property:${input.propertyNode}`;
    const rows = await tx<ExtensionRow[]>`
      SELECT version, content
      FROM extension
      WHERE tenant_id=${input.tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND type='commercial_attribution'
        AND key=${key}
        AND status='active'
        AND effective @> transaction_timestamp()
      ORDER BY version DESC
      LIMIT 2`;
    if (rows.length === 0) throw new Error("Active commercial attribution configuration was not found");
    if (rows.length !== 1 || !rows[0]) throw new Error("Commercial attribution configuration has overlapping active versions");
    return parseCommercialTaxonomy(rows[0].content, rows[0].version);
  }
}
