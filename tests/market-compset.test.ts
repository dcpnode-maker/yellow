import { describe, expect, test } from "bun:test";
import {
  MARKET_COMPSET_SCHEMA, MARKET_COMPSET_LIMITS, MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE,
  MarketCompsetService, tryParseMarketCompsetCommand, tryParseMarketCompsetContent,
  type MarketCompsetActor, type MarketCompsetDependencies, type MarketCompsetContent,
  type MarketRegionalAdmission, type MarketCompsetReference,
  type MarketCompsetProperty, type MarketCompsetPrincipal,
  OVERTURE_REGIONAL_ARTIFACT_PROVENANCE,
} from "../src/contexts/distribution";
import { validateJsonSchema, type Tx, type JsonValue, type IdempotencyInput, type IdempotencyCommandResult } from "../src/kernel";

const tenant = "00000000-0000-0000-0000-000000004720";
const property = "00000000-0000-0000-0000-000000004721";
const user = "00000000-0000-0000-0000-000000004722";
const request = "00000000-0000-0000-0000-000000004723";
const extension = "00000000-0000-0000-0000-000000004724";
const actor: MarketCompsetActor = { tenantId: tenant, actorId: user, propertyNode: property, requestId: request,
  scopes: [MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE] };
const stamp = "2026-09-13T08:00:00.000Z";
const region = { minimumLatitude: 24, maximumLatitude: 25, minimumLongitude: 46, maximumLongitude: 47 };
function record(id: string) { return { provenance: { source: "overture", release: "2026-08-19.0", schema: "1.18.0",
  recordId: id, attribution: "Synthetic source evidence" }, name: `Synthetic ${id} · परीक्षण`,
  coordinates: { latitude: 24.7, longitude: 46.6 }, address: null, websites: ["https://example.com/"],
  categories: ["hotel"], operatingStatus: "unknown" as const }; }
function admission(count = 3, logicalId = "synthetic", capturedAt = stamp): MarketRegionalAdmission {
  const records = Array.from({ length: count }, (_, index) => record(`source-${index}`));
  return { identity: { logicalId, sha256: "a".repeat(64), byteLength: 1234, region }, artifact: {
    records, completeness: { scope: "publisher-range-extract-all-places", status: "complete", sourceRows: count,
      returnedRecords: count, rejectedRows: 0 }, rawRows: [], rejectedRows: [], fieldExclusions: [],
    source: { ...OVERTURE_REGIONAL_ARTIFACT_PROVENANCE, capturedAt, region, limit: 500, moreAvailable: false,
      query: "synthetic fixture", sourceObjects: [], tool: { duckdbVersion: "1.5.5", wheelSha256: "a".repeat(64), httpfsSha256: "b".repeat(64) } },
  } };
}
function ref(sourceRecordId = "source-0", logicalId = "synthetic"): MarketCompsetReference {
  return { logicalId, sha256: "a".repeat(64), sourceRecordId };
}
function command() { return { expectedActiveVersion: null, ownProperty: ref(), comparators: [ref("source-1")] }; }
function persisted(): MarketCompsetContent {
  const source = admission();
  const item = (id: string) => ({ reference: ref(id), record: record(id), capturedAt: stamp,
    coordinateMethod: "source-wkb-point" as const, completeness: source.artifact.completeness });
  return { format: "yellow/market-compset/v1", propertyNode: property, confirmedBy: user, confirmedAt: stamp,
    ownProperty: item("source-0"), comparators: [item("source-1")] };
}

