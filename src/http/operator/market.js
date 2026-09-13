const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const PAGE_SIZE = 25;
const MAX_ROWS = 500;
const MAX_CONFIRM_BYTES = 16_384;
const MAX_PLAN_COMPARATORS = 200;
const MAX_PLAN_REQUESTS = 4_000;
const MAX_PLAN_SAMPLE = 10;
const PLAN_SOURCES = Object.freeze(["booking-mcp", "trivago-mcp", "google-hotels-serpapi", "google-visible"]);

const text = (value, maximum = 500) => typeof value === "string" && value.length > 0 && Array.from(value).length <= maximum && value.trim().length > 0 && value.isWellFormed() && !/[\u0000-\u001f\u007f]/u.test(value) ? value : null;
const planText = (value, maximum = 500) => {
 const candidate = text(value, maximum);
 return candidate && candidate === candidate.trim() ? candidate : null;
};
const uuid = value => typeof value === "string" && UUID.test(value) ? value : null;
const canonicalWebsite = value => {
 const candidate = text(value);
 if (!candidate) return null;
 try {
  const parsed = new URL(candidate);
  return parsed.protocol === "https:" && parsed.hostname.length > 0 && parsed.username === "" && parsed.password === "" && parsed.search === "" && parsed.hash === "" && parsed.toString() === candidate ? candidate : null;
 } catch { return null; }
};
const element = (tag, className, value) => {
 const node = document.createElement(tag);
 if (className) node.className = className;
 if (value !== undefined) node.textContent = value;
 return node;
};
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => isObject(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const sameRecord = (left, right) => Boolean(left && right && left.logicalId === right.logicalId && left.sha256 === right.sha256 && left.sourceRecordId === right.sourceRecordId);
const instant = value => {
 if (typeof value !== "string") return null;
 const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/u.exec(value);
 if (!match || !Number.isFinite(Date.parse(value))) return null;
 return new Date(value).toISOString() === `${match[1]}.${(match[2] || "").padEnd(3, "0")}Z` ? value : null;
};
const completeness = value => {
 if (!isObject(value) || Object.keys(value).sort().join(",") !== "rejectedRows,returnedRecords,scope,sourceRows,status" || value.scope !== "publisher-range-extract-all-places" || !["complete", "incomplete"].includes(value.status)) return null;
 for (const key of ["sourceRows", "returnedRecords", "rejectedRows"]) if (!Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > 501) return null;
 if (value.returnedRecords > 500 || value.returnedRecords + value.rejectedRows > value.sourceRows || (value.status === "complete" && value.returnedRecords + value.rejectedRows !== value.sourceRows)) return null;
 return Object.freeze({ scope: value.scope, status: value.status, sourceRows: value.sourceRows, returnedRecords: value.returnedRecords, rejectedRows: value.rejectedRows });
};

function parseRecord(value, source) {
 if (!exactKeys(value, ["provenance", "name", "coordinates", "address", "websites", "categories", "operatingStatus"])
  || !exactKeys(value.provenance, ["source", "release", "schema", "recordId", "attribution"])
  || !exactKeys(value.coordinates, ["latitude", "longitude"])) return null;
 const sourceRecordId = text(value.provenance.recordId), provenanceSource = text(value.provenance.source, 500), release = text(value.provenance.release, 500), schema = text(value.provenance.schema, 500), attribution = text(value.provenance.attribution, 500);
 const name = text(value.name);
 const latitude = value.coordinates.latitude;
 const longitude = value.coordinates.longitude;
 const address = value.address === null ? null : text(value.address, 1_000);
 const websites = Array.isArray(value.websites) ? value.websites.map(canonicalWebsite) : null;
 const categories = Array.isArray(value.categories) ? value.categories.map(entry => text(entry)) : null;
 if (!sourceRecordId || !provenanceSource || !release || !schema || !attribution || !name || typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
  || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  || (value.address !== null && !address) || !websites || !categories || websites.length > 16 || categories.length > 64
  || websites.some(entry => !entry) || categories.some(entry => !entry)
  || new Set(websites).size !== websites.length || new Set(categories).size !== categories.length
  || !["unknown", "source-reported-open", "source-reported-closed"].includes(value.operatingStatus)) return null;
 return Object.freeze({ logicalId: source.logicalId, sha256: source.sha256, sourceRecordId, name, latitude, longitude,
  address, websites: Object.freeze(websites), categories: Object.freeze(categories), operatingStatus: value.operatingStatus, source: provenanceSource, release, schema, attribution,
  capturedAt: source.capturedAt, completeness: source.completeness });
}

function parseSnapshot(value) {
 const capturedAt = instant(value?.capturedAt), coverage = completeness(value?.completeness);
 if (!exactKeys(value, ["logicalId", "sha256", "capturedAt", "region", "completeness", "records"])
  || !exactKeys(value.region, ["minimumLatitude", "maximumLatitude", "minimumLongitude", "maximumLongitude"])
  || !text(value.logicalId, 128) || typeof value.sha256 !== "string" || !SHA256.test(value.sha256)
  || !capturedAt || !coverage || !Array.isArray(value.records) || value.records.length > MAX_ROWS
  || ![value.region.minimumLatitude, value.region.maximumLatitude].every(coordinate => typeof coordinate === "number" && Number.isFinite(coordinate) && coordinate >= -90 && coordinate <= 90)
  || ![value.region.minimumLongitude, value.region.maximumLongitude].every(coordinate => typeof coordinate === "number" && Number.isFinite(coordinate) && coordinate >= -180 && coordinate <= 180)
  || value.region.minimumLatitude > value.region.maximumLatitude || value.region.minimumLongitude > value.region.maximumLongitude
  || coverage.returnedRecords !== value.records.length) return null;
 const region = Object.freeze({ ...value.region });
 const source = Object.freeze({ logicalId: value.logicalId, sha256: value.sha256, capturedAt, completeness: coverage, region });
 const records = value.records.map(record => parseRecord(record, source));
 return records.every(Boolean) && records.every(record => record.latitude >= region.minimumLatitude && record.latitude <= region.maximumLatitude && record.longitude >= region.minimumLongitude && record.longitude <= region.maximumLongitude)
  && new Set(records.map(record => record.sourceRecordId)).size === records.length
  ? Object.freeze({ ...source, records: Object.freeze(records) }) : null;
}

/** Strict browser-bound discovery parsing: no ambiguous selector or evidence identity. */
export function tryParseMarketSnapshots(value) {
 if (!Array.isArray(value) || value.length === 0 || value.length > 16) return null;
 const snapshots = value.map(parseSnapshot);
 if (!snapshots.every(Boolean) || snapshots.reduce((total, snapshot) => total + snapshot.records.length, 0) > MAX_ROWS
  || new Set(snapshots.map(snapshot => snapshot.logicalId)).size !== snapshots.length) return null;
 return Object.freeze(snapshots);
}

function command(currentVersion, own, comparators) {
 const result = Object.freeze({ expectedActiveVersion: currentVersion, ownProperty: Object.freeze({ logicalId: own.logicalId, sha256: own.sha256, sourceRecordId: own.sourceRecordId }),
  comparators: Object.freeze(comparators.map(value => Object.freeze({ logicalId: value.logicalId, sha256: value.sha256, sourceRecordId: value.sourceRecordId }))) });
 const body = JSON.stringify(result);
 return new TextEncoder().encode(body).byteLength <= MAX_CONFIRM_BYTES ? Object.freeze({ body, value: result }) : null;
}

function displayDate(value) {
 const time = typeof value === "string" ? Date.parse(value) : NaN;
 return Number.isFinite(time) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(time) + " UTC" : "Unknown source date";
}
function savedCompset(value, propertyNode) {
 if (!isObject(value) || !uuid(value.extensionId) || !Number.isSafeInteger(value.version) || value.version < 1 || !isObject(value.content)
  || value.content.propertyNode !== propertyNode || !isObject(value.content.ownProperty) || !Array.isArray(value.content.comparators)) return null;
 const reference = evidence => isObject(evidence) && isObject(evidence.reference) && isObject(evidence.record?.provenance) && text(evidence.reference.logicalId, 128)
  && typeof evidence.reference.sha256 === "string" && SHA256.test(evidence.reference.sha256) && text(evidence.reference.sourceRecordId)
  ? Object.freeze({ logicalId: evidence.reference.logicalId, sha256: evidence.reference.sha256, sourceRecordId: evidence.reference.sourceRecordId,
   name: text(evidence.record?.name) || "Historical source record", capturedAt: instant(evidence.capturedAt) || null,
   source: text(evidence.record.provenance.source, 500), release: text(evidence.record.provenance.release, 500), schema: text(evidence.record.provenance.schema, 500), attribution: text(evidence.record.provenance.attribution, 500) }) : null;
 const own = reference(value.content.ownProperty), comparators = value.content.comparators.map(reference);
 return own && own.source && own.release && own.schema && own.attribution && comparators.every(value => value && value.source && value.release && value.schema && value.attribution) && comparators.length <= MAX_ROWS
  ? Object.freeze({ extensionId: value.extensionId, version: value.version, own, comparators: Object.freeze(comparators) }) : null;
}

const exactArray = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const canonicalLocalDate = value => {
 if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
 const [year, month, day] = value.split("-").map(Number);
 const date = new Date(Date.UTC(year, month - 1, day));
 return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
};
const addLocalDays = (value, days) => {
 const date = canonicalLocalDate(value);
 if (!date || !Number.isSafeInteger(days)) return null;
 const result = new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000);
 return result.toISOString().slice(0, 10);
};
const addLocalMonths = (value, months) => {
 const date = canonicalLocalDate(value);
 if (!date || (months !== 3 && months !== 4)) return null;
 const [year, month, day] = date.split("-").map(Number);
 const target = new Date(Date.UTC(year, month - 1 + months, 1));
 const finalDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
 return `${String(target.getUTCFullYear()).padStart(4, "0")}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, finalDay)).padStart(2, "0")}`;
};
const timezone = value => {
 const candidate = planText(value, 128);
 if (!candidate) return null;
 try { new Intl.DateTimeFormat("en", { timeZone: candidate }).format(0); return candidate; } catch { return null; }
};
const localDateAt = (value, zone) => {
 const time = Date.parse(value);
 if (!Number.isFinite(time) || !timezone(zone)) return null;
 try {
  const pieces = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time);
  const values = Object.fromEntries(pieces.filter(piece => ["year", "month", "day"].includes(piece.type)).map(piece => [piece.type, piece.value]));
  const result = `${values.year}-${values.month}-${values.day}`;
  return canonicalLocalDate(result);
 } catch { return null; }
};
const planReference = value => exactKeys(value, ["logicalId", "sha256", "sourceRecordId"])
 && planText(value.logicalId, 128) && typeof value.sha256 === "string" && SHA256.test(value.sha256) && planText(value.sourceRecordId)
 ? Object.freeze({ logicalId: value.logicalId, sha256: value.sha256, sourceRecordId: value.sourceRecordId }) : null;
