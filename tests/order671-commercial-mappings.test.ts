import { expect, test } from "bun:test";
import { CommercialMappingConflictError, CommercialMappingService, CommercialMappingValidationError } from "../src/contexts/reporting";
import { createAuditEnvelope, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-4000-8000-000000000001";
const PROPERTY = "00000000-0000-4000-8000-000000000002";
const ACTOR = "00000000-0000-4000-8000-000000000003";
const EXTENSION = "00000000-0000-4000-8000-000000000004";
const CONTENT = {
  demandGroups: [{ code: "CORP", label: "Corporate", segments: [{ code: "NEG", label: "Negotiated" }] }],
  distributionGroups: [{ code: "DIRECT", label: "Direct", sources: [{ code: "WEB", label: "Web", channelCodes: ["WEB"] }] }],
  companies: [], roomClasses: [], marketMappings: [{ marketCode: "CORP", segmentCode: "NEG" }],
} as const;

function envelope() {
  return createAuditEnvelope({ actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY,
    requestId: crypto.randomUUID(), operation: "extension.draft_created" });
}

function fixture(latest = 1): { tx: Tx; statements: string[] } {
  const statements: string[] = [];
  const tx = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    statements.push(sql);
    if (sql.includes("FROM org_node")) return [{ id: PROPERTY }];
    if (sql.includes("FROM extension_type")) return [{ json_schema: {} }];
    if (sql.includes("COALESCE(max(version)")) return [{ version: latest }];
    if (sql.includes("INSERT INTO extension(")) return [{ id: EXTENSION, version: latest + 1, content: CONTENT, status: "draft" }];
    if (sql.includes("INSERT INTO fact_log")) return [{ id: crypto.randomUUID(), tenant_id: TENANT,
      entity_type: "extension", entity_id: EXTENSION, fact_type: "extension.draft_created",
      valid_from: new Date(), recorded_at: new Date(), business_date: "2026-09-24",
      actor_id: ACTOR, payload: {}, supersedes: null }];
    if (sql.includes("status='draft'")) return [];
    if (sql.includes("status='active'")) return [{ id: EXTENSION, version: latest, content: CONTENT, status: "active" }];
    return [];
  }) as unknown as Tx;
  return { tx, statements };
}

test("Order 671 draft save validates taxonomy and writes extension plus audit after CAS lock", async () => {
  const { tx, statements } = fixture();
  const saved = await new CommercialMappingService().saveDraft(tx, {
    tenantId: TENANT, propertyNode: PROPERTY, content: CONTENT, expectedVersion: 1, envelope: envelope(),
  });
  expect(saved).toMatchObject({ id: EXTENSION, version: 2, status: "draft", content: CONTENT });
  const lock = statements.findIndex((sql) => sql.includes("pg_advisory_xact_lock"));
  const current = statements.findIndex((sql) => sql.includes("COALESCE(max(version)"));
  const insert = statements.findIndex((sql) => sql.includes("INSERT INTO extension("));
  const audit = statements.findIndex((sql) => sql.includes("INSERT INTO fact_log"));
  expect(lock).toBeGreaterThan(-1);
  expect(lock).toBeLessThan(current);
  expect(current).toBeLessThan(insert);
  expect(insert).toBeLessThan(audit);
  expect(statements.some((sql) => sql.includes("INSERT INTO outbox"))).toBe(false);
});

test("Order 671 stale version and malformed taxonomy leave extension and audit unwritten", async () => {
  const stale = fixture(2);
  await expect(new CommercialMappingService().saveDraft(stale.tx, {
    tenantId: TENANT, propertyNode: PROPERTY, content: CONTENT, expectedVersion: 1, envelope: envelope(),
  })).rejects.toBeInstanceOf(CommercialMappingConflictError);
  expect(stale.statements.some((sql) => sql.includes("INSERT INTO"))).toBe(false);

  const invalid = fixture();
  await expect(new CommercialMappingService().saveDraft(invalid.tx, {
    tenantId: TENANT, propertyNode: PROPERTY, content: { ...CONTENT, marketMappings: [{ marketCode: "X", segmentCode: "UNKNOWN" }] },
    expectedVersion: 1, envelope: envelope(),
  })).rejects.toBeInstanceOf(CommercialMappingValidationError);
  expect(invalid.statements).toEqual([]);
});

test("Order 671 read fetches bounded active and draft versions", async () => {
  const { tx, statements } = fixture();
  const snapshot = await new CommercialMappingService().load(tx, { tenantId: TENANT, propertyNode: PROPERTY });
  expect(snapshot.active?.version).toBe(1);
  expect(snapshot.draft).toBeNull();
  expect(snapshot.latestVersion).toBe(1);
  expect(statements.filter((sql) => sql.includes("FROM extension") && sql.includes("content")))
    .toEqual(expect.arrayContaining([expect.stringContaining("LIMIT 1"), expect.stringContaining("LIMIT 2")]));
});