/** Sequencing/failure-containment model only; real authorization and races are integration proofs. */
function harness(options: { denied?: boolean; eventFailure?: boolean; admissions?: readonly MarketRegionalAdmission[]; replay?: unknown;
  initialContent?: MarketCompsetContent; properties?: MarketCompsetProperty[]; inactive?: boolean;
  metadata?: { timezone: string | null; currency: string | null; as_of_utc: string } } = {}) {
  const calls: string[] = [];
  const bindings: unknown[][] = [];
  let stored: Array<{ id: string; tenant_id: string; key: string; version: number; status: string; content: unknown }> = options.initialContent
    ? [{ id: extension, tenant_id: tenant, key: `property:${property}`, version: 1, status: "active", content: options.initialContent }] : [];
  let effects = 0;
  let saved: { stored: typeof stored; effects: number } | null = null;
  let idempotencyCalls = 0;
  const query = async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const sql = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push(sql);
    bindings.push(_values);
    if (sql.includes("assert_market_compset_authority")) {
      if (options.denied) throw Object.assign(new Error("private authority details"), { code: "ERR_POSTGRES_SERVER_ERROR", errno: "42501" });
      return [{ authorized: true }];
    }
    if (sql.startsWith("SELECT id, tenant_id")) return stored.filter(row => row.status === "active");
    if (sql.startsWith("SELECT pg_advisory")) return [];
    if (sql.includes("AS confirmed_at")) return [{ confirmed_at: stamp }];
    if (sql.includes("AS as_of_utc")) return [options.metadata ?? { timezone: "Asia/Riyadh", currency: "SAR", as_of_utc: stamp }];
    if (sql.includes("AS active")) return [{ active: !options.inactive }];
    if (sql.startsWith("SELECT target.id")) return (options.properties ?? []).filter(row => _values[2] === null || row.id > String(_values[2])).slice(0, 51);
    if (sql.startsWith("UPDATE extension SET status = 'active'")) {
      const row = stored.find(item => item.status === "draft");
      if (!row) return [];
      row.status = "active"; effects += 1; return [row];
    }
    if (sql.startsWith("UPDATE extension SET status = 'retired'")) {
      const row = stored.find(item => item.status === "active");
      if (!row) return [];
      row.status = "retired"; effects += 1; return [{ id: row.id }];
    }
    if (sql.startsWith("INSERT INTO fact_log")) {
      effects += 1;
      return [{ id: request, tenant_id: tenant, entity_type: "extension", entity_id: extension, fact_type: "confirmed",
        valid_from: new Date(stamp), recorded_at: new Date(stamp), business_date: "2026-09-13", actor_id: user, payload: {}, supersedes: null }];
    }
    throw new Error(`Unexpected model query: ${sql}`);
  };
  const tx = Object.assign(query, { unsafe: async (sql: string) => {
    calls.push(sql);
    if (sql.startsWith("SAVEPOINT")) saved = { stored: structuredClone(stored), effects };
    if (sql.startsWith("ROLLBACK TO")) { stored = saved!.stored; effects = saved!.effects; }
    return [];
  } }) as unknown as Tx;
  const dependencies: MarketCompsetDependencies = {
    admissions: options.admissions ?? [admission()],
    registry: { async createVersion(_tx, input) {
      calls.push("registry.createVersion"); effects += 1;
      const row = { id: extension, tenant_id: tenant, key: input.key, version: stored.length + 1, status: "draft", content: input.content };
      stored.push(row);
      return { id: row.id, tenantId: tenant, type: input.type, key: input.key, version: row.version, content: input.content, status: "draft" };
    } },
    events: { async publish(_tx, input) {
      calls.push("events.publish"); effects += 1;
      if (options.eventFailure) throw new Error("private E:\\source artifact leaked detail");
      return { ...input, id: request, seq: 1, eventVersion: 1, causationId: null, occurredAt: new Date(stamp) };
    } },
    idempotency: { async execute<T extends JsonValue>(_tx: Tx, _input: IdempotencyInput,
      operation: (tx: Tx) => Promise<IdempotencyCommandResult<T>>) {
      calls.push("idempotency.execute"); idempotencyCalls += 1;
      if (options.replay !== undefined) return { status: 201, body: options.replay as T, replayed: true };
      return { ...await operation(tx), replayed: false };
    } },
  };
  return { service: new MarketCompsetService(dependencies), tx, calls, bindings,
    state: () => ({ stored, effects, idempotencyCalls }) };
}

