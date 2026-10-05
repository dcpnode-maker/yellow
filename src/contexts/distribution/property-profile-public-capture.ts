import {
  PROPERTY_PROFILE_EVIDENCE_LIMITS,
  canonicalPropertyAmenityKey,
  isValidUtcEvidenceInstant,
  safePublicHttpsUrl,
  snapshotUntrustedJsonInput,
  type PropertyAmenityEvidence,
  type PropertyImageEvidence,
  type PropertyListingIdentity,
  type PropertyProfileObservation,
} from "./property-profile-candidate-evidence";

export const PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS = Object.freeze({
  maxUtf8Bytes: 2_097_152,
  maxNodes: 128,
  maxLodgingEvidence: 64,
  maxStrings: 64,
  maxStringCharacters: 2_048,
  maxScriptBlocks: 64,
  maxNestingDepth: 8,
  maxVisitedValues: 4_096,
  maxIssues: 64,
} as const);

export interface PublicPropertyCaptureInput {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly httpStatus: number;
  /** CLI capture envelope spelling; accepted as an alias for httpStatus. */
  readonly status?: number;
  readonly capturedAt: string;
  readonly body: string;
  /** Optional source namespace, never Yellow ownership or an authenticated account. */
  readonly provider?: string;
  readonly accountNamespace?: string | null;
}

export interface PublicPropertyCaptureIssue {
  readonly code:
    | "invalid-capture"
    | "capture-too-large"
    | "invalid-url"
    | "invalid-capture-time"
    | "jsonld-script-limit"
    | "invalid-jsonld"
    | "node-limit"
    | "nesting-limit"
    | "evidence-limit"
    | "issue-limit"
    | "missing-lodging-name"
    | "missing-stable-identity"
    | "unresolved-short-link"
    | "no-lodging-node";
  readonly path: string;
}

export interface PublicPropertyCaptureResult {
  readonly observations: readonly PropertyProfileObservation[];
  readonly issues: readonly PublicPropertyCaptureIssue[];
  readonly contentSha256: string;
  readonly utf8Bytes: number | null;
}

function failedCapture(code: PublicPropertyCaptureIssue["code"], path: string): PublicPropertyCaptureResult {
  return Object.freeze({
    observations: Object.freeze([]),
    issues: Object.freeze([Object.freeze({ code, path })]),
    contentSha256: "",
    utf8Bytes: null,
  });
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const LODGING_TYPES = new Set([
  "Hotel", "Motel", "Hostel", "Resort", "BedAndBreakfast", "LodgingBusiness",
  "TouristAccommodation", "VacationRental", "Apartment", "Residence", "ExtendedStayHotel",
]);
const LODGING_TYPE_URIS = new Set([...LODGING_TYPES].map(type => "https://schema.org/" + type));
const SHORT_HOSTS = new Set([
  "goo.gl", "maps.app.goo.gl", "g.page", "share.google", "bit.ly", "tinyurl.com",
  "t.co", "ow.ly", "buff.ly",
]);

function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function boundedText(value: unknown, maximum = PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxStringCharacters): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maximum && !CONTROL.test(text) ? text : null;
}

function parseInstant(value: unknown): string | null {
  return isValidUtcEvidenceInstant(value) ? value : null;
}

function publicUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length > PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxStringCharacters) return null;
  return safePublicHttpsUrl(value);
}

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/u, "");
}

/** Safe public capture URL for receipts; retains exact allowed URL bytes. */
export function sanitizePublicCaptureUrl(value: unknown): string | null {
  return typeof value === "string" && publicUrl(value) !== null ? value : null;
}

function providerIdentity(uri: string, accountNamespace: string | null = null): PropertyListingIdentity | null {
  const url = publicUrl(uri);
  if (!url || SHORT_HOSTS.has(hostOf(url))) return null;
  return Object.freeze({ provider: hostOf(url), accountNamespace, externalId: uri });
}

