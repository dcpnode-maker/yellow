import { describe, expect, test } from "bun:test";

import { TaxJurisdictionResolutionService } from "../src/contexts/tax-fiscal";

type AnyRecord = Record<PropertyKey, any>;
type Period = {
  extensionId: string;
  ownerTenantId: string | null;
  effectiveFromInstant: string;
  effectiveToInstant: string | null;
};
type PropertyDay = {
  tenant_id: string;
  property_timezone: string;
  business_day_from_instant: string;
  business_day_to_instant: string;
};
type Assignment = {
  jurisdiction_key: string;
  effective_from: string | null;
  effective_to: string | null;
};
type State = {
  property: PropertyDay | AnyRecord;
  assignments: readonly (Assignment | AnyRecord)[];
  visible: readonly unknown[];
  periods: Record<string, unknown>;
  sql: string[];
};

const id = (n: number): string =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const TENANT_A = id(30601);
const TENANT_B = id(30602);
const PROPERTY_A = id(30611);
const PROPERTY_B = id(30612);
const PREDECESSOR = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const OTHER_EXTENSION = id(30631);
const KEY = "in-gst-lodging";
const CUTOVER = "2025-09-21T18:30:00.000000Z";
const PREDECESSOR_FROM = "2022-07-17T18:30:00.000000Z";
const SOURCE_2019 = "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901";
const SOURCE_2022 = "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716";
const SOURCE_2025 = "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289";

const predecessorContent = (): AnyRecord => ({
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [
    {
      code: "GST_ROOM",
      name: "GST on accommodation",
      mode: "slab_percent",
      slab_basis: "transaction_value",
      applies_to: ["room_revenue"],
      slabs: [
        { upto_minor: 750000, rate: 0.12, itc_eligible: true },
        { upto_minor: null, rate: 0.18, itc_eligible: true },
      ],
    },
    {
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    },
  ],
});

const successorContent = (): AnyRecord => ({
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [
    {
      code: "GST_ROOM",
      name: "GST on accommodation",
      mode: "slab_percent",
      slab_basis: "transaction_value",
      applies_to: ["room_revenue"],
      slabs: [
        { upto_minor: 750000, rate: 0.05, itc_eligible: false },
        { upto_minor: null, rate: 0.18, itc_eligible: true },
      ],
    },
    {
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    },
  ],
});

const extension = (
  extensionId: string,
  version: number,
  status: "active" | "retired",
  content: AnyRecord,
  tenantId: string | null = null,
): AnyRecord => ({
  id: extensionId,
  tenantId,
  type: "tax_jurisdiction",
  key: KEY,
  version,
  content,
  status,
});

const basePredecessor = (): AnyRecord => extension(PREDECESSOR, 1, "retired", predecessorContent());
const baseSuccessor = (): AnyRecord => extension(SUCCESSOR, 2, "active", successorContent());

const period = (
  extensionId: string,
  from: string,
  to: string | null,
  ownerTenantId: string | null = null,
): Period => ({
  extensionId,
  ownerTenantId,
  effectiveFromInstant: from,
  effectiveToInstant: to,
});

function defaultProperty(date = "2026-01-01"): PropertyDay {
  return {
    tenant_id: TENANT_A,
    property_timezone: "Asia/Kolkata",
    business_day_from_instant: `${date === "2025-09-21" ? "2025-09-20" : date}T18:30:00.000000Z`,
    business_day_to_instant: `${date === "2025-09-21" ? "2025-09-21" : "2026-01-02"}T18:30:00.000000Z`,
  };
}

function baseState(property: PropertyDay | AnyRecord = defaultProperty()): State {
  return {
    property,
    assignments: [{ jurisdiction_key: KEY, effective_from: "2020-01-01", effective_to: null }],
    visible: [basePredecessor(), baseSuccessor()],
    periods: {
      [PREDECESSOR]: period(PREDECESSOR, PREDECESSOR_FROM, CUTOVER),
      [SUCCESSOR]: period(SUCCESSOR, CUTOVER, null),
    },
    sql: [],
  };
}

function txFor(state: State) {
  return (async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    state.sql.push(sql);
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error(`unexpected write: ${sql}`);
    if (/FROM\s+(?:public\.)?org_node/i.test(sql)) {
      return /property_timezone|business_day_from_instant/i.test(sql)
        ? [state.property]
        : [{ tenant_id: (state.property as AnyRecord).tenant_id }];
    }
    if (/FROM\s+(?:public\.)?tax_assignment/i.test(sql)) return state.assignments;
    throw new Error(`unexpected SQL: ${sql}`);
  }) as never;
}

