import { describe, expect, test } from "bun:test";
import {
  IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError,
  IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError,
  IndiaGstAccommodationFinalComponentTaxSemanticRouteService,
} from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const H = (character: string): string => character.repeat(64);

const TENANT = id(406001);
const PROPERTY = id(406002);
const RESERVATION = id(406003);
const FOLIO = id(406004);

type Row = Readonly<Record<string, unknown>>;

function exactInput() {
  return Object.freeze({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
  });
}

function root(overrides: Row = {}): Row {
  return {
    tax_id: id(406010), generation: 0, valuation_id: id(406011),
    valuation_generation: 0, applicability_id: id(406012), currency: "INR",
    transaction_value_minor: "100001", tax_minor: "18000",
    grand_total_minor: "118001", component_family: "igst",
    selected_extension_id: id(406013), selected_extension_version: 2,
    selected_extension_owner_tenant_id: null, selected_extension_key: "in-gst-lodging",
    selected_extension_content_hash: H("a"), evidence_hash: H("b"),
    final_valuation_evidence_hash: H("c"),
    quoted_rate_applicability_evidence_hash: H("d"),
    ...overrides,
  };
}

function component(identity: "igst" | "cgst" | "sgst" | "utgst",
  amount: string, ordinal = 0, summary: Row = {}): Row {
  return {
    component_identity: identity, tax_amount_minor: amount,
    first_ordinal: ordinal, component_count: 1,
    night_count: 1, first_night_ordinal: 0, last_night_ordinal: 0,
    night_value_total: "100001", night_tax_total: "18000",
    ...summary,
  };
}

function route(kind: "revenue" | "tax", code: string, ordinal: number): Row {
  const role = kind === "revenue" ? "revenue" : "tax_payable";
  return {
    mapping_id: id(406100 + ordinal), semantic_kind: kind, semantic_code: code,
    tx_code: `O406_${code.toUpperCase()}`, route_credit_account_id: id(406200 + ordinal),
    tx_code_value: `O406_${code.toUpperCase()}`,
    tx_code_group: kind === "revenue" ? "revenue" : "tax",
    usali_line: kind === "revenue" ? "Rooms" : null,
    account_id: id(406200 + ordinal), account_property_node: PROPERTY,
    account_role: role, account_currency: "INR", account_status: "open",
  };
}