const sameReference = (left, right) => Boolean(left && right && left.logicalId === right.logicalId && left.sha256 === right.sha256 && left.sourceRecordId === right.sourceRecordId);
const normalizedPlanConditions = value => {
 if (!exactKeys(value, ["destination", "lookaheadMonths", "selectedSources", "guests", "pointOfSaleMarket", "language", "lengthsOfStayNights"])
  || !exactKeys(value.guests, ["rooms", "adults", "childAges"]) || (value.lookaheadMonths !== 3 && value.lookaheadMonths !== 4)
  || !Array.isArray(value.selectedSources) || !Array.isArray(value.lengthsOfStayNights) || !Array.isArray(value.guests.childAges)) return null;
 const destination = planText(value.destination, 256), pointOfSaleMarket = planText(value.pointOfSaleMarket, 2), languageInput = planText(value.language, 35);
 if (!destination || !pointOfSaleMarket || !/^[A-Z]{2}$/u.test(pointOfSaleMarket) || !languageInput
  || !Number.isSafeInteger(value.guests.rooms) || value.guests.rooms < 1 || value.guests.rooms > 100
  || !Number.isSafeInteger(value.guests.adults) || value.guests.adults < 1 || value.guests.adults > 200
  || value.selectedSources.length < 1 || value.selectedSources.length > PLAN_SOURCES.length
  || value.lengthsOfStayNights.length < 1 || value.lengthsOfStayNights.length > 365 || value.guests.childAges.length > 100) return null;
 let language;
 try { language = Intl.getCanonicalLocales(languageInput)[0] || null; } catch { language = null; }
 if (!language || language !== languageInput || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,3})?$/u.test(language)) return null;
 const sources = [...value.selectedSources], lengthsOfStayNights = [...value.lengthsOfStayNights], childAges = [...value.guests.childAges];
 if (!sources.every(source => PLAN_SOURCES.includes(source)) || new Set(sources).size !== sources.length
  || !lengthsOfStayNights.every(length => Number.isSafeInteger(length) && length >= 1 && length <= 365) || new Set(lengthsOfStayNights).size !== lengthsOfStayNights.length
  || !childAges.every(age => Number.isSafeInteger(age) && age >= 0 && age <= 25)) return null;
 const sortedSources = [...sources].sort(), sortedLengths = [...lengthsOfStayNights].sort((left, right) => left - right), sortedAges = [...childAges].sort((left, right) => left - right);
 if (!exactArray(sources, sortedSources) || !exactArray(lengthsOfStayNights, sortedLengths) || !exactArray(childAges, sortedAges)) return null;
 return Object.freeze({ destination, lookaheadMonths: value.lookaheadMonths, selectedSources: Object.freeze(sources), guests: Object.freeze({ rooms: value.guests.rooms, adults: value.guests.adults, childAges: Object.freeze(childAges) }), pointOfSaleMarket, language, lengthsOfStayNights: Object.freeze(lengthsOfStayNights) });
};
const normalizePlanRequestConditions = value => {
 if (!isObject(value) || !isObject(value.guests) || !Array.isArray(value.selectedSources) || !Array.isArray(value.lengthsOfStayNights) || !Array.isArray(value.guests.childAges)) return null;
 let language;
 try { language = typeof value.language === "string" ? Intl.getCanonicalLocales(value.language)[0] || null : null; } catch { language = null; }
 return normalizedPlanConditions({ ...value, pointOfSaleMarket: typeof value.pointOfSaleMarket === "string" ? value.pointOfSaleMarket.toUpperCase() : value.pointOfSaleMarket,
  language, selectedSources: [...value.selectedSources].sort(), lengthsOfStayNights: [...value.lengthsOfStayNights].sort((left, right) => left - right),
  guests: { ...value.guests, childAges: [...value.guests.childAges].sort((left, right) => left - right) } });
};
const samePlanConditions = (left, right) => left.destination === right.destination && left.lookaheadMonths === right.lookaheadMonths
 && left.pointOfSaleMarket === right.pointOfSaleMarket && left.language === right.language && left.guests.rooms === right.guests.rooms
 && left.guests.adults === right.guests.adults && exactArray(left.selectedSources, right.selectedSources)
 && exactArray(left.guests.childAges, right.guests.childAges) && exactArray(left.lengthsOfStayNights, right.lengthsOfStayNights);
const planCounts = value => {
 if (!exactKeys(value, ["asOfUtc", "propertyLocalDate", "arrivalEndExclusive", "requestedPotentialQueryCount", "dueRequestCount", "selectedRequestCount", "deferredRequestCount", "deferredDueToBudgetCount", "deferredDueToCadenceCount", "nextDueAtUtc"])) return null;
 const asOfUtc = instant(value.asOfUtc), propertyLocalDate = canonicalLocalDate(value.propertyLocalDate), arrivalEndExclusive = canonicalLocalDate(value.arrivalEndExclusive);
 const counts = ["requestedPotentialQueryCount", "dueRequestCount", "selectedRequestCount", "deferredRequestCount", "deferredDueToBudgetCount", "deferredDueToCadenceCount"];
 if (!asOfUtc || !propertyLocalDate || !arrivalEndExclusive || !counts.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= MAX_PLAN_REQUESTS)
  || value.selectedRequestCount > 100 || value.selectedRequestCount > value.dueRequestCount || value.dueRequestCount > value.requestedPotentialQueryCount
  || value.deferredDueToBudgetCount !== value.dueRequestCount - value.selectedRequestCount
  || value.deferredDueToCadenceCount !== value.requestedPotentialQueryCount - value.dueRequestCount
  || value.deferredRequestCount !== value.deferredDueToBudgetCount + value.deferredDueToCadenceCount) return null;
 if (value.nextDueAtUtc !== null && !instant(value.nextDueAtUtc)) return null;
 if ((value.deferredDueToBudgetCount === 0 && value.deferredDueToCadenceCount === 0) !== (value.nextDueAtUtc === null)) return null;
 if (value.deferredDueToBudgetCount > 0 && value.nextDueAtUtc !== asOfUtc) return null;
 if (value.deferredDueToBudgetCount === 0 && value.deferredDueToCadenceCount > 0 && Date.parse(value.nextDueAtUtc) <= Date.parse(asOfUtc)) return null;
 return Object.freeze({ asOfUtc, propertyLocalDate, arrivalEndExclusive, requestedPotentialQueryCount: value.requestedPotentialQueryCount, dueRequestCount: value.dueRequestCount, selectedRequestCount: value.selectedRequestCount, deferredRequestCount: value.deferredRequestCount, deferredDueToBudgetCount: value.deferredDueToBudgetCount, deferredDueToCadenceCount: value.deferredDueToCadenceCount, nextDueAtUtc: value.nextDueAtUtc });
};

