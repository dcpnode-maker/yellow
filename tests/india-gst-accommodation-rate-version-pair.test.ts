import { describe, expect, test } from "bun:test";

import { IndiaGstAccommodationRateVersionPairService } from "../src/contexts/tax-fiscal";

type AnyRecord = Record<PropertyKey, any>;
type Period = {
  extensionId: string;
  ownerTenantId: string | null;
  effectiveFromInstant: string | null;
  effectiveToInstant: string | null;
};

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TENANT = id(30401);
const FOREIGN_TENANT = id(30402);
const PROPERTY = id(30403);
const PREDECESSOR = id(30404);
const SUCCESSOR = id(30405);
const OTHER = id(30406);
const KEY = "in-gst-lodging";
const CUTOVER = "2025-09-21T18:30:00.000000Z";
const PRE_FROM = "2022-07-17T18:30:00.000000Z";
const PRE_TO = CUTOVER;
const POST_FROM = CUTOVER;
const SOURCE20 = "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901";
const SOURCE04 = "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716";
const SOURCE15 = "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289";

const predecessorContent = () => ({
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [{
    code: "GST_ROOM",
    name: "GST on accommodation",
    mode: "slab_percent",
    slab_basis: "transaction_value",
    applies_to: ["room_revenue"],
    slabs: [
      { upto_minor: 750000, rate: 0.12, itc_eligible: true },
      { upto_minor: null, rate: 0.18, itc_eligible: true },
    ],
    }, {
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    }],
});

const successorContent = () => ({
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [{
    code: "GST_ROOM",
    name: "GST on accommodation",
    mode: "slab_percent",
    slab_basis: "transaction_value",
    applies_to: ["room_revenue"],
    slabs: [
      { upto_minor: 750000, rate: 0.05, itc_eligible: false },
      { upto_minor: null, rate: 0.18, itc_eligible: true },
    ],
    }, {
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    }],
});

const extension = (
  extensionId: string,
  version: number,
  status: "active" | "retired",
  content: AnyRecord,
  tenantId: string | null = TENANT,
) => ({ id: extensionId, tenantId, type: "tax_jurisdiction", key: KEY, version, content, status });

const basePredecessor = () => extension(PREDECESSOR, 1, "retired", predecessorContent());
const baseSuccessor = () => extension(SUCCESSOR, 2, "active", successorContent());

function tx(tenantId = TENANT, rows?: unknown[]) {
  return (async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (/current_setting\('app\.tenant_id'|FROM\s+org_node|FROM\s+property/i.test(sql)) {
      return rows ?? [{ tenant_id: tenantId }];
    }
    throw new Error(`unexpected SQL: ${sql}`);
  }) as never;
}

function registry(
  visible: unknown[] = [basePredecessor(), baseSuccessor()],
  periods: Record<string, Period> = {
    [PREDECESSOR]: {
      extensionId: PREDECESSOR,
      ownerTenantId: TENANT,
      effectiveFromInstant: PRE_FROM,
      effectiveToInstant: PRE_TO,
    },
    [SUCCESSOR]: {
      extensionId: SUCCESSOR,
      ownerTenantId: TENANT,
      effectiveFromInstant: POST_FROM,
      effectiveToInstant: null,
    },
  },
) {
  return {
    async listVisible(tenantId: string) {
      expect(tenantId).toBe(TENANT);
      return visible;
    },
    async readVisibleEffectivePeriod(tenantId: string, extensionId: string) {
      expect(tenantId).toBe(TENANT);
      return periods[extensionId];
    },
  };
}

const input = () => ({
  propertyNode: PROPERTY,
  predecessorExtensionId: PREDECESSOR,
  successorExtensionId: SUCCESSOR,
});

const resolve = (value = input(), visible?: unknown[], periods?: Record<string, Period>, tenant = TENANT) =>
  new IndiaGstAccommodationRateVersionPairService(registry(visible, periods)).resolve(
    tx(tenant),
    value as never,
  );

function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deeplyFrozen((value as AnyRecord)[key], seen);
}

function resultText(value: unknown): string {
  return JSON.stringify(value);
}

