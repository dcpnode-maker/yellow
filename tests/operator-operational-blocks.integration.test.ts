import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService, InventoryService, OperationalBlockService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency,
  type ConsumeBatchOptions, type ConsumeBatchResult, type EventBus, type EventHandler,
  type OutboxEvent, type PublishEventInput, type Tx } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_BLOCK_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_BLOCK_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_BLOCK === "1";
const SECRET = "yellow-order-053-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000005391";
const FROM = "2045-01-10T12:00:00.000Z";
const TO = "2045-01-12T12:00:00.000Z";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_BLOCK_URL and YELLOW_OPERATOR_BLOCK_PASSWORD are required by Order 053");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let events: PostgresEventBus;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";
let spaces: Record<string, string> = {};
let openedOoo = "";

function headers(token = accessToken, key?: string): Record<string, string> {
  return { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}) };
}

function path(suffix = ""): string {
  return `/api/v1/properties/${SEED_PROPERTY.id}/operational-blocks${suffix}`;
}

function request(target: ReturnType<typeof createApp>, requestPath: string, init: RequestInit = {}): Promise<Response> {
  return target.handle(new Request(`http://yellow.test${requestPath}`, init));
}

function openBody(spaceId: string, kind: "ooo" | "oos" = "ooo", from = FROM, to = TO) {
  return { spaceId, kind, from, to, reason: `${kind.toUpperCase()} founder proof` };
}

async function open(body: unknown, key?: string, token = accessToken, target = app,
  property: string = SEED_PROPERTY.id): Promise<Response> {
  return request(target, `/api/v1/properties/${property}/operational-blocks`, {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
}

async function close(blockId: string, key?: string, token = accessToken, target = app,
  property: string = SEED_PROPERTY.id, body: unknown = {}): Promise<Response> {
  return request(target, `/api/v1/properties/${property}/operational-blocks/${blockId}/close`, {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
}

class FailSecondPublishBus implements EventBus {
  #calls = 0;
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.#calls += 1;
    if (this.#calls === 2) throw new Error("Order 053 injected second-publish failure");
    return this.delegate.publish(tx, event);
  }
  consumeBatch(consumer: string, handler: EventHandler, options?: ConsumeBatchOptions): Promise<ConsumeBatchResult> {
    return this.delegate.consumeBatch(consumer, handler, options);
  }
}

function makeApp(blocks: OperationalBlockService): ReturnType<typeof createApp> {
  return createApp({ database, tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens), new AvailabilityService(),
      new InventoryService(events), new PostgresIdempotency(), undefined, undefined, undefined, blocks) });
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 10 });
  loginPool = new SQL(DATABASE_URL, { max: 6 });
  eventPool = new SQL(DATABASE_URL, { max: 20 });
  database = Database.connect(DATABASE_URL, { maxConnections: 30 });
  tokens = new Hs256TokenSigner(SECRET);
  events = new PostgresEventBus(eventPool);
  app = makeApp(new OperationalBlockService(events));
  const rows = await admin<Array<{ id: string; code: string }>>`
    SELECT id, code FROM space WHERE tenant_id = ${SEED_TENANT.id}::uuid
      AND property_node = ${SEED_PROPERTY.id}::uuid ORDER BY code
  `;
  spaces = Object.fromEntries(rows.map(({ code, id }) => [code, id]));
  const login = await request(app, "/api/v1/auth/local:login", { method: "POST", headers: headers(""),
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }) });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close(); await eventPool.close(); await loginPool.close(); await admin.close();
});

