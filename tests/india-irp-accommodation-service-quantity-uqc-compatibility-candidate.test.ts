import { describe, expect, test } from "bun:test";

import {
  composeIndiaIrpAccommodationRoomNightItemCandidates,
  composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate,
  type IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateInput,
} from "../src/contexts/tax-fiscal";
import {
  cloneOrder419,
  makeOrder419Input,
  makeOrder419Source,
  makeOrder419UnsupportedExportInput,
  rehashOrder419Source,
  TENANT,
  type FixtureOptions,
} from "./fixtures/india-irp-order419-fixture";

type Mutable = Record<string, any>;

function freeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as Mutable)) freeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function allFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value as Mutable).every((child) => allFrozen(child, seen));
}

function rejected(value: unknown): void {
  expect(() => composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(
    value as IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateInput,
  )).toThrow();
}

function rebuilt(mutator: (source: Mutable) => void, options: FixtureOptions = {}): unknown {
  const source = cloneOrder419(makeOrder419Source(options)) as unknown as Mutable;
  mutator(source);
  return freeze({ tenantId: TENANT, source: rehashOrder419Source(freeze(source) as never) });
}

function childProjectionProbe(mutation: string): ReturnType<typeof Bun.spawnSync> {
  const childPath = "./src/contexts/tax-fiscal/india-irp-accommodation-room-night-item-candidate.ts";
  const script = `
    import { mock } from "bun:test";
    const child = await import(${JSON.stringify(childPath)});
    mock.module(${JSON.stringify(childPath)}, () => ({
      ...child,
      composeIndiaIrpAccommodationRoomNightItemCandidates: (input) => {
        const result = child.composeIndiaIrpAccommodationRoomNightItemCandidates(input);
        const [first, ...rest] = result.items;
        const mutations = {
          amount: () => ({ ...result, items: [{ ...first, irp: { ...first.irp, TotAmt: "99.99" } }, ...rest] }),
          count: () => ({ ...result, items: [] }),
          family: () => ({ ...result, items: [{ ...first, lineage: { ...first.lineage, componentFamily: "cgst_sgst" } }, ...rest] }),
          currency: () => ({ ...result, currency: "USD" }),
          supply: () => ({ ...result, supplyTypeCode: "SEZWP" }),
          source: () => ({ ...result, sourceEvidenceHash: "0".repeat(64) }),
        };
        return mutations[${JSON.stringify(mutation)}]();
      },
    }));
    const target = await import(
      "./src/contexts/tax-fiscal/india-irp-accommodation-service-quantity-uqc-compatibility-candidate.ts?" +
      ${JSON.stringify(mutation)}
    );
    const fixture = await import("./tests/fixtures/india-irp-order419-fixture.ts");
    try {
      target.composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(fixture.makeOrder419Input());
      process.exit(1);
    } catch {
      process.exit(0);
    }
  `;
  return Bun.spawnSync([process.execPath, "-e", script], {
    cwd: new URL("..", import.meta.url).pathname.slice(1), stdout: "pipe", stderr: "pipe",
  });
}

