import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { resolve } from "node:path";

import {
  PartyDuplicateReviewRequiredError,
  PartyProfileService,
  PartyProfileValidationError,
  type CreatePartyProfileInput,
  type UpdatePartyProfileInput,
} from "../src/contexts/crm";
import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DEPLOY_DATABASE_URL =
  process.env.YELLOW_DEPLOY_DATABASE_URL ??
  process.env.YELLOW_PARTY_PROFILES_URL;
const RUNTIME_DATABASE_URL =
  process.env.YELLOW_RUNTIME_DATABASE_URL ??
  process.env.YELLOW_PARTY_PROFILES_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_PARTY_PROFILES === "1";

const TENANT_A = "00000000-0000-0000-0000-000000010101";
const TENANT_B = "00000000-0000-0000-0000-000000010102";
const PROPERTY_A = "00000000-0000-0000-0000-000000010111";
const PROPERTY_B = "00000000-0000-0000-0000-000000010112";
const ACTOR_A = "00000000-0000-0000-0000-000000010121";
const ACTOR_B = "00000000-0000-0000-0000-000000010122";

const DEMO_TENANT = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const DEMO_PROPERTY = "4518a22f-b455-54c6-a50a-4584383749b9";
const DEMO_ACTOR = "9f90d3e9-94f9-54de-95ec-35bd00b99b15";
const DEMO_CLEAN_PARTY = "55ee1818-f8e8-570e-9fe5-6bc7f88db2df";
const DEMO_CLEAN_RESERVATION = "fe25d718-95b5-51d9-9443-0098cd4d10dc";
const DEMO_CLEAN_ATTRS = { source: "local-review", checkin_example: "clean" };

const PARTY_A = "00000000-0000-0000-0000-000000010131";
const PARTY_FUZZY = "00000000-0000-0000-0000-000000010132";
const PARTY_PREFIX = "00000000-0000-0000-0000-000000010133";
const PARTY_MERGED = "00000000-0000-0000-0000-000000010134";
const PARTY_ANONYMISED = "00000000-0000-0000-0000-000000010135";
const PARTY_B = "00000000-0000-0000-0000-000000010136";
const PARTY_ACK_RACE = "00000000-0000-0000-0000-000000010137";

const EMAIL_A = "asha.rao@order101.test";
const PHONE_A = "+919876543210";
const FOREIGN_EMAIL = "foreign@order101.test";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error(
    "YELLOW_PARTY_PROFILES_URL is required by the Order 101 proof",
  );
}

const databaseDescribe =
  DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let profiles: PartyProfileService | undefined;

function envelope(
  tenantId = TENANT_A,
  propertyNode = PROPERTY_A,
  actorId = ACTOR_A,
  requestId = crypto.randomUUID(),
) {
  return createAuditEnvelope({
    operation: "party.created",
    tenantId,
    propertyNode,
    actorId,
    requestId,
  });
}

function updateEnvelope(
  tenantId = TENANT_A,
  propertyNode = PROPERTY_A,
  actorId = ACTOR_A,
  requestId = crypto.randomUUID(),
) {
  return createAuditEnvelope({
    operation: "party.updated",
    tenantId,
    propertyNode,
    actorId,
    requestId,
  });
}

function serviceFor(bus: EventBus): PartyProfileService {
  return new PartyProfileService({
    events: bus,
    idempotency: new PostgresIdempotency(),
  });
}

async function search(
  input: Parameters<PartyProfileService["search"]>[1],
  transactionTenant = input.tenantId,
) {
  return database!.withTenantTransaction(transactionTenant, (tx) =>
    profiles!.search(tx, input),
  );
}

async function create(
  input: CreatePartyProfileInput,
  service = profiles!,
  transactionTenant = input.envelope.tenantId,
) {
  return database!.withTenantTransaction(transactionTenant, (tx) =>
    service.create(tx, input),
  );
}

async function update(
  input: UpdatePartyProfileInput,
  service = profiles!,
  transactionTenant = input.envelope.tenantId,
) {
  return database!.withTenantTransaction(transactionTenant, (tx) =>
    service.update(tx, input),
  );
}

function createInput(
  overrides: Partial<CreatePartyProfileInput> = {},
): CreatePartyProfileInput {
  return {
    kind: "person",
    displayName: "Order 101 Unique Person",
    legalName: null,
    roles: ["guest"],
    contacts: [],
    acknowledgedDuplicatePartyIds: [],
    idempotencyKey: `order101-${crypto.randomUUID()}`,
    envelope: envelope(),
    ...overrides,
  };
}

function updateInput(
  overrides: Partial<UpdatePartyProfileInput> = {},
): UpdatePartyProfileInput {
  return {
    partyId: PARTY_A,
    displayName: "Asha Rao Updated",
    legalName: "Asha Rao Updated Legal",
    idempotencyKey: `order465-${crypto.randomUUID()}`,
    envelope: updateEnvelope(),
    ...overrides,
  };
}

interface ArtifactCounts {
  readonly parties: number;
  readonly roles: number;
  readonly contacts: number;
  readonly facts: number;
  readonly events: number;
  readonly idempotency: number;
}

async function artifactCounts(tenantId = TENANT_A): Promise<ArtifactCounts> {
  const rows = await admin!<ArtifactCounts[]>`
    SELECT
      (SELECT count(*)::int FROM party WHERE tenant_id = ${tenantId}::uuid) AS parties,
      (SELECT count(*)::int FROM party_role WHERE tenant_id = ${tenantId}::uuid) AS roles,
      (SELECT count(*)::int FROM contact_point WHERE tenant_id = ${tenantId}::uuid) AS contacts,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${tenantId}::uuid
        AND entity_type = 'party' AND fact_type = 'party.created') AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id = ${tenantId}::uuid
        AND aggregate_type = 'party' AND event_type = 'party.created') AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${tenantId}::uuid
        AND operation = 'profiles.party.create') AS idempotency
  `;
  return rows[0]!;
}

/**
 * A state-changing Party-profile command must not accidentally touch reservation,
 * occupancy, financial, document, or related CRM rows.  Keep this intentionally
 * content-blind: the proof compares deterministic hashes instead of emitting any
 * fixture fields in test output.
 */
async function protectedTableFingerprint(
  tenantId = TENANT_A,
  excludePermittedPartyAttrs = false,
): Promise<Record<string, string>> {
  const rows = await admin!<Array<Record<string, string>>>`
    SELECT
      COALESCE((SELECT md5(string_agg(md5((to_jsonb(t) - 'display_name' - 'legal_name' - CASE WHEN ${excludePermittedPartyAttrs} THEN 'attrs' ELSE '__no_such_party_column__' END)::text), '' ORDER BY md5((to_jsonb(t) - 'display_name' - 'legal_name' - CASE WHEN ${excludePermittedPartyAttrs} THEN 'attrs' ELSE '__no_such_party_column__' END)::text))) FROM party AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS party_immutable,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM reservation AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS reservation,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM reservation_segment AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS reservation_segment,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM reservation_guest AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS reservation_guest,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM space_occupancy AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS space_occupancy,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM account AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS account,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM folio AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS folio,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM journal AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS journal,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM posting_line AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS posting_line,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM document AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS document,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM identity_document AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS identity_document,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM party_role AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS party_role,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM contact_point AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS contact_point,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM address AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS address,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM membership AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS membership,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM party_relationship AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS party_relationship,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM payment_instrument AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS payment_instrument,
      COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text))) FROM payment AS t WHERE t.tenant_id=${tenantId}::uuid), '') AS payment
  `;
  return rows[0]!;
}