function scriptedTx(options: {
  roots?: readonly Row[];
  components?: readonly Row[];
  routes?: readonly Row[];
}) {
  const writes: string[] = [];
  const tx = (async (strings: TemplateStringsArray) => {
    const sql = strings.join(" ").replace(/\s+/g, " ").toLowerCase();
    if (/\b(insert|update|delete|merge|call)\b/.test(sql)) writes.push(sql);
    if (sql.includes("tax_semantic_route")) return options.routes ?? [];
    if (sql.includes("final_component_tax_component")) return options.components ?? [];
    if (sql.includes("final_component_tax")) return options.roots ?? [];
    throw new Error(`unexpected Order406 query: ${sql}`);
  }) as Tx;
  return { tx, writes };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

describe("Order 406 persisted India component-tax semantic route", () => {
  test("rejects malformed or mutable selectors before querying", async () => {
    const service = new IndiaGstAccommodationFinalComponentTaxSemanticRouteService();
    const candidates = [
      { ...exactInput(), taxMinor: "1" },
      { ...exactInput(), tenantId: "not-a-uuid" },
      { ...exactInput(), folioId: undefined },
      exactInput(),
    ];
    for (const [index, candidate] of candidates.entries()) {
      let queried = false;
      const tx = (async () => { queried = true; return []; }) as unknown as Tx;
      if (index === candidates.length - 1) {
        const mutable = { ...candidate };
        await expect(service.resolve(tx, mutable as never)).rejects.toBeInstanceOf(Error);
      } else {
        await expect(service.resolve(tx, Object.freeze(candidate) as never))
          .rejects.toBeInstanceOf(Error);
      }
      expect(queried).toBeFalse();
    }
  });

  test("resolves room revenue and persisted IGST without recalculation", async () => {
    const fixture = scriptedTx({
      roots: [root()], components: [component("igst", "18000")],
      routes: [route("revenue", "room_revenue", 1), route("tax", "IGST", 2)],
    });
    const result = await new IndiaGstAccommodationFinalComponentTaxSemanticRouteService()
      .resolve(fixture.tx, exactInput());
    expect(JSON.stringify(result)).toContain('"transactionValueMinor":"100001"');
    expect(JSON.stringify(result)).toContain('"taxMinor":"18000"');
    expect(JSON.stringify(result)).toContain('"componentIdentity":"igst"');
    expect(JSON.stringify(result)).toContain('"semanticCode":"room_revenue"');
    expect(fixture.writes).toEqual([]);
    expectDeepFrozen(result);
  });

  test("retains zero-rounded statutory lineage without requiring its payable route", async () => {
    const fixture = scriptedTx({
      roots: [root({ component_family: "cgst_sgst", tax_minor: "1", grand_total_minor: "100002" })],
      components: [
        component("cgst", "1", 0, { night_tax_total: "1" }),
        component("sgst", "0", 1, { night_tax_total: "1" }),
      ],
      routes: [route("revenue", "room_revenue", 1), route("tax", "CGST", 2)],
    });
    const result = await new IndiaGstAccommodationFinalComponentTaxSemanticRouteService()
      .resolve(fixture.tx, exactInput());
    const json = JSON.stringify(result);
    expect(json).toContain('"componentIdentity":"cgst"');
    expect(json).toContain('"componentIdentity":"sgst"');
    expect(json).toContain('"amountMinor":"0"');
    expect(json).not.toContain("O406_SGST");
    expect(fixture.writes).toEqual([]);
  });

  test("aggregates multi-night CGST+UTGST persisted amounts and replays byte-equally", async () => {
    const options = {
      roots: [root({ component_family: "cgst_utgst", tax_minor: "24000", grand_total_minor: "124001" })],
      components: [
        component("cgst", "12000", 0, {
          component_count: 2, night_count: 2, last_night_ordinal: 1,
          night_value_total: "100001", night_tax_total: "24000",
        }),
        component("utgst", "12000", 1, {
          component_count: 2, night_count: 2, last_night_ordinal: 1,
          night_value_total: "100001", night_tax_total: "24000",
        }),
      ],
      routes: [
        route("revenue", "room_revenue", 1), route("tax", "CGST", 2),
        route("tax", "UTGST", 3),
      ],
    };
    const firstFixture = scriptedTx(options);
    const secondFixture = scriptedTx(options);
    const service = new IndiaGstAccommodationFinalComponentTaxSemanticRouteService();
    const first = await service.resolve(firstFixture.tx, exactInput());
    const second = await service.resolve(secondFixture.tx, exactInput());
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second).not.toBe(first);
    expect(firstFixture.writes).toEqual([]);
    expect(secondFixture.writes).toEqual([]);
  });

  test("preserves persisted 5/12/18-percent and signed-bigint-boundary amounts", async () => {
    const amounts = ["5000", "12000", "18000"] as const;
    for (const amount of amounts) {
      const fixture = scriptedTx({
        roots: [root({ tax_minor: amount,
          grand_total_minor: (100001n + BigInt(amount)).toString() })],
        components: [component("igst", amount, 0, { night_tax_total: amount })],
        routes: [route("revenue", "room_revenue", 1), route("tax", "IGST", 2)],
      });
      const result = await new IndiaGstAccommodationFinalComponentTaxSemanticRouteService()
        .resolve(fixture.tx, exactInput());
      expect(result.taxMinor).toBe(amount);
      expect(result.components[0]?.amountMinor).toBe(amount);
    }

    const maximum = "9223372036854775807";
    const boundary = scriptedTx({
      roots: [root({ transaction_value_minor: "9223372036854775806",
        tax_minor: "1", grand_total_minor: maximum })],
      components: [component("igst", "1", 0, {
        night_value_total: "9223372036854775806", night_tax_total: "1",
      })],
      routes: [route("revenue", "room_revenue", 1), route("tax", "IGST", 2)],
    });
    const result = await new IndiaGstAccommodationFinalComponentTaxSemanticRouteService()
      .resolve(boundary.tx, exactInput());
    expect(result.grandTotalMinor).toBe(maximum);
    expect(boundary.writes).toEqual([]);
  });

  test("fails closed on missing, duplicate, stale and incoherent persisted evidence", async () => {
    const service = new IndiaGstAccommodationFinalComponentTaxSemanticRouteService();
    const cases: readonly [
      ReturnType<typeof scriptedTx>,
      new (message: string) => Error,
    ][] = [
      [scriptedTx({ roots: [] }), IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError],
      [scriptedTx({ roots: [root(), root({ tax_id: id(406099) })] }),
        IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError],
      [scriptedTx({ roots: [root({ currency: "USD" })] }),
        IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError],
      [scriptedTx({ roots: [root()], components: [component("igst", "17999")], routes: [] }),
        IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError],
      [scriptedTx({ roots: [root()], components: [component("igst", "18000")], routes: [] }),
        IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError],
    ];
    for (const [fixture, error] of cases) {
      await expect(service.resolve(fixture.tx, exactInput())).rejects.toBeInstanceOf(error);
      expect(fixture.writes).toEqual([]);
    }
  });

  test("production source is read-only and binds exact persisted/configured authorities", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-semantic-route.ts",
      import.meta.url,
    )).text();
    expect(source).toContain("india_gst_accommodation_final_component_tax");
    expect(source).toContain("india_gst_accommodation_final_component_tax_component");
    expect(source).toContain("tax_semantic_route");
    expect(source).toContain("tx_code_route");
    expect(source).toContain("account");
    expect(source).toMatch(/current_setting\('app\.tenant_id',\s*true\)/);
    expect(source).toMatch(/supersedes_(?:tax|valuation)_id/);
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i);
    expect(source).not.toMatch(/new\s+Date|Date\.now|Math\.(?:round|floor|ceil)/);
  });
});
