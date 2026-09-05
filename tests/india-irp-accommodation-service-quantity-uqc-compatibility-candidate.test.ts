import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

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

function childProjectionProbe(
  mutation: "amount" | "count" | "family" | "currency" | "supply" | "source" | "itemSource" | "order" | "evidence",
  expectedMessage: string,
): ReturnType<typeof Bun.spawnSync> {
  const childPath = new URL(
    "../src/contexts/tax-fiscal/india-irp-accommodation-room-night-item-candidate.ts",
    import.meta.url,
  ).href;
  const targetPath = new URL(
    "../src/contexts/tax-fiscal/india-irp-accommodation-service-quantity-uqc-compatibility-candidate.ts",
    import.meta.url,
  ).href;
  const fixturePath = new URL("./fixtures/india-irp-order419-fixture.ts", import.meta.url).href;
  const script = `
    import { mock } from "bun:test";
    const child = await import(${JSON.stringify(childPath)});
    const original = child.composeIndiaIrpAccommodationRoomNightItemCandidates;
    mock.module(${JSON.stringify(childPath)}, () => ({
      ...child,
      composeIndiaIrpAccommodationRoomNightItemCandidates: (input) => {
        const result = original(input);
        const [first, ...rest] = result.items;
        const bind = (candidate) => {
          const { evidenceHash: _old, ...body } = candidate;
          return { ...body, evidenceHash: new Bun.CryptoHasher("sha256")
            .update(JSON.stringify({ tenantId: input.tenantId, ...body })).digest("hex") };
        };
        const mutations = {
          amount: () => ({ ...result, items: [{ ...first, irp: { ...first.irp, TotAmt: "99.99" } }, ...rest] }),
          count: () => ({ ...result, items: [first] }),
          family: () => ({ ...result, items: [first, { ...rest[0], lineage: { ...rest[0].lineage, componentFamily: "cgst_sgst" } }, ...rest.slice(1)] }),
          currency: () => ({ ...result, currency: "USD" }),
          supply: () => ({ ...result, supplyTypeCode: "SEZWP" }),
          source: () => ({ ...result, sourceEvidenceHash: "0".repeat(64), items: result.items.map((item) => ({ ...item, lineage: { ...item.lineage, sourceEvidenceHash: "0".repeat(64) } })) }),
          itemSource: () => ({ ...result, items: [{ ...first, lineage: { ...first.lineage, sourceEvidenceHash: "0".repeat(64) } }, ...rest] }),
          order: () => ({ ...result, items: [first, { ...rest[0], lineage: { ...rest[0].lineage, roomNightOrdinal: "9" } }, ...rest.slice(1)] }),
          evidence: () => ({ ...result, evidenceHash: "0".repeat(64) }),
        };
        const changed = mutations[${JSON.stringify(mutation)}]();
        return ${JSON.stringify(mutation)} === "evidence" ? changed : bind(changed);
      },
    }));
    const target = await import(${JSON.stringify(targetPath)} + "?" + ${JSON.stringify(mutation)});
    const fixture = await import(${JSON.stringify(fixturePath)});
    try {
      target.composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(
        fixture.makeOrder419Input({ nights: ${["count", "family", "order"].includes(mutation) ? 2 : 1} }),
      );
      process.exit(1);
    } catch (error) {
      const exact = error?.name === "IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateValidationError" &&
        error?.message === ${JSON.stringify(expectedMessage)};
      if (!exact) console.error(error?.name, error?.message);
      process.exit(exact ? 0 : 2);
    }
  `;
  return Bun.spawnSync([Bun.which("bun") ?? process.execPath, "-e", script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), stdout: "pipe", stderr: "pipe",
  });
}

const CHILD_PROJECTION_CASES = [
  ["amount", "inherited UnitPrice and TotAmt must be identical"],
  ["count", "inherited item-candidate evidence is inconsistent"],
  ["family", "inherited item order, lineage or component family is inconsistent"],
  ["currency", "inherited item-candidate evidence is inconsistent"],
  ["supply", "inherited item-candidate evidence is inconsistent"],
  ["source", "inherited item-candidate evidence is inconsistent"],
  ["itemSource", "inherited item order, lineage or component family is inconsistent"],
  ["order", "inherited item order, lineage or component family is inconsistent"],
  ["evidence", "inherited item-candidate evidence hash is inconsistent"],
] as const;

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

  for (const [mutation, message] of CHILD_PROJECTION_CASES) {
    test(`rejects the exact controlled inherited ${mutation} mismatch`, () => {
      const probe = childProjectionProbe(mutation, message);
      expect(probe.exitCode).toBe(0);
    });
  }
});