describe("Order 304: India GST accommodation rate-version pair", () => {
  test("proves the exact retired predecessor and active successor at the Kolkata cutover", async () => {
    const result = await resolve();
    const text = resultText(result);

    expect(text).toContain(PREDECESSOR);
    expect(text).toContain(SUCCESSOR);
    expect(text).toContain(PRE_FROM);
    expect(text).toContain(CUTOVER);
    expect(text).toContain('"rate":0.12');
    expect(text).toContain('"rate":0.05');
    expect(text).toContain('"rate":0.18');
    expect(text).toContain('"itc_eligible":true');
    expect(text).toContain('"itc_eligible":false');
    expect(text).toContain(SOURCE20);
    expect(text).toContain(SOURCE04);
    expect(text).toContain(SOURCE15);
    expect(text).not.toContain(TENANT);
    deeplyFrozen(result);
    expect(result).toEqual(await resolve());
  });

  test("rejects every microsecond gap, overlap, UTC-midnight impostor, and malformed bound", async () => {
    const mutants: Record<string, Period> = {
      gap: { extensionId: SUCCESSOR, ownerTenantId: TENANT, effectiveFromInstant: "2025-09-21T18:30:00.000001Z", effectiveToInstant: null },
      overlap: { extensionId: PREDECESSOR, ownerTenantId: TENANT, effectiveFromInstant: PRE_FROM, effectiveToInstant: "2025-09-21T18:30:00.000001Z" },
      utcMidnight: { extensionId: SUCCESSOR, ownerTenantId: TENANT, effectiveFromInstant: "2025-09-22T00:00:00.000000Z", effectiveToInstant: null },
      malformed: { extensionId: SUCCESSOR, ownerTenantId: TENANT, effectiveFromInstant: "2025-09-21T18:30:00Z", effectiveToInstant: null },
      reversed: { extensionId: PREDECESSOR, ownerTenantId: TENANT, effectiveFromInstant: CUTOVER, effectiveToInstant: PRE_FROM },
      boundedSuccessor: { extensionId: SUCCESSOR, ownerTenantId: TENANT, effectiveFromInstant: POST_FROM, effectiveToInstant: "2050-01-01T00:00:00.000000Z" },
    };
    for (const [kind, period] of Object.entries(mutants)) {
      const periods = { [PREDECESSOR]: { ...period, extensionId: PREDECESSOR, effectiveFromInstant: kind === "reversed" ? CUTOVER : PRE_FROM, effectiveToInstant: kind === "gap" ? PRE_TO : period.effectiveToInstant }, [SUCCESSOR]: { ...period, extensionId: SUCCESSOR, effectiveFromInstant: kind === "gap" || kind === "utcMidnight" || kind === "malformed" ? period.effectiveFromInstant : POST_FROM, effectiveToInstant: null } };
      await expect(resolve(input(), undefined, periods)).rejects.toThrow();
    }
    await expect(resolve(input(), undefined, {
      [PREDECESSOR]: { extensionId: PREDECESSOR, ownerTenantId: TENANT, effectiveFromInstant: PRE_FROM, effectiveToInstant: PRE_TO },
      [SUCCESSOR]: { extensionId: SUCCESSOR, ownerTenantId: TENANT, effectiveFromInstant: POST_FROM, effectiveToInstant: "2050-01-01T00:00:00.000000Z" },
    })).rejects.toThrow();
  });

  test("requires exact status, version, owner, id, type, key, visibility, and no duplicates", async () => {
    const cases = [
      [extension(PREDECESSOR, 1, "active", predecessorContent()), baseSuccessor()],
      [extension(PREDECESSOR, 2, "retired", predecessorContent()), baseSuccessor()],
      [extension(PREDECESSOR, 1, "retired", predecessorContent(), FOREIGN_TENANT), baseSuccessor()],
      [extension(OTHER, 1, "retired", predecessorContent()), baseSuccessor()],
      [extension(PREDECESSOR, 1, "retired", predecessorContent()), extension(SUCCESSOR, 2, "active", successorContent(), FOREIGN_TENANT)],
      [extension(PREDECESSOR, 1, "retired", predecessorContent()), extension(SUCCESSOR, 2, "active", successorContent()) , basePredecessor()],
      [extension(PREDECESSOR, 1, "retired", predecessorContent()), extension(SUCCESSOR, 2, "active", successorContent()) , extension(SUCCESSOR, 2, "active", successorContent())],
      [extension(PREDECESSOR, 1, "retired", predecessorContent()), extension(SUCCESSOR, 3, "active", successorContent())],
    ] as unknown[][];
    const wrongType = extension(PREDECESSOR, 1, "retired", predecessorContent()) as AnyRecord;
    wrongType.type = "other";
    const wrongKey = extension(PREDECESSOR, 1, "retired", predecessorContent()) as AnyRecord;
    wrongKey.key = "in-other-jurisdiction";
    cases.push([wrongType, baseSuccessor()], [wrongKey, baseSuccessor()]);
    for (const visible of cases) await expect(resolve(input(), visible)).rejects.toThrow();
    await expect(resolve(input(), [])).rejects.toThrow();
    await expect(resolve({ ...input(), predecessorExtensionId: OTHER })).rejects.toThrow();
    await expect(resolve({ ...input(), successorExtensionId: OTHER })).rejects.toThrow();
  });

  test("binds the exact old 12%-ITC/new 5%-no-ITC lower bands and unchanged 18%-ITC upper band", async () => {
    const baseline = resultText(await resolve());
    for (const [which, mutate] of [
      ["old rate", (c: AnyRecord) => { c.taxes[0].slabs[0].rate = 0.05; }],
      ["old ITC", (c: AnyRecord) => { c.taxes[0].slabs[0].itc_eligible = false; }],
      ["new rate", (c: AnyRecord) => { c.taxes[0].slabs[0].rate = 0.12; }],
      ["new ITC", (c: AnyRecord) => { c.taxes[0].slabs[0].itc_eligible = true; }],
      ["upper rate", (c: AnyRecord) => { c.taxes[0].slabs[1].rate = 0.12; }],
      ["upper ITC", (c: AnyRecord) => { c.taxes[0].slabs[1].itc_eligible = false; }],
    ] as const) {
      const old = predecessorContent();
      const next = successorContent();
      mutate(which.startsWith("old") ? old : next);
      const visible = [basePredecessor(), baseSuccessor()];
      visible[which.startsWith("old") ? 0 : 1]!.content = which.startsWith("old") ? old : next;
      await expect(resolve(input(), visible)).rejects.toThrow();
      expect(baseline).toContain('"rate":0.12');
    }
  });

  test("rejects nil/threshold/order/duplicate-GST_ROOM and semantic-content mutants", async () => {
    const mutants = [
      (c: AnyRecord) => { c.taxes[0].slabs[0].upto_minor = 100000; },
      (c: AnyRecord) => { c.taxes[0].slabs[0].upto_minor = null; },
      (c: AnyRecord) => { c.taxes[0].slabs.reverse(); },
      (c: AnyRecord) => { c.taxes[0].slabs.push({ upto_minor: null, rate: 0.18, itc_eligible: true }); },
      (c: AnyRecord) => { c.taxes.push({ ...c.taxes[0] }); },
      (c: AnyRecord) => { c.taxes[0].applies_to = ["spa_revenue"]; },
      (c: AnyRecord) => { c.taxes[0].mode = "percent"; },
      (c: AnyRecord) => { c.price_display = "tax_inclusive"; },
      (c: AnyRecord) => { c.rounding = "line"; },
      (c: AnyRecord) => { c.country = "GB"; },
    ];
    for (const mutate of mutants) {
      const content = predecessorContent();
      mutate(content);
      const visible = [extension(PREDECESSOR, 1, "retired", content), baseSuccessor()];
      await expect(resolve(input(), visible)).rejects.toThrow();
    }
  });

  test("fails closed on nil, threshold, ordering and duplicate GST_ROOM defects in the successor too", async () => {
    for (const mutate of [
      (c: AnyRecord) => { c.taxes[0].slabs[0].upto_minor = 750001; },
      (c: AnyRecord) => { c.taxes[0].slabs[1].upto_minor = 900000; },
      (c: AnyRecord) => { c.taxes[0].slabs[0].rate = 0; },
      (c: AnyRecord) => { c.taxes[0].slabs[1].itc_eligible = false; },
      (c: AnyRecord) => { c.taxes.unshift({ ...c.taxes[0] }); },
    ]) {
      const content = successorContent();
      mutate(content);
      await expect(resolve(input(), [basePredecessor(), extension(SUCCESSOR, 2, "active", content)])).rejects.toThrow();
    }
  });

  test("rejects hostile input, registry shapes, accessors, proxies and symbol keys", async () => {
    const hostileInput = [
      null,
      [],
      { ...input(), extra: true },
      { propertyNode: PROPERTY, predecessorExtensionId: PREDECESSOR },
      { ...input(), [Symbol("hostile")]: true },
      new Proxy(input(), {}),
    ];
    for (const value of hostileInput) await expect(resolve(value as never)).rejects.toThrow();
    const accessor = input() as AnyRecord;
    Object.defineProperty(accessor, "propertyNode", { enumerable: true, get: () => PROPERTY });
    await expect(resolve(accessor as never)).rejects.toThrow();

    const malformed = [
      new Proxy([basePredecessor(), baseSuccessor()], {}),
      [new Proxy(basePredecessor(), {}), baseSuccessor()],
      [{ ...basePredecessor(), [Symbol("x")]: true }, baseSuccessor()],
      [{ ...basePredecessor(), content: new Proxy(predecessorContent(), {}) }, baseSuccessor()],
      [{ ...basePredecessor(), content: { ...predecessorContent(), taxes: [] } }, baseSuccessor()],
    ];
    for (const visible of malformed) await expect(resolve(input(), visible)).rejects.toThrow();
    const period = { ...({ [PREDECESSOR]: { extensionId: PREDECESSOR, ownerTenantId: TENANT, effectiveFromInstant: PRE_FROM, effectiveToInstant: PRE_TO }, [SUCCESSOR]: { extensionId: SUCCESSOR, ownerTenantId: TENANT, effectiveFromInstant: POST_FROM, effectiveToInstant: null } }) };
    Object.defineProperty(period[PREDECESSOR], "effectiveToInstant", { enumerable: true, get: () => PRE_TO });
    await expect(resolve(input(), undefined, period)).rejects.toThrow();
  });

  test("changes evidence for every selected identity, version, period and content field while hiding tenant", async () => {
    const baseline = await resolve();
    const baseHash = (baseline as AnyRecord).evidenceHash;
    expect(typeof baseHash).toBe("string");
    const alternatePredecessor = id(30407);
    const alternateSuccessor = id(30408);
    const alternatePeriods = {
      [alternatePredecessor]: { extensionId: alternatePredecessor, ownerTenantId: TENANT, effectiveFromInstant: PRE_FROM, effectiveToInstant: PRE_TO },
      [alternateSuccessor]: { extensionId: alternateSuccessor, ownerTenantId: TENANT, effectiveFromInstant: POST_FROM, effectiveToInstant: null },
    };
    const changedPredecessor = await resolve(
      { ...input(), predecessorExtensionId: alternatePredecessor },
      [extension(alternatePredecessor, 1, "retired", predecessorContent()), baseSuccessor()],
      { ...alternatePeriods, [SUCCESSOR]: { extensionId: SUCCESSOR, ownerTenantId: TENANT, effectiveFromInstant: POST_FROM, effectiveToInstant: null } },
    );
    const changedSuccessor = await resolve(
      { ...input(), successorExtensionId: alternateSuccessor },
      [basePredecessor(), extension(alternateSuccessor, 2, "active", successorContent())],
      { ...alternatePeriods, [PREDECESSOR]: { extensionId: PREDECESSOR, ownerTenantId: TENANT, effectiveFromInstant: PRE_FROM, effectiveToInstant: PRE_TO } },
    );
    expect(changedPredecessor.evidenceHash).not.toBe(baseHash);
    expect(changedSuccessor.evidenceHash).not.toBe(baseHash);

    const changedContent = predecessorContent();
    (changedContent as AnyRecord).region = "WB";
    await expect(resolve(
      input(),
      [extension(PREDECESSOR, 1, "retired", changedContent), baseSuccessor()],
    )).rejects.toThrow();

    const changedUnrelated = predecessorContent();
    changedUnrelated.taxes[1]!.rate = 0.06;
    const changedUnrelatedResult = await resolve(
      input(),
      [extension(PREDECESSOR, 1, "retired", changedUnrelated), baseSuccessor()],
    );
    expect(changedUnrelatedResult.predecessor.contentHash)
      .not.toBe(baseline.predecessor.contentHash);
    expect(changedUnrelatedResult.evidenceHash).not.toBe(baseHash);

    const changedProperty = await resolve({ ...input(), propertyNode: id(30409) });
    expect(changedProperty.evidenceHash).not.toBe(baseHash);

    const globalPredecessor = extension(PREDECESSOR, 1, "retired", predecessorContent(), null);
    const globalSuccessor = extension(SUCCESSOR, 2, "active", successorContent(), null);
    const globalPeriods = {
      [PREDECESSOR]: { extensionId: PREDECESSOR, ownerTenantId: null, effectiveFromInstant: PRE_FROM, effectiveToInstant: PRE_TO },
      [SUCCESSOR]: { extensionId: SUCCESSOR, ownerTenantId: null, effectiveFromInstant: POST_FROM, effectiveToInstant: null },
    };
    const changedOwner = await resolve(input(), [globalPredecessor, globalSuccessor], globalPeriods);
    expect(changedOwner.evidenceHash).not.toBe(baseHash);

    await expect(resolve(input(), undefined, {
      [PREDECESSOR]: { extensionId: PREDECESSOR, ownerTenantId: TENANT, effectiveFromInstant: "2022-07-17T18:30:00.000001Z", effectiveToInstant: PRE_TO },
      [SUCCESSOR]: { extensionId: SUCCESSOR, ownerTenantId: TENANT, effectiveFromInstant: POST_FROM, effectiveToInstant: null },
    })).rejects.toThrow();
    await expect(resolve(input(), [extension(PREDECESSOR, 2, "retired", predecessorContent()), baseSuccessor()])).rejects.toThrow();
    expect(resultText(baseline)).not.toContain(TENANT);
    expect(resultText(baseline)).not.toContain(FOREIGN_TENANT);
  });
});
