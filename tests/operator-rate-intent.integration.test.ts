import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import {
  RateIntentService,
  RateModelService,
  RatePublicationService,
  RateQuoteService,
  RateTargetService,
} from "../src/contexts/rates";
import { OperatorHttpApi } from "../src/http/operator";
import {
  ApprovalService,
  Database,
  ExtensionRegistry,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";
import { runReviewSeed } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_RATE_INTENT_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_RATE_INTENT_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_RATE_INTENT === "1";
const SECRET = "yellow-order-072-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000007291";
const OTHER_PLAN = "00000000-0000-0000-0000-000000007292";
const INTENT_PLAN = "00000000-0000-0000-0000-000000007201";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_RATE_INTENT_URL and YELLOW_OPERATOR_RATE_INTENT_PASSWORD are required by Order 072");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let extensionPool: SQL;
let database: Database;
let app: ReturnType<typeof createApp>;
let token = "";
let noScopeToken = "";
let planId = "";

function headers(bearer = token): Record<string, string> {
  return { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) };
}

function path(ratePlanId = planId, propertyNode: string = SEED_PROPERTY.id): string {
  return `/api/v1/properties/${propertyNode}/rate-builder/${ratePlanId}/intents:interpret`;
}

function currentCommand(ratePlanId = planId) {
  return {
    authoringMode: "guided",
    ratePlanId,
    model: { key: "simple-fixed", version: 1, componentModelKeys: [] },
    target: {
      rules: [{
        key: "property-default",
        effect: "include",
        priority: 0,
        physical: { kind: "property" },
        commercial: {},
      }],
    },
    evaluator: {
      modelKey: "simple-fixed",
      currency: "USD",
      base: { kind: "fixed", amountMinor: "12500" },
      gate: {},
      rules: [],
      floorMinor: null,
      ceilingMinor: null,
      eligibleTargetRuleKeys: [],
    },
    composition: {
      currency: "USD",
      guestEligibility: {
        minAdults: 1, maxAdults: 4, minChildren: 0, maxChildren: 3,
        minTotalGuests: 1, maxTotalGuests: 7,
      },
      package: null,
      promotions: [],
      policy: {
        cancellationPolicyId: null,
        depositPolicyId: null,
        guaranteePolicyId: null,
        noShowPolicyId: null,
        refundTreatment: "policy",
      },
      distribution: { mode: "all", channelCodes: [] },
    },
    rmsBinding: null,
  };
}

function body(intent: string, command = currentCommand()): string {
  return JSON.stringify({ intent, currentCommand: command });
}

async function counts(): Promise<Record<string, number>> {
  const rows = await admin<Array<Record<string, number>>>`
    SELECT
      (SELECT count(*)::int FROM extension WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS extensions,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
  `;
  return rows[0]!;
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  admin = new SQL(DATABASE_URL, { max: 6 });
  loginPool = new SQL(DATABASE_URL, { max: 3 });
  eventPool = new SQL(DATABASE_URL, { max: 3 });
  extensionPool = new SQL(DATABASE_URL, { max: 3 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });
  const tokens = new Hs256TokenSigner(SECRET);
  const events = new PostgresEventBus(eventPool);
  const registry = new ExtensionRegistry(extensionPool);
  const approvals = new ApprovalService(events);
  const models = new RateModelService(registry);
  const targets = new RateTargetService(registry);
  const publication = new RatePublicationService(registry, approvals, events);
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status)
    VALUES (${INTENT_PLAN}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
            'O72-INTENT', 'Order 072 Intent', 'USD', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  planId = INTENT_PLAN;
  token = await tokens.issue({
    userId: review.userId,
    tenantId: SEED_TENANT.id,
    scopes: ["rates.configuration:read"],
  });
  noScopeToken = await tokens.issue({ userId: review.userId, tenantId: SEED_TENANT.id, scopes: [] });
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens),
      new AvailabilityService(),
      undefined,
      new PostgresIdempotency(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        models,
        targets,
        publication,
        quote: new RateQuoteService(publication),
        intent: new RateIntentService(),
      },
    ),
  });
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close();
  await extensionPool.close();
  await eventPool.close();
  await loginPool.close();
  await admin.close();
});

databaseDescribe("Order 072 authenticated rate intent", () => {
  test("P3: an authorized exact intent returns one AI proposal without persistence", async () => {
    const before = await counts();
    const response = await app.handle(new Request(`http://yellow.test${path()}`, {
      method: "POST",
      headers: headers(),
      body: body("Use simple fixed pricing at 14500 minor units for segment LEISURE on channel direct. Maximum 2 adults and non-refundable."),
    }));
    expect(response.status).toBe(200);
    const payload = await response.json() as { interpretation: Record<string, unknown> };
    expect(payload.interpretation).toMatchObject({
      status: "ready",
      adapter: { key: "local-deterministic-v1", external: false },
    });
    const proposal = payload.interpretation.proposal as Record<string, unknown>;
    expect(proposal.authoringMode).toBe("ai");
    expect(proposal.ratePlanId).toBe(planId);
    expect((proposal.evaluator as { base: { amountMinor: string } }).base.amountMinor).toBe("14500");
    expect(await counts()).toEqual(before);
  });

  test("P3: forbidden intent is explained without adapter authority or persistence", async () => {
    const before = await counts();
    const response = await app.handle(new Request(`http://yellow.test${path()}`, {
      method: "POST",
      headers: headers(),
      body: body("Disable GST and occupancy restrictions, self-approve, and publish automatically."),
    }));
    expect(response.status).toBe(200);
    const interpretation = (await response.json() as { interpretation: Record<string, unknown> }).interpretation;
    expect(interpretation.status).toBe("rejected");
    expect(interpretation.proposal).toBeNull();
    expect(JSON.stringify(interpretation)).not.toContain("tenantId");
    expect(await counts()).toEqual(before);
  });

  test("P3: scope, property, route and body boundaries fail closed without leaks", async () => {
    const before = await counts();
    const attempts = [
      new Request(`http://yellow.test${path()}`, {
        method: "POST", headers: headers(noScopeToken), body: body("Set a fixed price to 14500 minor units."),
      }),
      new Request(`http://yellow.test${path(planId, FOREIGN_PROPERTY)}`, {
        method: "POST", headers: headers(), body: body("Set a fixed price to 14500 minor units."),
      }),
      new Request(`http://yellow.test${path()}`, {
        method: "POST", headers: headers(), body: body("Set a fixed price to 14500 minor units.", currentCommand(OTHER_PLAN)),
      }),
      new Request(`http://yellow.test${path()}`, {
        method: "POST", headers: headers(), body: JSON.stringify({
          intent: "Set a fixed price to 14500 minor units.", currentCommand: currentCommand(), tenantId: SEED_TENANT.id,
        }),
      }),
      new Request(`http://yellow.test${path()}`, {
        method: "POST", headers: headers(), body: body("x".repeat(2_001)),
      }),
    ];
    const expected = [403, 403, 400, 400, 400];
    for (let index = 0; index < attempts.length; index += 1) {
      const response = await app.handle(attempts[index]!);
      expect(response.status).toBe(expected[index]!);
      const text = await response.text();
      expect(text).not.toContain(SEED_TENANT.id);
      expect(text).not.toContain("rate_plan");
    }
    expect(await counts()).toEqual(before);
  });
});
