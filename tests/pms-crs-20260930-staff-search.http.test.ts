import { describe, expect, test } from "bun:test";

import { RateEvaluationError } from "../src/contexts/rates";
import {
  ReservationOfferValidationError,
  type ReservationOfferSearchInput,
  type ReservationOfferSearchResult,
} from "../src/contexts/reservations";
import { createApp } from "../src/app";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, type TenantIdentity, type TenantResolver, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-4000-8000-000000000001";
const ACTOR = "00000000-0000-4000-8000-000000000002";
const PROPERTY_A = "00000000-0000-4000-8000-00000000000a";
const PROPERTY_B = "00000000-0000-4000-8000-00000000000b";
const PROPERTY_C = "00000000-0000-4000-8000-00000000000c";
const PROPERTY_D = "00000000-0000-4000-8000-00000000000d";
const PROPERTY_E = "00000000-0000-4000-8000-00000000000e";
const FOREIGN_PROPERTY = "00000000-0000-4000-8000-0000000000ff";
const ROUTE = "/api/v1/crs/availability:search";
const AUTHORIZATION = "Bearer controlled-http-test";
const SCOPE = "inventory.availability:read";

interface GrantRow {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string;
}

interface OfferOperations {
  search(tx: Tx, input: ReservationOfferSearchInput): Promise<ReservationOfferSearchResult>;
}

interface FixtureOptions {
  readonly scopes?: readonly string[];
  readonly grants?: readonly GrantRow[];
  readonly offers?: OfferOperations | null;
}

const DEFAULT_GRANTS: readonly GrantRow[] = Object.freeze([
  { id: PROPERTY_A, name: "Hotel A", timezone: "Asia/Dubai", currency: "AED" },
  { id: PROPERTY_B, name: "Hotel B", timezone: "Europe/London", currency: "GBP" },
  { id: PROPERTY_C, name: "Hotel C", timezone: "America/New_York", currency: "USD" },
  { id: PROPERTY_D, name: "Hotel D", timezone: "Pacific/Auckland", currency: "NZD" },
  { id: PROPERTY_E, name: "Hotel E", timezone: "UTC", currency: "EUR" },
]);

function canonicalSearch(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    stay: { from: "2026-10-10T15:00:00+04:00", to: "2026-10-12T11:00:00+04:00" },
    party: { adults: 2, children: [{ age: 7 }, { age: 12 }] },
    channel: "direct",
    unit_types: ["DLX"],
    rate_plans: ["FLEX"],
    attributes: { gender_policy: "any" },
    currency: "USD",
    selected_promotion_codes: ["AUTUMN"],
    commercial: { market_code: "LEISURE", source_code: "WEB", campaign_code: "FALL" },
    ...overrides,
  };
}

function entry(propertyId: string, search: unknown = canonicalSearch()): Record<string, unknown> {
  return { property_id: propertyId, search };
}

function body(entries: readonly unknown[], extras: Record<string, unknown> = {}): string {
  return JSON.stringify({ searches: entries, ...extras });
}

function emptyOffers(): ReservationOfferSearchResult {
  return {
    options: [],
    issues: [],
    summary: {
      inventoryOptions: 0,
      candidatePairs: 0,
      evaluatedPairs: 0,
      bookable: 0,
      blocked: 0,
      unpriced: 0,
      conflicted: 0,
      publicationUnavailable: 0,
      pricingEvidenceUnavailable: 0,
      workLimit: 1_000,
    },
  };
}

class FakeDatabase extends Database {
  readonly grantsQueried: string[] = [];
  transactionCount = 0;
  readonly tx: Tx;
  grants: readonly GrantRow[];

  constructor(grants: readonly GrantRow[] = DEFAULT_GRANTS) {
    super({ reserve: async () => { throw new Error("Unexpected real pool access in HTTP contract test"); } });
    this.grants = grants;
    const fake = async (...args: unknown[]): Promise<readonly GrantRow[]> => {
      const [template] = args as [TemplateStringsArray, ...unknown[]];
      const statement = template.join(" ");
      if (!statement.includes("FROM user_role")) {
        throw new Error("Unexpected SQL in HTTP contract fixture");
      }
      this.grantsQueried.push(statement);
      return this.grants;
    };
    this.tx = fake as unknown as Tx;
  }

  override withTenantTransaction<T>(_tenantId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return operation(this.tx);
  }
}

class ControlledResolver implements TenantResolver {
  constructor(private readonly scopes: readonly string[] = [SCOPE]) {}

  async resolve(request: Request): Promise<TenantIdentity | null> {
    if (request.headers.get("authorization") !== AUTHORIZATION) return null;
    return { tenantId: TENANT, actorId: ACTOR, scopes: this.scopes };
  }
}

function makeOperator(offers?: OfferOperations | null): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as LocalLoginService,
    undefined, // availability
    undefined, // inventory
    undefined, // idempotency
    undefined, // restrictions
    undefined, // rates
    undefined, // pricing
    undefined, // blocks
    undefined, // policy
    undefined, // holds
    undefined, // projection
    undefined, // runtime status
    undefined, // rate builder
    undefined, // reservations
    offers === null ? undefined : offers as never, // reservation offers
  );
}