function sourceIdentity(node: Record<string, unknown>, finalUrl: URL, exactFinalUrl: string, contentSha256: string, provider: string, accountNamespace: string | null, path: string): PropertyListingIdentity | null {
  const nodeId = typeof node["@id"] === "string" ? node["@id"] : null;
  const idUrl = nodeId === null ? null : publicUrl(nodeId);
  if (nodeId !== null && idUrl && !SHORT_HOSTS.has(hostOf(idUrl))) {
    return Object.freeze({ provider, accountNamespace, externalId: nodeId });
  }
  if (SHORT_HOSTS.has(hostOf(finalUrl))) return null;
  return Object.freeze({
    provider,
    accountNamespace,
    externalId: JSON.stringify([exactFinalUrl, contentSha256, path]),
  });
}

function schemaType(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === "string");
}

function schemaContext(value: unknown): boolean {
  const contexts = Array.isArray(value) ? value : [value];
  return contexts.length > 0 && contexts.every(item => item === "https://schema.org" || item === "https://schema.org/");
}

function lodgingNode(value: Record<string, unknown>, inheritedSchemaContext: boolean): boolean {
  const hasOwnContext = value["@context"] !== undefined;
  const trustedContext = hasOwnContext ? schemaContext(value["@context"]) : inheritedSchemaContext;
  if (!trustedContext) return false;
  return schemaType(value["@type"]).some(item => LODGING_TYPES.has(item) || LODGING_TYPE_URIS.has(item));
}

function textValue(value: unknown): string | null {
  return boundedText(value);
}

function addressValue(value: unknown): string | null {
  const direct = boundedText(value);
  if (direct) return direct;
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (!isPlain(candidate)) continue;
    const parts = ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"]
      .map(key => boundedText(candidate[key])).filter((part): part is string => part !== null);
    if (parts.length > 0) {
      const joined = parts.join(", ");
      return joined.length <= PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxStringCharacters ? joined : joined.slice(0, PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxStringCharacters);
    }
  }
  return null;
}

function positiveDimension(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 100_000 ? value : null;
}

function extractImages(value: unknown, path: string, issues: PublicPropertyCaptureIssue[]): PropertyImageEvidence[] {
  const items = Array.isArray(value) ? value : [value];
  const result: PropertyImageEvidence[] = [];
  for (let index = 0; index < items.length && result.length < PROPERTY_PROFILE_EVIDENCE_LIMITS.maxImagesPerObservation; index += 1) {
    const item = items[index];
    const itemPath = path + "[" + index + "]";
    let imageUrl: unknown = item;
    let width: number | null = null;
    let height: number | null = null;
    if (isPlain(item)) {
      imageUrl = item.contentUrl ?? item.url ?? item["@id"];
      width = positiveDimension(item.width);
      height = positiveDimension(item.height);
    }
    const safe = publicUrl(imageUrl);
    if (!safe) {
      if (imageUrl !== null && imageUrl !== undefined) addIssue(issues, { code: "invalid-url", path: itemPath });
      continue;
    }
    result.push(Object.freeze({
      url: typeof imageUrl === "string" ? imageUrl : safe.toString(),
      width, height, rightsStatus: "unknown", sourcePath: itemPath,
    }));
  }
  return result;
}

function extractAmenities(value: unknown, path: string): PropertyAmenityEvidence[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const result: PropertyAmenityEvidence[] = [];
  for (let index = 0; index < items.length && result.length < PROPERTY_PROFILE_EVIDENCE_LIMITS.maxAmenitiesPerObservation; index += 1) {
    const item = items[index];
    const itemPath = path + "[" + index + "]";
    if (typeof item === "string") {
      const name = boundedText(item);
      if (name) result.push(Object.freeze({
        canonicalKey: canonicalPropertyAmenityKey(name), name, value: null, scope: "unknown", sourcePath: itemPath,
      }));
    } else if (isPlain(item)) {
      const name = boundedText(item.name);
      if (!name) continue;
      const rawValue = item.value;
      result.push(Object.freeze({
        canonicalKey: canonicalPropertyAmenityKey(name),
        name,
        value: rawValue === true ? true : rawValue === false ? false : null,
        scope: "unknown",
        sourcePath: itemPath + ".value",
      }));
    }
  }
  return result;
}