databaseDescribe("Order 053 operator operational blocks", () => {
  test("P1: OOO open is exact, replay-safe, evidenced and changes only its physical option", async () => {
    const first = await open(openBody(spaces["101"]!), "order053-ooo");
    expect(first.status).toBe(201);
    const firstText = await first.text();
    const body = JSON.parse(firstText) as { operationalBlock: { id: string; kind: string } };
    openedOoo = body.operationalBlock.id;
    expect(body.operationalBlock.kind).toBe("ooo");
    const replay = await open(openBody(spaces["101"]!), "order053-ooo");
    expect(replay.status).toBe(201); expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(firstText);
    const evidence = await admin<Array<{ claims: number; facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='ooo' AND slot_ref=${openedOoo}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${openedOoo}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${openedOoo}::uuid
          OR payload @> ${JSON.stringify({ block_id: openedOoo })}::text::jsonb) AS events
    `;
    expect(evidence[0]).toEqual({ claims: 1, facts: 1, events: 2 });
    const availability = await request(app, path().replace("operational-blocks", "availability:search"), {
      method: "POST", headers: headers(), body: JSON.stringify({ from: FROM, to: TO, partySize: 1 }) });
    expect(availability.status).toBe(200);
    const options = (await availability.json() as { options: Array<{ sellableUnitName: string; availableCount: number;
      operationalBlocksApplied: Array<{ kind: string }> }> }).options;
    expect(options.filter(({ operationalBlocksApplied }) => operationalBlocksApplied.some(({ kind }) => kind === "ooo"))).toHaveLength(1);
    expect(options.find(({ sellableUnitName }) => sellableUnitName === "Room 101")?.availableCount).toBe(0);
  });

  test("P2: OOS open has no occupancy and remains distinct in the active list", async () => {
    const response = await open(openBody(spaces["102"]!, "oos"), "order053-oos");
    expect(response.status).toBe(201);
    const block = (await response.json() as { operationalBlock: { id: string; kind: string } }).operationalBlock;
    const rows = await admin<Array<{ claims: number }>>`
      SELECT count(*)::int AS claims FROM space_occupancy WHERE slot_ref=${block.id}::uuid
    `;
    expect(rows[0]?.claims).toBe(0);
    const listed = await request(app, path(), { headers: headers() });
    expect(listed.status).toBe(200);
    expect((await listed.json() as { operationalBlocks: Array<{ id: string; kind: string }> }).operationalBlocks)
      .toContainEqual(expect.objectContaining({ id: block.id, kind: "oos" }));
  });

  test("P3: close releases one OOO cause, is byte-replayable and disappears from active list", async () => {
    const first = await close(openedOoo, "order053-close");
    expect(first.status).toBe(200);
    const firstText = await first.text();
    const replay = await close(openedOoo, "order053-close");
    expect(replay.status).toBe(200); expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(firstText);
    const rows = await admin<Array<{ claims: number; facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${openedOoo}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${openedOoo}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${openedOoo}::uuid
          OR payload @> ${JSON.stringify({ block_id: openedOoo })}::text::jsonb) AS events
    `;
    expect(rows[0]).toEqual({ claims: 0, facts: 2, events: 4 });
    const active = (await (await request(app, path(), { headers: headers() })).json() as {
      operationalBlocks: Array<{ id: string }> }).operationalBlocks;
    expect(active.some(({ id }) => id === openedOoo)).toBe(false);
  });

  test("P4: twenty OOO opens have one winner, one claim and one durable request", async () => {
    const before = await admin<Array<{ claims: number }>>`
      SELECT count(*)::int AS claims FROM api_idempotency WHERE operation='operator.inventory.blocks.open'
    `;
    const responses = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      open(openBody(spaces["103"]!, "ooo", "2045-02-10T12:00:00.000Z", "2045-02-12T12:00:00.000Z"), `order053-race-${index}`)));
    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(19);
    const rows = await admin<Array<{ blocks: number; occupancies: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM ooo_oos WHERE space_id=${spaces["103"]!}::uuid
          AND period && tstzrange('2045-02-10T12:00:00Z','2045-02-12T12:00:00Z','[)')) AS blocks,
        (SELECT count(*)::int FROM space_occupancy WHERE space_id=${spaces["103"]!}::uuid
          AND slot_kind='ooo' AND period && tstzrange('2045-02-10T12:00:00Z','2045-02-12T12:00:00Z','[)')) AS occupancies,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.blocks.open') AS claims
    `;
    expect(rows[0]).toEqual({ blocks: 1, occupancies: 1, claims: (before[0]?.claims ?? 0) + 1 });
  });

  test("P5: malformed and unauthorized operations persist no artifact or claim", async () => {
    const before = await admin<Array<{ blocks: number; occupancies: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM ooo_oos) AS blocks,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='ooo') AS occupancies,
        (SELECT count(*)::int FROM api_idempotency) AS claims
    `;
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.availability:read"] });
    expect((await open(openBody(spaces["201"]!), "order053-no-scope", noScope)).status).toBe(403);
    expect((await open({ ...openBody(spaces["201"]!), surprise: true }, "order053-unknown")).status).toBe(400);
    expect((await open(openBody(spaces["201"]!), undefined)).status).toBe(400);
    expect((await open(openBody(spaces["201"]!), "order053-foreign", accessToken, app, FOREIGN_PROPERTY)).status).toBe(403);
    expect((await close(openedOoo, "order053-repeat")).status).toBe(409);
    const after = await admin<Array<{ blocks: number; occupancies: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM ooo_oos) AS blocks,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='ooo') AS occupancies,
        (SELECT count(*)::int FROM api_idempotency) AS claims
    `;
    expect(after[0]).toEqual(before[0]);
  });

  test("P6: second-publish failure rolls every OOO artifact and claim back before retry", async () => {
    const failing = makeApp(new OperationalBlockService(new FailSecondPublishBus(events)));
    const body = openBody(spaces["202"]!, "ooo", "2045-03-10T12:00:00.000Z", "2045-03-12T12:00:00.000Z");
    expect((await open(body, "order053-failure", accessToken, failing)).status).toBe(503);
    const rows = await admin<Array<{ blocks: number; occupancies: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM ooo_oos WHERE space_id=${spaces["202"]!}::uuid) AS blocks,
        (SELECT count(*)::int FROM space_occupancy WHERE space_id=${spaces["202"]!}::uuid AND slot_kind='ooo') AS occupancies,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.blocks.open'
          AND response_status IS NULL) AS claims
    `;
    expect(rows[0]).toEqual({ blocks: 0, occupancies: 0, claims: 0 });
    expect((await open(body, "order053-failure")).status).toBe(201);
  });

  test("P7/P8: Operations assets are typed, same-origin, responsive and exact-scope", async () => {
    const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
    const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
    expect(html).toContain("Operations"); expect(html).toContain("Out of order"); expect(html).toContain("Out of service");
    expect(html).toContain("operational-block-form"); expect(html).toContain("active-block-list");
    expect(script).toContain("/operational-blocks"); expect(script).toContain("loadOperationalBlocks");
    expect(script).not.toMatch(/localStorage|sessionStorage|indexedDB|space_occupancy|record_occupancy|release_occupancy/i);
    expect(css).toContain("[hidden]"); expect(css).toContain("@media (max-width: 720px)");
    const permissions = await admin<Array<{ code: string }>>`
      SELECT permission.code FROM permission
      JOIN role_permission ON role_permission.permission_code=permission.code
      JOIN role ON role.id=role_permission.role_id WHERE role.tenant_id=${SEED_TENANT.id}::uuid
        AND role.name='Local Availability Reviewer' ORDER BY permission.code
    `;
    expect(permissions.map(({ code }) => code)).toEqual([
      "crm.parties:read", "crm.parties:write", "financials.charges:write", "financials.folios:read",
      "inventory.availability:read", "inventory.blocks:read", "inventory.blocks:write",
      "inventory.configuration:read", "inventory.configuration:write", "inventory.holds:read",
      "inventory.holds:write", "inventory.offline_leases:read", "inventory.offline_leases:write",
      "inventory.policy:read",
      "inventory.policy:write", "inventory.restriction:read",
      "inventory.restriction:write", "rates.configuration:read", "rates.configuration:write",
      "rates.pricing:read", "rates.pricing:write",
      "reservations.guests:read", "reservations.guests:write", "reservations.lifecycle:read",
      "reservations.lifecycle:write", "reservations.segments:read", "reservations.segments:write",
    ]);
  });
});