/** Fail-closed UI boundary for the existing, non-executable planner response. */
export function tryParseMarketPlanPreview(value, binding) {
 if (!exactKeys(value, ["preview"]) || !isObject(binding) || !uuid(binding.extensionId) || !Number.isSafeInteger(binding.version) || binding.version < 1
  || !Array.isArray(binding.comparatorIndexes) || !Array.isArray(binding.comparatorReferences)) return null;
 const expectedConditions = normalizedPlanConditions(binding.conditions);
 const indexes = [...binding.comparatorIndexes], references = binding.comparatorReferences.map(planReference);
 if (!expectedConditions || indexes.length < 1 || indexes.length > MAX_PLAN_COMPARATORS || indexes.length !== references.length
  || !indexes.every(index => Number.isSafeInteger(index) && index >= 0 && index < MAX_ROWS) || new Set(indexes).size !== indexes.length
  || !references.every(Boolean)) return null;
 const sortedIndexes = [...indexes].sort((left, right) => left - right);
 if (!exactArray(indexes, sortedIndexes)) return null;
 const preview = value.preview;
 if (!isObject(preview) || !exactKeys(preview, ["previewOnly", "executable", "compset", "conditions", "propertyTimezone", "currency", "comparatorMapping", "plan", "sample"])
  || preview.previewOnly !== true || preview.executable !== false || !exactKeys(preview.compset, ["extensionId", "version"])
  || preview.compset.extensionId !== binding.extensionId || preview.compset.version !== binding.version || !Array.isArray(preview.comparatorMapping) || !Array.isArray(preview.sample)
  || preview.comparatorMapping.length !== indexes.length || preview.sample.length > MAX_PLAN_SAMPLE) return null;
 const conditions = normalizedPlanConditions(preview.conditions), propertyTimezone = timezone(preview.propertyTimezone), currency = typeof preview.currency === "string" && /^[A-Z]{3}$/u.test(preview.currency) ? preview.currency : null;
 const plan = planCounts(preview.plan);
 if (!conditions || !samePlanConditions(conditions, expectedConditions) || !propertyTimezone || !currency || !plan
  || localDateAt(plan.asOfUtc, propertyTimezone) !== plan.propertyLocalDate || addLocalMonths(plan.propertyLocalDate, conditions.lookaheadMonths) !== plan.arrivalEndExclusive
  || plan.requestedPotentialQueryCount !== ((Date.parse(`${plan.arrivalEndExclusive}T00:00:00.000Z`) - Date.parse(`${plan.propertyLocalDate}T00:00:00.000Z`)) / 86_400_000) * conditions.selectedSources.length * conditions.lengthsOfStayNights.length
  || preview.sample.length !== Math.min(plan.selectedRequestCount, MAX_PLAN_SAMPLE)) return null;
 const comparatorMapping = preview.comparatorMapping.map((mapping, position) => {
  if (!isObject(mapping) || !exactKeys(mapping, ["token", "index", "reference"]) || typeof mapping.token !== "string" || !/^evidence:[0-9a-f]{64}$/u.test(mapping.token)
   || mapping.index !== indexes[position] || !sameReference(planReference(mapping.reference), references[position])) return null;
  return Object.freeze({ index: mapping.index, reference: references[position] });
 });
 if (!comparatorMapping.every(Boolean)) return null;
 const sample = preview.sample.map(item => {
  if (!isObject(item) || !exactKeys(item, ["source", "arrivalDate", "checkoutDate", "lengthOfStayNights", "daysAhead", "cadence"])
   || !conditions.selectedSources.includes(item.source) || !canonicalLocalDate(item.arrivalDate) || !canonicalLocalDate(item.checkoutDate)
   || !Number.isSafeInteger(item.lengthOfStayNights) || !conditions.lengthsOfStayNights.includes(item.lengthOfStayNights)
   || !Number.isSafeInteger(item.daysAhead) || item.daysAhead < 0 || addLocalDays(item.arrivalDate, item.lengthOfStayNights) !== item.checkoutDate
   || addLocalDays(plan.propertyLocalDate, item.daysAhead) !== item.arrivalDate || item.arrivalDate < plan.propertyLocalDate || item.arrivalDate >= plan.arrivalEndExclusive
   || !isObject(item.cadence)) return null;
  const cadence = item.cadence.kind === "fixed" && exactKeys(item.cadence, ["kind", "intervalMinutes"]) && Number.isSafeInteger(item.cadence.intervalMinutes) && item.cadence.intervalMinutes >= 1 && item.cadence.intervalMinutes <= 31 * 1_440
   ? Object.freeze({ kind: "fixed", intervalMinutes: item.cadence.intervalMinutes })
   : null;
  return cadence ? Object.freeze({ source: item.source, arrivalDate: item.arrivalDate, checkoutDate: item.checkoutDate, lengthOfStayNights: item.lengthOfStayNights, daysAhead: item.daysAhead, cadence }) : null;
 });
 if (!sample.every(Boolean) || new Set(sample.map(item => JSON.stringify([item.source, item.arrivalDate, item.lengthOfStayNights]))).size !== sample.length) return null;
 return Object.freeze({ conditions, propertyTimezone, currency, comparatorMapping: Object.freeze(comparatorMapping), plan, sample: Object.freeze(sample) });
}

/** Parent-side boundary: only opaque, bounded marker facts may cross into the isolated map frame. */
export function tryCreateMarketMapData(nonce, revision, points) {
 if (!uuid(nonce) || !Number.isSafeInteger(revision) || revision < 1 || !Array.isArray(points) || points.length > MAX_ROWS) return null;
 const parsed = points.map(point => isObject(point) && exactKeys(point, ["id", "name", "latitude", "longitude", "role"])
  && planText(point.id, 80) && text(point.name, 500) && typeof point.latitude === "number" && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
  && typeof point.longitude === "number" && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180
  && ["candidate", "own", "comparator"].includes(point.role)
  ? Object.freeze({ id: point.id, name: point.name, latitude: point.latitude, longitude: point.longitude, role: point.role }) : null);
 if (!parsed.every(Boolean) || new Set(parsed.map(point => point.id)).size !== parsed.length) return null;
 return Object.freeze({ type: "yellow-market-map-data", version: 1, nonce, revision, points: Object.freeze(parsed) });
}

