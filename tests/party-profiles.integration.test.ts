import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  PartyDuplicateReviewRequiredError,
  PartyProfileService,
  PartyProfileValidationError,
  type CreatePartyProfileInput,
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

const DATABASE_URL = process.env.YELLOW_PARTY_PROFILES_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_PARTY_PROFILES === "1";

const TENANT_A = "00000000-0000-0000-0000-000000010101";
const TENANT_B = "00000000-0000-0000-0000-000000010102";
const PROPERTY_A = "00000000-0000-0000-0000-000000010111";
const PROPERTY_B = "00000000-0000-0000-0000-000000010112";
const ACTOR_A = "00000000-0000-0000-0000-000000010121";
const ACTOR_B = "00000000-0000-0000-0000-000000010122";

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

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_PARTY_PROFILES_URL is required by the Order 101 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
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

function serviceFor(bus: EventBus): PartyProfileService {
  return new PartyProfileService({ events: bus, idempotency: new PostgresIdempotency() });
}

async function search(
  input: Parameters<PartyProfileService["search"]>[1],
  transactionTenant = input.tenantId,
) {
  return database!.withTenantTransaction(transactionTenant, (tx) => profiles!.search(tx, input));
}

async function create(
  input: CreatePartyProfileInput,
  service = profiles!,
  transactionTenant = input.envelope.tenantId,
) {
  return database!.withTenantTransaction(transactionTenant, (tx) => service.create(tx, input));
}