async function cleanFixtures(): Promise<void> {
  if (!admin) return;
  await admin`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM reservation_guest WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM reservation WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM contact_point WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM party_role WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM app_user WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid, ${DEMO_TENANT}::uuid)`;
}

class FailAfterPublishEventBus implements EventBus {
  constructor(readonly delegate: EventBus) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 101 injected failure after outbox insert");
  }

  consumeBatch(
    ...args: Parameters<EventBus["consumeBatch"]>
  ): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 24 });
  eventPool = new SQL(RUNTIME_DATABASE_URL, { max: 24 });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 48 });
  events = new PostgresEventBus(eventPool);
  profiles = serviceFor(events);
  await cleanFixtures();

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order101-a', 'Order 101 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order101-b', 'Order 101 B', 'shared', 'active'),
      (${DEMO_TENANT}::uuid, 'yellow-demo', 'Yellow Demo', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order101_a', 'property', 'Order 101 A', 'Asia/Kolkata', 'INR'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order101_b', 'property', 'Order 101 B', 'UTC', 'USD'),
      (${DEMO_PROPERTY}::uuid, ${DEMO_TENANT}::uuid, 'yellow_demo.property', 'property', 'Yellow Demo Property', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name, status)
    VALUES
      (${ACTOR_A}::uuid, ${TENANT_A}::uuid, 'actor-a@order101.test', 'Order 101 Actor A', 'active'),
      (${ACTOR_B}::uuid, ${TENANT_B}::uuid, 'actor-b@order101.test', 'Order 101 Actor B', 'active'),
      (${DEMO_ACTOR}::uuid, ${DEMO_TENANT}::uuid, 'operator@yellow.local', 'Yellow Review Operator', 'active')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, legal_name, status, merged_into)
    VALUES
      (${PARTY_A}::uuid, ${TENANT_A}::uuid, 'person', 'Asha Rao', 'Asha Rao Legal', 'active', NULL),
      (${PARTY_FUZZY}::uuid, ${TENANT_A}::uuid, 'person', 'Anika Sharma', NULL, 'active', NULL),
      (${PARTY_PREFIX}::uuid, ${TENANT_A}::uuid, 'org', 'Alpine Hospitality', 'Alpine Hospitality Pvt Ltd', 'active', NULL),
      (${PARTY_MERGED}::uuid, ${TENANT_A}::uuid, 'person', 'Asha Rao', NULL, 'merged', ${PARTY_A}::uuid),
      (${PARTY_ANONYMISED}::uuid, ${TENANT_A}::uuid, 'person', 'Anonymised Party', NULL, 'anonymised', NULL),
      (${PARTY_B}::uuid, ${TENANT_B}::uuid, 'person', 'Asha Rao', 'Foreign Asha Rao', 'active', NULL),
      (${PARTY_ACK_RACE}::uuid, ${TENANT_A}::uuid, 'person', 'Order 101 Ack Race', NULL, 'active', NULL)
  `;
  await admin`
    INSERT INTO party_role (tenant_id, party_id, role)
    VALUES
      (${TENANT_A}::uuid, ${PARTY_A}::uuid, 'guest'),
      (${TENANT_A}::uuid, ${PARTY_A}::uuid, 'contact'),
      (${TENANT_A}::uuid, ${PARTY_FUZZY}::uuid, 'guest'),
      (${TENANT_A}::uuid, ${PARTY_PREFIX}::uuid, 'company'),
      (${TENANT_B}::uuid, ${PARTY_B}::uuid, 'guest'),
      (${TENANT_A}::uuid, ${PARTY_ACK_RACE}::uuid, 'guest')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, status)
    VALUES (${DEMO_CLEAN_PARTY}::uuid, ${DEMO_TENANT}::uuid, 'person', 'Drifted Demo Name', 'Drifted Demo Legal',
      '{"source":"legacy"}'::jsonb, 'active')
  `;
  await admin`
    INSERT INTO party_role (tenant_id, party_id, role, detail)
    VALUES (${DEMO_TENANT}::uuid, ${DEMO_CLEAN_PARTY}::uuid, 'guest', ${JSON.stringify(DEMO_CLEAN_ATTRS)}::text::jsonb)
  `;
  await admin`
    INSERT INTO reservation (id, tenant_id, property_node, confirmation_no, primary_party, channel_code, currency)
    VALUES (${DEMO_CLEAN_RESERVATION}::uuid, ${DEMO_TENANT}::uuid, ${DEMO_PROPERTY}::uuid, 'ARR-CLEAN',
      ${DEMO_CLEAN_PARTY}::uuid, 'direct', 'USD')
  `;
  await admin`
    INSERT INTO contact_point (tenant_id, party_id, kind, value, is_primary, verified)
    VALUES
      (${TENANT_A}::uuid, ${PARTY_A}::uuid, 'email', ${EMAIL_A}, true, true),
      (${TENANT_A}::uuid, ${PARTY_A}::uuid, 'phone', ${PHONE_A}, true, false),
      (${TENANT_A}::uuid, ${PARTY_A}::uuid, 'whatsapp', ${PHONE_A}, false, false),
      (${TENANT_A}::uuid, ${PARTY_MERGED}::uuid, 'email', ${EMAIL_A}, false, false),
      (${TENANT_A}::uuid, ${PARTY_ANONYMISED}::uuid, 'email', 'anonymous@order101.test', false, false),
      (${TENANT_B}::uuid, ${PARTY_B}::uuid, 'email', ${EMAIL_A}, true, true),
      (${TENANT_B}::uuid, ${PARTY_B}::uuid, 'phone', ${PHONE_A}, true, true)
  `;

  // Baseline child FKs are not tenant-composite. Queries must anchor each child to
  // the same-tenant Party rather than trusting the child's tenant_id by itself.
  await admin`
    INSERT INTO contact_point (tenant_id, party_id, kind, value, is_primary, verified)
    VALUES (${TENANT_A}::uuid, ${PARTY_B}::uuid, 'email', ${FOREIGN_EMAIL}, false, false)
  `;
  await admin`
    INSERT INTO party_role (tenant_id, party_id, role)
    VALUES (${TENANT_A}::uuid, ${PARTY_B}::uuid, 'owner')
  `;

  await admin`
    INSERT INTO party (tenant_id, kind, display_name, status)
    SELECT ${TENANT_A}::uuid, 'person', 'Order 101 Noise ' || lpad(value::text, 5, '0'), 'active'
    FROM generate_series(1, 1200) AS value
  `;
  await admin`
    INSERT INTO contact_point (tenant_id, party_id, kind, value)
    SELECT ${TENANT_A}::uuid, id, 'email',
      'noise-' || row_number() OVER (ORDER BY id)::text || '@order101.test'
    FROM party
    WHERE tenant_id = ${TENANT_A}::uuid AND display_name LIKE 'Order 101 Noise %'
  `;
  await admin.unsafe("ANALYZE party");
  await admin.unsafe("ANALYZE contact_point");
});

afterAll(async () => {
  await cleanFixtures();
  await database?.close();
  await eventPool?.close();
  await admin?.close();
}, 30_000);

databaseDescribe("Order 101 tenant-safe Party search and create", () => {
  test("P1: canonical search is bounded, deterministic, active-only and privacy-minimized", async () => {
    const byUuid = await search({
      tenantId: TENANT_A,
      query: PARTY_A,
      limit: 10,
    });
    expect(byUuid).toEqual([
      {
        partyId: PARTY_A,
        kind: "person",
        displayName: "Asha Rao",
        legalName: "Asha Rao Legal",
        status: "active",
        roles: ["contact", "guest"],
        contacts: [
          { kind: "email", hint: "a•••@order101.test", isPrimary: true },
          { kind: "phone", hint: "••••3210", isPrimary: true },
          { kind: "whatsapp", hint: "••••3210", isPrimary: false },
        ],
      },
    ]);

    const byEmail = await search({
      tenantId: TENANT_A,
      query: `  ${EMAIL_A.toUpperCase()}  `,
    });
    const byPhone = await search({ tenantId: TENANT_A, query: PHONE_A });
    const fuzzy = await search({ tenantId: TENANT_A, query: "Anika Sharm" });
    const twoCharacterPrefix = await search({
      tenantId: TENANT_A,
      query: "Al",
    });
    expect(byEmail.map(({ partyId }) => partyId)).toEqual([PARTY_A]);
    expect(byPhone.map(({ partyId }) => partyId)).toEqual([PARTY_A]);
    expect(fuzzy.map(({ partyId }) => partyId)).toContain(PARTY_FUZZY);
    expect(twoCharacterPrefix.map(({ partyId }) => partyId)).toEqual([
      PARTY_PREFIX,
    ]);

    const repeated = await search({
      tenantId: TENANT_A,
      query: "Order 101 Noise",
      limit: 50,
    });
    const repeatedAgain = await search({
      tenantId: TENANT_A,
      query: "Order 101 Noise",
      limit: 50,
    });
    expect(repeated).toHaveLength(50);
    expect(repeatedAgain).toEqual(repeated);
    expect(
      await search({ tenantId: TENANT_A, query: "Order 101 Noise", limit: 1 }),
    ).toHaveLength(1);

    expect(JSON.stringify([byUuid, byEmail, byPhone])).not.toContain(EMAIL_A);
    expect(JSON.stringify([byUuid, byEmail, byPhone])).not.toContain(PHONE_A);
    expect(await search({ tenantId: TENANT_A, query: PARTY_MERGED })).toEqual(
      [],
    );
    expect(
      await search({ tenantId: TENANT_A, query: PARTY_ANONYMISED }),
    ).toEqual([]);
    expect(await search({ tenantId: TENANT_A, query: FOREIGN_EMAIL })).toEqual(
      [],
    );
    expect(
      await search({ tenantId: TENANT_B, query: EMAIL_A }, TENANT_A),
    ).toEqual([]);
    expect(await search({ tenantId: TENANT_A, query: "%_" })).toEqual([]);
  });

  test("P1: tenant-leading search indexes exist and production-shaped branches use them", async () => {
    const indexes = await admin!<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('party_tenant_status_id', 'contact_point_tenant_kind_value')
      ORDER BY indexname
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual([
      "contact_point_tenant_kind_value",
      "party_tenant_status_id",
    ]);
    expect(indexes[0]!.indexdef).toContain(
      "(tenant_id, kind, value, party_id)",
    );
    expect(indexes[1]!.indexdef).toContain("(tenant_id, status, id)");

    const connection = await admin!.reserve();
    let tenantPlan = "";
    let contactPlan = "";
    let trigramPlan = "";
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe("SET LOCAL enable_seqscan = off");
      const tenantRows = await connection.unsafe<Array<Record<string, string>>>(
        `
        EXPLAIN (COSTS OFF)
        SELECT count(*) FROM party
        WHERE tenant_id = $1::uuid AND status = 'active'
      `,
        [TENANT_A],
      );
      const contactRows = await connection.unsafe<
        Array<Record<string, string>>
      >(
        `
        EXPLAIN (COSTS OFF)
        SELECT party_id FROM contact_point
        WHERE tenant_id = $1::uuid AND kind = 'email' AND value = $2
      `,
        [TENANT_A, EMAIL_A],
      );
      const trigramRows = await connection.unsafe<
        Array<Record<string, string>>
      >(
        `
        EXPLAIN (COSTS OFF)
        SELECT id FROM party WHERE display_name % $1
      `,
        ["Anika Sharm"],
      );
      tenantPlan = tenantRows.map((row) => Object.values(row)[0]).join("\n");
      contactPlan = contactRows.map((row) => Object.values(row)[0]).join("\n");
      trigramPlan = trigramRows.map((row) => Object.values(row)[0]).join("\n");
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
    expect(tenantPlan).toMatch(/party_tenant_status_id|party_tenant_id_id_uq/);
    expect(tenantPlan).toContain("Index");
    expect(contactPlan).toContain("contact_point_tenant_kind_value");
    expect(trigramPlan).toContain("party_name_trgm");
  });

  test("P2: duplicate review is exact, sorted, masked, tenant-local and leaves no failed artifacts", async () => {
    const before = await artifactCounts();
    await expect(
      create(
        createInput({
          displayName: "Order 101 Second Email Match",
          contacts: [
            { kind: "email", value: "aaa-unique@order101.test" },
            { kind: "email", value: EMAIL_A },
          ],
          idempotencyKey: "order101-second-email-duplicate",
        }),
      ),
    ).rejects.toMatchObject({
      candidates: [{ partyId: PARTY_A, reasons: ["email"] }],
    });
    expect(await artifactCounts()).toEqual(before);
    const requested = createInput({
      displayName: "  ASHA   RAO  ",
      roles: ["guest", "contact"],
      contacts: [{ kind: "email", value: ` ${EMAIL_A.toUpperCase()} ` }],
      acknowledgedDuplicatePartyIds: [],
      idempotencyKey: "order101-duplicate-review",
    });
    let review: PartyDuplicateReviewRequiredError | undefined;
    try {
      await create(requested);
    } catch (error) {
      expect(error).toBeInstanceOf(PartyDuplicateReviewRequiredError);
      review = error as PartyDuplicateReviewRequiredError;
    }
    expect(review?.candidates).toEqual([
      {
        partyId: PARTY_A,
        displayNameHint: "As…",
        reasons: ["display_name", "email"],
        contacts: [
          { kind: "email", hint: "a•••@order101.test", isPrimary: true },
        ],
      },
    ]);
    expect(JSON.stringify(review?.candidates)).not.toContain(EMAIL_A);
    expect(await artifactCounts()).toEqual(before);

    const acknowledged = await create({
      ...requested,
      acknowledgedDuplicatePartyIds: [PARTY_A],
    });
    expect(acknowledged.replayed).toBe(false);
    expect(acknowledged.party.displayName).toBe("ASHA RAO");

    const staleBefore = await artifactCounts();
    await expect(
      create({
        ...requested,
        idempotencyKey: "order101-stale-review",
        acknowledgedDuplicatePartyIds: [PARTY_A],
        envelope: envelope(),
      }),
    ).rejects.toBeInstanceOf(PartyDuplicateReviewRequiredError);
    expect(await artifactCounts()).toEqual(staleBefore);

    const extraBefore = await artifactCounts();
    await expect(
      create(
        createInput({
          displayName: "Order 101 No Candidates",
          acknowledgedDuplicatePartyIds: [PARTY_A],
          idempotencyKey: "order101-extra-review",
        }),
      ),
    ).rejects.toBeInstanceOf(PartyDuplicateReviewRequiredError);
    await expect(
      create(
        createInput({
          displayName: "Order 101 Foreign Evidence",
          acknowledgedDuplicatePartyIds: [PARTY_B],
          idempotencyKey: "order101-foreign-review",
        }),
      ),
    ).rejects.toMatchObject({ candidates: [] });
    expect(await artifactCounts()).toEqual(extraBefore);
  });

  test("P2: advisory locks close identical, stale-ack and partially-overlapping identity races", async () => {
    const identical = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        create(
          createInput({
            displayName: "Order 101 Empty Race",
            contacts: [{ kind: "email", value: "empty-race@order101.test" }],
            idempotencyKey: `order101-empty-race-${index}`,
            envelope: envelope(),
          }),
        ),
      ),
    );
    expect(
      identical.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    const identicalRejected = identical.filter(
      (result) => result.status === "rejected",
    );
    expect(identicalRejected).toHaveLength(19);
    expect(
      identicalRejected.every(
        ({ reason }) => reason instanceof PartyDuplicateReviewRequiredError,
      ),
    ).toBeTrue();

    const acknowledged = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        create(
          createInput({
            displayName: "Order 101 Ack Race",
            acknowledgedDuplicatePartyIds: [PARTY_ACK_RACE],
            idempotencyKey: `order101-ack-race-${index}`,
            envelope: envelope(),
          }),
        ),
      ),
    );
    expect(
      acknowledged.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      acknowledged.filter(({ status }) => status === "rejected"),
    ).toHaveLength(9);

    const sharedContact = await Promise.allSettled([
      create(
        createInput({
          displayName: "Order 101 Contact Race Left",
          contacts: [{ kind: "phone", value: "+14155550101" }],
          idempotencyKey: "order101-contact-race-left",
        }),
      ),
      create(
        createInput({
          displayName: "Order 101 Contact Race Right",
          contacts: [{ kind: "phone", value: "+14155550101" }],
          idempotencyKey: "order101-contact-race-right",
        }),
      ),
    ]);
    expect(
      sharedContact.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      sharedContact.filter(({ status }) => status === "rejected"),
    ).toHaveLength(1);

    const sharedName = await Promise.allSettled([
      create(
        createInput({
          displayName: "Order 101 Shared Name Race",
          contacts: [
            { kind: "email", value: "shared-name-left@order101.test" },
          ],
          idempotencyKey: "order101-name-race-left",
        }),
      ),
      create(
        createInput({
          displayName: "  order 101   shared name race ",
          contacts: [
            { kind: "email", value: "shared-name-right@order101.test" },
          ],
          idempotencyKey: "order101-name-race-right",
        }),
      ),
    ]);
    expect(
      sharedName.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      sharedName.filter(({ status }) => status === "rejected"),
    ).toHaveLength(1);
  }, 30_000);

  test("P3: creation is normalized, atomic, idempotent and persists only minimized evidence", async () => {
    const requestId = crypto.randomUUID();
    const input = createInput({
      kind: "person",
      displayName: "  Meera   Joshi  ",
      legalName: "  MEERA   JOSHI LEGAL ",
      roles: ["contact", "guest"],
      contacts: [
        { kind: "phone", value: "+919123456789", isPrimary: true },
        {
          kind: "email",
          value: "  MEERA.JOSHI@ORDER101.TEST  ",
          isPrimary: true,
        },
      ],
      idempotencyKey: "order101-atomic-person",
      envelope: envelope(TENANT_A, PROPERTY_A, ACTOR_A, requestId),
    });
    const first = await create(input);
    expect(first).toMatchObject({
      replayed: false,
      party: {
        kind: "person",
        displayName: "Meera Joshi",
        legalName: "MEERA JOSHI LEGAL",
        status: "active",
        roles: ["contact", "guest"],
        contacts: [
          { kind: "email", hint: "m•••@order101.test", isPrimary: true },
          { kind: "phone", hint: "••••6789", isPrimary: true },
        ],
      },
    });
    const replay = await create(input);
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(
      create({ ...input, legalName: "Changed Legal Name" }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);

    const storedParty = await admin!<
      Array<{
        kind: string;
        display_name: string;
        legal_name: string | null;
        status: string;
        attrs: unknown;
      }>
    >`
      SELECT kind, display_name, legal_name, status, attrs
      FROM party WHERE id = ${first.party.partyId}::uuid
    `;
    expect(storedParty).toEqual([
      {
        kind: "person",
        display_name: "Meera Joshi",
        legal_name: "MEERA JOSHI LEGAL",
        status: "active",
        attrs: {},
      },
    ]);
    const storedRoles = await admin!<{ role: string }[]>`
      SELECT role FROM party_role WHERE party_id = ${first.party.partyId}::uuid ORDER BY role
    `;
    const storedContacts = await admin!<
      Array<{
        kind: string;
        value: string;
        is_primary: boolean;
        verified: boolean;
      }>
    >`
      SELECT kind, value, is_primary, verified
      FROM contact_point WHERE party_id = ${first.party.partyId}::uuid ORDER BY kind, value
    `;
    expect(storedRoles.map(({ role }) => role)).toEqual(["contact", "guest"]);
    expect(storedContacts).toEqual([
      {
        kind: "email",
        value: "meera.joshi@order101.test",
        is_primary: true,
        verified: false,
      },
      {
        kind: "phone",
        value: "+919123456789",
        is_primary: true,
        verified: false,
      },
    ]);

    const evidence = await admin!<
      Array<{
        fact_payload: Record<string, unknown>;
        event_payload: Record<string, unknown>;
        event_tenant: string;
        property_node: string;
        actor_id: string;
        correlation_id: string;
        business_dates_match: boolean;
        response_body: Record<string, unknown>;
        idempotency_serialized: string;
      }>
    >`
      SELECT fact.payload AS fact_payload, event.payload AS event_payload,
        event.tenant_id AS event_tenant, event.property_node, event.actor_id,
        event.correlation_id, event.business_date = fact.business_date AS business_dates_match,
        idem.response_body, to_jsonb(idem)::text AS idempotency_serialized
      FROM fact_log AS fact
      JOIN outbox AS event
        ON event.tenant_id = fact.tenant_id AND event.aggregate_id = fact.entity_id
       AND event.event_type = 'party.created'
      JOIN api_idempotency AS idem
        ON idem.tenant_id = fact.tenant_id AND idem.operation = 'profiles.party.create'
      WHERE fact.entity_id = ${first.party.partyId}::uuid
        AND fact.fact_type = 'party.created'
        AND idem.response_body @> ${JSON.stringify({ partyId: first.party.partyId })}::text::jsonb
    `;
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.fact_payload).toEqual({
      party_id: first.party.partyId,
      kind: "person",
      roles: ["contact", "guest"],
      contact_kinds: ["email", "phone"],
      request_id: requestId,
    });
    expect(evidence[0]!.event_payload).toEqual({
      party_id: first.party.partyId,
      kind: "person",
      roles: ["contact", "guest"],
      contact_kinds: ["email", "phone"],
    });
    expect(evidence[0]).toMatchObject({
      event_tenant: TENANT_A,
      property_node: PROPERTY_A,
      actor_id: ACTOR_A,
      correlation_id: requestId,
      business_dates_match: true,
    });
    const serializedEvidence = JSON.stringify(evidence[0]);
    for (const raw of [
      "Meera Joshi",
      "MEERA JOSHI LEGAL",
      "meera.joshi@order101.test",
      "+919123456789",
    ])
      expect(serializedEvidence).not.toContain(raw);
    expect(evidence[0]!.idempotency_serialized).not.toContain(
      "order101-atomic-person",
    );

    const org = await create(
      createInput({
        kind: "org",
        displayName: "Order 101 Example Holdings",
        legalName: "Order 101 Example Holdings Limited",
        roles: ["company", "agent"],
        idempotencyKey: "order101-atomic-org",
      }),
    );
    expect(org.party).toMatchObject({
      kind: "org",
      roles: ["agent", "company"],
      contacts: [],
    });
  });

  test("P3: a failure after outbox insertion rolls back every artifact and the same key retries", async () => {
    const before = await artifactCounts();
    const input = createInput({
      displayName: "Order 101 Rollback Person",
      contacts: [{ kind: "email", value: "rollback-person@order101.test" }],
      idempotencyKey: "order101-publish-rollback",
    });
    const failing = serviceFor(new FailAfterPublishEventBus(events!));
    await expect(create(input, failing)).rejects.toThrow(
      "failure after outbox insert",
    );
    expect(await artifactCounts()).toEqual(before);

    const retried = await create(input);
    expect(retried.replayed).toBe(false);
    expect(retried.party.displayName).toBe("Order 101 Rollback Person");
    const after = await artifactCounts();
    expect(after).toEqual({
      parties: before.parties + 1,
      roles: before.roles + 1,
      contacts: before.contacts + 1,
      facts: before.facts + 1,
      events: before.events + 1,
      idempotency: before.idempotency + 1,
    });
  });

  test("P4: malformed names, roles, contacts, acknowledgements, keys and envelopes fail before mutation", async () => {
    const before = await artifactCounts();
    const valid = createInput({
      displayName: "Order 101 Hostile Boundary",
      idempotencyKey: "order101-hostile-base",
    });
    const invalid: unknown[] = [
      { ...valid, kind: "guest", idempotencyKey: "order101-hostile-kind" },
      {
        ...valid,
        displayName: "   ",
        idempotencyKey: "order101-hostile-blank",
      },
      {
        ...valid,
        displayName: "x".repeat(201),
        idempotencyKey: "order101-hostile-long",
      },
      {
        ...valid,
        displayName: "bad\u0000name",
        idempotencyKey: "order101-hostile-control",
      },
      { ...valid, roles: [], idempotencyKey: "order101-hostile-no-role" },
      {
        ...valid,
        roles: ["guest", "guest"],
        idempotencyKey: "order101-hostile-dup-role",
      },
      {
        ...valid,
        roles: ["guest", "traveller"],
        idempotencyKey: "order101-hostile-role",
      },
      {
        ...valid,
        contacts: Array.from({ length: 7 }, (_, index) => ({
          kind: "email",
          value: `h${index}@order101.test`,
        })),
        idempotencyKey: "order101-hostile-many-contact",
      },
      {
        ...valid,
        contacts: [{ kind: "email", value: "not-an-email" }],
        idempotencyKey: "order101-hostile-email",
      },
      {
        ...valid,
        contacts: [{ kind: "phone", value: "919123456789" }],
        idempotencyKey: "order101-hostile-phone",
      },
      {
        ...valid,
        contacts: [{ kind: "whatsapp", value: "+019123456789" }],
        idempotencyKey: "order101-hostile-whatsapp",
      },
      {
        ...valid,
        contacts: [
          { kind: "email", value: "DUP@ORDER101.TEST" },
          { kind: "email", value: " dup@order101.test " },
        ],
        idempotencyKey: "order101-hostile-dup-contact",
      },
      {
        ...valid,
        contacts: [
          { kind: "phone", value: "+919111111111", isPrimary: true },
          { kind: "phone", value: "+919222222222", isPrimary: true },
        ],
        idempotencyKey: "order101-hostile-primary",
      },
      {
        ...valid,
        acknowledgedDuplicatePartyIds: [PARTY_A, PARTY_A],
        idempotencyKey: "order101-hostile-dup-ack",
      },
      {
        ...valid,
        acknowledgedDuplicatePartyIds: [PARTY_FUZZY, PARTY_A],
        idempotencyKey: "order101-hostile-sort-ack",
      },
      {
        ...valid,
        acknowledgedDuplicatePartyIds: ["bad"],
        idempotencyKey: "order101-hostile-bad-ack",
      },
      { ...valid, idempotencyKey: "short" },
      { ...valid, idempotencyKey: "order 101 spaces rejected" },
      {
        ...valid,
        envelope: { ...valid.envelope, operation: "party.updated" },
        idempotencyKey: "order101-hostile-operation",
      },
    ];
    for (const input of invalid) {
      await expect(
        create(input as CreatePartyProfileInput),
      ).rejects.toBeInstanceOf(PartyProfileValidationError);
      expect(await artifactCounts()).toEqual(before);
    }

    const searchInvalid = [
      { tenantId: TENANT_A, query: " " },
      { tenantId: TENANT_A, query: "x" },
      { tenantId: TENANT_A, query: "x".repeat(121) },
      { tenantId: "bad", query: "valid" },
      { tenantId: TENANT_A, query: "valid", limit: 0 },
      { tenantId: TENANT_A, query: "valid", limit: 51 },
      { tenantId: TENANT_A, query: "valid", limit: 1.5 },
      { tenantId: TENANT_A, query: "valid", limit: Number.NaN },
    ];
    for (const input of searchInvalid) {
      await expect(search(input)).rejects.toBeInstanceOf(
        PartyProfileValidationError,
      );
    }

    const wrongProperty = createInput({
      displayName: "Order 101 Wrong Property",
      idempotencyKey: "order101-wrong-property",
      envelope: envelope(TENANT_A, PROPERTY_B),
    });
    await expect(create(wrongProperty)).rejects.toThrow(
      "Audit property was not found",
    );
    expect(await artifactCounts()).toEqual(before);

    const tenantMismatch = createInput({
      displayName: "Order 101 Tenant Mismatch",
      idempotencyKey: "order101-tenant-mismatch",
      envelope: envelope(TENANT_B, PROPERTY_B, ACTOR_B),
    });
    await expect(create(tenantMismatch, profiles!, TENANT_A)).rejects.toThrow();
    expect(await artifactCounts()).toEqual(before);
    expect(
      await search({ tenantId: TENANT_B, query: PARTY_B }, TENANT_A),
    ).toEqual([]);
  });

  test("P4: runtime input cannot smuggle unbuilt PII or server-owned contact state", async () => {
    const before = await artifactCounts();
    const withUnbuiltPii = {
      ...createInput({
        displayName: "Order 101 Smuggled PII",
        idempotencyKey: "order101-smuggled-pii",
      }),
      attrs: { date_of_birth: "1990-01-01", nationality: "ZZ" },
    } as unknown as CreatePartyProfileInput;
    await expect(create(withUnbuiltPii)).rejects.toBeInstanceOf(
      PartyProfileValidationError,
    );

    const withServerState = createInput({
      displayName: "Order 101 Smuggled Contact State",
      idempotencyKey: "order101-smuggled-contact-state",
      contacts: [
        {
          kind: "email",
          value: "smuggled@order101.test",
          verified: true,
        } as unknown as CreatePartyProfileInput["contacts"][number],
      ],
    });
    await expect(create(withServerState)).rejects.toBeInstanceOf(
      PartyProfileValidationError,
    );
    expect(await artifactCounts()).toEqual(before);
  });

  test("P3: Party update is tenant-scoped, idempotent, minimized and atomic", async () => {
    await expect(
      database!.withTenantTransaction(TENANT_A, (tx) => tx`
        UPDATE party SET display_name = 'Direct update must be denied'
        WHERE tenant_id = ${TENANT_A}::uuid AND id = ${PARTY_A}::uuid
      `),
    ).rejects.toMatchObject({ errno: "42501" });
    await expect(
      database!.withTenantTransaction(TENANT_A, (tx) => tx`
        SELECT * FROM public.update_party_profile(
          ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${PARTY_A}::uuid,
          ${ACTOR_A}::uuid, ${crypto.randomUUID()}::uuid,
          'Stale expected display', 'Asha Rao Legal', 'Asha Rao Updated', 'Asha Rao Updated Legal'
        )
      `),
    ).rejects.toMatchObject({ errno: "40001" });
    const protectedBaseline = await protectedTableFingerprint();

    const requestId = crypto.randomUUID();
    const input = updateInput({
      idempotencyKey: "order465-party-update",
      envelope: updateEnvelope(TENANT_A, PROPERTY_A, ACTOR_A, requestId),
    });
    const first = await update(input);
    expect(first).toMatchObject({
      replayed: false,
      changed: true,
      party: {
        partyId: PARTY_A,
        displayName: "Asha Rao Updated",
        legalName: "Asha Rao Updated Legal",
        roles: ["contact", "guest"],
      },
    });
    expect(await update(input)).toEqual({ ...first, replayed: true });
    expect(await protectedTableFingerprint()).toEqual(protectedBaseline);

    const evidence = await admin!<
      Array<{
        fact_payload: Record<string, unknown>;
        event_payload: Record<string, unknown>;
        event_tenant: string;
        property_node: string;
        actor_id: string;
        correlation_id: string;
      }>
    >`
      SELECT fact.payload AS fact_payload, event.payload AS event_payload,
        event.tenant_id AS event_tenant, event.property_node, event.actor_id, event.correlation_id
      FROM fact_log AS fact
      JOIN outbox AS event
        ON event.tenant_id = fact.tenant_id AND event.aggregate_id = fact.entity_id
       AND event.event_type = 'party.updated'
      WHERE fact.tenant_id = ${TENANT_A}::uuid
        AND fact.entity_id = ${PARTY_A}::uuid
        AND fact.fact_type = 'party.updated'
    `;
    expect(evidence).toEqual([
      {
        fact_payload: {
          party_id: PARTY_A,
          changed_fields: ["display_name", "legal_name"],
          request_id: requestId,
        },
        event_payload: {
          party_id: PARTY_A,
          changed_fields: ["display_name", "legal_name"],
        },
        event_tenant: TENANT_A,
        property_node: PROPERTY_A,
        actor_id: ACTOR_A,
        correlation_id: requestId,
      },
    ]);
    expect(JSON.stringify(evidence)).not.toContain("Asha Rao Updated");

    const noOp = await update(
      updateInput({
        displayName: "Asha Rao Updated",
        legalName: "Asha Rao Updated Legal",
        idempotencyKey: "order465-party-update-noop",
      }),
    );
    expect(noOp).toMatchObject({ replayed: false, changed: false });
    const eventCount = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM outbox
      WHERE tenant_id = ${TENANT_A}::uuid AND aggregate_id = ${PARTY_A}::uuid AND event_type = 'party.updated'
    `;
    expect(eventCount).toEqual([{ count: 1 }]);
    expect(await protectedTableFingerprint()).toEqual(protectedBaseline);

    await expect(
      update(updateInput({ envelope: updateEnvelope(TENANT_A, PROPERTY_B, ACTOR_A) })),
    ).rejects.toBeInstanceOf(PartyProfileValidationError);
    await expect(
      update(updateInput({ envelope: updateEnvelope(TENANT_A, PROPERTY_A, ACTOR_B) })),
    ).rejects.toMatchObject({ errno: "42501" });

    const later = await update(updateInput({
      displayName: "Asha Rao Later Update",
      legalName: "Asha Rao Later Legal",
      idempotencyKey: "order465-party-update-later",
    }));
    expect(later).toMatchObject({ replayed: false, changed: true });
    expect(await update(input)).toEqual({ ...first, replayed: true });
    expect(await protectedTableFingerprint()).toEqual(protectedBaseline);

    const displayOnly = await update(
      updateInput({
        partyId: PARTY_FUZZY,
        displayName: "Anika Sharma Updated",
        legalName: undefined,
        idempotencyKey: "order465-party-update-display-only",
      }),
    );
    expect(displayOnly).toMatchObject({
      replayed: false,
      changed: true,
      party: {
        partyId: PARTY_FUZZY,
        displayName: "Anika Sharma Updated",
        legalName: null,
      },
    });
    const displayOnlyEvent = await admin!<
      Array<{ payload: Record<string, unknown> }>
    >`
      SELECT payload FROM outbox
      WHERE tenant_id=${TENANT_A}::uuid AND aggregate_id=${PARTY_FUZZY}::uuid AND event_type='party.updated'
    `;
    expect(displayOnlyEvent).toEqual([
      {
        payload: { party_id: PARTY_FUZZY, changed_fields: ["display_name"] },
      },
    ]);
    expect(await protectedTableFingerprint()).toEqual(protectedBaseline);

    await expect(
      update({ ...input, displayName: "Changed Again" }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    await expect(
      update(
        updateInput({
          partyId: PARTY_A,
          envelope: updateEnvelope(TENANT_B, PROPERTY_B, ACTOR_B),
        }),
        profiles!,
        TENANT_B,
      ),
    ).rejects.toBeInstanceOf(PartyProfileValidationError);
    await expect(
      update(
        updateInput({
          envelope: envelope() as UpdatePartyProfileInput["envelope"],
        }),
      ),
    ).rejects.toBeInstanceOf(PartyProfileValidationError);

    const beforeFailure = await admin!<
      Array<{
        display_name: string;
        legal_name: string | null;
        facts: number;
        events: number;
        idempotency: number;
      }>
    >`
      SELECT party.display_name, party.legal_name,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid AND fact_type='party.updated') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid AND event_type='party.updated') AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid AND operation='profiles.party.update') AS idempotency
      FROM party WHERE id=${PARTY_PREFIX}::uuid
    `;
    const protectedBeforeFailure = await protectedTableFingerprint();
    await admin!.unsafe(`
      CREATE FUNCTION public.order465_fail_party_update_outbox() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_type = 'party.updated' THEN
          RAISE EXCEPTION 'Order 465 injected failure after outbox insert';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await admin!.unsafe(`
      CREATE TRIGGER order465_fail_party_update_outbox
      AFTER INSERT ON public.outbox
      FOR EACH ROW EXECUTE FUNCTION public.order465_fail_party_update_outbox()
    `);
    try {
      await expect(
        update(
          updateInput({
            partyId: PARTY_PREFIX,
            displayName: "Should Roll Back",
            legalName: "Should Roll Back Legal",
            idempotencyKey: "order465-update-rollback",
          }),
        ),
      ).rejects.toThrow("Order 465 injected failure after outbox insert");
    } finally {
      await admin!.unsafe(
        "DROP TRIGGER order465_fail_party_update_outbox ON public.outbox",
      );
      await admin!.unsafe(
        "DROP FUNCTION public.order465_fail_party_update_outbox()",
      );
    }
    const afterFailure = await admin!<
      Array<{
        display_name: string;
        legal_name: string | null;
        facts: number;
        events: number;
        idempotency: number;
      }>
    >`
      SELECT party.display_name, party.legal_name,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid AND fact_type='party.updated') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid AND event_type='party.updated') AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid AND operation='profiles.party.update') AS idempotency
      FROM party WHERE id=${PARTY_PREFIX}::uuid
    `;
    expect(afterFailure).toEqual(beforeFailure);
    expect(await protectedTableFingerprint()).toEqual(protectedBeforeFailure);
  });

  test("P3: synthetic clean-arrival reconciliation is target-bound, atomic and replay-safe", async () => {
    const invoke = (
      expectedName: string,
      expectedLegalName: string,
      expectedAttrs: Record<string, string>,
      overrides: Partial<{ tenant: string; property: string; party: string; reservation: string; actor: string; request: string }> = {},
    ) => database!.withTenantTransaction(DEMO_TENANT, (tx) => tx`
      SELECT * FROM public.reconcile_synthetic_clean_arrival_party(
        ${overrides.tenant ?? DEMO_TENANT}::uuid, ${overrides.property ?? DEMO_PROPERTY}::uuid,
        ${overrides.party ?? DEMO_CLEAN_PARTY}::uuid, ${overrides.reservation ?? DEMO_CLEAN_RESERVATION}::uuid,
        ${overrides.actor ?? DEMO_ACTOR}::uuid, ${overrides.request ?? crypto.randomUUID()}::uuid,
        ${expectedName}, ${expectedLegalName}, ${JSON.stringify(expectedAttrs)}::text::jsonb,
        'Aarav Mehta', 'Aarav Mehta', ${JSON.stringify(DEMO_CLEAN_ATTRS)}::text::jsonb
      )
    `);

    const protectedBefore = await protectedTableFingerprint(DEMO_TENANT, true);
    await expect(
      database!.withTenantTransaction(DEMO_TENANT, (tx) => tx`
        UPDATE party SET attrs='{}'::jsonb WHERE id=${DEMO_CLEAN_PARTY}::uuid
      `),
    ).rejects.toMatchObject({ errno: "42501" });
    const firstRequest = crypto.randomUUID();
    const changed = await invoke("Drifted Demo Name", "Drifted Demo Legal", { source: "legacy" }, { request: firstRequest });
    expect(changed).toEqual([{ party_id: DEMO_CLEAN_PARTY, changed: true, changed_fields: ["display_name", "legal_name", "attrs"] }]);
    expect(await protectedTableFingerprint(DEMO_TENANT, true)).toEqual(protectedBefore);
    const noOp = await invoke("Aarav Mehta", "Aarav Mehta", DEMO_CLEAN_ATTRS);
    expect(noOp).toEqual([{ party_id: DEMO_CLEAN_PARTY, changed: false, changed_fields: [] }]);
    expect(await protectedTableFingerprint(DEMO_TENANT, true)).toEqual(protectedBefore);
    await expect(invoke("Drifted Demo Name", "Drifted Demo Legal", { source: "legacy" })).rejects.toMatchObject({ errno: "40001" });
    await expect(invoke("Aarav Mehta", "Aarav Mehta", DEMO_CLEAN_ATTRS, { actor: ACTOR_A })).rejects.toMatchObject({ errno: "42501" });
    await expect(invoke("Aarav Mehta", "Aarav Mehta", DEMO_CLEAN_ATTRS, { property: PROPERTY_A })).rejects.toMatchObject({ errno: "42501" });
    await expect(invoke("Aarav Mehta", "Aarav Mehta", DEMO_CLEAN_ATTRS, { party: PARTY_A })).rejects.toMatchObject({ errno: "42501" });
    await expect(invoke("Aarav Mehta", "Aarav Mehta", DEMO_CLEAN_ATTRS, { reservation: crypto.randomUUID() })).rejects.toMatchObject({ errno: "42501" });
    await expect(invoke("Aarav Mehta", "Aarav Mehta", DEMO_CLEAN_ATTRS, { tenant: TENANT_A })).rejects.toMatchObject({ errno: "42501" });
    await expect(
      database!.withTenantTransaction(DEMO_TENANT, (tx) => tx`
        SELECT * FROM public.reconcile_synthetic_clean_arrival_party(
          ${DEMO_TENANT}::uuid, ${DEMO_PROPERTY}::uuid, ${DEMO_CLEAN_PARTY}::uuid,
          ${DEMO_CLEAN_RESERVATION}::uuid, ${DEMO_ACTOR}::uuid, ${crypto.randomUUID()}::uuid,
          'Aarav Mehta', 'Aarav Mehta', ${JSON.stringify(DEMO_CLEAN_ATTRS)}::text::jsonb,
          'Aarav Mehta', 'Aarav Mehta', '{"source":"arbitrary"}'::jsonb
        )
      `),
    ).rejects.toMatchObject({ errno: "22023" });
    await admin!`UPDATE party_role SET detail='{"source":"legacy"}'::jsonb
      WHERE tenant_id=${DEMO_TENANT}::uuid AND party_id=${DEMO_CLEAN_PARTY}::uuid AND role='guest'`;
    await expect(invoke("Aarav Mehta", "Aarav Mehta", DEMO_CLEAN_ATTRS)).rejects.toMatchObject({ errno: "42501" });
    await admin!`UPDATE party_role SET detail=${JSON.stringify(DEMO_CLEAN_ATTRS)}::text::jsonb
      WHERE tenant_id=${DEMO_TENANT}::uuid AND party_id=${DEMO_CLEAN_PARTY}::uuid AND role='guest'`;
    const evidence = await admin!<Array<{ fact: Record<string, unknown>; event: Record<string, unknown>; actor_id: string; property_node: string; correlation_id: string }>>`
      SELECT fact.payload AS fact, event.payload AS event, event.actor_id, event.property_node, event.correlation_id
      FROM fact_log AS fact JOIN outbox AS event
        ON event.tenant_id=fact.tenant_id AND event.aggregate_id=fact.entity_id AND event.event_type='party.reconciled'
      WHERE fact.tenant_id=${DEMO_TENANT}::uuid AND fact.entity_id=${DEMO_CLEAN_PARTY}::uuid AND fact.fact_type='party.reconciled'
    `;
    expect(evidence).toHaveLength(1);
    expect(Object.keys(evidence[0]!.fact).sort()).toEqual(["changed_fields", "party_id", "request_id"]);
    expect(Object.keys(evidence[0]!.event).sort()).toEqual(["changed_fields", "party_id"]);
    expect(evidence[0]!.event).toEqual({ party_id: DEMO_CLEAN_PARTY, changed_fields: ["display_name", "legal_name", "attrs"] });
    expect(evidence[0]).toMatchObject({ actor_id: DEMO_ACTOR, property_node: DEMO_PROPERTY, correlation_id: firstRequest });
    expect(JSON.stringify(evidence)).not.toContain("Aarav Mehta");
    expect(JSON.stringify(evidence)).not.toContain("Drifted Demo");
  });

  test("P3: synthetic reconciliation revalidates its locked reservation relationship", async () => {
    const holder = await admin!.reserve();
    try {
      await holder.unsafe("BEGIN");
      await holder`SELECT id FROM party WHERE id=${DEMO_CLEAN_PARTY}::uuid FOR UPDATE`;
      const holderPid = (await holder<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0]!.pid;
      const contender = database!.withTenantTransaction(DEMO_TENANT, (tx) => tx`
        SELECT * FROM public.reconcile_synthetic_clean_arrival_party(
          ${DEMO_TENANT}::uuid, ${DEMO_PROPERTY}::uuid, ${DEMO_CLEAN_PARTY}::uuid,
          ${DEMO_CLEAN_RESERVATION}::uuid, ${DEMO_ACTOR}::uuid, ${crypto.randomUUID()}::uuid,
          'Aarav Mehta', 'Aarav Mehta', ${JSON.stringify(DEMO_CLEAN_ATTRS)}::text::jsonb,
          'Aarav Mehta', 'Aarav Mehta', ${JSON.stringify(DEMO_CLEAN_ATTRS)}::text::jsonb
        )
      `);
      let blocked = false;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const rows = await admin!<Array<{ blocked: boolean }>>`
          SELECT EXISTS(
            SELECT 1 FROM pg_stat_activity
            WHERE ${holderPid}::int = ANY(pg_blocking_pids(pid))
          ) AS blocked
        `;
        if (rows[0]?.blocked) { blocked = true; break; }
        await Bun.sleep(10);
      }
      expect(blocked).toBe(true);
      await holder`UPDATE reservation SET confirmation_no='ARR-CLEAN-CHANGED'
        WHERE id=${DEMO_CLEAN_RESERVATION}::uuid`;
      await holder.unsafe("COMMIT");
      await expect(contender).rejects.toMatchObject({ errno: "42501" });
      await admin!`UPDATE reservation SET confirmation_no='ARR-CLEAN'
        WHERE id=${DEMO_CLEAN_RESERVATION}::uuid`;
      const events = await admin!<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM outbox
        WHERE tenant_id=${DEMO_TENANT}::uuid AND aggregate_id=${DEMO_CLEAN_PARTY}::uuid
          AND event_type='party.reconciled'
      `;
      expect(events).toEqual([{ count: 1 }]);
    } finally {
      try { await holder.unsafe("ROLLBACK"); } catch { /* already committed */ }
      holder.release();
    }
  });

  test("P3: offline reconciliation suppresses database error detail", async () => {
    await admin!`UPDATE party SET attrs='{"source":"private-test-marker"}'::jsonb
      WHERE id=${DEMO_CLEAN_PARTY}::uuid`;
    await admin!.unsafe(`
      CREATE FUNCTION public.order467_private_detail() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'injected reconcile failure' USING DETAIL='order467-private-test-marker';
      END; $$
    `);
    await admin!.unsafe(`CREATE TRIGGER order467_private_detail
      BEFORE UPDATE ON public.party FOR EACH ROW EXECUTE FUNCTION public.order467_private_detail()`);
    try {
      const child = Bun.spawn(
        [process.execPath, "scripts/reconcile-synthetic-clean-arrival.ts"],
        {
          cwd: resolve(import.meta.dir, ".."),
          env: {
            ...process.env,
            YELLOW_RUNTIME_DATABASE_URL: RUNTIME_DATABASE_URL!,
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(exitCode).toBe(1);
      expect(`${stdout}${stderr}`).toContain("synthetic clean-arrival reconciliation failed");
      expect(`${stdout}${stderr}`).not.toContain("order467-private-test-marker");
    } finally {
      await admin!.unsafe("DROP TRIGGER order467_private_detail ON public.party");
      await admin!.unsafe("DROP FUNCTION public.order467_private_detail()");
    }
  });

  test("P3: synthetic reconciliation rolls back Party and evidence after outbox failure", async () => {
    const before = await admin!<Array<{ display_name: string; legal_name: string | null; attrs: Record<string, string>; facts: number; events: number }>>`
      SELECT party.display_name, party.legal_name, party.attrs,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${DEMO_TENANT}::uuid AND fact_type='party.reconciled') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${DEMO_TENANT}::uuid AND event_type='party.reconciled') AS events
      FROM party WHERE id=${DEMO_CLEAN_PARTY}::uuid
    `;
    const protectedBefore = await protectedTableFingerprint(DEMO_TENANT, true);
    await admin!.unsafe(`
      CREATE FUNCTION public.order467_fail_reconciled_outbox() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='party.reconciled' THEN RAISE EXCEPTION 'order467 injected outbox failure'; END IF;
        RETURN NEW;
      END; $$
    `);
    await admin!.unsafe(`CREATE TRIGGER order467_fail_reconciled_outbox
      AFTER INSERT ON public.outbox FOR EACH ROW EXECUTE FUNCTION public.order467_fail_reconciled_outbox()`);
    const invoke = () => database!.withTenantTransaction(DEMO_TENANT, (tx) => tx`
      SELECT * FROM public.reconcile_synthetic_clean_arrival_party(
        ${DEMO_TENANT}::uuid, ${DEMO_PROPERTY}::uuid, ${DEMO_CLEAN_PARTY}::uuid,
        ${DEMO_CLEAN_RESERVATION}::uuid, ${DEMO_ACTOR}::uuid, ${crypto.randomUUID()}::uuid,
        'Aarav Mehta', 'Aarav Mehta', '{"source":"private-test-marker"}'::jsonb,
        'Aarav Mehta', 'Aarav Mehta', ${JSON.stringify(DEMO_CLEAN_ATTRS)}::text::jsonb
      )
    `);
    try {
      await expect(invoke()).rejects.toThrow("order467 injected outbox failure");
    } finally {
      await admin!.unsafe("DROP TRIGGER order467_fail_reconciled_outbox ON public.outbox");
      await admin!.unsafe("DROP FUNCTION public.order467_fail_reconciled_outbox()");
    }
    expect(await admin!<Array<{ display_name: string; legal_name: string | null; attrs: Record<string, string>; facts: number; events: number }>>`
      SELECT party.display_name, party.legal_name, party.attrs,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${DEMO_TENANT}::uuid AND fact_type='party.reconciled') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${DEMO_TENANT}::uuid AND event_type='party.reconciled') AS events
      FROM party WHERE id=${DEMO_CLEAN_PARTY}::uuid
    `).toEqual(before);
    expect(await protectedTableFingerprint(DEMO_TENANT, true)).toEqual(protectedBefore);
    expect(await invoke()).toEqual([{ party_id: DEMO_CLEAN_PARTY, changed: true, changed_fields: ["attrs"] }]);
  });
});
