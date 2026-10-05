import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner } from "../src/contexts/identity";
import { CommercialMappingService } from "../src/contexts/reporting";
import { OperatorHttpApi } from "../src/http/operator";
import { createAuditEnvelope, Database } from "../src/kernel";

const deployUrl = process.env.YELLOW_ORDER671_DEPLOY_DATABASE_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER671_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER671_DB === "1";
if (required && (!deployUrl || !runtimeUrl)) throw new Error("Order 671 requires deploy and runtime database URLs");
const databaseDescribe = required && deployUrl && runtimeUrl ? describe.serial : describe.skip;

const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const propertyA = crypto.randomUUID();
const propertyB = crypto.randomUUID();
const foreignProperty = crypto.randomUUID();
const actorA = crypto.randomUUID();
const actorB = crypto.randomUUID();
const roleId = crypto.randomUUID();
const companyA = crypto.randomUUID();
const companyB = crypto.randomUUID();
const unitA = crypto.randomUUID();
const unitB = crypto.randomUUID();
const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const secret = `order671-isolated-proof-${crypto.randomUUID()}-${crypto.randomUUID()}`;
const content = Object.freeze({
  demandGroups: [{ code: "CORP", label: "Corporate", segments: [{ code: "NEG", label: "Negotiated" }] }],
  distributionGroups: [{ code: "DIRECT", label: "Direct", sources: [{ code: "WEB", label: "Web", channelCodes: ["WEB"] }] }],
  companies: [{ code: "COMPANY", label: "Company", partyId: companyA, parentCode: null }],
  roomClasses: [{ code: "ROOM", label: "Room", unitTypeIds: [unitA] }],
  marketMappings: [{ marketCode: "CORP", segmentCode: "NEG" }],
});

let deploy: SQL | undefined;
let database: Database | undefined;
let app: ReturnType<typeof createApp> | undefined;
let fullToken = "";
let readToken = "";
let foreignToken = "";
let ungrantedToken = "";