function explicitAliases(node: Record<string, unknown>, accountNamespace: string | null, issues: PublicPropertyCaptureIssue[], path: string): PropertyListingIdentity[] {
  const aliases: PropertyListingIdentity[] = [];
  const sameAs = Array.isArray(node.sameAs) ? node.sameAs : node.sameAs === undefined ? [] : [node.sameAs];
  for (let index = 0; index < sameAs.length && aliases.length < PROPERTY_PROFILE_EVIDENCE_LIMITS.maxAliasesPerObservation; index += 1) {
    const raw = sameAs[index];
    const candidate = typeof raw === "string" ? raw : isPlain(raw) ? raw["@id"] : null;
    if (typeof candidate !== "string") continue;
    const url = publicUrl(candidate);
    if (!url) { addIssue(issues, { code: "invalid-url", path: path + ".sameAs[" + index + "]" }); continue; }
    if (SHORT_HOSTS.has(url.hostname.toLowerCase())) {
      addIssue(issues, { code: "unresolved-short-link", path: path + ".sameAs[" + index + "]" });
      continue;
    }
    const alias = providerIdentity(candidate, accountNamespace);
    if (alias) aliases.push(alias);
  }
  const identifiers = Array.isArray(node.identifier) ? node.identifier : node.identifier === undefined ? [] : [node.identifier];
  for (let index = 0; index < identifiers.length && aliases.length < PROPERTY_PROFILE_EVIDENCE_LIMITS.maxAliasesPerObservation; index += 1) {
    const item = identifiers[index];
    if (!isPlain(item)) continue;
    const provider = boundedText(item.propertyID ?? item.name);
    const externalId = boundedText(item.value);
    if (provider && externalId) aliases.push(Object.freeze({ provider, accountNamespace, externalId }));
  }
  const seen = new Set<string>();
  return aliases.filter(item => {
    const key = JSON.stringify([item.provider, item.accountNamespace, item.externalId]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addIssue(issues: PublicPropertyCaptureIssue[], issue: PublicPropertyCaptureIssue): void {
  if (issues.length < PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxIssues - 1) {
    issues.push(issue);
  } else if (!issues.some(item => item.code === "issue-limit")) {
    issues.push({ code: "issue-limit", path: "$" });
  }
}

interface WalkBudget { visited: number; halted: boolean; }

function walkNodes(value: unknown, path: string, depth: number, inheritedSchemaContext: boolean,
  nodes: { value: Record<string, unknown>; path: string; schemaContext: boolean }[], issues: PublicPropertyCaptureIssue[], budget: WalkBudget): void {
  if (budget.halted) return;
  budget.visited += 1;
  if (budget.visited > PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxVisitedValues) {
    addIssue(issues, { code: "node-limit", path }); budget.halted = true; return;
  }
  if (nodes.length >= PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxNodes) {
    addIssue(issues, { code: "node-limit", path }); budget.halted = true; return;
  }
  if (depth > PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxNestingDepth) {
    addIssue(issues, { code: "nesting-limit", path }); return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length && !budget.halted; index += 1) {
      walkNodes(value[index], path + "[" + index + "]", depth + 1, inheritedSchemaContext, nodes, issues, budget);
    }
    return;
  }
  if (!isPlain(value)) return;
  const trustedContext = value["@context"] === undefined ? inheritedSchemaContext : schemaContext(value["@context"]);
  nodes.push({ value, path, schemaContext: trustedContext });
  if (value["@graph"] !== undefined) walkNodes(value["@graph"], path + ".@graph", depth + 1, trustedContext, nodes, issues, budget);
}

/** Detect repeated object keys before JSON.parse's last-key-wins behavior erases evidence. */
function hasDuplicateJsonKeys(source: string): boolean {
  const stack: Array<{ kind: "object" | "array"; keys?: Set<string>; expectKey?: boolean }> = [];
  let index = 0;
  const whitespace = (): void => { while (index < source.length && /\s/u.test(source[index]!)) index += 1; };
  const readString = (): string | null => {
    const start = index++;
    while (index < source.length) {
      const char = source[index++]!;
      if (char === "\\") { index += 1; continue; }
      if (char === '"') {
        try { return JSON.parse(source.slice(start, index)) as string; } catch { return null; }
      }
    }
    return null;
  };
  while (index < source.length) {
    whitespace();
    const char = source[index];
    if (char === undefined) break;
    const top = stack.at(-1);
    if (char === "}") { stack.pop(); index += 1; if (stack.at(-1)?.kind === "object") stack.at(-1)!.expectKey = false; continue; }
    if (char === "]") { stack.pop(); index += 1; if (stack.at(-1)?.kind === "object") stack.at(-1)!.expectKey = false; continue; }
    if (char === ":") { index += 1; continue; }
    if (char === ",") { index += 1; if (top?.kind === "object") top.expectKey = true; continue; }
    if (char === "{") { stack.push({ kind: "object", keys: new Set(), expectKey: true }); index += 1; continue; }
    if (char === "[") { stack.push({ kind: "array" }); index += 1; continue; }
    if (char === '"') {
      const value = readString();
      if (value === null) return false;
      if (top?.kind === "object" && top.expectKey) {
        if (top.keys!.has(value)) return true;
        top.keys!.add(value); top.expectKey = false;
      } else if (top?.kind === "object") top.expectKey = false;
      continue;
    }
    while (index < source.length && !/[\s,:}\]]/u.test(source[index]!)) index += 1;
    if (top?.kind === "object") top.expectKey = false;
  }
  return false;
}

async function extractJsonLdScripts(body: string, issues: PublicPropertyCaptureIssue[]): Promise<string[]> {
  const blocks: string[] = [];
  let active = false;
  let current = "";
  let overLimit = false;
  let templateDepth = 0;
  const templateHandler = {
    element(element: { onEndTag(callback: () => void): void }) {
      templateDepth += 1;
      element.onEndTag(() => { templateDepth = Math.max(0, templateDepth - 1); });
    },
  };
  const handler = {
    element(element: { onEndTag(callback: () => void): void }) {
      if (templateDepth > 0) return;
      if (blocks.length >= PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxScriptBlocks) {
        overLimit = true;
        return;
      }
      active = true;
      current = "";
      element.onEndTag(() => {
        if (active) blocks.push(unwrapJsonLd(current));
        active = false;
      });
    },
    text(text: { text: string }) { if (active) current += text.text; },
  };
  await new HTMLRewriter().on("template", templateHandler)
    .on('script[type="application/ld+json"]', handler)
    .transform(new Response(body)).text();
  if (overLimit) addIssue(issues, { code: "jsonld-script-limit", path: "$.body.script" });
  return blocks;
}

function unwrapJsonLd(source: string): string {
  let content = source.trim();
  if (content.startsWith("<!--") && content.endsWith("-->")) content = content.slice(4, -3).trim();
  if (content.startsWith("<![CDATA[") && content.endsWith("]]>")) content = content.slice(9, -3).trim();
  return content;
}

/** Extracts only bounded schema.org lodging nodes from an already captured HTML document. */
export async function parsePublicPropertyCapture(input: unknown): Promise<PublicPropertyCaptureResult> {
  const issues: PublicPropertyCaptureIssue[] = [];
  const snapshot = snapshotUntrustedJsonInput(input);
  if (!snapshot.ok || !isPlain(snapshot.value)) return failedCapture("invalid-capture", "$");
  const capture = snapshot.value;
  const status = capture.httpStatus ?? capture.status;
  if (typeof capture.sourceUrl !== "string" || typeof capture.finalUrl !== "string"
      || typeof capture.body !== "string" || typeof status !== "number"
      || !Number.isInteger(status) || status < 100 || status > 599
      || (capture.httpStatus !== undefined && capture.status !== undefined && capture.httpStatus !== capture.status)) {
    return failedCapture("invalid-capture", "$");
  }
  const sourceUrl = publicUrl(capture.sourceUrl);
  const finalUrl = publicUrl(capture.finalUrl);
  if (!sourceUrl || !finalUrl) {
    return failedCapture("invalid-url", "$.sourceUrl/finalUrl");
  }
  const capturedAt = parseInstant(capture.capturedAt);
  if (!capturedAt) {
    return failedCapture("invalid-capture-time", "$.capturedAt");
  }
  const provider = capture.provider === undefined ? hostOf(finalUrl) : boundedText(capture.provider);
  const httpStatus = status;
  const accountNamespace = capture.accountNamespace === undefined ? null
    : capture.accountNamespace === null ? null : boundedText(capture.accountNamespace);
  if (!provider || !(capture.accountNamespace === undefined || capture.accountNamespace === null || accountNamespace !== null)) {
    return failedCapture("invalid-capture", "$.provider/accountNamespace");
  }
  if (capture.body.length > PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxUtf8Bytes) {
    return Object.freeze({
      observations: Object.freeze([]),
      issues: Object.freeze([Object.freeze({ code: "capture-too-large" as const, path: "$.body" })]),
      contentSha256: "",
      utf8Bytes: null,
    });
  }
  const body = capture.body;
  const bytes = new TextEncoder().encode(body);
  if (bytes.byteLength > PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxUtf8Bytes) {
    return Object.freeze({
      observations: Object.freeze([]),
      issues: Object.freeze([Object.freeze({ code: "capture-too-large" as const, path: "$.body" })]),
      contentSha256: "",
      utf8Bytes: bytes.byteLength,
    });
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const contentSha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
  const blocks = await extractJsonLdScripts(body, issues);
  const nodes: { value: Record<string, unknown>; path: string; schemaContext: boolean }[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    try {
      if (hasDuplicateJsonKeys(blocks[index]!)) {
        addIssue(issues, { code: "invalid-jsonld", path: "$.jsonld[" + index + "]" });
        continue;
      }
      const parsed: unknown = JSON.parse(blocks[index]!);
      walkNodes(parsed, "$.jsonld[" + index + "]", 0, false, nodes, issues, { visited: 0, halted: false });
    } catch {
      addIssue(issues, { code: "invalid-jsonld", path: "$.jsonld[" + index + "]" });
    }
  }
  const observations: PropertyProfileObservation[] = [];
  let evidenceStringCount = 0;
  for (const entry of nodes) {
    const declaredId = typeof entry.value["@id"] === "string" && providerIdentity(entry.value["@id"], accountNamespace) !== null;
    if (!lodgingNode(entry.value, entry.schemaContext)) continue;
    const identity = sourceIdentity(entry.value, finalUrl, capture.finalUrl, contentSha256, provider, accountNamespace, entry.path);
    if (!identity) {
      addIssue(issues, { code: "unresolved-short-link", path: entry.path + ".@id" });
      continue;
    }
    const name = textValue(entry.value.name);
    if (!declaredId) addIssue(issues, { code: "missing-stable-identity", path: entry.path + ".@id" });
    if (name === null) addIssue(issues, { code: "missing-lodging-name", path: entry.path + ".name" });
    const address = addressValue(entry.value.address);
    const amenityFeature = extractAmenities(entry.value.amenityFeature, entry.path + ".amenityFeature");
    const images = extractImages(entry.value.image, entry.path + ".image", issues);
    const sourceUpdatedAt = parseInstant(entry.value.dateModified);
    const observation: PropertyProfileObservation = Object.freeze({
      source: Object.freeze({
        sourceUrl: capture.sourceUrl,
        finalUrl: capture.finalUrl,
        httpStatus,
        capturedAt,
        sourceUpdatedAt,
        contentSha256,
      }),
      identity,
      explicitAliases: Object.freeze(explicitAliases(entry.value, accountNamespace, issues, entry.path)),
      name,
      address,
      amenities: Object.freeze(amenityFeature),
      images: Object.freeze(images),
      sourcePath: entry.path,
    });
    const stringCount = (name === null ? 0 : 1) + (address === null ? 0 : 1)
      + observation.explicitAliases.length + observation.amenities.length + observation.images.length;
    if (evidenceStringCount + stringCount > PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxStrings) {
      addIssue(issues, { code: "evidence-limit", path: entry.path });
      continue;
    }
    evidenceStringCount += stringCount;
    observations.push(observation);
    if (observations.length > PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxLodgingEvidence) {
      addIssue(issues, { code: "evidence-limit", path: entry.path });
      observations.length = PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxLodgingEvidence;
      break;
    }
  }
  if (observations.length === 0) addIssue(issues, { code: "no-lodging-node", path: "$.jsonld" });
  return Object.freeze({
    observations: Object.freeze(observations),
    issues: Object.freeze(issues.map(item => Object.freeze(item))),
    contentSha256,
    utf8Bytes: bytes.byteLength,
  });
}
