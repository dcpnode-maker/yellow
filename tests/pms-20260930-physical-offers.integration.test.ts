import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { AvailabilityProjectionService, AvailabilityService } from "../src/contexts/inventory";
import { Database, PostgresEventBus, ExtensionRegistry, ApprovalService, type Tx } from "../src/kernel";
import { RateConfigurationService, RatePublicationService, RateQuoteService, type ResolveRateQuoteInput } from "../src/contexts/rates";
import { TaxJurisdictionResolutionService } from "../src/contexts/tax-fiscal";
import { ReservationOfferSearchService, ReservationOfferSearchTooBroadError, type ReservationOfferSearchInput } from "../src/contexts/reservations";
import { runReviewSeed } from "../scripts/seed-review";
import { SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

setDefaultTimeout(180_000);
const deployUrl = process.env.YELLOW_PMS_OFFERS_DEPLOY_URL;
const runtimeUrl = process.env.YELLOW_PMS_OFFERS_RUNTIME_URL;
const required = process.env.YELLOW_REQUIRE_PMS_PHYSICAL_OFFERS === "1";
if (required && (!deployUrl || !runtimeUrl)) {
  throw new Error("Yellow PMS physical-offer deploy and runtime URLs are required");
}

function target(raw: string) {
  const url = new URL(raw);
  return {
    host: url.hostname.toLowerCase(),
    port: url.port || "5432",
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}
if (deployUrl && runtimeUrl) {
  const deploy = target(deployUrl), runtime = target(runtimeUrl);
  if (deploy.host !== runtime.host || deploy.port !== runtime.port || deploy.database !== runtime.database ||
      !/^(yellow_pms_offer_proof|.*_proof)$/.test(deploy.database)) {
    throw new Error("PMS physical-offer deploy/runtime URLs are not the same guarded disposable proof target");
  }
}

const proof = deployUrl && runtimeUrl ? describe.serial : describe.skip;
interface InventoryFixture {
  readonly sellable_unit_id: string;
  readonly sellable_unit_name: string;
  readonly unit_type_code: string;
  readonly space_id: string;
  readonly space_code: string;
}
let admin: SQL;
let runtimePool: SQL;
let db: Database;
let start: Date;
let end: Date;
let ratePlanId: string;
let runtimeOffers: ReservationOfferSearchService;
let availability: AvailabilityService;
let rates: RateConfigurationService;
let quoteService: RateQuoteService;

async function inventoryFixtures(): Promise<readonly InventoryFixture[]> {
  return admin<InventoryFixture[]>`
    SELECT sellable.id AS sellable_unit_id, sellable.name AS sellable_unit_name,
           unit_type.code AS unit_type_code, space.id AS space_id, space.code AS space_code
    FROM sellable_unit AS sellable
    JOIN unit_type ON unit_type.id = sellable.unit_type_id
    JOIN sellable_unit_space AS mapping ON mapping.sellable_unit_id = sellable.id
    JOIN space ON space.id = mapping.space_id
    WHERE sellable.tenant_id = ${SEED_TENANT.id}::uuid
      AND unit_type.property_node = ${SEED_PROPERTY.id}::uuid
      AND sellable.status = 'active'
    ORDER BY unit_type.sort_order, unit_type.code, sellable.name, sellable.id
  `;
}

async function publicFingerprint() {
  const tables = await admin<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  if (tables.length === 0) throw new Error("PMS proof target has no public tables to fingerprint");
  const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
  const tableHashes: Record<string, string> = {};
  for (const { tablename } of tables) {
    const rows = await admin.unsafe<{ value: string }[]>(
      `SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY to_jsonb(t)::text), '')) AS value ` +
      `FROM public.${quoteIdentifier(tablename)} AS t`,
    );
    if (rows.length !== 1 || typeof rows[0]?.value !== "string") {
      throw new Error("PMS proof could not fingerprint a public table");
    }
    tableHashes[tablename] = rows[0].value;
  }
  const sequences = await admin<{ sequencename: string }[]>`
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename
  `;
  const sequenceStates: Record<string, { lastValue: string; isCalled: boolean }> = {};
  for (const { sequencename } of sequences) {
    const rows = await admin.unsafe<{ last_value: string; is_called: boolean }[]>(
      `SELECT last_value::text, is_called FROM public.${quoteIdentifier(sequencename)}`,
    );
    if (rows.length !== 1 || typeof rows[0]?.last_value !== "string" || typeof rows[0]?.is_called !== "boolean") {
      throw new Error("PMS proof could not fingerprint a public sequence");
    }
    sequenceStates[sequencename] = { lastValue: rows[0].last_value, isCalled: rows[0].is_called };
  }
  return { tables: tableHashes, sequences: sequenceStates };
}

function offerInput(): ReservationOfferSearchInput {
  return {
    propertyNode: SEED_PROPERTY.id,
    stayStart: start,
    stayEnd: end,
    guests: { adults: 1, childAges: [] },
    channelCode: "direct",
  };
}

function exactQuoteInput(sellableUnitId: string): ResolveRateQuoteInput {
  return {
    propertyNode: SEED_PROPERTY.id,
    ratePlanId,
    sellableUnitId,
    stayStart: start,
    stayEnd: end,
    guests: { adults: 1, childAges: [] },
    selectedPromotionCodes: [],
    commercial: {},
    channelCode: "direct",
  };
}

async function search(service = runtimeOffers) {
  return db.withTenantTransaction(SEED_TENANT.id, (tx) => service.search(tx, offerInput()));
}

proof("PMS physical offer-pair contract on restricted PostgreSQL", () => {
  beforeAll(async () => {
    admin = new SQL(deployUrl!, { max: 8, prepare: false });
    runtimePool = new SQL(runtimeUrl!, { max: 8, prepare: false });
    db = Database.connect(runtimeUrl!, { maxConnections: 12, prepare: false });

    const [deploymentIdentity] = await admin`SELECT current_database() AS name,
      (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS oid,
      inet_server_addr()::text AS address, inet_server_port()::text AS port,
      pg_postmaster_start_time()::text AS started`;
    const [runtimeIdentity] = await runtimePool`SELECT current_database() AS name,
      (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS oid,
      inet_server_addr()::text AS address, inet_server_port()::text AS port,
      pg_postmaster_start_time()::text AS started, session_user::text AS session_user,
      current_user::text AS current_user,
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = session_user) AS elevated,
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS current_elevated,
      pg_has_role(session_user, 'app_role', 'member') AS app_member`;
    if (!deploymentIdentity || !runtimeIdentity ||
        !/^(yellow_pms_offer_proof|.*_proof)$/.test(deploymentIdentity.name) ||
        deploymentIdentity.name !== runtimeIdentity.name || deploymentIdentity.oid !== runtimeIdentity.oid ||
        deploymentIdentity.address !== runtimeIdentity.address || deploymentIdentity.port !== runtimeIdentity.port ||
        deploymentIdentity.started !== runtimeIdentity.started) {
      throw new Error("PMS physical-offer pools do not identify one guarded disposable PostgreSQL instance");
    }
    if (runtimeIdentity.session_user !== "yellow_runtime" || runtimeIdentity.elevated !== false ||
        runtimeIdentity.current_elevated !== false || runtimeIdentity.app_member !== true) {
      throw new Error("PMS physical-offer runtime login is not the restricted yellow_runtime role");
    }
    const migrated = await admin<{ max_version: number | null; count: number }[]>`
      SELECT max(version)::int AS max_version, count(*)::int AS count FROM public.schema_migration
    `;
    const publicTables = await admin<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const tableNames = new Set(publicTables.map(({ tablename }) => tablename));
    const requiredTables = [
      "schema_migration", "org_node", "sellable_unit", "sellable_unit_space", "space",
      "space_occupancy", "ooo_oos", "rate_plan", "rate_price",
    ];
    if (!migrated[0] || migrated[0].max_version === null || migrated[0].count < 1 ||
        requiredTables.some((name) => !tableNames.has(name))) {
      throw new Error("PMS physical-offer target lacks its migrated canonical inventory/rate catalogue");
    }
    const context = await db.withTenantTransaction(SEED_TENANT.id, async (tx: Tx) => {
      const [row] = await tx`SELECT session_user::text AS session_user, current_user::text AS current_user,
        current_setting('app.tenant_id', true) AS tenant_context,
        (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = session_user) AS elevated,
        (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS current_elevated,
        pg_has_role(session_user, 'app_role', 'member') AS app_member`;
      return row;
    });
    if (context?.session_user !== "yellow_runtime" || context.current_user !== "app_role" ||
        context.tenant_context !== SEED_TENANT.id || context.elevated !== false ||
        context.current_elevated !== false || context.app_member !== true) {
      throw new Error("PMS physical-offer transaction did not establish restricted app_role tenant context");
    }

    const review = await runReviewSeed({
      databaseUrl: deployUrl!,
      password: "synthetic-physical-offer-review-password-20260930",
      approverPassword: "synthetic-physical-offer-approver-password-20260930",
      logger: () => undefined,
    });
    ratePlanId = review.rate.ratePlanId;
    start = new Date("2028-04-20T15:00:00.000Z");
    end = new Date(start.getTime() + 2 * 86_400_000);

    const events = new PostgresEventBus(runtimePool);
    availability = new AvailabilityService();
    const projection = new AvailabilityProjectionService();
    rates = new RateConfigurationService(events);
    const registry = new ExtensionRegistry(runtimePool);
    const publication = new RatePublicationService(registry, new ApprovalService(events), events);
    quoteService = new RateQuoteService(
      publication,
      new TaxJurisdictionResolutionService(registry),
      availability,
      projection,
    );
    runtimeOffers = new ReservationOfferSearchService(rates, quoteService, availability);
  }, 120_000);

  afterAll(async () => {
    await Promise.allSettled([db?.close(), runtimePool?.close({ timeout: 0 }), admin?.close({ timeout: 0 })]);
  });

  test("returns all six physical quotes, preserves either sibling blocker ordering, and leaves public rows/sequences unchanged", async () => {
    const fixtures = await inventoryFixtures();
    expect(fixtures).toHaveLength(6);
    expect(fixtures.filter(({ unit_type_code }) => unit_type_code === "STD")).toHaveLength(3);
    expect(fixtures.filter(({ unit_type_code }) => unit_type_code === "DLX")).toHaveLength(3);

    const beforeClear = await publicFingerprint();
    const clearProof = await db.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const rawAvailability = await availability.search(tx, {
        propertyNode: SEED_PROPERTY.id,
        from: start,
        to: end,
        partySize: 1,
        channelCode: "direct",
      });
      const offers = await runtimeOffers.search(tx, offerInput());
      const directQuotes = [];
      for (const fixture of fixtures) {
        directQuotes.push(await quoteService.resolve(tx, exactQuoteInput(fixture.sellable_unit_id)));
      }
      return { rawAvailability, offers, directQuotes };
    });
    const { rawAvailability, offers: clear, directQuotes } = clearProof;
    expect(rawAvailability).toHaveLength(6);
    expect(new Set(rawAvailability.map(({ sellableUnitId }) => sellableUnitId))).toEqual(
      new Set(fixtures.map(({ sellable_unit_id }) => sellable_unit_id)),
    );
    expect(clear.options).toHaveLength(6);
    expect(clear.summary).toMatchObject({ inventoryOptions: 6, candidatePairs: 6, evaluatedPairs: 6, bookable: 6 });
    expect(new Set(clear.options.map(({ sellableUnit }) => sellableUnit.id))).toEqual(
      new Set(fixtures.map(({ sellable_unit_id }) => sellable_unit_id)),
    );
    expect(directQuotes).toHaveLength(6);
    const quotesBySellable = new Map(directQuotes.map((quote) => [quote.sellableUnitId, quote]));
    for (const offer of clear.options) {
      const id = offer.sellableUnit.id;
      const quote = quotesBySellable.get(id);
      expect(quote).toBeDefined();
      if (!quote) throw new Error(`direct exact quote is missing for physical sellable ${id}`);
      expect(quote.availabilityOption.sellableUnitId).toBe(id);
      expect(offer.evidence.quoteHash).toBe(quote.quoteHash);
      expect(offer.evidence.availabilityRef).toBe(quote.result.availabilityEvidence.evidenceRef);
      expect(offer.release).toEqual({
        id: quote.releaseId,
        version: quote.releaseVersion,
        contentHash: quote.releaseContentHash,
      });
      const expectedState = quote.result.state === "quoted" ? "bookable" : quote.result.state;
      expect(offer.state).toBe(expectedState);
      if (expectedState === "bookable") {
        const preTaxAmount = quote.result.preTaxSubtotalMinor;
        if (typeof preTaxAmount !== "bigint") throw new Error(`bookable quote for ${id} omitted pre-tax money`);
        const nightly = quote.result.rateEvaluations.map(({ nightDate, evaluationResult }) => {
          if (typeof evaluationResult.amountMinor !== "bigint") throw new Error(`bookable quote for ${id} omitted nightly money`);
          return { date: nightDate, amountMinor: evaluationResult.amountMinor };
        });
        expect(offer.total).toEqual({
          amountMinor: preTaxAmount,
          currency: quote.result.currency,
          kind: "pre_tax",
        });
        expect(offer.perNight).toEqual(nightly);
      } else {
        expect(offer.total).toBeNull();
        expect(offer.perNight).toEqual([]);
      }
    }
    expect(await publicFingerprint()).toEqual(beforeClear);

    const deluxe = fixtures.filter(({ unit_type_code }) => unit_type_code === "DLX");
    const first = deluxe.find(({ space_code }) => space_code === "201");
    const later = deluxe.find(({ space_code }) => space_code === "202");
    if (!first || !later) throw new Error("canonical DLX first/later physical sibling fixtures are unavailable");
    for (const [occupied, expectedBlocked, expectedBookable] of [
      [first, first, later],
      [later, later, first],
    ] as const) {
      const slot = crypto.randomUUID();
      let occupancyRecorded = false;
      await admin`
        INSERT INTO ooo_oos (id, tenant_id, space_id, kind, period, reason)
        VALUES (
          ${slot}::uuid, ${SEED_TENANT.id}::uuid, ${occupied.space_id}::uuid, 'ooo',
          tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
          'PMS physical-offer sibling blocker proof'
        )
      `;
      try {
        await db.withTenantTransaction(SEED_TENANT.id, (tx) => tx`
          SELECT public.record_occupancy(
            ${SEED_TENANT.id}::uuid, ${occupied.space_id}::uuid,
            tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
            ${slot}::uuid, 'ooo', true
          )
        `);
        occupancyRecorded = true;
        const beforeRead = await publicFingerprint();
        const result = await search();
        const blocked = result.options.find(({ sellableUnit }) => sellableUnit.id === expectedBlocked.sellable_unit_id);
        const availableSibling = result.options.find(({ sellableUnit }) => sellableUnit.id === expectedBookable.sellable_unit_id);
        expect(blocked).toMatchObject({ state: "blocked", bookable: false, total: null, perNight: [] });
        expect(availableSibling).toMatchObject({ state: "bookable", bookable: true });
        expect(result.options).toHaveLength(6);
        expect(await publicFingerprint()).toEqual(beforeRead);
      } finally {
        if (occupancyRecorded) {
          try {
          await db.withTenantTransaction(SEED_TENANT.id, (tx) =>
            tx`SELECT public.release_occupancy(${SEED_TENANT.id}::uuid, ${slot}::uuid)`
          );
          } catch (error) {
            throw new Error("failed to release the physical-offer occupancy; retained its typed OOO parent", { cause: error });
          }
        }
        await admin`DELETE FROM ooo_oos WHERE id = ${slot}::uuid`;
      }
    }

    let quoteCalls = 0;
    const countedQuote = {
      async resolve(tx: Tx, value: ResolveRateQuoteInput) {
        quoteCalls += 1;
        return quoteService.resolve(tx, value);
      },
    };
    const bounded = new ReservationOfferSearchService(
      rates, countedQuote as never, new AvailabilityService(), { maxCandidatePairs: 5 },
    );
    const beforeDenied = await publicFingerprint();
    await expect(search(bounded)).rejects.toBeInstanceOf(ReservationOfferSearchTooBroadError);
    expect(quoteCalls).toBe(0);
    expect(await publicFingerprint()).toEqual(beforeDenied);
  });
});