function harness(options: FixtureOptions = {}) {
  const database = new FakeDatabase(options.grants);
  const inputs: ReservationOfferSearchInput[] = [];
  const defaultOffers: OfferOperations = {
    async search(_tx, input) {
      inputs.push(input);
      return emptyOffers();
    },
  };
  const app = createApp({
    database,
    tenantResolver: new ControlledResolver(options.scopes),
    operatorApi: makeOperator(options.offers === undefined ? defaultOffers : options.offers),
  });
  return { app, database, inputs };
}

function post(bodyText: string, options: {
  readonly authorize?: boolean;
  readonly contentType?: string;
} = {}): Request {
  const headers = new Headers();
  if (options.authorize !== false) headers.set("authorization", AUTHORIZATION);
  headers.set("content-type", options.contentType ?? "application/json");
  return new Request(`http://yellow.test${ROUTE}`, { method: "POST", headers, body: bodyText });
}

function postBytes(bytes: Uint8Array, options: {
  readonly authorize?: boolean;
  readonly contentType?: string;
  readonly contentLength?: string;
  readonly close?: boolean;
  readonly onCancel?: () => void;
} = {}): Request {
  const headers = new Headers();
  if (options.authorize !== false) headers.set("authorization", AUTHORIZATION);
  headers.set("content-type", options.contentType ?? "application/json");
  if (options.contentLength !== undefined) headers.set("content-length", options.contentLength);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      if (options.close !== false) controller.close();
    },
    cancel() { options.onCancel?.(); },
  });
  return new Request(`http://yellow.test${ROUTE}`, {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit);
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe("mounted staff CRS offer search HTTP contract", () => {
  test("requires bearer tenant identity and preserves success cache/security headers", async () => {
    const { app, database, inputs } = harness();
    const unauthenticated = await app.handle(post(body([entry(PROPERTY_A)]), { authorize: false }));
    expect(unauthenticated.status).toBe(401);
    expect(database.transactionCount).toBe(0);
    expect(inputs).toHaveLength(0);

    const response = await app.handle(post(body([entry(PROPERTY_A)])));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  test("searches selected grants serially and forwards the existing canonical offer input unchanged", async () => {
    const calls: Array<{ tx: Tx; input: ReservationOfferSearchInput }> = [];
    const result = await emptyOffers();
    const { app, database } = harness({
      offers: { async search(tx, input) { calls.push({ tx, input }); return result; } },
    });
    const response = await app.handle(post(body([
      entry(PROPERTY_B), entry(PROPERTY_A),
    ])));
    expect(response.status).toBe(200);
    const json = await payload(response);
    expect(json).toEqual({ properties: [
      { property_id: PROPERTY_B, property_name: "Hotel B", time_zone: "Europe/London", result: {
        options: [], issues: [], summary: {
          inventory_options: 0, candidate_pairs: 0, evaluated_pairs: 0, bookable: 0, blocked: 0,
          unpriced: 0, conflicted: 0, publication_unavailable: 0,
          pricing_evidence_unavailable: 0, work_limit: 1_000,
        },
      } },
      { property_id: PROPERTY_A, property_name: "Hotel A", time_zone: "Asia/Dubai", result: {
        options: [], issues: [], summary: {
          inventory_options: 0, candidate_pairs: 0, evaluated_pairs: 0, bookable: 0, blocked: 0,
          unpriced: 0, conflicted: 0, publication_unavailable: 0,
          pricing_evidence_unavailable: 0, work_limit: 1_000,
        },
      } },
    ] });
    expect(calls).toHaveLength(2);
    expect(calls.map(({ input }) => input.propertyNode)).toEqual([PROPERTY_B, PROPERTY_A]);
    expect(calls.every(({ tx }) => tx === database.tx)).toBe(true);
    expect(calls[0]?.input).toMatchObject({
      stayStart: new Date("2026-10-10T11:00:00.000Z"),
      stayEnd: new Date("2026-10-12T07:00:00.000Z"),
      guests: { adults: 2, childAges: [7, 12] },
      unitTypeCodes: ["DLX"],
      ratePlanCodes: ["FLEX"],
      attributes: { genderPolicy: "any" },
      channelCode: "direct",
      currency: "USD",
      selectedPromotionCodes: ["AUTUMN"],
      commercial: { marketCode: "LEISURE", sourceCode: "WEB", campaignCode: "FALL" },
    });
    expect(database.grantsQueried).toHaveLength(1);
  });

  test("missing availability scope returns 403 before body parsing, grants, or offer calls", async () => {
    const { app, database, inputs } = harness({ scopes: [] });
    const response = await app.handle(post("not JSON"));
    expect(response.status).toBe(403);
    expect((await payload(response)).type).toBe("auth/scope_missing");
    expect(database.grantsQueried).toHaveLength(0);
    expect(inputs).toHaveLength(0);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("rejects exact-envelope, canonical nested-key, legacy, impossible, and unzoned date inputs before search", async () => {
    const invalidBodies = [
      body([entry(PROPERTY_A)], { extra: true }),
      body([{ ...entry(PROPERTY_A), extra: true }]),
      body([entry(PROPERTY_A, canonicalSearch({ extra: true }))]),
      body([entry(PROPERTY_A, { from: "2026-10-10T15:00:00+04:00", to: "2026-10-12T11:00:00+04:00", partySize: 2 })]),
      body([entry(PROPERTY_A, canonicalSearch({ stay: { from: "2026-02-30T10:00:00Z", to: "2026-03-02T10:00:00Z" } }))]),
      body([entry(PROPERTY_A, canonicalSearch({ stay: { from: "2026-10-10T15:00:00", to: "2026-10-12T11:00:00Z" } }))]),
    ];
    for (const text of invalidBodies) {
      const { app, database, inputs } = harness();
      const response = await app.handle(post(text));
      expect(response.status).toBe(400);
      expect(inputs).toHaveLength(0);
      expect(database.grantsQueried).toHaveLength(0);
    }
  });

  test("rejects duplicate properties and more than four properties before grants/search", async () => {
    const invalidBodies = [
      body([entry(PROPERTY_A), entry(PROPERTY_A)]),
      body([entry(PROPERTY_A), entry(PROPERTY_B), entry(PROPERTY_C), entry(PROPERTY_D), entry(PROPERTY_E)]),
    ];
    for (const text of invalidBodies) {
      const { app, database, inputs } = harness();
      const response = await app.handle(post(text));
      expect(response.status).toBe(400);
      expect(database.grantsQueried).toHaveLength(0);
      expect(inputs).toHaveLength(0);
    }
  });

  test("unknown and foreign grants fail the full request with zero offer calls", async () => {
    const errors: Array<{ type: unknown; title: unknown; detail: unknown }> = [];
    for (const searches of [
      [entry(PROPERTY_A), entry(FOREIGN_PROPERTY)],
      [entry(FOREIGN_PROPERTY)],
      [entry(PROPERTY_E)],
    ]) {
      const calls: ReservationOfferSearchInput[] = [];
      const { app, database } = harness({
        grants: DEFAULT_GRANTS.filter(({ id }) => id === PROPERTY_A),
        offers: { async search(_tx, input) { calls.push(input); return emptyOffers(); } },
      });
      const response = await app.handle(post(body(searches)));
      expect(response.status).toBe(403);
      const json = await payload(response);
      errors.push({ type: json.type, title: json.title, detail: json.detail });
      expect(calls).toHaveLength(0);
      expect(database.grantsQueried).toHaveLength(1);
    }
    expect(errors[0]).toEqual(errors[1]);
    expect(errors[1]).toEqual(errors[2]);
  });

  test("reports missing offer capability as 503 only after property authorization", async () => {
    const { app, database, inputs } = harness({ offers: null });
    const response = await app.handle(post(body([entry(PROPERTY_A)])));
    expect(response.status).toBe(503);
    expect((await payload(response)).type).toBe("service/unavailable");
    expect(database.grantsQueried).toHaveLength(1);
    expect(inputs).toHaveLength(0);
  });

  test("maps offer input and property-local booking-window errors to 400", async () => {
    for (const error of [
      new ReservationOfferValidationError("invalid offer input"),
      new RateEvaluationError("booking window must be 0 to 730 property-local days"),
    ]) {
      const { app, database, inputs } = harness({
        offers: { async search() { throw error; } },
      });
      const response = await app.handle(post(body([entry(PROPERTY_A)])));
      expect(response.status).toBe(400);
      const json = await payload(response);
      expect(json.type).toBe(error instanceof RateEvaluationError ? "request/booking_window" : "request/invalid");
      expect(database.grantsQueried).toHaveLength(1);
      expect(inputs).toHaveLength(0);
    }
  });

  test("maps unexpected later-property failures to a generic 503 without partial results or private errors", async () => {
    let count = 0;
    const { app, database } = harness({
      offers: { async search() {
        count += 1;
        if (count === 2) throw new Error("internal db host and tenant data must not escape");
        return emptyOffers();
      } },
    });
    const response = await app.handle(post(body([entry(PROPERTY_A), entry(PROPERTY_B)])));
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("internal db host");
    expect(text).not.toContain("tenant data");
    expect(text).not.toContain("Hotel A");
    expect(count).toBe(2);
    expect(database.grantsQueried).toHaveLength(1);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("rejects raw oversized, invalid UTF-8, invalid JSON, and wrong-content-type bodies at the route", async () => {
    const invalidRequests = [
      postBytes(new Uint8Array(64 * 1024 + 1).fill(0x20), { contentLength: "1" }),
      postBytes(new Uint8Array([0xff, 0xfe])),
      post("{not json"),
      post(body([entry(PROPERTY_A)]), { contentType: "text/plain" }),
    ];
    for (const request of invalidRequests) {
      const { app, database, inputs } = harness();
      const response = await app.handle(request);
      expect(response.status).toBe(400);
      expect(database.grantsQueried).toHaveLength(0);
      expect(inputs).toHaveLength(0);
    }
  });
});