function request(property: string, token: string, method = "GET", body?: unknown): Request {
  return new Request(`http://yellow.test/api/v1/properties/${property}/commercial-mappings`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeAll(async () => {
  if (!required || !deployUrl || !runtimeUrl) return;
  deploy = new SQL(deployUrl, { max: 2, prepare: false });
  const probe = new SQL(runtimeUrl, { max: 1, prepare: false });
  try {
    const deployIdentity = await deploy<{ db: string }[]>`SELECT current_database() AS db`;
    const runtimeIdentity = await probe<{ db: string; actor: string }[]>`
      SELECT current_database() AS db, session_user::text AS actor`;
    if (!deployIdentity[0]?.db.includes("order671") ||
        deployIdentity[0].db !== runtimeIdentity[0]?.db || runtimeIdentity[0]?.actor !== "yellow_runtime") {
      throw new Error("Order 671 proof requires one disposable order671 database and the yellow_runtime identity");
    }
  } finally { await probe.close(); }

  await deploy`INSERT INTO tenant(id,slug,name) VALUES
    (${tenantA}::uuid,${`order671-a-${suffix}`},${`Order671 A ${suffix}`}),
    (${tenantB}::uuid,${`order671-b-${suffix}`},${`Order671 B ${suffix}`})`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${propertyA}::uuid,${tenantA}::uuid,${`o671a${suffix}`}::ltree,'property','Order671 A','UTC','USD'),
    (${propertyB}::uuid,${tenantA}::uuid,${`o671b${suffix}`}::ltree,'property','Order671 B','UTC','USD'),
    (${foreignProperty}::uuid,${tenantB}::uuid,${`o671c${suffix}`}::ltree,'property','Order671 foreign','UTC','USD')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name) VALUES
    (${actorA}::uuid,${tenantA}::uuid,${`a-${suffix}@example.test`},'Order671 A'),
    (${actorB}::uuid,${tenantB}::uuid,${`b-${suffix}@example.test`},'Order671 B')`;
  await deploy`INSERT INTO permission(code,description) VALUES
    ('inventory.configuration:read','Read property configuration'),
    ('inventory.configuration:write','Write property configuration') ON CONFLICT(code) DO NOTHING`;
  await deploy`INSERT INTO role(id,tenant_id,name) VALUES (${roleId}::uuid,${tenantA}::uuid,${`Order671 ${suffix}`})`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES
    (${roleId}::uuid,'inventory.configuration:read'),(${roleId}::uuid,'inventory.configuration:write')`;
  await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
    VALUES (${tenantA}::uuid,${actorA}::uuid,${roleId}::uuid,${propertyA}::uuid)`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name) VALUES
    (${companyA}::uuid,${tenantA}::uuid,'org','Order671 company'),
    (${companyB}::uuid,${tenantB}::uuid,'org','Order671 foreign company')`;
  await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${tenantA}::uuid,${companyA}::uuid,'company'),(${tenantB}::uuid,${companyB}::uuid,'company')`;
  await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
    (${unitA}::uuid,${tenantA}::uuid,${propertyA}::uuid,'ROOM','Order671 room','hotel'),
    (${unitB}::uuid,${tenantA}::uuid,${propertyB}::uuid,'OTHER','Order671 other','hotel')`;
  await deploy`INSERT INTO extension_type(type,json_schema) VALUES ('commercial_attribution','{}'::jsonb)
    ON CONFLICT(type) DO NOTHING`;
  await deploy`INSERT INTO extension(tenant_id,type,key,version,content,status)
    VALUES (${tenantA}::uuid,'commercial_attribution',${`property:${propertyA}`},1,${JSON.stringify(content)}::text::jsonb,'active')`;

  database = Database.connect(runtimeUrl, { maxConnections: 5, prepare: false });
  const signer = new Hs256TokenSigner(secret);
  fullToken = await signer.issue({ tenantId: tenantA, userId: actorA,
    scopes: ["inventory.configuration:read", "inventory.configuration:write"] });
  readToken = await signer.issue({ tenantId: tenantA, userId: actorA, scopes: ["inventory.configuration:read"] });
  foreignToken = await signer.issue({ tenantId: tenantB, userId: actorB,
    scopes: ["inventory.configuration:read", "inventory.configuration:write"] });
  ungrantedToken = await signer.issue({ tenantId: tenantA, userId: actorA, scopes: ["inventory.configuration:write"] });
  app = createApp({ database, tenantResolver: new BearerTenantResolver(signer),
    operatorApi: new OperatorHttpApi({} as never) });
});

afterAll(async () => { await database?.close(); await deploy?.close(); });

