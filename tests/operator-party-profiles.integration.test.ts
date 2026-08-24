import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { PartyProfileService } from "../src/contexts/crm";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";
import {
  REVIEW_EMAIL,
  REVIEW_PERMISSIONS,
  REVIEW_ROLE_NAME,
  runReviewSeed,
} from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_PARTY_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_PARTY_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_PARTY === "1";
const SECRET = "yellow-order-102-test-token-secret-exactly-long-enough";
const EXISTING_PARTY = "00000000-0000-0000-0000-000000010231";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000010251";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000010202";
const FOREIGN_TENANT_PROPERTY = "00000000-0000-0000-0000-000000010252";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000010232";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_PARTY_URL and YELLOW_OPERATOR_PARTY_PASSWORD are required by Order 102");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
const runTag = crypto.randomUUID().slice(0, 8);
const existingName = `Order 102 Asha ${runTag}`;
const firstEmail = `first-${runTag}@order102.test`;
const laterEmail = `later-${runTag}@order102.test`;
const existingPhone = "+919876540102";

let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let events: PostgresEventBus;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";

function headers(token = accessToken, key?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}),
  };
}

function partyPath(kind: "search" | "create", property: string = SEED_PROPERTY.id): string {
  const collection = `/api/v1/properties/${property}/parties`;
  return kind === "search" ? `${collection}:search` : collection;
}

function request(target: ReturnType<typeof createApp>, path: string, init: RequestInit = {}): Promise<Response> {
  return target.handle(new Request(`http://yellow.test${path}`, init));
}

function search(body: unknown, token = accessToken, property: string = SEED_PROPERTY.id, target = app): Promise<Response> {
  return request(target, partyPath("search", property), {
    method: "POST", headers: headers(token), body: JSON.stringify(body),
  });
}

function create(
  body: unknown,
  key?: string,
  token = accessToken,
  property: string = SEED_PROPERTY.id,
  target = app,
): Promise<Response> {
  return request(target, partyPath("create", property), {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
}

function createBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "person",
    displayName: `Order 102 Unique ${runTag}`,
    legalName: null,
    roles: ["guest"],
    contacts: [],
    acknowledgedDuplicatePartyIds: [],
    ...overrides,
  };
}

function appFor(bus: EventBus): ReturnType<typeof createApp> {
  const profiles = new PartyProfileService({ events: bus, idempotency: new PostgresIdempotency() });
  return createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined,
      new PostgresIdempotency(), undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, profiles,
    ),
  });
}

interface ArtifactCounts {
  readonly parties: number;
  readonly roles: number;
  readonly contacts: number;
  readonly facts: number;
  readonly events: number;
  readonly idempotency: number;
}

async function artifacts(): Promise<ArtifactCounts> {
  const rows = await admin<ArtifactCounts[]>`
    SELECT
      (SELECT count(*)::int FROM party WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS parties,
      (SELECT count(*)::int FROM party_role WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS roles,
      (SELECT count(*)::int FROM contact_point WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS contacts,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND entity_type = 'party' AND fact_type = 'party.created') AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND aggregate_type = 'party' AND event_type = 'party.created') AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND operation = 'profiles.party.create') AS idempotency
  `;
  return rows[0]!;
}

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 102 private injected failure after publish");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 8 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 16 });
  tokens = new Hs256TokenSigner(SECRET);
  events = new PostgresEventBus(eventPool);

  await admin`DELETE FROM contact_point WHERE party_id = ${EXISTING_PARTY}::uuid`;
  await admin`DELETE FROM party_role WHERE party_id = ${EXISTING_PARTY}::uuid`;
  await admin`DELETE FROM party WHERE id = ${EXISTING_PARTY}::uuid`;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${FOREIGN_PROPERTY}::uuid, ${SEED_TENANT.id}::uuid,
      'yellow_demo.foreign_order102', 'property', 'Order 102 ungranted property', 'UTC', 'USD')
    ON CONFLICT (id) DO NOTHING
  `;
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${FOREIGN_TENANT}::uuid, 'order102-foreign', 'Order 102 Foreign', 'shared', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status)
    VALUES (${FOREIGN_PARTY}::uuid, ${FOREIGN_TENANT}::uuid, 'person', 'Order 102 Foreign Party', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${FOREIGN_TENANT_PROPERTY}::uuid, ${FOREIGN_TENANT}::uuid,
      'order102_foreign.property', 'property', 'Order 102 foreign property', 'UTC', 'USD')
    ON CONFLICT (id) DO NOTHING
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, legal_name, status)
    VALUES (${EXISTING_PARTY}::uuid, ${SEED_TENANT.id}::uuid,
      'person', ${existingName}, 'Order 102 Existing Legal', 'active')
  `;
  await admin`
    INSERT INTO party_role (tenant_id, party_id, role)
    VALUES
      (${SEED_TENANT.id}::uuid, ${EXISTING_PARTY}::uuid, 'contact'),
      (${SEED_TENANT.id}::uuid, ${EXISTING_PARTY}::uuid, 'guest')
  `;
  await admin`
    INSERT INTO contact_point (tenant_id, party_id, kind, value, is_primary, verified)
    VALUES
      (${SEED_TENANT.id}::uuid, ${EXISTING_PARTY}::uuid, 'email', ${firstEmail}, true, false),
      (${SEED_TENANT.id}::uuid, ${EXISTING_PARTY}::uuid, 'email', ${laterEmail}, false, false),
      (${SEED_TENANT.id}::uuid, ${EXISTING_PARTY}::uuid, 'phone', ${existingPhone}, true, false)
  `;

  app = appFor(events);
  const login = await request(app, "/api/v1/auth/local:login", {
    method: "POST", headers: headers(""),
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
  });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close();
  await eventPool.close();
  await loginPool.close();
  await admin.close();
});