describe("Order425 India IRP service quantity/UQC compatibility candidate", () => {
  test("adds only exact compatibility fields in exact IRP schema order across every family", () => {
    for (const family of ["igst", "cgst_sgst", "cgst_utgst"] as const) {
      const input = makeOrder419Input({ family });
      const inherited = composeIndiaIrpAccommodationRoomNightItemCandidates(input);
      const result = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input);
      expect(result.state).toBe("eligible_irp_accommodation_service_quantity_uqc_compatibility_candidate");
      expect(result.supplyTypeCode).toBe("B2B");
      expect(result.currency).toBe("INR");
      expect(result.items).toHaveLength(1);
      expect(Object.keys(result)).toEqual([
        "state", "supplyTypeCode", "currency", "items", "lineage", "sourceEvidenceHash", "evidenceHash",
      ]);
      expect(Object.keys(result.lineage)).toEqual([
        "itemCandidateEvidenceHash", "sourceEvidenceHash", "itemCount", "componentFamily",
      ]);
      const before = inherited.items[0]!;
      const after = result.items[0]!;
      expect(Object.keys(after.irp)).toEqual(family === "igst"
        ? ["SlNo", "IsServc", "HsnCd", "Qty", "Unit", "UnitPrice", "TotAmt", "AssAmt", "GstRt", "IgstAmt", "TotItemVal"]
        : ["SlNo", "IsServc", "HsnCd", "Qty", "Unit", "UnitPrice", "TotAmt", "AssAmt", "GstRt", "CgstAmt", "SgstAmt", "TotItemVal"]);
      expect(after.irp.Qty).toBe("1.000");
      expect(after.irp.Unit).toBe("OTH");
      const { Qty: _qty, Unit: _unit, ...unchanged } = after.irp;
      expect(unchanged).toEqual(before.irp);
      expect(after.lineage).toEqual(before.lineage);
    }
  });

  test("preserves exact count, order, child values and lineage for 1, 2 and 366 room nights", () => {
    for (const nights of [1, 2, 366]) {
      const input = makeOrder419Input({ nights });
      const before = JSON.stringify(input);
      const inherited = composeIndiaIrpAccommodationRoomNightItemCandidates(input);
      const first = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input);
      const replay = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input);
      expect(first.items).toHaveLength(nights);
      expect(first.items.map((item) => item.irp.SlNo)).toEqual(inherited.items.map((item) => item.irp.SlNo));
      expect(first.items.map((item) => item.lineage)).toEqual(inherited.items.map((item) => item.lineage));
      expect(first.lineage.itemCandidateEvidenceHash).toBe(inherited.evidenceHash);
      expect(first.sourceEvidenceHash).toBe(inherited.sourceEvidenceHash);
      expect(first).toEqual(replay);
      expect(JSON.stringify(input)).toBe(before);
      expect(allFrozen(first)).toBeTrue();
      expect(JSON.stringify(first)).not.toContain(TENANT);
    }
  });

  test("binds identical commercial evidence to its tenant without disclosing either tenant", () => {
    const otherTenant = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const first = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(makeOrder419Input());
    const second = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(
      makeOrder419Input({}, otherTenant),
    );
    expect(first.evidenceHash).not.toBe(second.evidenceHash);
    expect(JSON.stringify(first)).not.toContain(TENANT);
    expect(JSON.stringify(second)).not.toContain(otherTenant);
  });

  test("does not admit any other optional item field or caller quantity/UQC", () => {
    const input = makeOrder419Input({ family: "cgst_utgst" });
    const result = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input);
    const item = result.items[0]!.irp as Mutable;
    for (const field of ["PrdDesc", "Discount", "PreTaxVal", "CesRt", "CesAmt", "CesNonAdvlAmt", "StateCesRt", "StateCesAmt", "StateCesNonAdvlAmt", "OthChrg"])
      expect(Object.hasOwn(item, field)).toBeFalse();
    rejected(freeze({ ...cloneOrder419(input), Qty: "2.000" }));
    rejected(freeze({ ...cloneOrder419(input), Unit: "NOS" }));
  });

  test("keeps Order419 load-bearing and rejects inherited hostile graphs", () => {
    rejected(makeOrder419UnsupportedExportInput());
    const cases: ((source: Mutable) => void)[] = [
      (source) => { source.financialSource.roomNights[0].unexpected = true; },
      (source) => { source.financialSource.roomNights[0].transactionValueMinor = "01"; },
      (source) => { source.financialSource.components.reverse(); },
      (source) => { source.supplyNatureAtTimeOfSupply.supplyNature = "export"; },
    ];
    for (const mutate of cases) rejected(rebuilt(mutate, { family: "cgst_sgst", nights: 2 }));
  });

  test("rejects mutable, proxy, accessor, symbol, sparse and cyclic inputs", () => {
    const valid = makeOrder419Input();
    rejected({ ...valid });
    rejected(Object.freeze({ ...valid, source: new Proxy(valid.source, {}) }));
    const accessor = { tenantId: TENANT } as Mutable;
    Object.defineProperty(accessor, "source", { enumerable: true, get: () => valid.source });
    Object.freeze(accessor);
    rejected(accessor);
    const symbol = cloneOrder419(valid) as unknown as Mutable;
    Object.defineProperty(symbol, Symbol("unit"), { enumerable: true, value: "OTH" });
    rejected(freeze(symbol));
    const sparse = cloneOrder419(valid) as unknown as Mutable;
    sparse.source.financialSource.roomNights.length = 2;
    rejected(freeze(sparse));
    const cycle = cloneOrder419(valid) as unknown as Mutable;
    cycle.source.loop = cycle.source;
    rejected(freeze(cycle));
  });

  test("rejects controlled inherited amount, count, family, currency, B2B and source mismatches", () => {
    for (const mutation of ["amount", "count", "family", "currency", "supply", "source"]) {
      const probe = childProjectionProbe(mutation);
      expect(probe.exitCode).toBe(0);
    }
  });
});