describe("Order472 strict market confirmation contracts", () => {
  test("requires expected version; accepts explicit empty clear and bounded references only", () => {
    expect(tryParseMarketCompsetCommand(command()).ok).toBe(true);
    expect(tryParseMarketCompsetCommand({ ...command(), comparators: [] }).ok).toBe(true);
    expect(tryParseMarketCompsetCommand({ ownProperty: ref(), comparators: [] }).ok).toBe(false);
    for (const bad of [-1, 0, 1.1, Infinity, "1", 2_147_483_648, undefined]) {
      expect(tryParseMarketCompsetCommand({ ...command(), expectedActiveVersion: bad }).ok).toBe(false);
    }
    for (const field of ["tenantId", "actorId", "propertyNode", "evidence", "path"]) {
      expect(tryParseMarketCompsetCommand({ ...command(), [field]: "forged" }).ok).toBe(false);
    }
    expect(tryParseMarketCompsetCommand({ ...command(), ownProperty: { ...ref(), coordinates: {} } }).ok).toBe(false);
    expect(tryParseMarketCompsetCommand({ ...command(), ownProperty: { ...ref(), sha256: "A".repeat(64) } }).ok).toBe(false);
  });
  test("caps at 500; rejects sparse/accessor/prototype/symbol input without invoking getters", () => {
    expect(tryParseMarketCompsetCommand({ ...command(), comparators: Array.from({ length: 500 }, (_, i) => ref(String(i))) }).ok).toBe(true);
    expect(tryParseMarketCompsetCommand({ ...command(), comparators: Array(501).fill(ref()) }).ok).toBe(false);
    expect(tryParseMarketCompsetCommand({ ...command(), comparators: Array(1) }).ok).toBe(false);
    let invoked = false;
    const hostile = { ...command(), get comparators() { invoked = true; return []; } };
    expect(tryParseMarketCompsetCommand(hostile).ok).toBe(false);
    expect(invoked).toBe(false);
    expect(tryParseMarketCompsetCommand(Object.assign(Object.create({}), command())).ok).toBe(false);
    expect(tryParseMarketCompsetCommand({ ...command(), [Symbol("extra")]: 1 }).ok).toBe(false);
    const parsed = tryParseMarketCompsetCommand(command());
    expect(parsed.ok && Object.isFrozen(parsed.value.comparators[0])).toBe(true);
  });
  test("validates canonical schema, immutable history, own exclusion and exact evidence relationships", () => {
    expect(validateJsonSchema(MARKET_COMPSET_SCHEMA, persisted())).toEqual([]);
    expect(Object.isFrozen(MARKET_COMPSET_SCHEMA.properties)).toBe(true);
    const parsed = tryParseMarketCompsetContent(persisted(), property);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && Object.isFrozen(parsed.value.ownProperty.record.coordinates)).toBe(true);
    for (const modified of [
      { ...persisted(), propertyNode: tenant },
      { ...persisted(), comparators: [persisted().ownProperty] },
      { ...persisted(), comparators: [persisted().comparators[0], persisted().comparators[0]] },
      { ...persisted(), ownProperty: { ...persisted().ownProperty, reference: ref("wrong") } },
      { ...persisted(), ownProperty: { ...persisted().ownProperty, coordinateMethod: "bbox-min" } },
      { ...persisted(), confirmedAt: "2026-02-30T08:00:00.000Z" },
    ]) expect(tryParseMarketCompsetContent(modified, property).ok).toBe(false);
  });
  test("preserves valid source instant spelling at zero, one, two and three fractional digits", () => {
    for (const capturedAt of ["2026-09-13T08:00:00Z", "2026-09-13T08:00:00.1Z", "2026-09-13T08:00:00.12Z", stamp]) {
      const value = { ...persisted(), ownProperty: { ...persisted().ownProperty, capturedAt } };
      const parsed = tryParseMarketCompsetContent(value, property);
      expect(parsed.ok && parsed.value.ownProperty.capturedAt).toBe(capturedAt);
    }
  });
});