describe("Order 102 operator Party static contract", () => {
  test("P0/P4: search, create, explicit duplicate review and stale-memory guards remain present", async () => {
    const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
    const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    expect(html).toContain('id="party-profile-search-form"');
    expect(html).toContain('id="party-profile-results"');
    expect(html).toContain('id="party-profile-create-form"');
    expect(html).toContain('id="party-duplicate-review"');
    expect(html).toContain('id="party-create-distinct-confirm" type="checkbox"');
    expect(script).toContain("searchPartyProfiles");
    expect(script).toContain("renderPartyDuplicateReview");
    expect(script).toContain("Use for reservation");
    expect(script).toContain("generation !== partyProfileGeneration || property !== propertySelect.value");
    expect(script).toContain("clearPartyProfileState()");
    expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  });
});

databaseDescribe("Order 102 operator Party HTTP adapter", () => {
  test("P1: body-only POST searches UUID/name/email/phone deterministically with masked tenant truth and no writes", async () => {
    const before = await artifacts();
    const queries = [EXISTING_PARTY, existingName, laterEmail.toUpperCase(), existingPhone];
    for (const query of queries) {
      const target = new URL(`http://yellow.test${partyPath("search")}`);
      expect(target.search).toBe("");
      expect(target.href).not.toContain(query);
      const response = await search({ query, limit: 10 });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const text = await response.text();
      const body = JSON.parse(text) as { profiles: Array<Record<string, unknown>> };
      expect(body.profiles.map(({ partyId }) => partyId)).toEqual([EXISTING_PARTY]);
      expect(text).not.toContain(firstEmail);
      expect(text).not.toContain(laterEmail);
      expect(text).not.toContain(existingPhone);
      expect(body.profiles[0]).toMatchObject({
        partyId: EXISTING_PARTY, displayName: existingName, kind: "person", roles: ["contact", "guest"],
      });
    }
    const broad = existingName.slice(0, -runTag.length);
    const limited = await search({ query: broad, limit: 1 });
    const repeated = await search({ query: broad, limit: 1 });
    expect(limited.status).toBe(200);
    expect(await repeated.text()).toBe(await limited.text());
    expect(await artifacts()).toEqual(before);
  });

  test("P1/P3: exact read scope, property grant and tenant authority fail without Party existence leakage", async () => {
    const readOnly = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["crm.parties:read"] });
    const writeOnly = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["crm.parties:write"] });
    expect((await search({ query: existingName }, readOnly)).status).toBe(200);
    expect((await search({ query: existingName }, writeOnly)).status).toBe(403);
    expect((await search({ query: existingName }, readOnly, FOREIGN_PROPERTY)).status).toBe(403);
    expect((await search({ query: existingName, extra: true }, readOnly)).status).toBe(400);
    expect((await search({ query: "x" }, readOnly)).status).toBe(400);
    expect((await search({ query: existingName }, "")).status).toBe(401);

    const foreign = await tokens.issue({ userId, tenantId: FOREIGN_TENANT, scopes: ["crm.parties:read"] });
    const known = await search({ query: existingName }, foreign, FOREIGN_TENANT_PROPERTY);
    const unknown = await search({ query: `absent-${runTag}` }, foreign, FOREIGN_TENANT_PROPERTY);
    expect(known.status).toBe(403);
    expect(unknown.status).toBe(403);
    const knownBody = await known.json() as Record<string, unknown>;
    const unknownBody = await unknown.json() as Record<string, unknown>;
    delete knownBody.correlation_id;
    delete unknownBody.correlation_id;
    expect(knownBody).toEqual(unknownBody);
  });

  test("P2: normalized create persists canonical Party evidence and replay is byte-equivalent", async () => {
    const key = `order102-create-${runTag}`;
    const body = createBody({
      displayName: `  Meera   Joshi ${runTag}  `,
      legalName: "  MEERA   JOSHI LEGAL  ",
      roles: ["guest", "contact"],
      contacts: [
        { kind: "phone", value: "+919123456789", isPrimary: true },
        { kind: "email", value: `  MEERA.${runTag}@ORDER102.TEST  `, isPrimary: true },
      ],
    });
    const first = await create(body, key);
    expect(first.status).toBe(201);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    const firstText = await first.text();
    const parsed = JSON.parse(firstText) as { party: { partyId: string; displayName: string; contacts: unknown[] } };
    expect(parsed.party).toMatchObject({
      displayName: `Meera Joshi ${runTag}`,
      contacts: [
        { kind: "email", hint: "m•••@order102.test", isPrimary: true },
        { kind: "phone", hint: "••••6789", isPrimary: true },
      ],
    });
    expect(firstText.toLowerCase()).not.toContain(`meera.${runTag}@order102.test`);
    expect(firstText).not.toContain("+919123456789");

    const replay = await create(body, key);
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(firstText);
    expect((await create({ ...body, legalName: "Changed" }, key)).status).toBe(409);

    const stored = await admin<Array<{
      display_name: string; legal_name: string; roles: string[]; contacts: string[];
      facts: number; events: number; raw_evidence: boolean;
    }>>`
      SELECT p.display_name, p.legal_name,
        ARRAY(SELECT role FROM party_role WHERE party_id = p.id ORDER BY role) AS roles,
        ARRAY(SELECT kind || ':' || value FROM contact_point WHERE party_id = p.id ORDER BY kind) AS contacts,
        (SELECT count(*)::int FROM fact_log WHERE entity_id = p.id AND fact_type = 'party.created') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = p.id AND event_type = 'party.created') AS events,
        EXISTS (
          SELECT 1 FROM fact_log f FULL JOIN outbox o ON o.aggregate_id = f.entity_id
          WHERE COALESCE(f.entity_id, o.aggregate_id) = p.id
            AND (COALESCE(f.payload::text, '') || COALESCE(o.payload::text, ''))
              ~* ${`meera\\.${runTag}@order102\\.test|\\+919123456789`}
        ) AS raw_evidence
      FROM party p WHERE p.id = ${parsed.party.partyId}::uuid
    `;
    expect(stored).toEqual([{
      display_name: `Meera Joshi ${runTag}`,
      legal_name: "MEERA JOSHI LEGAL",
      roles: ["contact", "guest"],
      contacts: [`email:meera.${runTag}@order102.test`, "phone:+919123456789"],
      facts: 1, events: 1, raw_evidence: false,
    }]);
  });

  test("P2: later-email duplicate review is stable, sorted, masked, artifact-free and exact acknowledgement creates distinct", async () => {
    const before = await artifacts();
    const key = `order102-later-email-${runTag}`;
    const body = createBody({
      displayName: `Order 102 Distinct ${runTag}`,
      contacts: [
        { kind: "email", value: `unique-${runTag}@order102.test` },
        { kind: "email", value: laterEmail },
      ],
    });
    const conflict = await create(body, key);
    expect(conflict.status).toBe(409);
    expect(conflict.headers.get("cache-control")).toBe("no-store");
    const conflictText = await conflict.text();
    const evidence = JSON.parse(conflictText) as { type: string; candidates: unknown[] };
    expect(evidence.type).toBe("profiles/duplicate_review_required");
    expect(evidence.candidates).toEqual([{
      partyId: EXISTING_PARTY,
      displayNameHint: "Or…",
      reasons: ["email"],
      contacts: [{ kind: "email", hint: "l•••@order102.test", isPrimary: false }],
    }]);
    expect(conflictText).not.toContain(laterEmail);
    expect(conflictText).not.toContain(firstEmail);
    expect(await artifacts()).toEqual(before);

    const retry = await create({ ...body, acknowledgedDuplicatePartyIds: [EXISTING_PARTY] }, key);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotency-replayed")).toBe("false");
    const after = await artifacts();
    expect(after).toEqual({
      parties: before.parties + 1, roles: before.roles + 1, contacts: before.contacts + 2,
      facts: before.facts + 1, events: before.events + 1, idempotency: before.idempotency + 1,
    });
  });

  test("P2: failure after outbox insertion rolls Party, fact, event and idempotency back before same-key retry", async () => {
    const before = await artifacts();
    const key = `order102-rollback-${runTag}`;
    const body = createBody({
      displayName: `Order 102 Rollback ${runTag}`,
      contacts: [{ kind: "email", value: `rollback-${runTag}@order102.test` }],
    });
    const failed = await create(body, key, accessToken, SEED_PROPERTY.id, appFor(new FailAfterPublishBus(events)));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private injected failure");
    expect(await artifacts()).toEqual(before);
    const retried = await create(body, key);
    expect(retried.status).toBe(201);
    expect(retried.headers.get("idempotency-replayed")).toBe("false");
  });

  test("P3: hostile caller-owned authority, PII, contact state, malformed fields and keys fail before mutation", async () => {
    const before = await artifacts();
    const valid = createBody({ displayName: `Order 102 Hostile ${runTag}` });
    const hostile: unknown[] = [
      { ...valid, tenantId: SEED_TENANT.id },
      { ...valid, actorId: userId },
      { ...valid, propertyNode: SEED_PROPERTY.id },
      { ...valid, operation: "party.created" },
      { ...valid, attrs: { dateOfBirth: "1990-01-01", nationality: "IN" } },
      { ...valid, consent: true },
      { ...valid, payment: { pan: "4111111111111111", cvv: "123" } },
      { ...valid, verified: true },
      { ...valid, contacts: [{ kind: "email", value: `verified-${runTag}@order102.test`, verified: true }] },
      { ...valid, roles: [] },
      { ...valid, roles: ["guest", "guest"] },
      { ...valid, roles: ["traveller"] },
      { ...valid, contacts: [{ kind: "email", value: "not-an-email" }] },
      { ...valid, contacts: [{ kind: "phone", value: "919123456789" }] },
      { ...valid, acknowledgedDuplicatePartyIds: [EXISTING_PARTY, EXISTING_PARTY] },
      { ...valid, acknowledgedDuplicatePartyIds: [FOREIGN_PROPERTY, EXISTING_PARTY] },
      { ...valid, acknowledgedDuplicatePartyIds: ["not-a-uuid"] },
      { kind: "person", displayName: "missing exact fields" },
    ];
    for (const [index, body] of hostile.entries()) {
      const response = await create(body, `order102-hostile-${runTag}-${index}`);
      expect(response.status).toBe(400);
      expect(await response.text()).not.toMatch(/4111111111111111|verified-.*@order102\.test/);
      expect(await artifacts()).toEqual(before);
    }
    expect((await create(valid)).status).toBe(400);
    expect((await create(valid, "short")).status).toBe(400);
    expect((await create(valid, "order 102 invalid key")).status).toBe(400);
    expect(await artifacts()).toEqual(before);

    const foreignEvidence = await create(
      { ...valid, acknowledgedDuplicatePartyIds: [FOREIGN_PARTY] },
      `order102-foreign-evidence-${runTag}`,
    );
    expect(foreignEvidence.status).toBe(409);
    const foreignProblem = await foreignEvidence.json() as { candidates?: unknown[] };
    expect(foreignProblem.candidates).toEqual([]);
    expect(await artifacts()).toEqual(before);

    const readOnly = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["crm.parties:read"] });
    expect((await create(valid, `order102-read-only-${runTag}`, readOnly)).status).toBe(403);
    expect((await create(valid, `order102-wrong-property-${runTag}`, accessToken, FOREIGN_PROPERTY)).status).toBe(403);
    expect(await artifacts()).toEqual(before);
  });

  test("P3: local-review role has the exact declared permission set and only the two bounded Party scopes", async () => {
    const rows = await admin<Array<{ code: string }>>`
      SELECT rp.permission_code AS code
      FROM role r JOIN role_permission rp ON rp.role_id = r.id
      WHERE r.tenant_id = ${SEED_TENANT.id}::uuid AND r.name = ${REVIEW_ROLE_NAME}
      ORDER BY rp.permission_code
    `;
    const actual = rows.map(({ code }) => code);
    expect(actual).toEqual(REVIEW_PERMISSIONS.map(({ code }) => code).sort());
    expect(actual.filter((scope) => scope.startsWith("crm.parties:"))).toEqual([
      "crm.parties:read", "crm.parties:write",
    ]);
    expect(actual.some((scope) => /merge|verify|consent|payment|document|identity/.test(scope))).toBeFalse();
  });
});
