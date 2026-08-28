import { describe, expect, test } from "bun:test";

import {
  createPositiveTaxAttributionSnapshot,
  derivePositiveTaxPostingPlan,
  type CreatePositiveTaxAttributionSnapshotInput,
  type PositiveTaxAttributionSnapshotV1,
} from "../src/contexts/tax-fiscal";

const INT64_MAX = 9_223_372_036_854_775_807n;
const QUOTE_HASH = "a".repeat(64);
const CONTENT_HASH = "b".repeat(64);
const EXTENSION_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";

interface TaxFixture {
  readonly code: string;
  readonly name?: string;
  readonly amount: bigint;
  readonly base?: bigint;
  readonly rateBasisPoints?: number | null;
}

interface SnapshotOptions {
  readonly country?: string;
  readonly jurisdictionKey?: string;
  readonly rounding?: "line" | "document";
  readonly priceDisplay?: "tax_exclusive" | "tax_inclusive";
  readonly base?: bigint;
  readonly taxes?: readonly TaxFixture[];
}

function snapshot(options: SnapshotOptions = {}): PositiveTaxAttributionSnapshotV1 {
  const country = options.country ?? "AE";
  const jurisdictionKey = options.jurisdictionKey ?? "ae.vat.hotel";
  const rounding = options.rounding ?? "line";
  const priceDisplay = options.priceDisplay ?? "tax_exclusive";
  const base = options.base ?? 10_000n;
  const taxes: readonly TaxFixture[] = options.taxes ?? [
    Object.freeze({ code: "VAT", name: "Room VAT", amount: 500n }),
  ];
  const taxTotal = taxes.reduce((sum, tax) => sum + tax.amount, 0n);
  const grand = base + taxTotal;
  const inputAmount = priceDisplay === "tax_inclusive" ? grand : base;
  const input: CreatePositiveTaxAttributionSnapshotInput = {
    origin: { kind: "rate_quote", quoteHash: QUOTE_HASH },
    currency: "AED",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: inputAmount,
      nights: 1,
      personNights: 2,
      roomNights: [{ businessDate: "2030-01-10", amountMinor: inputAmount }],
    },
    assignments: [{
      businessDate: "2030-01-10",
      jurisdictionKey,
      evidenceRef: `tax-assignment:${"c".repeat(64)}`,
    }],
    jurisdiction: {
      extensionId: EXTENSION_ID,
      ownerTenantId: TENANT_ID,
      key: jurisdictionKey,
      version: 1,
      contentHash: CONTENT_HASH,
      evidenceRef: `tax-jurisdiction:${"d".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey,
      country,
      priceDisplay,
      rounding,
      inputTotalMinor: inputAmount,
      baseTotalMinor: base,
      taxTotalMinor: taxTotal,
      grandTotalMinor: grand,
      taxes: taxes.map((tax) => ({
        code: tax.code,
        name: tax.name ?? tax.code,
        taxMinor: tax.amount,
        components: [{
          lineId: "room" as const,
          revenueGroup: "room_revenue" as const,
          baseMinor: tax.base ?? base,
          taxMinor: rounding === "line" ? tax.amount : null,
          rateBasisPoints: tax.rateBasisPoints === undefined ? 500 : tax.rateBasisPoints,
        }],
      })),
    },
  };
  return createPositiveTaxAttributionSnapshot(input);
}

function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectDeeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child, seen);
}

function signedSum(lines: readonly Readonly<{ amountMinor: string }>[]): bigint {
  return lines.reduce((sum, line) => sum + BigInt(line.amountMinor), 0n);
}

describe("Order 251 canonical positive tax posting plan", () => {
  test("P1: exact parser authority rejects hostile or tampered snapshots without mutating input", () => {
    const canonical = snapshot();
    const pristine = jsonCopy(canonical);
    const unknown = { ...jsonCopy(canonical), taxPayableAccountId: crypto.randomUUID() };
    const accessor = jsonCopy(canonical) as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "currency", { enumerable: true, get: () => "AED" });
    const cyclic = jsonCopy(canonical) as unknown as Record<string, unknown>;
    cyclic.origin = cyclic;
    const tampered = jsonCopy(canonical);
    (tampered.evaluation as { grandTotalMinor: string }).grandTotalMinor = "10501";

    for (const hostile of [unknown, accessor, cyclic, tampered]) {
      expect(() => derivePositiveTaxPostingPlan(hostile)).toThrow();
    }
    expect(canonical).toEqual(pristine);
  });

  test("P2: exclusive and inclusive truth use D-323 signs and balance exactly with bigint", () => {
    for (const priceDisplay of ["tax_exclusive", "tax_inclusive"] as const) {
      const plan = derivePositiveTaxPostingPlan(snapshot({ priceDisplay }));
      expect(plan).toMatchObject({
        schemaVersion: 1,
        quoteHash: QUOTE_HASH,
        currency: "AED",
        state: "route_ready",
        blockers: [],
        balanceMinor: "0",
      });
      expect(plan.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.keys(plan)).toEqual([
        "schemaVersion", "quoteHash", "snapshotHash", "currency", "state", "blockers",
        "revenueLine", "taxLineage", "lines", "balanceMinor",
      ]);
      expect(plan.revenueLine).toEqual({
        lineId: "room",
        revenueGroup: "room_revenue",
        inputAmountMinor: priceDisplay === "tax_inclusive" ? "10500" : "10000",
        baseTotalMinor: "10000",
      });
      expect(plan.taxLineage).toEqual([
        { index: "0", code: "VAT", name: "Room VAT", taxMinor: "500" },
      ]);
      expect(plan.lines).toEqual([
        { index: "0", role: "guest_receivable", direction: "debit", amountMinor: "10500" },
        {
          index: "1", role: "room_revenue", direction: "credit", amountMinor: "-10000",
          lineId: "room", revenueGroup: "room_revenue",
        },
        {
          index: "2", role: "tax_payable", direction: "credit", taxIndex: "0",
          taxCode: "VAT", taxName: "Room VAT", amountMinor: "-500",
        },
      ]);
      expect(signedSum(plan.lines)).toBe(0n);
    }
  });

  test("P3: canonical output is deterministic, freshly derived and recursively frozen", () => {
    const source = snapshot();
    const encoded = JSON.stringify(source);
    const first = derivePositiveTaxPostingPlan(source);
    const replay = derivePositiveTaxPostingPlan(JSON.parse(encoded));

    expect(replay).toEqual(first);
    expect(replay).not.toBe(first);
    expect(replay.lines).not.toBe(first.lines);
    expect(JSON.stringify(source)).toBe(encoded);
    expectDeeplyFrozen(first);
    expectDeeplyFrozen(replay);
  });

  test("P4: document allocation and India decomposition gaps are explicit blockers, never invented lines", () => {
    const document = derivePositiveTaxPostingPlan(snapshot({ rounding: "document" }));
    expect(document).toMatchObject({
      state: "policy_blocked",
      blockers: ["document_tax_allocation_required"],
    });

    const india = derivePositiveTaxPostingPlan(snapshot({
      country: "IN",
      jurisdictionKey: "in.gst.hotel",
      taxes: [{ code: "GST_ROOM", amount: 500n }],
    }));
    expect(india).toMatchObject({
      state: "policy_blocked",
      blockers: ["india_place_of_supply_decomposition_required"],
    });
    expect(india.lines.filter((line) => line.role === "tax_payable")).toEqual([
      {
        index: "2", role: "tax_payable", direction: "credit", taxIndex: "0",
        taxCode: "GST_ROOM", taxName: "GST_ROOM", amountMinor: "-500",
      },
    ]);
    expect(JSON.stringify(india)).not.toMatch(/CGST|SGST|IGST/);

    const both = derivePositiveTaxPostingPlan(snapshot({
      country: "IN",
      jurisdictionKey: "in.gst.hotel",
      rounding: "document",
      taxes: [{ code: "GST_ROOM", amount: 500n }],
    }));
    expect(both.blockers).toEqual([
      "document_tax_allocation_required",
      "india_place_of_supply_decomposition_required",
    ]);

    const aggregateOutsideIndia = derivePositiveTaxPostingPlan(snapshot({
      country: "AE",
      taxes: [{ code: "GST_ROOM", amount: 500n }],
    }));
    expect(aggregateOutsideIndia).toMatchObject({
      state: "policy_blocked",
      blockers: ["india_place_of_supply_decomposition_required"],
    });
  });

  test("P5: zero tax emits no tax line; compound and 64-code order remain exact and bounded", () => {
    const zero = derivePositiveTaxPostingPlan(snapshot({
      taxes: [{ code: "VAT", amount: 0n, rateBasisPoints: 0 }],
    }));
    expect(zero.lines).toHaveLength(2);
    expect(zero.taxLineage).toEqual([
      { index: "0", code: "VAT", name: "VAT", taxMinor: "0" },
    ]);
    expect(zero.lines.some((line) => line.role === "tax_payable")).toBe(false);
    expect(signedSum(zero.lines)).toBe(0n);

    const compound = derivePositiveTaxPostingPlan(snapshot({
      taxes: [
        { code: "VAT", amount: 500n, rateBasisPoints: 500 },
        { code: "CITY_TAX", amount: 25n, base: 10_500n, rateBasisPoints: 25 },
      ],
    }));
    expect(compound.taxLineage.map((tax) => tax.code)).toEqual(["VAT", "CITY_TAX"]);
    expect(compound.lines.slice(2).map((line) => line.amountMinor)).toEqual(["-500", "-25"]);
    expect(signedSum(compound.lines)).toBe(0n);

    const maximumSnapshot = snapshot({
      base: INT64_MAX - 1n,
      taxes: [{ code: "VAT", amount: 1n, rateBasisPoints: 1 }],
    });
    const maximum = derivePositiveTaxPostingPlan(maximumSnapshot);
    expect(maximum.lines[0]!.amountMinor).toBe(INT64_MAX.toString());
    expect(signedSum(maximum.lines)).toBe(0n);

    const taxes = Array.from({ length: 64 }, (_, index) => ({
      code: `TAX_${String(index).padStart(2, "0")}`,
      amount: 1n,
      rateBasisPoints: 1,
    }));
    const bounded = derivePositiveTaxPostingPlan(snapshot({ taxes }));
    expect(bounded.taxLineage.map((tax) => tax.code)).toEqual(taxes.map((tax) => tax.code));
    expect(bounded.lines).toHaveLength(66);
    expect(signedSum(bounded.lines)).toBe(0n);

    const unsafe = jsonCopy(maximumSnapshot);
    (unsafe.evaluation as { grandTotalMinor: string }).grandTotalMinor = "9223372036854775808";
    expect(() => derivePositiveTaxPostingPlan(unsafe)).toThrow();
  });

  test("P6: production module remains synchronous, pure and free of runtime/write authority", async () => {
    const source = await Bun.file(new URL("../src/contexts/tax-fiscal/posting-plan.ts", import.meta.url)).text();
    for (const forbidden of [
      'from "../../kernel"', 'from "../financials', "Tx", "EventBus", "Database", "SQL", "sql`",
      "posting_line", "tax_detail", "recordFact", ".publish(", "INSERT ", "UPDATE ", "DELETE ",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/export\s+async\s+function\s+derivePositiveTaxPostingPlan/);
  });
});