function registryFor(state: State) {
  return {
    async listVisible(tenantId: string) {
      expect(tenantId).toBe(TENANT_A);
      return state.visible;
    },
    async readVisibleEffectivePeriod(tenantId: string, extensionId: string) {
      expect(tenantId).toBe(TENANT_A);
      return state.periods[extensionId];
    },
  };
}

async function historical(state = baseState(), value: AnyRecord = {
  propertyNode: PROPERTY_A,
  businessDate: "2026-01-01",
}) {
  const module = await import("../src/contexts/tax-fiscal");
  const Service = module.IndiaGstAccommodationHistoricalResolutionService;
  if (typeof Service !== "function") throw new Error("historical resolution service is not exported");
  return new Service(registryFor(state) as never).resolve(txFor(state), value as never);
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deeplyFrozen((value as AnyRecord)[key], seen);
}

function text(value: unknown): string {
  return JSON.stringify(value);
}

function selected(value: unknown): AnyRecord {
  const result = value as AnyRecord;
  return result.selectedExtension as AnyRecord;
}

describe("Order 306: India GST accommodation historical resolution", () => {
  test("accepts exactly {propertyNode,businessDate} and rejects caller authority or hostile records", async () => {
    const valid = { propertyNode: PROPERTY_A, businessDate: "2026-01-01" };
    const hostile: unknown[] = [
      null,
      [],
      { ...valid, tenantId: TENANT_A },
      { ...valid, propertyTimezone: "UTC" },
      { ...valid, businessDayFromInstant: "2026-01-01T00:00:00.000000Z" },
      { ...valid, predecessorExtensionId: PREDECESSOR },
      { propertyNode: PROPERTY_A },
      { businessDate: "2026-01-01" },
      { ...valid, extra: true },
      { ...valid, [Symbol("hostile")]: true },
      new Proxy(valid, {}),
    ];
    for (const value of hostile) await expect(historical(baseState(), value as AnyRecord)).rejects.toThrow();

    const accessor = { ...valid } as AnyRecord;
    Object.defineProperty(accessor, "businessDate", { enumerable: true, get: () => valid.businessDate });
    await expect(historical(baseState(), accessor)).rejects.toThrow();
  });

  test("selects v1 for the whole local day before cutover and v2 from the cutover day", async () => {
    const before = baseState({
      tenant_id: TENANT_A,
      property_timezone: "Asia/Kolkata",
      business_day_from_instant: "2025-09-20T18:30:00.000000Z",
      business_day_to_instant: CUTOVER,
    });
    const beforeResult = await historical(before, { propertyNode: PROPERTY_A, businessDate: "2025-09-21" });
    expect(selected(beforeResult).extensionId).toBe(PREDECESSOR);
    expect(selected(beforeResult).version).toBe(1);
    expect(selected(beforeResult).status).toBe("retired");
    expect(selected(beforeResult).effectiveToInstant).toBe(CUTOVER);

    const atCutover = baseState({
      tenant_id: TENANT_A,
      property_timezone: "Asia/Kolkata",
      business_day_from_instant: CUTOVER,
      business_day_to_instant: "2025-09-22T18:30:00.000000Z",
    });
    const atCutoverResult = await historical(atCutover, { propertyNode: PROPERTY_A, businessDate: "2025-09-22" });
    expect(selected(atCutoverResult).extensionId).toBe(SUCCESSOR);
    expect(selected(atCutoverResult).version).toBe(2);
    expect(selected(atCutoverResult).status).toBe("active");
    expect(selected(atCutoverResult).effectiveFromInstant).toBe(CUTOVER);
  });

  test("binds exact equality and fails closed at one-microsecond edges, gaps, overlaps and cross-cutover days", async () => {
    const baselineBefore = baseState({
      tenant_id: TENANT_A,
      property_timezone: "Asia/Kolkata",
      business_day_from_instant: "2025-09-20T18:30:00.000000Z",
      business_day_to_instant: CUTOVER,
    });
    await expect(historical(baselineBefore, { propertyNode: PROPERTY_A, businessDate: "2025-09-21" })).resolves.toBeTruthy();

    const mutants: Record<string, State> = {};
    for (const [name, predecessorTo, successorFrom] of [
      ["gap", "2025-09-21T18:29:59.999999Z", "2025-09-21T18:30:00.000001Z"],
      ["overlap", "2025-09-21T18:30:00.000001Z", CUTOVER],
    ] as const) {
      const state = baseState({
        tenant_id: TENANT_A,
        property_timezone: "Asia/Kolkata",
        business_day_from_instant: "2025-09-20T18:30:00.000000Z",
        business_day_to_instant: CUTOVER,
      });
      (state.periods[PREDECESSOR] as AnyRecord).effectiveToInstant = predecessorTo;
      (state.periods[SUCCESSOR] as AnyRecord).effectiveFromInstant = successorFrom;
      mutants[name] = state;
    }
    for (const state of Object.values(mutants)) {
      await expect(historical(state, { propertyNode: PROPERTY_A, businessDate: "2025-09-21" })).rejects.toThrow();
    }

    const cross = baseState({
      tenant_id: TENANT_A,
      property_timezone: "UTC",
      business_day_from_instant: "2025-09-21T00:00:00.000000Z",
      business_day_to_instant: "2025-09-22T00:00:00.000000Z",
    });
    await expect(historical(cross, { propertyNode: PROPERTY_A, businessDate: "2025-09-21" })).rejects.toThrow();
  });

  test("requires one active property, one exact lodging assignment and the complete governed pair", async () => {
    const propertyDefects: AnyRecord[] = [
      { tenant_id: TENANT_B, property_timezone: "Asia/Kolkata", business_day_from_instant: "2026-01-01T18:30:00.000000Z", business_day_to_instant: "2026-01-02T18:30:00.000000Z" },
      { tenant_id: TENANT_A, property_timezone: "Asia/Kolkata", business_day_from_instant: "2026-01-02T18:30:00.000000Z", business_day_to_instant: "2026-01-01T18:30:00.000000Z" },
      { tenant_id: TENANT_A, property_timezone: "Asia/Kolkata", business_day_from_instant: "2026-01-01T18:30:00Z", business_day_to_instant: "2026-01-02T18:30:00.000000Z" },
    ];
    for (const property of propertyDefects) {
      await expect(historical(baseState(property))).rejects.toThrow();
    }

    for (const assignments of [
      [],
      [{ jurisdiction_key: KEY, effective_from: "2020-01-01", effective_to: null }, { jurisdiction_key: KEY, effective_from: "2020-01-01", effective_to: null }],
      [{ jurisdiction_key: "in-gst-other", effective_from: "2020-01-01", effective_to: null }],
      [{ jurisdiction_key: KEY, effective_from: "2027-01-01", effective_to: null }],
    ]) {
      const state = baseState();
      state.assignments = assignments;
      await expect(historical(state)).rejects.toThrow();
    }

    const pairDefects: AnyRecord[][] = [
      [extension(PREDECESSOR, 1, "active", predecessorContent()), baseSuccessor()],
      [extension(PREDECESSOR, 2, "retired", predecessorContent()), baseSuccessor()],
      [extension(PREDECESSOR, 1, "retired", predecessorContent(), TENANT_B), baseSuccessor()],
      [extension(OTHER_EXTENSION, 1, "retired", predecessorContent()), baseSuccessor()],
      [basePredecessor(), extension(SUCCESSOR, 3, "active", successorContent())],
      [basePredecessor(), extension(SUCCESSOR, 2, "active", successorContent(), TENANT_B)],
      [basePredecessor(), extension(SUCCESSOR, 2, "active", { ...successorContent(), country: "GB" })],
      [basePredecessor(), extension(SUCCESSOR, 2, "active", { ...successorContent(), rounding: "line" })],
    ];
    for (const visible of pairDefects) {
      const state = baseState();
      state.visible = visible;
      await expect(historical(state)).rejects.toThrow();
    }

    for (const [idToMutate, replacement] of [
      [PREDECESSOR, period(PREDECESSOR, "2022-07-17T18:30:00.000001Z", CUTOVER)],
      [SUCCESSOR, period(SUCCESSOR, "2025-09-22T00:00:00.000000Z", null)],
      [SUCCESSOR, period(OTHER_EXTENSION, CUTOVER, null)],
      [SUCCESSOR, period(SUCCESSOR, CUTOVER, "2050-01-01T00:00:00.000000Z")],
    ] as const) {
      const state = baseState();
      state.periods[idToMutate] = replacement;
      await expect(historical(state)).rejects.toThrow();
    }
  });

  test("rejects hostile registry/content/period values and produces no writes", async () => {
    const state = baseState();
    state.visible = new Proxy(state.visible, {});
    await expect(historical(state)).rejects.toThrow();

    const content = predecessorContent();
    const cyclic = predecessorContent();
    cyclic.self = cyclic;
    for (const hostileContent of [
      new Proxy(content, {}),
      cyclic,
      { ...content, [Symbol("content")]: true },
    ]) {
      const defect = baseState();
      defect.visible = [extension(PREDECESSOR, 1, "retired", hostileContent), baseSuccessor()];
      await expect(historical(defect)).rejects.toThrow();
    }

    const accessorPeriod = period(SUCCESSOR, CUTOVER, null) as AnyRecord;
    Object.defineProperty(accessorPeriod, "effectiveFromInstant", {
      enumerable: true,
      get: () => CUTOVER,
    });
    const periodDefect = baseState();
    periodDefect.periods[SUCCESSOR] = accessorPeriod;
    await expect(historical(periodDefect)).rejects.toThrow();
    expect(state.sql.every((sql) => /^\s*SELECT\b/i.test(sql))).toBeTrue();
  });

  test("handles PostgreSQL-derived 23-hour, 25-hour and awkward-offset envelopes without fixed-day arithmetic", async () => {
    const cases = [
      ["America/New_York", "2026-03-08", "2026-03-08T05:00:00.000000Z", "2026-03-09T04:00:00.000000Z"],
      ["America/New_York", "2026-11-01", "2026-11-01T04:00:00.000000Z", "2026-11-02T05:00:00.000000Z"],
      ["Asia/Kathmandu", "2026-01-01", "2025-12-31T18:15:00.000000Z", "2026-01-01T18:15:00.000000Z"],
    ] as const;
    for (const [timezone, businessDate, from, to] of cases) {
      const state = baseState({
        tenant_id: TENANT_A,
        property_timezone: timezone,
        business_day_from_instant: from,
        business_day_to_instant: to,
      });
      const result = await historical(state, { propertyNode: PROPERTY_A, businessDate });
      expect((result as AnyRecord).property.propertyTimezone).toBe(timezone);
      expect((result as AnyRecord).businessDay.fromInstant).toBe(from);
      expect((result as AnyRecord).businessDay.toInstant).toBe(to);
      expect(selected(result).version).toBe(2);
    }
  });

  test("returns recursively frozen, tenant-hidden evidence whose hash binds identity, assignment, content, source and every bound", async () => {
    const state = baseState();
    const result = await historical(state);
    const value = result as AnyRecord;
    deeplyFrozen(result);
    const encoded = text(result);
    expect(encoded).not.toContain(TENANT_A);
    expect(encoded).not.toContain(TENANT_B);
    expect(value.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(value.rateVersionPair.sourceHashes).toEqual({
      notification20_2019: SOURCE_2019,
      notification04_2022: SOURCE_2022,
      notification15_2025: SOURCE_2025,
    });
    expect(text(value.rateVersionPair)).not.toContain(TENANT_A);

    const mutations: Array<(candidate: State) => void> = [
      (candidate) => { candidate.property = { ...candidate.property, property_timezone: "Asia/Kathmandu", business_day_from_instant: "2025-12-31T18:15:00.000000Z", business_day_to_instant: "2026-01-01T18:15:00.000000Z" }; },
      (candidate) => { candidate.property = { ...candidate.property, business_day_from_instant: "2026-01-01T18:30:00.000001Z" }; },
      (candidate) => { candidate.property = { ...candidate.property, business_day_to_instant: "2026-01-02T18:30:00.000001Z" }; },
      (candidate) => { candidate.assignments = [{ jurisdiction_key: KEY, effective_from: "2021-01-01", effective_to: null }]; },
      (candidate) => { const content = predecessorContent(); content.taxes[1].rate = 0.06; candidate.visible = [extension(PREDECESSOR, 1, "retired", content), baseSuccessor()]; },
      (candidate) => { candidate.visible = [extension(PREDECESSOR, 1, "retired", predecessorContent(), TENANT_A), extension(SUCCESSOR, 2, "active", successorContent(), TENANT_A)]; candidate.periods[PREDECESSOR] = period(PREDECESSOR, PREDECESSOR_FROM, CUTOVER, TENANT_A); candidate.periods[SUCCESSOR] = period(SUCCESSOR, CUTOVER, null, TENANT_A); },
    ];
    for (const mutate of mutations) {
      const candidate = baseState();
      mutate(candidate);
      const changed = await historical(candidate);
      expect((changed as AnyRecord).evidenceHash).not.toBe(value.evidenceHash);
    }

    const identityDefect = baseState();
    identityDefect.visible = [extension(OTHER_EXTENSION, 1, "retired", predecessorContent()), baseSuccessor()];
    await expect(historical(identityDefect)).rejects.toThrow();
  });

  test("preserves the current active-only resolver: v2 remains current even when v1 is visible", async () => {
    const state = baseState();
    const current = await new TaxJurisdictionResolutionService(registryFor(state) as never).resolve(
      txFor(state),
      { propertyNode: PROPERTY_A, businessDate: "2026-01-01" },
    );
    expect(current.state).toBe("resolved");
    if (current.state === "resolved") {
      expect(current.jurisdiction.version).toBe(2);
      expect(current.jurisdiction.extensionId).toBe(SUCCESSOR);
    }
    expect(text(current)).not.toContain(PREDECESSOR);
    expect(state.sql.every((sql) => /^\s*SELECT\b/i.test(sql))).toBeTrue();
  });
});