databaseDescribe("Order 671 isolated PostgreSQL and HTTP proof", () => {
  test("property grant, token scope and tenant prevent cross-property reads and writes", async () => {
    const read = await app!.handle(request(propertyA, fullToken));
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ active: { version: 1, content }, draft: null,
      latestVersion: 1, canWrite: true });
    const readOnly = await app!.handle(request(propertyA, readToken));
    expect(readOnly.status).toBe(200);
    expect(await readOnly.json()).toMatchObject({ canWrite: false });
    expect((await app!.handle(request(propertyA, ungrantedToken))).status).toBe(403);
    expect((await app!.handle(request(propertyB, fullToken))).status).toBe(403);
    expect((await app!.handle(request(propertyA, foreignToken))).status).toBe(403);
    expect((await app!.handle(request(propertyB, fullToken, "POST", { content, expectedVersion: 0 }))).status).toBe(403);
    expect((await app!.handle(request(propertyA, readToken, "POST", { content, expectedVersion: 1 }))).status).toBe(403);
  });

  test("foreign company and other-property unit references reject without drafts", async () => {
    const foreignCompany = { ...content, companies: [{ ...content.companies[0]!, partyId: companyB }] };
    const foreignUnit = { ...content, roomClasses: [{ ...content.roomClasses[0]!, unitTypeIds: [unitB] }] };
    for (const candidate of [foreignCompany, foreignUnit]) {
      const response = await app!.handle(request(propertyA, fullToken, "POST", { content: candidate, expectedVersion: 1 }));
      expect(response.status).toBe(400);
    }
    const rows = await deploy!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM extension WHERE tenant_id=${tenantA}::uuid
        AND type='commercial_attribution' AND key=${`property:${propertyA}`} AND status='draft'`;
    expect(rows[0]?.n).toBe(0);
  });

  test("malformed taxonomy rejects before a draft or audit fact exists", async () => {
    const invalid = { ...content, marketMappings: [
      { marketCode: "CORP", segmentCode: "NEG" },
      { marketCode: "CORP", segmentCode: "UNKNOWN" },
    ] };
    const response = await app!.handle(request(propertyA, fullToken, "POST", { content: invalid, expectedVersion: 1 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ type: "reporting/commercial_mapping_invalid" });
    const draft = await deploy!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM extension WHERE tenant_id=${tenantA}::uuid
        AND type='commercial_attribution' AND key=${`property:${propertyA}`} AND status='draft'`;
    const audit = await deploy!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM fact_log WHERE tenant_id=${tenantA}::uuid
        AND entity_type='extension' AND fact_type='extension.draft_created'`;
    expect(draft[0]?.n).toBe(0);
    expect(audit[0]?.n).toBe(0);
  });

  test("concurrent stale saves yield one draft, append-only audit and reload", async () => {
    const [first, second] = await Promise.all([
      app!.handle(request(propertyA, fullToken, "POST", { content, expectedVersion: 1 })),
      app!.handle(request(propertyA, fullToken, "POST", { content, expectedVersion: 1 })),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const saved = first.status === 201 ? await first.json() : await second.json();
    expect(saved).toMatchObject({ version: 2, status: "draft", content });
    const reload = await app!.handle(request(propertyA, fullToken));
    expect(await reload.json()).toMatchObject({ active: { version: 1, content }, draft: { version: 2 }, latestVersion: 2 });
    const facts = await deploy!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM fact_log WHERE tenant_id=${tenantA}::uuid
        AND entity_type='extension' AND entity_id=${(saved as { id: string }).id}::uuid
        AND fact_type='extension.draft_created'`;
    expect(facts[0]?.n).toBe(1);
    const events = await deploy!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM outbox WHERE tenant_id=${tenantA}::uuid`;
    expect(events[0]?.n).toBe(0);
  });

  test("audit insertion failure rolls the draft back in the same runtime transaction", async () => {
    await deploy!`UPDATE org_node SET timezone='Invalid/Order671' WHERE id=${propertyA}::uuid`;
    try {
      await expect(database!.withTenantTransaction(tenantA, (tx) => new CommercialMappingService().saveDraft(tx, {
        tenantId: tenantA, propertyNode: propertyA, content, expectedVersion: 2,
        envelope: createAuditEnvelope({ actorId: actorA, tenantId: tenantA, propertyNode: propertyA,
          requestId: crypto.randomUUID(), operation: "extension.draft_created" }),
      }))).rejects.toThrow();
    } finally {
      await deploy!`UPDATE org_node SET timezone='UTC' WHERE id=${propertyA}::uuid`;
    }
    const drafts = await deploy!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM extension WHERE tenant_id=${tenantA}::uuid
        AND type='commercial_attribution' AND key=${`property:${propertyA}`} AND status='draft'`;
    const facts = await deploy!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM fact_log WHERE tenant_id=${tenantA}::uuid
        AND entity_type='extension' AND fact_type='extension.draft_created'`;
    expect(drafts[0]?.n).toBe(1);
    expect(facts[0]?.n).toBe(1);
  });
});
