import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  BusinessDayCloseReadinessService,
  BusinessDayCloseReadinessUnavailableError,
} from "../src/contexts/financials";
import { Database } from "../src/kernel";

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_BUSINESS_DAY_CLOSE_READINESS === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Order 349 database proof requires deploy and runtime URLs");
const databaseDescribe = DEPLOY && RUNTIME ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000034900";
const PROPERTY = "00000000-0000-0000-0000-000000034901";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000034902";
const ACTOR = "00000000-0000-0000-0000-000000034903";
const INACTIVE_ACTOR = "00000000-0000-0000-0000-000000034904";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000034905";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000034906";
const DAY = "2047-05-06";

let admin: SQL | undefined;
let database: Database | undefined;
let service: BusinessDayCloseReadinessService | undefined;

const input = (overrides: Record<string, string> = {}) => ({
  tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY, actorId: ACTOR, ...overrides,
});

async function clearEvidence() {
  await admin!`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await admin!`DELETE FROM business_day WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date)
    VALUES (${TENANT}::uuid,${PROPERTY}::uuid,${DAY}::date)`;
}

databaseDescribe("Order 349 PostgreSQL-authoritative close readiness", () => {
  beforeAll(async () => {
    admin = new SQL(DEPLOY!, { max: 4, prepare: false });
    database = Database.connect(RUNTIME!, { maxConnections: 4, prepare: false });
    service = new BusinessDayCloseReadinessService({ database });
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'o349','Order349','shared','active'),
      (${FOREIGN_TENANT}::uuid,'o349-foreign','Order349 foreign','shared','active')`;
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'o349.p1','property','Order349','UTC','USD'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'o349.p2','property','Other','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'o349f.p1','property','Foreign','UTC','USD')`;
    await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'o349@example.invalid','Order349','active'),
      (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,'o349-inactive@example.invalid','Inactive','inactive')`;
    await clearEvidence();
  });

  afterAll(async () => {
    await admin!`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM business_day WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM app_user WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await database?.close(); await admin?.close();
  });

  test("binds the exact active actor, tenant, property and open backlog day", async () => {
    await clearEvidence();
    expect((await service!.read(input())).ready).toBe(true);
    for (const target of [
      input({ actorId: INACTIVE_ACTOR }),
      input({ actorId: crypto.randomUUID() }),
      input({ propertyNode: OTHER_PROPERTY }),
      input({ propertyNode: FOREIGN_PROPERTY }),
      input({ businessDate: "2047-05-07" }),
    ]) await expect(service!.read(target)).rejects.toBeInstanceOf(BusinessDayCloseReadinessUnavailableError);

    await admin!`UPDATE business_day SET sealed_at=transaction_timestamp(),sealed_by=${ACTOR}::uuid
      WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${DAY}::date`;
    await expect(service!.read(input())).rejects.toBeInstanceOf(BusinessDayCloseReadinessUnavailableError);
  });

  test("uses exact typed property/date and a strict PostgreSQL five-minute boundary", async () => {
    await clearEvidence();
    const insert = async (property: string | null, created: string, published = false) => admin!`
      INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
        actor_id,correlation_id,payload,created_at,published_at)
      VALUES (${TENANT}::uuid,${property}::uuid,${DAY}::date,'proof',${crypto.randomUUID()}::uuid,'proof.event',
        ${ACTOR}::uuid,${crypto.randomUUID()}::uuid,'{}',transaction_timestamp()+${created}::interval,
        CASE WHEN ${published} THEN transaction_timestamp() ELSE NULL END)`;

    await insert(OTHER_PROPERTY, "-20 minutes");
    await insert(PROPERTY, "-4 minutes 59 seconds");
    await insert(PROPERTY, "-10 seconds");
    const within = await service!.read(input());
    expect(within.ready).toBe(true);
    expect(within.outboxLag.kind).toBe("within_threshold");
    if (within.outboxLag.kind === "within_threshold") expect(within.outboxLag.ageMilliseconds).toBeLessThan(300000);

    await admin!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await insert(PROPERTY, "-5 minutes");
    const boundary = await service!.read(input());
    expect(boundary.ready).toBe(false);
    expect(boundary.outboxLag.kind).toBe("over_threshold");

    await admin!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await insert(PROPERTY, "-30 minutes", true);
    expect((await service!.read(input())).outboxLag).toEqual({ kind: "none", ageMilliseconds: 0 });
  });

  test("future and unrelatable unpublished evidence is explicit unknown and read-only", async () => {
    await clearEvidence();
    const before = await admin!<{ days: number; events: number }[]>`SELECT
      (SELECT count(*)::int FROM business_day WHERE tenant_id=${TENANT}::uuid) AS days,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) AS events`;
    await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload,created_at)
      VALUES (${TENANT}::uuid,NULL,${DAY}::date,'proof',${crypto.randomUUID()}::uuid,'proof.event',
        ${ACTOR}::uuid,${crypto.randomUUID()}::uuid,'{"forged_property":"${PROPERTY}"}',transaction_timestamp())`;
    const unknown = await service!.read(input());
    expect(unknown.ready).toBe(false);
    expect(unknown.outboxLag).toEqual({ kind: "unknown", count: 1 });
    expect(unknown.reasons.at(-1)).toEqual({ code: "source_attribution_unknown", source: "outbox", count: 1 });
    const after = await admin!<{ days: number; events: number }[]>`SELECT
      (SELECT count(*)::int FROM business_day WHERE tenant_id=${TENANT}::uuid) AS days,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) AS events`;
    expect(after[0]!.days).toBe(before[0]!.days);
    expect(after[0]!.events).toBe(before[0]!.events + 1);

    await admin!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload,created_at)
      VALUES (${TENANT}::uuid,${PROPERTY}::uuid,${DAY}::date,'proof',${crypto.randomUUID()}::uuid,'proof.event',
        ${ACTOR}::uuid,${crypto.randomUUID()}::uuid,'{}',transaction_timestamp()+interval '1 minute')`;
    expect((await service!.read(input())).outboxLag).toEqual({ kind: "unknown", count: 1 });
  });
});