describe("Order472 service sequencing models (not database concurrency proof)", () => {
  test("exposes bounded immutable dated discovery and copies composition inputs", async () => {
    const source = admission();
    const proof = harness({ admissions: [source] });
    (source.artifact.records[0] as { name: string }).name = "changed after construction";
    const result = await proof.service.discovery(proof.tx, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.snapshots[0]?.capturedAt).toBe(stamp);
    expect(result.value.snapshots[0]?.records[0]?.name).toContain("Synthetic");
    expect(Object.isFrozen(result.value.snapshots[0]?.records)).toBe(true);
  });
  test("fails a whole over-500 catalog rather than silently truncating", async () => {
    const proof = harness({ admissions: [admission(300, "a"), admission(201, "b")] });
    const result = await proof.service.discovery(proof.tx, actor);
    expect(!result.ok && result.error.code).toBe("unavailable");
    expect(MARKET_COMPSET_LIMITS.maximumComparators).toBe(500);
  });
  test("requires scope and locked current authority before idempotency or replay", async () => {
    const proof = harness({ denied: true, replay: { extensionId: extension, version: 1, content: persisted() } });
    const deniedResult = await proof.service.confirm(proof.tx, actor, command(), "test-key-123");
    expect(!deniedResult.ok && deniedResult.error.code).toBe("forbidden");
    expect(proof.state().idempotencyCalls).toBe(0);
    expect(proof.state().effects).toBe(0);
    const missing = harness();
    const denied = await missing.service.current(missing.tx, { ...actor, scopes: [] });
    expect(!denied.ok && denied.error.code).toBe("forbidden");
    expect(missing.calls.some(sql => sql.includes("assert_market_compset_authority"))).toBe(false);
  });
  test("locks exact extension family before expected version and saves one version", async () => {
    const proof = harness();
    const result = await proof.service.confirm(proof.tx, actor, command(), "test-key-123");
    expect(result.ok).toBe(true);
    const lock = proof.calls.findIndex(sql => sql.includes("pg_advisory_xact_lock"));
    const current = proof.calls.findIndex(sql => sql.startsWith("SELECT id, tenant_id"));
    expect(lock).toBeGreaterThan(-1); expect(current).toBeGreaterThan(lock);
    expect(proof.state().stored.map(row => row.status)).toEqual(["active"]);
    expect(result.ok && result.value.version.content.ownProperty.record.operatingStatus).toBe("unknown");
    expect(result.ok && Object.isFrozen(result.value.version.content)).toBe(true);
  });
  test("rejects drift, noncatalog identity, duplicate evidence and own membership with no effects", async () => {
    for (const changed of [
      { ...command(), ownProperty: { ...ref(), sha256: "b".repeat(64) } },
      { ...command(), ownProperty: ref("absent") },
      { ...command(), comparators: [ref()] },
      { ...command(), comparators: [ref("source-1"), ref("source-1")] },
      { ...command(), expectedActiveVersion: 1 },
    ]) {
      const proof = harness();
      expect((await proof.service.confirm(proof.tx, actor, changed, "test-key-123")).ok).toBe(false);
      expect(proof.state().effects).toBe(0);
    }
    const overlap = harness({ admissions: [admission(3), admission(3, "overlap")] });
    expect((await overlap.service.confirm(overlap.tx, actor, { ...command(), comparators: [ref("source-0", "overlap")] }, "test-key-123")).ok).toBe(false);
  });
  test("late outbox failure rolls back model effects before a static Result", async () => {
    const proof = harness({ eventFailure: true });
    const result = await proof.service.confirm(proof.tx, actor, command(), "test-key-123");
    expect(!result.ok && result.error.code).toBe("unavailable");
    expect(proof.state().effects).toBe(0); expect(proof.state().stored).toEqual([]);
    expect(proof.calls.some(sql => sql.startsWith("ROLLBACK TO SAVEPOINT"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private");
  });
  test("validates replay content, reauthorizes first and does not imply current version", async () => {
    const proof = harness({ replay: { extensionId: extension, version: 1, content: persisted() } });
    const result = await proof.service.confirm(proof.tx, actor, command(), "test-key-123");
    expect(result.ok && result.value.replayed).toBe(true);
    expect(proof.calls.findIndex(sql => sql.includes("assert_market_compset_authority"))).toBeLessThan(proof.calls.indexOf("idempotency.execute"));
    expect(proof.state().effects).toBe(0);
    const malformed = harness({ replay: { extensionId: extension, version: 1, content: { ...persisted(), propertyNode: tenant } } });
    const rejected = await malformed.service.confirm(malformed.tx, actor, command(), "test-key-123");
    expect(!rejected.ok && rejected.error.code).toBe("invalid_state");
  });
  test("snapshots actor and command before its first asynchronous boundary", async () => {
    const proof = harness();
    const caller = { ...actor, scopes: [...actor.scopes] };
    const input = command();
    const pending = proof.service.confirm(proof.tx, caller, input, "test-key-123");
    caller.actorId = tenant; caller.propertyNode = tenant; caller.scopes.length = 0;
    (input.ownProperty as { sourceRecordId: string }).sourceRecordId = "forged";
    const result = await pending;
    expect(result.ok && result.value.version.content.confirmedBy).toBe(user);
    expect(result.ok && result.value.version.content.propertyNode).toBe(property);
  });
});

function principal(): MarketCompsetPrincipal {
  return { tenantId: tenant, actorId: user, requestId: request, scopes: [MARKET_COMPSET_READ_SCOPE] };
}
function identityInput() { return { snapshot: { logicalId: "synthetic", sha256: "a".repeat(64) }, target: { recordId: "source-0" } }; }
function previewInput() { return { expectedCompset: { extensionId: extension, version: 1 }, comparatorIndexes: [0], conditions: {
  destination: "Riyadh", lookaheadMonths: 3, selectedSources: ["booking-mcp"], guests: { rooms: 1, adults: 2, childAges: [] as number[] },
  pointOfSaleMarket: "sa", language: "en-us", lengthsOfStayNights: [1],
} }; }

describe("Order472 Q267 authorized read-only bridges (sequencing models, not DB proof)", () => {
  test("suggests exact snapshot evidence without confirmation or URL persistence", async () => {
    const proof = harness({ admissions: [admission(3), admission(3, "other-release")] });
    const result = await proof.service.suggestIdentity(proof.tx, actor, identityInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.requiresConfirmation).toBe(true);
    expect(result.value.ambiguous).toBe(false);
    expect(result.value.candidates.map(item => item.reference)).toEqual([ref()]);
    expect(result.value.candidates[0]?.matchedBy).toEqual(["source-record-id"]);
    expect(result.value.candidates[0]?.capturedAt).toBe(stamp);
    expect(result.value.candidates[0]?.record.operatingStatus).toBe("unknown");
    expect(Object.isFrozen(result.value.candidates[0]?.matchedBy)).toBe(true);
    const shared = await proof.service.suggestIdentity(proof.tx, actor, { ...identityInput(), target: { publicUrl: "https://example.com/" } });
    expect(shared.ok && shared.value.ambiguous).toBe(true);
    expect(shared.ok && shared.value.candidates.length).toBe(3);
    expect(JSON.stringify(result)).not.toContain("publicUrl");
    expect(proof.state().effects).toBe(0); expect(proof.state().idempotencyCalls).toBe(0);
  });
  test("rejects unsafe, empty, forged and accessor identity input before I/O; unmatched is explicit", async () => {
    let getterCalls = 0;
    for (const target of [{}, { callerLabel: "hotel" }, { source: "forged", recordId: "source-0" },
      { get name() { getterCalls += 1; return "source-0"; } },
      ...["https://a:b@example.com/", "http://example.com/", "https://example.com/?secret=x", "https://example.com/#secret", "x".repeat(501)].map(publicUrl => ({ publicUrl })),
      { coordinates: { latitude: NaN, longitude: 0 } }, { recordId: " " }]) {
      const proof = harness();
      const result = await proof.service.suggestIdentity(proof.tx, actor, { ...identityInput(), target });
      expect(!result.ok && result.error.code).toBe("invalid_input");
      expect(proof.calls).toEqual([]);
    }
    expect(getterCalls).toBe(0);
    const proof = harness();
    const drift = await proof.service.suggestIdentity(proof.tx, actor, { ...identityInput(), snapshot: { logicalId: "synthetic", sha256: "b".repeat(64) } });
    expect(!drift.ok && drift.error.code).toBe("invalid_input");
    const absent = await proof.service.suggestIdentity(proof.tx, actor, { ...identityInput(), target: { publicUrl: "https://example.com/other" } });
    expect(absent.ok && absent.value.candidates).toEqual([]);
    expect(absent.ok && absent.value.requiresConfirmation).toBe(true);
  });
  test("snapshots suggestion targets and actors before await and reauthorizes every read", async () => {
    const proof = harness(); const input = identityInput(); const caller = { ...actor, scopes: [...actor.scopes] };
    const pending = proof.service.suggestIdentity(proof.tx, caller, input);
    input.target.recordId = "forged"; caller.actorId = tenant; caller.scopes.length = 0;
    const result = await pending;
    expect(result.ok && result.value.candidates[0]?.reference).toEqual(ref());
    expect(proof.bindings.some(values => values.includes(user))).toBe(true);
    const denied = harness({ denied: true });
    expect((await denied.service.suggestIdentity(denied.tx, actor, identityInput())).ok).toBe(false);
    expect(denied.state().effects).toBe(0);
  });
  test("previews historical persisted evidence with exact version lock and server date/currency", async () => {
    const proof = harness({ initialContent: persisted(), admissions: [],
      metadata: { timezone: "Asia/Dubai", currency: "AED", as_of_utc: "2026-09-30T23:15:00.000Z" } });
    const input = previewInput(); input.conditions.selectedSources = ["booking-mcp", "trivago-mcp"];
    const result = await proof.service.previewPlan(proof.tx, actor, input);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.value.previewOnly).toBe(true); expect(result.value.executable).toBe(false);
    expect(result.value.compset).toEqual(input.expectedCompset);
    expect(result.value.propertyTimezone).toBe("Asia/Dubai"); expect(result.value.currency).toBe("AED");
    expect(result.value.conditions.language).toBe("en-US"); expect(result.value.conditions.pointOfSaleMarket).toBe("SA");
    expect(result.value.plan.propertyLocalDate).toBe("2026-10-01"); expect(result.value.plan.arrivalEndExclusive).toBe("2027-01-01");
    expect(result.value.plan.requestedPotentialQueryCount).toBe(184); expect(result.value.plan.selectedRequestCount).toBe(100);
    expect(result.value.plan.deferredDueToBudgetCount).toBe(84); expect(result.value.plan.deferredDueToCadenceCount).toBe(0);
    expect(result.value.sample).toHaveLength(10);
    expect(result.value.sample[0]?.cadence).toEqual({ kind: "fixed", intervalMinutes: 60 });
    expect(result.value.comparatorMapping[0]?.reference).toEqual(ref("source-1"));
    expect(result.value.comparatorMapping[0]?.token).toMatch(/^evidence:[0-9a-f]{64}$/);
    expect(Object.isFrozen(result.value.comparatorMapping[0]?.reference)).toBe(true);
    expect(JSON.stringify(result.value)).not.toContain('"key"'); expect(JSON.stringify(result.value)).not.toContain("entitlement");
    expect(proof.calls.findIndex(sql => sql.includes("pg_advisory_xact_lock"))).toBeGreaterThan(proof.calls.findIndex(sql => sql.includes("assert_market_compset_authority")));
    expect(proof.calls.findIndex(sql => sql.startsWith("SELECT id, tenant_id"))).toBeGreaterThan(proof.calls.findIndex(sql => sql.includes("pg_advisory_xact_lock")));
    expect(proof.bindings.some(values => values.includes(`extension-version:${tenant}:market_compset:property:${property}`))).toBe(true);
    expect(proof.state().effects).toBe(0); expect(proof.state().idempotencyCalls).toBe(0);
  });
  test("preview rejects missing/stale saved version and invalid index sets without effects", async () => {
    for (const indexes of [[], [0, 0], [-1], [500], [0.1], Array.from({ length: 201 }, (_, index) => index)]) {
      const proof = harness({ initialContent: persisted() });
      const result = await proof.service.previewPlan(proof.tx, actor, { ...previewInput(), comparatorIndexes: indexes });
      expect(!result.ok && result.error.code).toBe("invalid_input"); expect(proof.calls).toEqual([]);
    }
    for (const change of [{ comparatorIndexes: [1] }, { expectedCompset: { extensionId: request, version: 1 } },
      { expectedCompset: { extensionId: extension, version: 2 } }]) {
      const proof = harness({ initialContent: persisted() });
      expect((await proof.service.previewPlan(proof.tx, actor, { ...previewInput(), ...change })).ok).toBe(false);
      expect(proof.state().effects).toBe(0); expect(proof.state().idempotencyCalls).toBe(0);
    }
    const empty = harness(); const missing = await empty.service.previewPlan(empty.tx, actor, previewInput());
    expect(!missing.ok && missing.error.code).toBe("conflict");
    const denied = harness({ initialContent: persisted(), denied: true });
    const forbidden = await denied.service.previewPlan(denied.tx, actor, previewInput());
    expect(!forbidden.ok && forbidden.error.code).toBe("forbidden");
    expect(denied.calls.some(sql => sql.includes("pg_advisory_xact_lock"))).toBe(false);
  });
  test("preview rejects condition authority injection and snapshots nested selections before await", async () => {
    for (const change of [{ tenantId: tenant }, { currency: "USD" }, { entitlement: "paid" }, { now: stamp }, { lastSuccessByKey: {} },
      { selectedSources: [] }, { selectedSources: ["booking-mcp", "booking-mcp"] }, { lengthsOfStayNights: [1, 1] },
      { language: "not_a_locale" }, { pointOfSaleMarket: "1A" }, { destination: "x".repeat(257) }]) {
      const proof = harness({ initialContent: persisted() }); const input = previewInput();
      const result = await proof.service.previewPlan(proof.tx, actor, { ...input, conditions: { ...input.conditions, ...change } });
      expect(!result.ok && result.error.code).toBe("invalid_input"); expect(proof.calls).toEqual([]);
    }
    const proof = harness({ initialContent: persisted() }); const input = previewInput();
    const pending = proof.service.previewPlan(proof.tx, actor, input);
    input.expectedCompset.version = 999; input.comparatorIndexes[0] = 499; input.conditions.guests.adults = 100;
    input.conditions.lengthsOfStayNights[0] = 365;
    const result = await pending;
    expect(result.ok && result.value.conditions.guests.adults).toBe(2);
    expect(result.ok && result.value.conditions.lengthsOfStayNights).toEqual([1]);
  });
  test("200-index preview is bounded and evidence drift changes opaque tokens", async () => {
    const original = persisted();
    const saved = { ...original, comparators: Array.from({ length: 250 }, (_, index) => ({ ...original.comparators[0]!,
      reference: ref(`many-${index}`), record: record(`many-${index}`) })) };
    const proof = harness({ initialContent: saved });
    const input = { ...previewInput(), comparatorIndexes: Array.from({ length: 200 }, (_, i) => i) };
    const started = performance.now();
    const pending = proof.service.previewPlan(proof.tx, actor, input);
    const synchronousBeforeFirstAwaitMs = performance.now() - started;
    const result = await pending;
    console.info(JSON.stringify({ proof: "Q267 bounded planner model (not native DB)", comparators: 200,
      synchronousBeforeFirstAwaitMs, totalMs: performance.now() - started, responseBytes: new TextEncoder().encode(JSON.stringify(result)).byteLength }));
    expect(result.ok && result.value.comparatorMapping.length).toBe(200);
    expect(result.ok && result.value.sample.length).toBe(10);
    const before = harness({ initialContent: original });
    const after = harness({ initialContent: { ...original, ownProperty: { ...original.ownProperty,
      reference: { ...original.ownProperty.reference, sha256: "b".repeat(64) } } } });
    const left = await before.service.previewPlan(before.tx, actor, previewInput());
    const right = await after.service.previewPlan(after.tx, actor, previewInput());
    expect(left.ok && right.ok && left.value.comparatorMapping[0]?.token !== right.value.comparatorMapping[0]?.token).toBe(true);
    for (const metadata of [{ timezone: null, currency: "SAR", as_of_utc: stamp }, { timezone: "Asia/Riyadh", currency: null, as_of_utc: stamp },
      { timezone: "invalid/zone", currency: "SAR", as_of_utc: stamp }, { timezone: "Asia/Riyadh", currency: "SAR", as_of_utc: "yesterday" }]) {
      const invalid = harness({ initialContent: original, metadata }); const response = await invalid.service.previewPlan(invalid.tx, actor, previewInput());
      expect(!response.ok && response.error.code).toBe("invalid_state");
    }
  });
  test("policy validation does not impose a hypothetical month's request budget", async () => {
    const proof = harness({ initialContent: persisted(), metadata: { timezone: "UTC", currency: "SAR", as_of_utc: "2027-02-01T00:00:00Z" } });
    const input = previewInput(); input.conditions.lengthsOfStayNights = Array.from({ length: 44 }, (_, index) => index + 1);
    const result = await proof.service.previewPlan(proof.tx, actor, input);
    expect(result.ok && result.value.plan.requestedPotentialQueryCount).toBe(3_916);
    const over = harness({ initialContent: persisted(), metadata: { timezone: "UTC", currency: "SAR", as_of_utc: "2027-01-01T00:00:00Z" } });
    const invalid = await over.service.previewPlan(over.tx, actor, { ...input, conditions: { ...input.conditions, lengthsOfStayNights: Array.from({ length: 45 }, (_, i) => i + 1) } });
    expect(!invalid.ok && invalid.error.code).toBe("invalid_input");
  });
  test("market property pages have strict opaque keysets/current predicates and no availability grants", async () => {
    const properties = Array.from({ length: 52 }, (_, index) => ({ id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
      name: `Property ${index}`, timezone: "Asia/Riyadh", currency: "SAR" }));
    const proof = harness({ properties }); const caller = principal();
    const first = await proof.service.properties(proof.tx, caller, { cursor: null });
    expect(first.ok).toBe(true); if (!first.ok) return;
    expect(first.value.properties).toHaveLength(50); expect(first.value.nextCursor).toHaveLength(48);
    expect(Buffer.from(first.value.nextCursor!, "base64url").toString("utf8")).toBe(properties[49]!.id);
    const next = await proof.service.properties(proof.tx, caller, { cursor: first.value.nextCursor });
    expect(next.ok && next.value.properties.map(item => item.id)).toEqual(properties.slice(50).map(item => item.id));
    expect(next.ok && next.value.nextCursor).toBeNull();
    expect(proof.calls.find(sql => sql.startsWith("SELECT target.id"))).toContain("scope.path @> target.path");
    expect(proof.calls.join(" ")).not.toContain("OFFSET"); expect(proof.calls.join(" ")).not.toContain("availability");
    expect(proof.bindings.some(values => values.includes(MARKET_COMPSET_READ_SCOPE))).toBe(true);
    expect(Object.isFrozen(first.value.properties[0])).toBe(true); expect(proof.state().effects).toBe(0);
    for (const input of [{}, { cursor: "" }, { cursor: property }, { cursor: "a".repeat(49) }, { cursor: first.value.nextCursor, tenantId: tenant }]) {
      const invalid = await proof.service.properties(proof.tx, caller, input); expect(!invalid.ok && invalid.error.code).toBe("invalid_input");
    }
    const disabled = harness({ inactive: true, properties });
    const invalid = await disabled.service.properties(disabled.tx, caller, { cursor: null });
    expect(!invalid.ok && invalid.error.code).toBe("forbidden");
    const missingScope = await proof.service.properties(proof.tx, { ...caller, scopes: [] }, { cursor: null });
    expect(!missingScope.ok && missingScope.error.code).toBe("forbidden");
  });
});