function createInput(overrides: Partial<CreatePartyProfileInput> = {}): CreatePartyProfileInput {
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

async function cleanFixtures(): Promise<void> {
  if (!admin) return;
  await admin`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM contact_point WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM party_role WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM app_user WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
}

class FailAfterPublishEventBus implements EventBus {
  constructor(readonly delegate: EventBus) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 101 injected failure after outbox insert");
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 24 });
  eventPool = new SQL(DATABASE_URL, { max: 24 });
  database = Database.connect(DATABASE_URL, { maxConnections: 48 });
  events = new PostgresEventBus(eventPool);
  profiles = serviceFor(events);
  await cleanFixtures();

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order101-a', 'Order 101 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order101-b', 'Order 101 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order101_a', 'property', 'Order 101 A', 'Asia/Kolkata', 'INR'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order101_b', 'property', 'Order 101 B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name, status)
    VALUES
      (${ACTOR_A}::uuid, ${TENANT_A}::uuid, 'actor-a@order101.test', 'Order 101 Actor A', 'active'),
      (${ACTOR_B}::uuid, ${TENANT_B}::uuid, 'actor-b@order101.test', 'Order 101 Actor B', 'active')
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
    const byUuid = await search({ tenantId: TENANT_A, query: PARTY_A, limit: 10 });
    expect(byUuid).toEqual([{
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
    }]);

    const byEmail = await search({ tenantId: TENANT_A, query: `  ${EMAIL_A.toUpperCase()}  ` });
    const byPhone = await search({ tenantId: TENANT_A, query: PHONE_A });
    const fuzzy = await search({ tenantId: TENANT_A, query: "Anika Sharm" });
    const twoCharacterPrefix = await search({ tenantId: TENANT_A, query: "Al" });
    expect(byEmail.map(({ partyId }) => partyId)).toEqual([PARTY_A]);
    expect(byPhone.map(({ partyId }) => partyId)).toEqual([PARTY_A]);
    expect(fuzzy.map(({ partyId }) => partyId)).toContain(PARTY_FUZZY);
    expect(twoCharacterPrefix.map(({ partyId }) => partyId)).toEqual([PARTY_PREFIX]);

    const repeated = await search({ tenantId: TENANT_A, query: "Order 101 Noise", limit: 50 });
    const repeatedAgain = await search({ tenantId: TENANT_A, query: "Order 101 Noise", limit: 50 });
    expect(repeated).toHaveLength(50);
    expect(repeatedAgain).toEqual(repeated);
    expect((await search({ tenantId: TENANT_A, query: "Order 101 Noise", limit: 1 }))).toHaveLength(1);

    expect(JSON.stringify([byUuid, byEmail, byPhone])).not.toContain(EMAIL_A);
    expect(JSON.stringify([byUuid, byEmail, byPhone])).not.toContain(PHONE_A);
    expect((await search({ tenantId: TENANT_A, query: PARTY_MERGED }))).toEqual([]);
    expect((await search({ tenantId: TENANT_A, query: PARTY_ANONYMISED }))).toEqual([]);
    expect((await search({ tenantId: TENANT_A, query: FOREIGN_EMAIL }))).toEqual([]);
    expect((await search({ tenantId: TENANT_B, query: EMAIL_A }, TENANT_A))).toEqual([]);
    expect((await search({ tenantId: TENANT_A, query: "%_" }))).toEqual([]);
  });

  test("P1: tenant-leading search indexes exist and production-shaped branches use them", async () => {
    const indexes = await admin!<Array<{ indexname: string; indexdef: string }>>`
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
    expect(indexes[0]!.indexdef).toContain("(tenant_id, kind, value, party_id)");
    expect(indexes[1]!.indexdef).toContain("(tenant_id, status, id)");

    const connection = await admin!.reserve();
    let tenantPlan = "";
    let contactPlan = "";
    let trigramPlan = "";
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe("SET LOCAL enable_seqscan = off");
      const tenantRows = await connection.unsafe<Array<Record<string, string>>>(`
        EXPLAIN (COSTS OFF)
        SELECT count(*) FROM party
        WHERE tenant_id = $1::uuid AND status = 'active'
      `, [TENANT_A]);
      const contactRows = await connection.unsafe<Array<Record<string, string>>>(`
        EXPLAIN (COSTS OFF)
        SELECT party_id FROM contact_point
        WHERE tenant_id = $1::uuid AND kind = 'email' AND value = $2
      `, [TENANT_A, EMAIL_A]);
      const trigramRows = await connection.unsafe<Array<Record<string, string>>>(`
        EXPLAIN (COSTS OFF)
        SELECT id FROM party WHERE display_name % $1
      `, ["Anika Sharm"]);
      tenantPlan = tenantRows.map((row) => Object.values(row)[0]).join("\n");
      contactPlan = contactRows.map((row) => Object.values(row)[0]).join("\n");
      trigramPlan = trigramRows.map((row) => Object.values(row)[0]).join("\n");
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
    expect(tenantPlan).toContain("party_tenant_status_id");
    expect(contactPlan).toContain("contact_point_tenant_kind_value");
    expect(trigramPlan).toContain("party_name_trgm");
  });

  test("P2: duplicate review is exact, sorted, masked, tenant-local and leaves no failed artifacts", async () => {
    const before = await artifactCounts();
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
    expect(review?.candidates).toEqual([{
      partyId: PARTY_A,
      displayNameHint: "As…",
      reasons: ["display_name", "email"],
      contacts: [{ kind: "email", hint: "a•••@order101.test", isPrimary: true }],
    }]);
    expect(JSON.stringify(review?.candidates)).not.toContain(EMAIL_A);
    expect(await artifactCounts()).toEqual(before);

    const acknowledged = await create({ ...requested, acknowledgedDuplicatePartyIds: [PARTY_A] });
    expect(acknowledged.replayed).toBe(false);
    expect(acknowledged.party.displayName).toBe("ASHA RAO");

    const staleBefore = await artifactCounts();
    await expect(create({
      ...requested,
      idempotencyKey: "order101-stale-review",
      acknowledgedDuplicatePartyIds: [PARTY_A],
      envelope: envelope(),
    })).rejects.toBeInstanceOf(PartyDuplicateReviewRequiredError);
    expect(await artifactCounts()).toEqual(staleBefore);

    const extraBefore = await artifactCounts();
    await expect(create(createInput({
      displayName: "Order 101 No Candidates",
      acknowledgedDuplicatePartyIds: [PARTY_A],
      idempotencyKey: "order101-extra-review",
    }))).rejects.toBeInstanceOf(PartyDuplicateReviewRequiredError);
    await expect(create(createInput({
      displayName: "Order 101 Foreign Evidence",
      acknowledgedDuplicatePartyIds: [PARTY_B],
      idempotencyKey: "order101-foreign-review",
    }))).rejects.toMatchObject({ candidates: [] });
    expect(await artifactCounts()).toEqual(extraBefore);
  });

  test("P2: advisory locks close identical, stale-ack and partially-overlapping identity races", async () => {
    const identical = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => create(createInput({
      displayName: "Order 101 Empty Race",
      contacts: [{ kind: "email", value: "empty-race@order101.test" }],
      idempotencyKey: `order101-empty-race-${index}`,
      envelope: envelope(),
    }))));
    expect(identical.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const identicalRejected = identical.filter((result) => result.status === "rejected");
    expect(identicalRejected).toHaveLength(19);
    expect(identicalRejected.every(({ reason }) => reason instanceof PartyDuplicateReviewRequiredError)).toBeTrue();

    const acknowledged = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => create(createInput({
      displayName: "Order 101 Ack Race",
      acknowledgedDuplicatePartyIds: [PARTY_ACK_RACE],
      idempotencyKey: `order101-ack-race-${index}`,
      envelope: envelope(),
    }))));
    expect(acknowledged.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(acknowledged.filter(({ status }) => status === "rejected")).toHaveLength(9);

    const sharedContact = await Promise.allSettled([
      create(createInput({
        displayName: "Order 101 Contact Race Left",
        contacts: [{ kind: "phone", value: "+14155550101" }],
        idempotencyKey: "order101-contact-race-left",
      })),
      create(createInput({
        displayName: "Order 101 Contact Race Right",
        contacts: [{ kind: "phone", value: "+14155550101" }],
        idempotencyKey: "order101-contact-race-right",
      })),
    ]);
    expect(sharedContact.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(sharedContact.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const sharedName = await Promise.allSettled([
      create(createInput({
        displayName: "Order 101 Shared Name Race",
        contacts: [{ kind: "email", value: "shared-name-left@order101.test" }],
        idempotencyKey: "order101-name-race-left",
      })),
      create(createInput({
        displayName: "  order 101   shared name race ",
        contacts: [{ kind: "email", value: "shared-name-right@order101.test" }],
        idempotencyKey: "order101-name-race-right",
      })),
    ]);
    expect(sharedName.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(sharedName.filter(({ status }) => status === "rejected")).toHaveLength(1);
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
        { kind: "email", value: "  MEERA.JOSHI@ORDER101.TEST  ", isPrimary: true },
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
    await expect(create({ ...input, legalName: "Changed Legal Name" }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);

    const storedParty = await admin!<Array<{
      kind: string; display_name: string; legal_name: string | null; status: string; attrs: unknown;
    }>>`
      SELECT kind, display_name, legal_name, status, attrs
      FROM party WHERE id = ${first.party.partyId}::uuid
    `;
    expect(storedParty).toEqual([{
      kind: "person",
      display_name: "Meera Joshi",
      legal_name: "MEERA JOSHI LEGAL",
      status: "active",
      attrs: {},
    }]);
    const storedRoles = await admin!<{ role: string }[]>`
      SELECT role FROM party_role WHERE party_id = ${first.party.partyId}::uuid ORDER BY role
    `;
    const storedContacts = await admin!<Array<{
      kind: string; value: string; is_primary: boolean; verified: boolean;
    }>>`
      SELECT kind, value, is_primary, verified
      FROM contact_point WHERE party_id = ${first.party.partyId}::uuid ORDER BY kind, value
    `;
    expect(storedRoles.map(({ role }) => role)).toEqual(["contact", "guest"]);
    expect(storedContacts).toEqual([
      { kind: "email", value: "meera.joshi@order101.test", is_primary: true, verified: false },
      { kind: "phone", value: "+919123456789", is_primary: true, verified: false },
    ]);

    const evidence = await admin!<Array<{
      fact_payload: Record<string, unknown>; event_payload: Record<string, unknown>;
      event_tenant: string; property_node: string; actor_id: string; correlation_id: string;
      business_dates_match: boolean; response_body: Record<string, unknown>; idempotency_serialized: string;
    }>>`
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
      "Meera Joshi", "MEERA JOSHI LEGAL", "meera.joshi@order101.test", "+919123456789",
    ]) expect(serializedEvidence).not.toContain(raw);
    expect(evidence[0]!.idempotency_serialized).not.toContain("order101-atomic-person");

    const org = await create(createInput({
      kind: "org",
      displayName: "Order 101 Example Holdings",
      legalName: "Order 101 Example Holdings Limited",
      roles: ["company", "agent"],
      idempotencyKey: "order101-atomic-org",
    }));
    expect(org.party).toMatchObject({ kind: "org", roles: ["agent", "company"], contacts: [] });
  });

  test("P3: a failure after outbox insertion rolls back every artifact and the same key retries", async () => {
    const before = await artifactCounts();
    const input = createInput({
      displayName: "Order 101 Rollback Person",
      contacts: [{ kind: "email", value: "rollback-person@order101.test" }],
      idempotencyKey: "order101-publish-rollback",
    });
    const failing = serviceFor(new FailAfterPublishEventBus(events!));
    await expect(create(input, failing)).rejects.toThrow("failure after outbox insert");
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
    const valid = createInput({ displayName: "Order 101 Hostile Boundary", idempotencyKey: "order101-hostile-base" });
    const invalid: unknown[] = [
      { ...valid, kind: "guest", idempotencyKey: "order101-hostile-kind" },
      { ...valid, displayName: "   ", idempotencyKey: "order101-hostile-blank" },
      { ...valid, displayName: "x".repeat(201), idempotencyKey: "order101-hostile-long" },
      { ...valid, displayName: "bad\u0000name", idempotencyKey: "order101-hostile-control" },
      { ...valid, roles: [], idempotencyKey: "order101-hostile-no-role" },
      { ...valid, roles: ["guest", "guest"], idempotencyKey: "order101-hostile-dup-role" },
      { ...valid, roles: ["guest", "traveller"], idempotencyKey: "order101-hostile-role" },
      { ...valid, contacts: Array.from({ length: 7 }, (_, index) => ({ kind: "email", value: `h${index}@order101.test` })), idempotencyKey: "order101-hostile-many-contact" },
      { ...valid, contacts: [{ kind: "email", value: "not-an-email" }], idempotencyKey: "order101-hostile-email" },
      { ...valid, contacts: [{ kind: "phone", value: "919123456789" }], idempotencyKey: "order101-hostile-phone" },
      { ...valid, contacts: [{ kind: "whatsapp", value: "+019123456789" }], idempotencyKey: "order101-hostile-whatsapp" },
      { ...valid, contacts: [{ kind: "email", value: "DUP@ORDER101.TEST" }, { kind: "email", value: " dup@order101.test " }], idempotencyKey: "order101-hostile-dup-contact" },
      { ...valid, contacts: [{ kind: "phone", value: "+919111111111", isPrimary: true }, { kind: "phone", value: "+919222222222", isPrimary: true }], idempotencyKey: "order101-hostile-primary" },
      { ...valid, acknowledgedDuplicatePartyIds: [PARTY_A, PARTY_A], idempotencyKey: "order101-hostile-dup-ack" },
      { ...valid, acknowledgedDuplicatePartyIds: [PARTY_FUZZY, PARTY_A], idempotencyKey: "order101-hostile-sort-ack" },
      { ...valid, acknowledgedDuplicatePartyIds: ["bad"], idempotencyKey: "order101-hostile-bad-ack" },
      { ...valid, idempotencyKey: "short" },
      { ...valid, idempotencyKey: "order 101 spaces rejected" },
      { ...valid, envelope: { ...valid.envelope, operation: "party.updated" }, idempotencyKey: "order101-hostile-operation" },
    ];
    for (const input of invalid) {
      await expect(create(input as CreatePartyProfileInput)).rejects.toBeInstanceOf(PartyProfileValidationError);
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
      await expect(search(input)).rejects.toBeInstanceOf(PartyProfileValidationError);
    }

    const wrongProperty = createInput({
      displayName: "Order 101 Wrong Property",
      idempotencyKey: "order101-wrong-property",
      envelope: envelope(TENANT_A, PROPERTY_B),
    });
    await expect(create(wrongProperty)).rejects.toThrow("Audit property was not found");
    expect(await artifactCounts()).toEqual(before);

    const tenantMismatch = createInput({
      displayName: "Order 101 Tenant Mismatch",
      idempotencyKey: "order101-tenant-mismatch",
      envelope: envelope(TENANT_B, PROPERTY_B, ACTOR_B),
    });
    await expect(create(tenantMismatch, profiles!, TENANT_A)).rejects.toThrow();
    expect(await artifactCounts()).toEqual(before);
    expect((await search({ tenantId: TENANT_B, query: PARTY_B }, TENANT_A))).toEqual([]);
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
    await expect(create(withUnbuiltPii)).rejects.toBeInstanceOf(PartyProfileValidationError);

    const withServerState = createInput({
      displayName: "Order 101 Smuggled Contact State",
      idempotencyKey: "order101-smuggled-contact-state",
      contacts: [{
        kind: "email",
        value: "smuggled@order101.test",
        verified: true,
      } as unknown as CreatePartyProfileInput["contacts"][number]],
    });
    await expect(create(withServerState)).rejects.toBeInstanceOf(PartyProfileValidationError);
    expect(await artifactCounts()).toEqual(before);
  });
});