/** Lazy, property-bound market evidence surface. It has no network dependency beyond its injected authenticated request. */
export function createMarketWorkspace({ root, request, propertyNode = null, verifyPropertyNode = false, onPropertyChange = () => {}, isActive = () => true }) {
 if (!(root instanceof Element) || typeof request !== "function" || (propertyNode !== null && !uuid(propertyNode)) || typeof verifyPropertyNode !== "boolean" || typeof onPropertyChange !== "function") throw new TypeError("Invalid market workspace configuration");
 let generation = 0, marketPropertyGeneration = 0, suggestionGeneration = 0, plannerGeneration = 0, disposed = false, state = null, pending = null;
 const current = () => !disposed && root.isConnected && !root.hidden && isActive();
 const mount = element("div", "market-workspace");
 mount.dataset.marketState = "idle";
 const heading = element("div", "section-heading market-workspace__heading");
 const title = element("h2", "", "Market evidence workspace"); title.id = "market-title"; title.tabIndex = -1;
 const copy = element("div"); copy.append(element("p", "eyebrow", "External evidence · manual selection"), title, element("p", "muted", "Inspect source-point evidence before selecting an own-property record and comparators. This is not street imagery, property identity verification, rate shopping or auto-pricing."));
 const refresh = element("button", "quiet market-workspace__refresh", "Refresh evidence"); refresh.type = "button"; refresh.dataset.testid = "market-refresh"; heading.append(copy, refresh);
 const status = element("p", "market-workspace__status", "Open Market evidence to load a bounded regional snapshot."); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.dataset.testid = "market-status";
 const propertyLabel = element("label", "market-workspace__property-label", "Market-authorized property");
 const marketPropertySelect = element("select", "market-workspace__property"); marketPropertySelect.disabled = true; marketPropertySelect.dataset.testid = "market-property-select"; propertyLabel.append(marketPropertySelect);
 const marketPropertyMore = element("button", "quiet market-workspace__property-more", "Load next 50 market properties"); marketPropertyMore.type = "button"; marketPropertyMore.disabled = true; marketPropertyMore.dataset.testid = "market-property-next";
 const sourceLabel = element("label", "market-workspace__source-label", "Regional source snapshot");
 const sourceSelect = element("select", "market-workspace__source"); sourceSelect.disabled = true; sourceSelect.dataset.testid = "market-source"; sourceLabel.append(sourceSelect);
 const sourceMeta = element("p", "market-workspace__source-meta muted", "Select a source snapshot to see its provenance."); sourceMeta.dataset.testid = "market-source-meta";
 const filterLabel = element("label", "market-workspace__filter-label", "Filter source records");
 const filter = element("input", "market-workspace__filter"); filter.type = "search"; filter.maxLength = 200; filter.autocomplete = "off"; filter.disabled = true; filter.dataset.testid = "market-filter"; filterLabel.append(filter);
 const coverage = element("p", "market-workspace__coverage muted", "No source coverage is loaded."); coverage.dataset.testid = "market-coverage";
 const map = element("section", "market-workspace__map card"); map.setAttribute("aria-labelledby", "market-map-title"); const mapTitle = element("h3", "", "Source-point coordinate plot"); mapTitle.id = "market-map-title"; map.append(mapTitle, element("p", "muted", "Points are source coordinates only. No streets, imagery, route, proximity accuracy or physical-identity claim is shown."));
 const mapControls = element("div", "market-workspace__map-controls"); const mapEnable = element("button", "secondary market-workspace__map-enable", "Enable map"); mapEnable.type = "button"; mapEnable.dataset.testid = "market-map-enable"; const mapDisable = element("button", "quiet market-workspace__map-disable", "Disable map"); mapDisable.type = "button"; mapDisable.hidden = true; mapDisable.dataset.testid = "market-map-disable"; mapControls.append(mapEnable, mapDisable);
 const mapStatus = element("p", "market-workspace__map-status muted", "Map is disabled. The coordinate plot and evidence table do not need a map."); mapStatus.dataset.testid = "market-map-parent-status"; mapStatus.setAttribute("role", "status"); mapStatus.setAttribute("aria-live", "polite");
 const mapDisclosure = element("p", "market-workspace__map-disclosure muted", "Enabling the map may request public OpenStreetMap tiles; OpenStreetMap receives your IP address, viewed tile area and origin referrer. The coordinate plot and evidence table remain available without it."); mapDisclosure.dataset.testid = "market-map-disclosure";
 const mapFrameHost = element("div", "market-workspace__map-frame-host"); mapFrameHost.hidden = true; mapFrameHost.dataset.testid = "market-map-frame-host";
 const plot = element("div", "market-workspace__plot"); plot.setAttribute("role", "img"); plot.setAttribute("aria-label", "Source-point coordinate plot; use the evidence table for exact records."); plot.dataset.testid = "market-plot"; map.append(mapControls, mapStatus, mapDisclosure, mapFrameHost, plot);
 const table = element("div", "market-workspace__table-wrap");
 const attributeControls = element("fieldset", "market-workspace__attribute-controls"); attributeControls.append(element("legend", "", "Table attributes"));
 const tableAttributes = new Set(["coordinates", "operatingStatus", "provenance"]);
 const attributeBoxes = new Map();
 for (const [key, label] of [["address", "Address"], ["categories", "Categories"], ["websites", "Websites"], ["coordinates", "Coordinates"], ["operatingStatus", "Operating status"], ["provenance", "Provenance"]]) {
  const control = element("label", "market-workspace__attribute-choice"); const box = element("input"); box.type = "checkbox"; box.checked = tableAttributes.has(key); box.dataset.testid = `market-attribute-${key}`; control.append(box, document.createTextNode(` ${label}`)); attributeControls.append(control); attributeBoxes.set(key, box);
 }
 const rows = element("div", "market-workspace__rows"); rows.dataset.testid = "market-table";
 const pager = element("div", "market-workspace__pager"); const previous = element("button", "quiet", "Previous page"), next = element("button", "quiet", "Next page"), page = element("span", "market-workspace__page", "No records"); previous.type = next.type = "button"; pager.append(previous, page, next); table.append(rows, pager);
 const inspector = element("section", "market-workspace__inspector card"); inspector.setAttribute("aria-labelledby", "market-inspector-title"); const inspectorTitle = element("h3", "", "Evidence attributes"); inspectorTitle.id = "market-inspector-title"; inspectorTitle.tabIndex = -1; const inspectorContent = element("div", "market-workspace__inspector-content", "Choose Inspect attributes on a source record to review its complete retained evidence."); inspectorContent.dataset.testid = "market-record-inspector"; inspector.append(inspectorTitle, inspectorContent);
 const review = element("section", "market-workspace__review card"); review.setAttribute("aria-labelledby", "market-review-title"); const reviewTitle = element("h3", "", "Review and confirm"); reviewTitle.id = "market-review-title"; review.append(reviewTitle);
 const summary = element("p", "muted", "Select one own-property source record. Comparator selection is optional and never automatic."); summary.dataset.testid = "market-review";
 const selectedEvidence = element("ul", "market-workspace__selection-list"); selectedEvidence.dataset.testid = "market-selected-evidence";
 const explicit = element("label", "market-workspace__explicit"); const confirmBox = element("input"); confirmBox.type = "checkbox"; confirmBox.disabled = true; explicit.append(confirmBox, document.createTextNode(" I reviewed this exact source evidence and deliberately confirm it."));
 const confirm = element("button", "primary market-workspace__confirm", "Confirm selected evidence"); confirm.type = "button"; confirm.disabled = true; confirm.dataset.testid = "market-confirm"; review.append(summary, selectedEvidence, explicit, confirm);
 const identity = element("section", "market-workspace__identity card"); identity.setAttribute("aria-labelledby", "market-identity-title"); const identityTitle = element("h3", "", "Identity suggestions"); identityTitle.id = "market-identity-title"; identity.append(identityTitle, element("p", "muted", "Enter an explicit record ID, canonical public URL, name or coordinates. Suggestions are never selected automatically."));
 const identityRecord = element("input", "market-workspace__identity-record"); identityRecord.placeholder = "Source record ID"; identityRecord.setAttribute("aria-label", "Source record ID"); identityRecord.maxLength = 500; identityRecord.dataset.testid = "market-identity-record-id";
 const identityUrl = element("input", "market-workspace__identity-url"); identityUrl.type = "url"; identityUrl.placeholder = "Public HTTPS URL"; identityUrl.setAttribute("aria-label", "Public HTTPS URL"); identityUrl.maxLength = 500; identityUrl.dataset.testid = "market-identity-url";
 const identityName = element("input", "market-workspace__identity-name"); identityName.placeholder = "Property name"; identityName.setAttribute("aria-label", "Property name"); identityName.maxLength = 500; identityName.dataset.testid = "market-identity-name";
 const identityLatitude = element("input", "market-workspace__identity-latitude"); identityLatitude.type = "number"; identityLatitude.step = "any"; identityLatitude.placeholder = "Latitude"; identityLatitude.setAttribute("aria-label", "Latitude");
 const identityLongitude = element("input", "market-workspace__identity-longitude"); identityLongitude.type = "number"; identityLongitude.step = "any"; identityLongitude.placeholder = "Longitude"; identityLongitude.setAttribute("aria-label", "Longitude");
 const identitySuggest = element("button", "secondary market-workspace__identity-suggest", "Suggest matching records"); identitySuggest.type = "button"; identitySuggest.dataset.testid = "market-identity-suggest";
 const identityApply = element("button", "secondary market-workspace__identity-apply", "Use selected suggestion as the editable own-record draft"); identityApply.type = "button"; identityApply.disabled = true; identityApply.dataset.testid = "market-identity-apply";
 const suggestions = element("div", "market-workspace__suggestions"); suggestions.dataset.testid = "market-suggestions"; identity.append(identityRecord, identityUrl, identityName, identityLatitude, identityLongitude, identitySuggest, suggestions, identityApply);
 const saved = element("section", "market-workspace__saved card"); saved.setAttribute("aria-labelledby", "market-saved-title"); const savedTitle = element("h3", "", "Saved confirmed evidence and plan preview"); savedTitle.id = "market-saved-title"; const savedEvidence = element("div", "market-workspace__saved-evidence"); savedEvidence.dataset.testid = "market-saved-evidence";
 const planConditions = element("div", "market-workspace__plan-conditions"); planConditions.dataset.testid = "market-plan-conditions";
 const destination = element("input", "market-workspace__plan-destination"); destination.placeholder = "Destination"; destination.maxLength = 256;
 const months = element("select", "market-workspace__plan-months"); months.append(element("option", "", "3 months"), element("option", "", "4 months")); months.options[0].value = "3"; months.options[1].value = "4";
 const pointOfSale = element("input", "market-workspace__plan-pos"); pointOfSale.placeholder = "Point of sale (e.g. SA)"; pointOfSale.maxLength = 2;
 const language = element("input", "market-workspace__plan-language"); language.placeholder = "Language (e.g. en)"; language.maxLength = 10;
 const rooms = element("input", "market-workspace__plan-rooms"); rooms.type = "number"; rooms.min = "1"; rooms.max = "100"; rooms.value = "1";
 const adults = element("input", "market-workspace__plan-adults"); adults.type = "number"; adults.min = "1"; adults.max = "200"; adults.value = "2";
 const childAges = element("input", "market-workspace__plan-child-ages"); childAges.placeholder = "Child ages, comma-separated"; childAges.setAttribute("aria-label", "Child ages, comma-separated");
 const stays = element("input", "market-workspace__plan-stays"); stays.placeholder = "Stay nights, comma-separated"; stays.value = "1";
 const sourcesControl = element("fieldset", "market-workspace__plan-sources"); sourcesControl.append(element("legend", "", "Explicit request sources"));
 for (const source of ["booking-mcp", "trivago-mcp", "google-hotels-serpapi", "google-visible"]) { const label = element("label", ""); const box = element("input"); box.type = "checkbox"; box.value = source; label.append(box, document.createTextNode(` ${source}`)); sourcesControl.append(label); }
 planConditions.append(destination, months, pointOfSale, language, rooms, adults, childAges, stays, sourcesControl);
 const planNotice = element("p", "muted", "Select 1–200 persisted comparators. The preview is bounded to 100 requests and 25-request batches; it does not schedule collection, create supplier work or execute requests."); const planPreview = element("button", "secondary market-workspace__plan-preview", "Preview saved comparator plan"); planPreview.type = "button"; planPreview.disabled = true; planPreview.dataset.testid = "market-plan-preview"; const planResult = element("p", "market-workspace__plan-result", "No persisted plan is loaded."); planResult.dataset.testid = "market-plan-result"; const planDetails = element("section", "market-workspace__plan-details"); planDetails.dataset.testid = "market-plan-details"; planDetails.setAttribute("aria-live", "polite"); saved.append(savedTitle, savedEvidence, planConditions, planNotice, planPreview, planResult, planDetails);
 mount.append(heading, status, propertyLabel, marketPropertyMore, sourceLabel, sourceMeta, filterLabel, coverage, map, attributeControls, table, inspector, review, identity, saved); root.replaceChildren(mount);

 const setStatus = (message, error = false) => { status.textContent = message; status.classList.toggle("error", error); };
 let mapBinding = null, mapFrame = null, mapReadyTimer = null, mapMessageHandler = null, inspectedRecord = null;
 const syncMapControls = () => {
  const frozen = Boolean(state?.inflight || pending?.unknown);
  mapEnable.disabled = frozen || !state || Boolean(mapBinding);
  mapDisable.disabled = frozen || !mapBinding;
 };
 syncMapControls();
 const renderInspector = record => {
  inspectedRecord = record || null; inspectorContent.replaceChildren();
  if (!record) { inspectorContent.textContent = "Choose Inspect attributes on a source record to review its complete retained evidence."; return; }
  const facts = element("dl", "market-workspace__attribute-list");
  const fact = (label, value) => { const term = element("dt", "", label), detail = element("dd", "", value); facts.append(term, detail); return detail; };
  fact("Source record", record.sourceRecordId); fact("Coordinates", `${record.latitude}, ${record.longitude}`); fact("Operating status", record.operatingStatus);
  fact("Address", record.address || "No address supplied by this source."); fact("Categories", record.categories.length ? record.categories.join(", ") : "No categories supplied by this source.");
  fact("Provenance", `${record.source} · ${record.release} · ${record.schema} · ${record.attribution}`); fact("Captured", displayDate(record.capturedAt));
  const websites = fact("Websites", record.websites.length ? "" : "No websites supplied by this source.");
  if (record.websites.length) {
   const list = element("ul", "market-workspace__website-list");
   for (const website of record.websites) { const item = element("li", ""); const link = element("a", "", website); link.href = website; link.rel = "noreferrer noopener"; item.append(link); list.append(item); }
   websites.replaceChildren(list);
  }
  inspectorContent.append(facts);
  inspectorTitle.focus({ preventScroll: true });
 };
 const mapContext = source => JSON.stringify([propertyNode, source.logicalId, source.sha256]);
 const destroyMap = (message = "Map is disabled. The coordinate plot and evidence table remain available.") => {
  if (mapReadyTimer !== null) { clearTimeout(mapReadyTimer); mapReadyTimer = null; }
  if (mapMessageHandler) window.removeEventListener("message", mapMessageHandler);
  mapMessageHandler = null; mapFrame?.remove(); mapFrame = null; mapBinding = null;
  mapFrameHost.replaceChildren(); mapFrameHost.hidden = true; plot.hidden = false; mapTitle.textContent = "Source-point coordinate plot"; mapEnable.hidden = false; mapDisable.hidden = true; mapStatus.textContent = message; syncMapControls();
 };
 const postMapData = () => {
  const binding = mapBinding;
  if (!binding || !binding.ready || !mapFrame || !mapFrame.contentWindow || !current() || state?.inflight || pending?.unknown) return;
  const data = tryCreateMarketMapData(binding.nonce, binding.revision + 1, binding.points);
  if (!data) { destroyMap("Map data became invalid. The coordinate plot and evidence table remain available."); return; }
  binding.revision = data.revision; mapFrame.contentWindow.postMessage(data, location.origin);
 };
 const updateMapData = (source, records) => {
  const binding = mapBinding;
  if (!binding || state?.inflight || pending?.unknown) return;
  if (!current() || binding.context !== mapContext(source)) { destroyMap(); return; }
  const recordsById = new Map();
  const points = records.map(record => {
   const key = JSON.stringify([record.logicalId, record.sha256, record.sourceRecordId]);
   const id = binding.ids.get(key) || crypto.randomUUID(); binding.ids.set(key, id); recordsById.set(id, record);
   return { id, name: record.name, latitude: record.latitude, longitude: record.longitude, role: sameRecord(record, state.own) ? "own" : state.comparators.some(value => sameRecord(record, value)) ? "comparator" : "candidate" };
  });
  const checked = tryCreateMarketMapData(binding.nonce, Math.max(1, binding.revision + 1), points);
  if (!checked) { destroyMap("Map data could not be prepared safely. The coordinate plot and evidence table remain available."); return; }
  binding.points = checked.points; binding.records = recordsById;
  if (inspectedRecord && !records.some(record => sameRecord(record, inspectedRecord))) renderInspector(null);
  postMapData();
 };
 const enableMap = () => {
  const source = state?.sources.find(item => item.logicalId === state.source);
  if (!source || !current() || state.inflight || pending?.unknown || mapBinding) return;
  const binding = { nonce: crypto.randomUUID(), revision: 0, context: mapContext(source), ids: new Map(), points: Object.freeze([]), records: new Map(), ready: false };
  if (!uuid(binding.nonce)) return;
  mapBinding = binding; mapFrame = document.createElement("iframe"); mapFrame.className = "market-workspace__map-frame"; mapFrame.dataset.testid = "market-map-frame"; mapFrame.title = "Interactive source-point map"; mapFrame.src = "/assets/market-map/frame.html";
  mapFrameHost.replaceChildren(mapFrame); mapFrameHost.hidden = false; plot.hidden = true; mapTitle.textContent = "Interactive source-point map"; mapEnable.hidden = true; mapDisable.hidden = false; syncMapControls();
  mapStatus.textContent = "Map loading. OpenStreetMap may receive your IP address, viewed tile area and origin referrer; the evidence table remains available.";
  mapMessageHandler = event => {
   const active = mapBinding;
   if (!active || event.origin !== location.origin || event.source !== mapFrame?.contentWindow || !isObject(event.data)) return;
   const data = event.data;
   if (exactKeys(data, ["type", "version"]) && data.type === "yellow-market-map-ready" && data.version === 1) {
    if (active.ready) return;
    active.ready = true; if (mapReadyTimer !== null) { clearTimeout(mapReadyTimer); mapReadyTimer = null; }
    mapStatus.textContent = "Interactive source-point map is enabled. Marker inspection does not change any evidence selection."; postMapData(); return;
   }
   if (!exactKeys(data, ["type", "version", "nonce", "revision", "id"]) || data.type !== "yellow-market-map-inspect" || data.version !== 1
    || data.nonce !== active.nonce || data.revision !== active.revision || !planText(data.id, 80) || !current()) return;
   const record = active.records.get(data.id);
   if (record) renderInspector(record);
  };
  window.addEventListener("message", mapMessageHandler);
  mapReadyTimer = setTimeout(() => { if (mapBinding === binding && !binding.ready) destroyMap("Map frame did not become ready. The coordinate plot and evidence table remain available."); }, 5_000);
  updateMapData(source, state.filtered);
 };
 const clearPrivate = ({ preserveMarketProperties = false } = {}) => { destroyMap("Map disabled because this evidence context changed. The coordinate plot and evidence table remain available."); generation += 1; marketPropertyGeneration += 1; suggestionGeneration += 1; plannerGeneration += 1; state = null; pending = null; syncMapControls(); sourceSelect.replaceChildren(); rows.replaceChildren(); plot.replaceChildren(); selectedEvidence.replaceChildren(); savedEvidence.replaceChildren(); planDetails.replaceChildren(); renderInspector(null); clearSuggestions(); filter.value = ""; identityRecord.value = identityUrl.value = identityName.value = identityLatitude.value = identityLongitude.value = ""; filter.disabled = true; sourceSelect.disabled = true; confirmBox.checked = false; confirmBox.disabled = true; confirm.disabled = true; planPreview.disabled = true; planResult.textContent = "No persisted plan is loaded."; if (!preserveMarketProperties) { marketProperties = []; marketPropertiesCursor = null; marketPropertySelect.replaceChildren(); marketPropertySelect.disabled = true; marketPropertyMore.disabled = true; } refresh.disabled = false; sourceMeta.textContent = "Market provenance is unavailable because access is not granted."; summary.textContent = "Market access is not granted for this property."; };
 let marketProperties = [], marketPropertiesCursor = null, suggestionChoices = [];
 const selected = () => state?.records.find(row => sameRecord(row, state.own)) || null;
 const comparable = () => state ? state.records.filter(row => state.comparators.some(value => sameRecord(row, value))) : [];
 const resetPending = () => { if (!pending?.unknown) pending = null; };
 const clearSuggestions = () => { suggestionGeneration += 1; suggestionChoices = []; identityApply.disabled = true; identitySuggest.disabled = Boolean(state?.inflight || pending?.unknown); suggestions.replaceChildren(); };
 const renderSaved = () => {
  savedEvidence.replaceChildren();
  const persisted = state?.saved;
  if (!persisted) { savedEvidence.textContent = "No persisted confirmed competitor set is available for this property."; planPreview.disabled = true; return; }
  const historicalReference = reference => `Historical reference ${reference.logicalId} / ${reference.sourceRecordId}; captured ${reference.capturedAt ? displayDate(reference.capturedAt) : "historical source date unavailable"}; ${reference.source} / ${reference.release} / ${reference.schema}; ${reference.attribution}.`;
  const ownReference = element("p", "", `Saved version ${persisted.version}; original own ${historicalReference(persisted.own)}`);
  ownReference.title = `Pinned snapshot SHA-256: ${persisted.own.sha256}`;
  savedEvidence.append(ownReference);
  for (const [index, comparator] of persisted.comparators.entries()) {
   const label = element("label", "market-workspace__plan-comparator"); const box = element("input"); box.type = "checkbox"; box.value = String(index); box.disabled = Boolean(state.inflight || pending?.unknown); label.title = `Pinned snapshot SHA-256: ${comparator.sha256}`; label.append(box, document.createTextNode(` Comparator ${index + 1}: ${comparator.name}. ${historicalReference(comparator)}`)); savedEvidence.append(label);
   box.addEventListener("change", () => { if (state?.inflight || pending?.unknown) return; plannerGeneration += 1; clearPlanPreview(); planResult.textContent = "Saved comparator selection changed; request a fresh preview."; syncPlan(); });
  }
  syncPlan();
 };
 const syncPlan = () => {
  const count = savedEvidence.querySelectorAll("input[type=checkbox]:checked").length;
  planPreview.disabled = !state?.saved || state.requiresReload || state.planRequiresReload || count < 1 || count > 200 || state.inflight || pending?.unknown === true;
  planNotice.textContent = state?.saved ? `${count} of ${state.saved.comparators.length} persisted comparators selected; preview accepts 1–200, is bounded to 100 requests and 25-request batches, and never uses the editable discovery draft.` : "A preview uses only a persisted confirmed competitor set. It does not schedule collection, create supplier work or execute requests.";
 };
 const clearPlanPreview = () => planDetails.replaceChildren();
 const renderPlanPreview = preview => {
  planDetails.replaceChildren();
  const windowLabel = `${preview.plan.propertyLocalDate} (inclusive) to ${preview.plan.arrivalEndExclusive} (exclusive)`;
  planDetails.append(
   element("p", "", `Server planner context: ${preview.propertyTimezone} · ${preview.currency} · as of ${displayDate(preview.plan.asOfUtc)}.`),
   element("p", "", `Property-local planning window: ${windowLabel}. ${preview.comparatorMapping.length} exact persisted comparator reference${preview.comparatorMapping.length === 1 ? "" : "s"} bound.`),
   element("p", "", `${preview.plan.requestedPotentialQueryCount} potential · ${preview.plan.dueRequestCount} due · ${preview.plan.selectedRequestCount} selected · ${preview.plan.deferredRequestCount} deferred. Deferred for budget: ${preview.plan.deferredDueToBudgetCount}; deferred for cadence: ${preview.plan.deferredDueToCadenceCount}.${preview.plan.nextDueAtUtc ? ` Next eligible: ${displayDate(preview.plan.nextDueAtUtc)}.` : ""}`),
  );
  const samples = element("ol", "market-workspace__plan-samples");
  for (const sample of preview.sample) {
   const cadence = sample.cadence.kind === "fixed" ? `every ${sample.cadence.intervalMinutes} minutes` : "calendar-month cadence";
   samples.append(element("li", "", `${sample.source}: ${sample.arrivalDate} to ${sample.checkoutDate} · ${sample.lengthOfStayNights} night${sample.lengthOfStayNights === 1 ? "" : "s"} · ${sample.daysAhead} days ahead · ${cadence}.`));
  }
  planDetails.append(samples);
 };
 const syncConfirm = () => {
  const own = selected(); const body = own ? command(state.currentVersion, own, comparable()) : null;
  const comparators = comparable();
  selectedEvidence.replaceChildren();
  if (own) {
   const ownItem = element("li", "", `Own property: ${own.name} (${own.sourceRecordId}).`); selectedEvidence.append(ownItem);
   for (const comparator of comparators) selectedEvidence.append(element("li", "", `Comparator: ${comparator.name} (${comparator.sourceRecordId}).`));
  }
  if (!own || !body || state.requiresReload) { confirm.disabled = true; confirmBox.disabled = true; if (own && !body) summary.textContent = "The selected evidence is too large to confirm within the 16 KiB request limit."; else if (state.requiresReload) summary.textContent = "Reload source evidence before confirming this selection."; else summary.textContent = `Current competitor set: ${state.currentVersion === null ? "none" : `version ${state.currentVersion}`}. Select one own-property source record; comparator selection is optional and never automatic.`; return; }
  if (pending && (pending.body !== body.body || pending.property !== propertyNode) && !pending.unknown) pending = null;
  confirmBox.disabled = state.inflight || pending?.unknown === true; confirm.disabled = !confirmBox.checked || state.inflight;
  summary.textContent = `Own record and ${comparators.length} comparator${comparators.length === 1 ? "" : "s"} are shown below. Current version: ${state.currentVersion === null ? "none" : state.currentVersion}.`;
 };
 const render = () => {
  if (!state) return;
  const source = state.sources.find(item => item.logicalId === state.source);
  const term = filter.value.trim().toLocaleLowerCase();
  const filtered = source ? source.records.filter(row => !term || `${row.name} ${row.sourceRecordId} ${row.address || ""}`.toLocaleLowerCase().includes(term)) : [];
  state.filtered = filtered; state.page = Math.min(state.page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  rows.replaceChildren(); plot.replaceChildren();
  coverage.textContent = source ? `Captured ${displayDate(source.capturedAt)} · ${source.completeness.status} source coverage · ${source.completeness.returnedRecords} accepted record${source.completeness.returnedRecords === 1 ? "" : "s"}; ${source.completeness.rejectedRows} rejected. Operating status remains source-reported or unknown.` : "No source coverage is available.";
  if (source) {
   const provenance = Array.from(new Set(source.records.map(row => JSON.stringify([row.source, row.release, row.schema, row.attribution]))));
   sourceMeta.textContent = provenance.length === 1
    ? `Source: ${source.records[0].source} · release: ${source.records[0].release} · schema: ${source.records[0].schema} · attribution: ${source.records[0].attribution}. Source rows: ${source.completeness.sourceRows}; returned: ${source.completeness.returnedRecords}; rejected: ${source.completeness.rejectedRows}. Coverage is publisher all-places extraction, not hotel coverage.`
    : `Record provenance varies by row; each row shows source, release, schema and attribution. Source rows: ${source.completeness.sourceRows}; returned: ${source.completeness.returnedRecords}; rejected: ${source.completeness.rejectedRows}. Coverage is publisher all-places extraction, not hotel coverage.`;
  } else sourceMeta.textContent = "No source provenance is available.";
  const frozen = state.inflight || pending?.unknown === true;
  sourceSelect.disabled = frozen; filter.disabled = frozen; refresh.disabled = frozen; marketPropertySelect.disabled = frozen || marketProperties.length === 0; marketPropertyMore.disabled = frozen || marketPropertiesCursor === null;
  syncMapControls();
  identityRecord.disabled = identityUrl.disabled = identityName.disabled = identityLatitude.disabled = identityLongitude.disabled = frozen; identitySuggest.disabled = frozen; identityApply.disabled = frozen || !suggestions.querySelector("input[name=market-suggestion]:checked");
  for (const control of [destination, months, pointOfSale, language, rooms, adults, childAges, stays, ...sourcesControl.querySelectorAll("input")]) control.disabled = frozen;
  for (const box of attributeBoxes.values()) box.disabled = frozen;
  const longitudes = filtered.map(row => row.longitude), latitudes = filtered.map(row => row.latitude);
  const rawMinimumLongitude = longitudes.length ? Math.min(...longitudes) : 0, rawMaximumLongitude = longitudes.length ? Math.max(...longitudes) : 0;
  const rawMinimumLatitude = latitudes.length ? Math.min(...latitudes) : 0, rawMaximumLatitude = latitudes.length ? Math.max(...latitudes) : 0;
  const longitudePadding = Math.max((rawMaximumLongitude - rawMinimumLongitude) * 0.08, 0.000001);
  const latitudePadding = Math.max((rawMaximumLatitude - rawMinimumLatitude) * 0.08, 0.000001);
  const minimumLongitude = rawMinimumLongitude - longitudePadding, maximumLongitude = rawMaximumLongitude + longitudePadding;
  const minimumLatitude = rawMinimumLatitude - latitudePadding, maximumLatitude = rawMaximumLatitude + latitudePadding;
  const longitudeSpan = Math.max(maximumLongitude - minimumLongitude, 0.000002), latitudeSpan = Math.max(maximumLatitude - minimumLatitude, 0.000002);
  for (const row of filtered) { const point = element("span", "market-workspace__point"); point.style.left = `${((row.longitude - minimumLongitude) / longitudeSpan) * 100}%`; point.style.top = `${((maximumLatitude - row.latitude) / latitudeSpan) * 100}%`; point.title = `${row.name} · ${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`; plot.append(point); }
  const pageRows = filtered.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
  for (const row of pageRows) {
   const article = element("article", "market-workspace__row"); const title = element("strong", "", row.name); const metaParts = [row.sourceRecordId]; if (tableAttributes.has("coordinates")) metaParts.push(`${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`); if (tableAttributes.has("operatingStatus")) metaParts.push(row.operatingStatus); const meta = element("p", "muted", metaParts.join(" · "));
   const provenance = tableAttributes.has("provenance") ? element("p", "muted market-workspace__record-provenance", `Source: ${row.source} · release: ${row.release} · schema: ${row.schema} · attribution: ${row.attribution}`) : null;
   const address = tableAttributes.has("address") ? element("p", "muted market-workspace__record-attribute", `Address: ${row.address || "No address supplied by this source."}`) : null;
   const categories = tableAttributes.has("categories") ? element("p", "muted market-workspace__record-attribute", `Categories: ${row.categories.length ? row.categories.join(", ") : "No categories supplied by this source."}`) : null;
   const websites = tableAttributes.has("websites") ? element("p", "muted market-workspace__record-attribute", `Websites: ${row.websites.length ? row.websites.join(", ") : "No websites supplied by this source."}`) : null;
   const choices = element("div", "market-workspace__choices"); const inspect = element("button", "quiet market-workspace__inspect", "Inspect attributes"); inspect.type = "button"; inspect.dataset.testid = "market-record-inspect"; inspect.addEventListener("click", () => { if (current()) renderInspector(row); }); const ownLabel = element("label", "market-workspace__choice"); const own = element("input"); own.type = "radio"; own.name = "market-own"; own.checked = sameRecord(row, state.own); own.disabled = state.inflight || pending?.unknown === true; ownLabel.append(own, document.createTextNode(" Own property"));
   const comparatorLabel = element("label", "market-workspace__choice"); const comparator = element("input"); comparator.type = "checkbox"; comparator.checked = state.comparators.some(value => sameRecord(row, value)); comparator.disabled = own.checked || state.inflight || pending?.unknown === true; comparatorLabel.append(comparator, document.createTextNode(" Comparator"));
   own.addEventListener("change", () => { if (!current() || !own.checked || state.inflight || pending?.unknown) return; generation += 1; plannerGeneration += 1; clearPlanPreview(); planResult.textContent = "Discovery draft changed; request a fresh saved-plan preview if needed."; clearSuggestions(); state.own = row; state.comparators = state.comparators.filter(item => !sameRecord(item, row)); state.page = 0; confirmBox.checked = false; resetPending(); render(); syncConfirm(); });
   comparator.addEventListener("change", () => { if (!current() || sameRecord(row, state.own) || state.inflight || pending?.unknown) return; generation += 1; plannerGeneration += 1; clearPlanPreview(); planResult.textContent = "Discovery draft changed; request a fresh saved-plan preview if needed."; clearSuggestions(); state.comparators = comparator.checked ? [...state.comparators, row] : state.comparators.filter(item => !sameRecord(item, row)); confirmBox.checked = false; resetPending(); syncConfirm(); });
   choices.append(inspect, ownLabel, comparatorLabel); article.append(title, meta); if (provenance) article.append(provenance); if (address) article.append(address); if (categories) article.append(categories); if (websites) article.append(websites); article.append(choices); rows.append(article);
  }
  page.textContent = filtered.length ? `Page ${state.page + 1} of ${Math.ceil(filtered.length / PAGE_SIZE)} · ${filtered.length} records` : "No source records match this filter.";
  previous.disabled = frozen || state.page === 0; next.disabled = frozen || (state.page + 1) * PAGE_SIZE >= filtered.length;
  updateMapData(source, filtered); syncConfirm();
 };
 const loadMarketProperties = async (cursor = null) => {
  const token = ++marketPropertyGeneration;
  const suffix = cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  marketPropertyMore.disabled = true;
  try {
   const envelope = await request(`/api/v1/me/market-properties${suffix}`);
   const pageProperties = envelope?.marketProperties?.properties;
   const nextCursor = envelope?.marketProperties?.nextCursor;
   if (!Array.isArray(pageProperties) || pageProperties.length > 50 || (nextCursor !== null && (typeof nextCursor !== "string" || nextCursor.length === 0 || nextCursor.length > 48))) throw new Error("invalid");
   const parsed = pageProperties.map(value => isObject(value) && uuid(value.id) && text(value.name) && text(value.timezone, 128) && (value.currency === null || (typeof value.currency === "string" && /^[A-Z]{3}$/u.test(value.currency)))
    ? Object.freeze({ id: value.id, name: value.name, timezone: value.timezone, currency: value.currency }) : null);
   if (!parsed.every(Boolean) || new Set(parsed.map(value => value.id)).size !== parsed.length || parsed.some(value => marketProperties.some(previous => previous.id === value.id))) throw new Error("invalid");
   if (!current() || token !== marketPropertyGeneration) return;
   marketProperties = Object.freeze([...marketProperties, ...parsed]); marketPropertiesCursor = nextCursor;
   marketPropertySelect.replaceChildren(...marketProperties.map(value => {
    const option = element("option", "", `${value.name} · ${value.timezone}${value.currency ? ` · ${value.currency}` : ""}`); option.value = value.id; return option;
   }));
   if (propertyNode && marketProperties.some(value => value.id === propertyNode)) marketPropertySelect.value = propertyNode;
   marketPropertySelect.disabled = marketProperties.length === 0;
   marketPropertyMore.disabled = marketPropertiesCursor === null;
   if (marketProperties.length === 0) setStatus("No market-authorized properties are available on this page.", true);
  } catch (error) { if (current() && token === marketPropertyGeneration) setStatus(error?.status === 403 ? "Market access is not granted for this user." : "Market property access is unavailable.", true); }
 };
 const isCurrent = token => current() && token === generation;
 const load = async ({ afterConfirmation = false } = {}) => {
  const entryToken = ++generation;
  if (marketProperties.length === 0 && (!propertyNode || verifyPropertyNode)) await loadMarketProperties();
  else if (marketProperties.length === 0) void loadMarketProperties();
  if (!isCurrent(entryToken)) return;
  if (propertyNode && marketProperties.length > 0 && !marketProperties.some(value => value.id === propertyNode)) {
   if (verifyPropertyNode && marketPropertiesCursor !== null) { mount.dataset.marketState = "property-pending"; setStatus("Requested market property is not on this page. Load the next authorized page; no operational property was substituted."); return; }
   propertyNode = null;
  }
  if (propertyNode && marketProperties.some(value => value.id === propertyNode)) verifyPropertyNode = false;
  if (!propertyNode) { mount.dataset.marketState = "property-required"; setStatus("Choose a market-authorized property before loading evidence."); return; }
  destroyMap("Map disabled while evidence refreshes. The coordinate plot and evidence table remain available."); renderInspector(null);
  const token = ++generation; mount.dataset.marketState = "loading"; refresh.disabled = true;
  plannerGeneration += 1; clearPlanPreview(); planResult.textContent = "Saved-plan preview is invalidated while evidence refreshes.";
  clearSuggestions();
  if (state) { state.requiresReload = true; state.planRequiresReload = true; confirmBox.checked = false; render(); }
  setStatus("Loading current market evidence…");
  try {
   const [discoveryEnvelope, currentEnvelope] = await Promise.all([request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/market/discovery`), request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/market/compset`)]);
   if (!isCurrent(token)) return;
   const snapshots = tryParseMarketSnapshots(discoveryEnvelope?.discovery?.snapshots);
   const currentVersion = currentEnvelope?.compset === null ? null : currentEnvelope?.compset?.version;
   if (!snapshots || (currentVersion !== null && (!Number.isSafeInteger(currentVersion) || currentVersion < 1))) throw new Error("invalid");
   state = { sources: snapshots, source: snapshots[0].logicalId, records: snapshots[0].records, filtered: [], own: null, comparators: [], page: 0, currentVersion, saved: savedCompset(currentEnvelope?.compset, propertyNode), inflight: false, requiresReload: false, planRequiresReload: false };
   sourceSelect.replaceChildren(...snapshots.map(snapshot => { const option = element("option", "", `${snapshot.logicalId} · ${displayDate(snapshot.capturedAt)} · ${snapshot.completeness.status}`); option.value = snapshot.logicalId; return option; }));
   sourceSelect.disabled = false; filter.disabled = false; mount.dataset.marketState = "ready"; setStatus(afterConfirmation ? "Confirmation receipt recorded. Latest saved evidence loaded; review and make a new selection before another confirmation." : "Source evidence loaded. Choose records deliberately."); render(); renderSaved();
  } catch (error) {
   if (!isCurrent(token)) return;
   mount.dataset.marketState = "error";
   if (error?.status === 403) { clearPrivate(); setStatus("Market access is not granted for this property.", true); }
   else if (error?.status === 404) setStatus(afterConfirmation ? "Confirmation receipt recorded, but latest saved evidence is unavailable. Reload before a new selection." : "Market evidence is not configured for this property.", true);
   else setStatus(afterConfirmation ? "Confirmation receipt recorded, but latest saved evidence could not be refreshed. Reload before a new selection." : "Market evidence is unavailable. No selection was made.", true);
 } finally { if (isCurrent(token)) refresh.disabled = false; }
 };
 marketPropertySelect.addEventListener("change", () => {
  const selectedProperty = marketProperties.find(value => value.id === marketPropertySelect.value);
  if (!selectedProperty || !current() || state?.inflight || pending?.unknown) return;
  propertyNode = selectedProperty.id; generation += 1; clearPrivate({ preserveMarketProperties: true }); onPropertyChange(propertyNode); void load();
 });
 marketPropertyMore.addEventListener("click", () => { if (marketPropertiesCursor !== null && current() && !state?.inflight && !pending?.unknown) void loadMarketProperties(marketPropertiesCursor); });
 for (const input of [identityRecord, identityUrl, identityName, identityLatitude, identityLongitude]) input.addEventListener("input", () => { if (state?.inflight || pending?.unknown) return; suggestionGeneration += 1; clearSuggestions(); });
 for (const input of [destination, months, pointOfSale, language, rooms, adults, childAges, stays, ...sourcesControl.querySelectorAll("input")]) input.addEventListener("input", () => { if (state?.inflight || pending?.unknown) return; plannerGeneration += 1; clearPlanPreview(); planResult.textContent = "Plan conditions changed; request a fresh preview of the saved evidence."; syncPlan(); });
 identitySuggest.addEventListener("click", async () => {
  const source = state?.sources.find(value => value.logicalId === state.source);
  if (!source || !propertyNode || !current() || state.inflight || pending?.unknown) return;
  const target = {};
  if (text(identityRecord.value)) target.recordId = identityRecord.value;
  if (text(identityUrl.value)) target.publicUrl = identityUrl.value;
  if (text(identityName.value)) target.name = identityName.value;
  if (identityLatitude.value !== "" || identityLongitude.value !== "") {
   if (identityLatitude.value === "" || identityLongitude.value === "") { setStatus("Enter both source coordinates for an identity suggestion.", true); return; }
   const latitude = Number(identityLatitude.value), longitude = Number(identityLongitude.value);
   if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { setStatus("Enter both bounded source coordinates for an identity suggestion.", true); return; }
   target.coordinates = { latitude, longitude };
  }
  if (Object.keys(target).length === 0) { setStatus("Enter at least one explicit identity target; no URL or record is fetched automatically.", true); return; }
  const token = ++suggestionGeneration; identitySuggest.disabled = true; suggestions.replaceChildren();
  try {
   const result = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/market/identity/suggest`, { method: "POST", body: JSON.stringify({ snapshot: { logicalId: source.logicalId, sha256: source.sha256 }, target }) });
   if (!current() || token !== suggestionGeneration || state?.source !== source.logicalId) return;
   const items = result?.suggestions?.candidates;
   if (!result?.suggestions?.requiresConfirmation || result.suggestions.snapshot?.logicalId !== source.logicalId || result.suggestions.snapshot?.sha256 !== source.sha256 || !Array.isArray(items) || items.length > MAX_ROWS) throw new Error("invalid");
   suggestionChoices = items.map(candidate => {
    const reference = candidate?.reference, matchedBy = candidate?.matchedBy;
    const record = source.records.find(row => reference?.logicalId === source.logicalId && reference?.sha256 === source.sha256 && reference?.sourceRecordId === row.sourceRecordId);
    return record && Array.isArray(matchedBy) && matchedBy.length > 0 && matchedBy.every(reason => text(reason, 128)) ? Object.freeze({ record, matchedBy: Object.freeze([...matchedBy]) }) : null;
   });
   if (!suggestionChoices.every(Boolean)) throw new Error("invalid");
   suggestions.replaceChildren(...suggestionChoices.map((candidate, index) => {
    const label = element("label", "market-workspace__suggestion"); const radio = element("input"); radio.type = "radio"; radio.name = "market-suggestion"; radio.value = String(index); radio.checked = false; radio.addEventListener("change", () => { identityApply.disabled = !radio.checked; }); label.append(radio, document.createTextNode(`${candidate.record.name} · ${candidate.record.sourceRecordId} · matched by ${candidate.matchedBy.join(", ")}. Review before deliberately using it as a draft record.`)); return label;
   }));
   setStatus(result.suggestions.ambiguous ? "Several suggestions need an explicit manual choice; none was selected." : "Suggestion available for review; none was selected.");
  } catch (error) { if (current() && token === suggestionGeneration) { if (error?.status === 403) { clearPrivate(); setStatus("Market access is not granted for identity suggestions.", true); } else setStatus("Identity suggestions are unavailable or invalid.", true); } }
  finally { if (current() && token === suggestionGeneration) identitySuggest.disabled = false; }
 });
 identityApply.addEventListener("click", () => {
  const checked = suggestions.querySelector("input[name=market-suggestion]:checked"); const choice = checked ? suggestionChoices[Number(checked.value)] : null;
  if (!choice || !state || !current() || state.inflight || pending?.unknown) return;
  generation += 1; plannerGeneration += 1; clearPlanPreview(); planResult.textContent = "Discovery draft changed; request a fresh saved-plan preview if needed."; state.own = choice.record; state.comparators = state.comparators.filter(item => !sameRecord(item, choice.record)); confirmBox.checked = false; clearSuggestions(); render(); setStatus("Suggestion is now the editable draft only. Confirm it explicitly to persist evidence.");
 });
 planPreview.addEventListener("click", async () => {
  const persisted = state?.saved;
  if (!persisted || !propertyNode || !current() || state.inflight || pending?.unknown) return;
  const comparatorIndexes = [...savedEvidence.querySelectorAll("input[type=checkbox]:checked")].map(box => Number(box.value)).sort((left, right) => left - right);
  const selectedSources = [...sourcesControl.querySelectorAll("input:checked")].map(box => box.value);
  const stayParts = stays.value.split(",").map(value => value.trim());
  const lengthsOfStayNights = stayParts.map(value => Number(value));
  const childParts = childAges.value === "" ? [] : childAges.value.split(",").map(value => value.trim()); const parsedChildAges = childParts.map(value => Number(value));
  const conditions = normalizePlanRequestConditions({ destination: destination.value, lookaheadMonths: Number(months.value), selectedSources, guests: { rooms: Number(rooms.value), adults: Number(adults.value), childAges: parsedChildAges }, pointOfSaleMarket: pointOfSale.value, language: language.value, lengthsOfStayNights });
  const comparatorReferences = comparatorIndexes.map(index => persisted.comparators[index]);
  if (comparatorIndexes.length < 1 || comparatorIndexes.length > MAX_PLAN_COMPARATORS || !conditions || comparatorReferences.some(value => !value)) { clearPlanPreview(); planResult.textContent = "Select 1–200 saved comparators, at least one source and valid normalized whole-number stay lengths and child ages before previewing."; return; }
  const binding = Object.freeze({ extensionId: persisted.extensionId, version: persisted.version, comparatorIndexes: Object.freeze(comparatorIndexes), comparatorReferences: Object.freeze(comparatorReferences.map(value => Object.freeze({ logicalId: value.logicalId, sha256: value.sha256, sourceRecordId: value.sourceRecordId }))), conditions });
  const token = ++plannerGeneration; clearPlanPreview(); planResult.textContent = "Requesting a bounded, non-executable preview from the saved evidence…"; planPreview.disabled = true;
  try {
   const response = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/market/plan/preview`, { method: "POST", body: JSON.stringify({ expectedCompset: { extensionId: binding.extensionId, version: binding.version }, comparatorIndexes: binding.comparatorIndexes, conditions: binding.conditions }) });
   if (!current() || token !== plannerGeneration || state?.saved !== persisted) return;
   const preview = tryParseMarketPlanPreview(response, binding);
   if (!preview) throw new Error("invalid");
   renderPlanPreview(preview); planResult.textContent = `Preview only — ${preview.plan.selectedRequestCount} selected, ${preview.plan.deferredRequestCount} deferred; no collection is scheduled.`;
  } catch (error) { if (current() && token === plannerGeneration) { clearPlanPreview(); if (error?.status === 403) { clearPrivate(); setStatus("Market access is not granted for saved-plan preview.", true); } else if (error?.status === 409) { state.planRequiresReload = true; planResult.textContent = "The saved competitor set changed. Reload before a fresh preview."; } else planResult.textContent = "Saved-plan preview is unavailable or invalid; no collection was scheduled."; } }
  finally { if (current() && token === plannerGeneration) syncPlan(); }
 });
 sourceSelect.addEventListener("change", () => { if (!state || !current() || state.inflight || pending?.unknown) return; const source = state.sources.find(item => item.logicalId === sourceSelect.value); if (!source) return; destroyMap("Map disabled because the source snapshot changed. The coordinate plot and evidence table remain available."); renderInspector(null); generation += 1; plannerGeneration += 1; clearPlanPreview(); clearSuggestions(); state.source = source.logicalId; state.records = source.records; state.own = null; state.comparators = []; state.page = 0; confirmBox.checked = false; pending = null; render(); });
 filter.addEventListener("input", () => { if (!state || !current() || state.inflight || pending?.unknown) return; generation += 1; plannerGeneration += 1; clearPlanPreview(); clearSuggestions(); state.page = 0; pending = null; render(); });
 previous.addEventListener("click", () => { if (state && !state.inflight && !pending?.unknown && state.page > 0) { state.page -= 1; render(); } }); next.addEventListener("click", () => { if (state && !state.inflight && !pending?.unknown && (state.page + 1) * PAGE_SIZE < state.filtered.length) { state.page += 1; render(); } });
 confirmBox.addEventListener("change", syncConfirm); refresh.addEventListener("click", () => void load());
 mapEnable.addEventListener("click", enableMap); mapDisable.addEventListener("click", () => { if (!state?.inflight && !pending?.unknown) destroyMap(); });
 for (const [key, box] of attributeBoxes) box.addEventListener("change", () => {
  if (!state || !current() || state.inflight || pending?.unknown) { box.checked = tableAttributes.has(key); return; }
  if (box.checked) tableAttributes.add(key); else tableAttributes.delete(key); render();
 });
 confirm.addEventListener("click", async () => {
  if (!state || !current() || !confirmBox.checked) return;
  const own = selected(); const prepared = own ? command(state.currentVersion, own, comparable()) : null; if (!prepared) return;
  pending = pending?.body === prepared.body && pending.property === propertyNode ? pending : { key: crypto.randomUUID(), body: prepared.body, property: propertyNode, unknown: false };
  const token = ++generation; state.inflight = true; mount.dataset.marketState = "confirming"; render(); setStatus("Confirming the exact selected evidence…");
  try {
   const response = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/market/compset/confirm`, { method: "POST", headers: { "idempotency-key": pending.key }, body: pending.body });
   if (!isCurrent(token)) return;
   const version = response?.confirmation?.version?.version; if (!Number.isSafeInteger(version) || version < 1) throw new Error("invalid");
   state.currentVersion = version; state.inflight = false; pending = null; confirmBox.checked = false; mount.dataset.marketState = "confirmed"; setStatus("Confirmation receipt recorded. Refreshing the latest saved evidence before any new selection."); render(); void load({ afterConfirmation: true });
  } catch (error) {
   if (!isCurrent(token)) return;
   state.inflight = false;
   if (error?.status === 409) { pending = null; confirmBox.checked = false; setStatus("The current competitor set changed. Reload and make an entirely fresh confirmation.", true); void load(); }
   else if (error?.status === 403) { clearPrivate(); setStatus("Market access is no longer granted. Selected evidence was cleared.", true); }
   else if (error?.status === 400 || error?.status === 404) { pending = null; state.requiresReload = true; confirmBox.checked = false; setStatus("The selected evidence is no longer valid. Reload before confirming again.", true); }
   else { pending.unknown = true; setStatus("The confirmation outcome is unknown. Retry the unchanged selection with the same key.", true); }
   render();
  }
 });
 return Object.freeze({ load, refresh: load, suspend() { generation += 1; destroyMap("Map disabled while this workspace is hidden. The exact confirmation state is retained."); mount.hidden = true; }, dispose() { generation += 1; destroyMap("Map disabled because this workspace was disposed."); disposed = true; root.replaceChildren(); } });
}

export const MARKET_WORKSPACE_LIMITS = Object.freeze({ pageSize: PAGE_SIZE, maximumRows: MAX_ROWS, maximumConfirmBytes: MAX_CONFIRM_BYTES });
