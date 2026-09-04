import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import {
  composeIndiaIrpAccommodationPreDocumentEvidenceAssembly,
  composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate,
  composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly,
  type IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyInput,
} from "../src/contexts/tax-fiscal";
import {
  cloneOrder419,
  makeOrder419Input,
  makeOrder419UnsupportedExportInput,
  TENANT,
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
  expect(() => composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(
    value as IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyInput,
  )).toThrow();
}

function childProbe(
  child: "pre" | "compatibility",
  mutation: string,
  expectedMessage: string,
): ReturnType<typeof Bun.spawnSync> {
  const prePath = new URL(
    "../src/contexts/tax-fiscal/india-irp-accommodation-pre-document-evidence-assembly.ts",
    import.meta.url,
  ).href;
  const compatibilityPath = new URL(
    "../src/contexts/tax-fiscal/india-irp-accommodation-service-quantity-uqc-compatibility-candidate.ts",
    import.meta.url,
  ).href;
  const targetPath = new URL(
    "../src/contexts/tax-fiscal/india-irp-accommodation-validation-compatibility-pre-document-evidence-assembly.ts",
    import.meta.url,
  ).href;
  const fixturePath = new URL("./fixtures/india-irp-order419-fixture.ts", import.meta.url).href;
  const script = `
    import { mock } from "bun:test";
    const path = ${JSON.stringify(child)} === "pre" ? ${JSON.stringify(prePath)} : ${JSON.stringify(compatibilityPath)};
    const module = await import(path);
    const exportName = ${JSON.stringify(child)} === "pre"
      ? "composeIndiaIrpAccommodationPreDocumentEvidenceAssembly"
      : "composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate";
    const original = module[exportName];
    mock.module(path, () => ({
      ...module,
      [exportName]: (input) => {
        const result = original(input);
        const bind = (candidate) => {
          const { evidenceHash: _old, ...body } = candidate;
          return { ...body, evidenceHash: new Bun.CryptoHasher("sha256")
            .update(JSON.stringify({ tenantId: input.tenantId, ...body })).digest("hex") };
        };
        let changed;
        if (${JSON.stringify(child)} === "pre") {
          const mutations = {
            source: () => ({ ...result, sourceEvidenceHash: "0".repeat(64) }),
            lineageSource: () => ({ ...result, lineage: { ...result.lineage, sourceEvidenceHash: "0".repeat(64) } }),
            count: () => ({ ...result, sections: { ...result.sections, ItemList: result.sections.ItemList.slice(0, 1) } }),
            b2b: () => ({ ...result, sections: { ...result.sections, TranDtls: { ...result.sections.TranDtls, SupTyp: "SEZWP" } } }),
            taxScheme: () => ({ ...result, sections: { ...result.sections, TranDtls: { ...result.sections.TranDtls, TaxSch: "VAT" } } }),
            format: () => ({ ...result, format: "irp_json_2_0" }),
            readiness: () => ({ ...result, submissionReady: true }),
            ancestry: () => ({ ...result, lineage: { ...result.lineage, itemCandidatesEvidenceHash: "0".repeat(64) } }),
            evidence: () => ({ ...result, evidenceHash: "0".repeat(64) }),
          };
          changed = mutations[${JSON.stringify(mutation)}]();
        } else {
          const [first, ...rest] = result.items;
          const mutations = {
            source: () => ({ ...result, sourceEvidenceHash: "0".repeat(64) }),
            lineageSource: () => ({ ...result, lineage: { ...result.lineage, sourceEvidenceHash: "0".repeat(64) } }),
            itemSource: () => ({ ...result, items: result.items.map((item) => ({ ...item, lineage: { ...item.lineage, sourceEvidenceHash: "0".repeat(64) } })) }),
            count: () => ({ ...result, items: [first], lineage: { ...result.lineage, itemCount: 1 } }),
            lineageCount: () => ({ ...result, lineage: { ...result.lineage, itemCount: 1 } }),
            family: () => ({ ...result, lineage: { ...result.lineage, componentFamily: "cgst_sgst" }, items: result.items.map((item) => ({ ...item, lineage: { ...item.lineage, componentFamily: "cgst_sgst" } })) }),
            itemFamily: () => ({ ...result, items: result.items.map((item) => ({ ...item, lineage: { ...item.lineage, componentFamily: "cgst_sgst" } })) }),
            currency: () => ({ ...result, currency: "USD" }),
            b2b: () => ({ ...result, supplyTypeCode: "SEZWP" }),
            state: () => ({ ...result, state: "ineligible" }),
            ancestry: () => ({ ...result, lineage: { ...result.lineage, itemCandidateEvidenceHash: "0".repeat(64) } }),
            order: () => ({ ...result, items: [first, { ...rest[0], lineage: { ...rest[0].lineage, roomNightOrdinal: "9" } }, ...rest.slice(1)] }),
            qty: () => ({ ...result, items: [{ ...first, irp: { ...first.irp, Qty: "2.000" } }, ...rest] }),
            unit: () => ({ ...result, items: [{ ...first, irp: { ...first.irp, Unit: "NOS" } }, ...rest] }),
            item: () => ({ ...result, items: [{ ...first, irp: { ...first.irp, TotAmt: "99.99" } }, ...rest] }),
            evidence: () => ({ ...result, evidenceHash: "0".repeat(64) }),
          };
          changed = mutations[${JSON.stringify(mutation)}]();
        }
        return ${JSON.stringify(mutation)} === "evidence" ? changed : bind(changed);
      },
    }));
    const target = await import(${JSON.stringify(targetPath)} + "?" + ${JSON.stringify(child)} + "-" + ${JSON.stringify(mutation)});
    const fixture = await import(${JSON.stringify(fixturePath)});
    try {
      target.composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(
        fixture.makeOrder419Input({ nights: 2, family: "cgst_utgst" }),
      );
      process.exit(1);
    } catch (error) {
      const exact = error?.name === "IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyValidationError" &&
        error?.message === ${JSON.stringify(expectedMessage)};
      if (!exact) console.error(error?.name, error?.message);
      process.exit(exact ? 0 : 2);
    }
  `;
  return Bun.spawnSync([Bun.which("bun") ?? process.execPath, "-e", script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), stdout: "pipe", stderr: "pipe",
  });
}

describe("Order426 India IRP validation-compatibility pre-document evidence assembly", () => {
  test("preserves fixed sections and replaces only ItemList with exact approved compatibility items", () => {
    const input = makeOrder419Input({ family: "cgst_utgst", nights: 2 });
    const preDocument = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);
    const compatibility = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input);
    const result = composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(input);

    expect(Object.keys(result)).toEqual([
      "state", "format", "submissionReady", "authenticatedProviderSandboxCertified",
      "explicitlyExcludedEvidence", "sections", "sectionsJson", "lineage",
      "sourceEvidenceHash", "evidenceHash",
    ]);
    expect(result.state).toBe(
      "incomplete_non_submit_ready_irp_accommodation_validation_compatibility_pre_document_evidence",
    );
    expect(result.format).toBe("irp_json_1_1");
    expect(result.submissionReady).toBeFalse();
    expect(result.authenticatedProviderSandboxCertified).toBeFalse();
    expect(result.explicitlyExcludedEvidence).toEqual(["DocDtls"]);
    expect(Object.keys(result.sections)).toEqual([
      "Version", "TranDtls", "SellerDtls", "BuyerDtls", "ItemList", "ValDtls",
    ]);
    expect(result.sections).toEqual({
      Version: preDocument.sections.Version,
      TranDtls: preDocument.sections.TranDtls,
      SellerDtls: preDocument.sections.SellerDtls,
      BuyerDtls: preDocument.sections.BuyerDtls,
      ItemList: compatibility.items.map((item) => item.irp),
      ValDtls: preDocument.sections.ValDtls,
    });
    expect(result.sectionsJson).toBe(JSON.stringify(result.sections));
    expect("DocDtls" in result.sections).toBeFalse();
  });

  test("supports every family and 1, multiple and 366 nights without recalculation", () => {
    const cases = [
      { family: "igst", aggregateRateBasisPoints: 500, nights: 1 },
      { family: "cgst_sgst", aggregateRateBasisPoints: 1200, nights: 3 },
      { family: "cgst_utgst", aggregateRateBasisPoints: 1800, nights: 366 },
    ] as const;
    for (const options of cases) {
      const input = makeOrder419Input(options);
      const preDocument = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);
      const compatibility = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input);
      const result = composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(input);
      expect(result.sections.ItemList).toEqual(compatibility.items.map((item) => item.irp));
      expect(result.sections.ItemList).toHaveLength(options.nights);
      expect(result.sections.ItemList.map(({ Qty: _qty, Unit: _unit, ...item }) => item))
        .toEqual(Array.from(preDocument.sections.ItemList));
      expect(result.sections.ValDtls).toEqual(preDocument.sections.ValDtls);
      expect(result.sections.ItemList.every((item) => item.Qty === "1.000" && item.Unit === "OTH")).toBeTrue();
    }
  });

  test("binds both independently composed children with exact ordered lineage", () => {
    const input = makeOrder419Input();
    const preDocument = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);
    const compatibility = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input);
    const result = composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(input);
    expect(Object.keys(result.lineage)).toEqual([
      "sourceEvidenceHash", "preDocumentEvidenceAssemblyHash",
      "serviceQuantityUqcCompatibilityEvidenceHash", "itemCandidatesEvidenceHash",
    ]);
    expect(result.lineage).toEqual({
      sourceEvidenceHash: input.source.evidenceHash,
      preDocumentEvidenceAssemblyHash: preDocument.evidenceHash,
      serviceQuantityUqcCompatibilityEvidenceHash: compatibility.evidenceHash,
      itemCandidatesEvidenceHash: compatibility.lineage.itemCandidateEvidenceHash,
    });
  });

  test("replays byte-equivalently, preserves input, freezes deeply and hides tenant identity", () => {
    const input = makeOrder419Input();
    const before = JSON.stringify(input);
    const first = composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(input);
    const replay = composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(input);
    expect(JSON.stringify(replay)).toBe(JSON.stringify(first));
    expect(JSON.stringify(input)).toBe(before);
    expect(allFrozen(first)).toBeTrue();
    expect(JSON.stringify(first)).not.toContain(TENANT);
    const otherTenant = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const other = composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(
      makeOrder419Input({}, otherTenant),
    );
    expect(other.sections).toEqual(first.sections);
    expect(other.sectionsJson).toBe(first.sectionsJson);
    expect(other.evidenceHash).not.toBe(first.evidenceHash);
    expect(JSON.stringify(other)).not.toContain(otherTenant);
  });

  test("rejects unsupported and hostile input graphs", () => {
    rejected(makeOrder419UnsupportedExportInput());
    const valid = makeOrder419Input();
    rejected({ ...valid });
    rejected(Object.freeze({ ...valid, source: new Proxy(valid.source, {}) }));
    const accessor = { tenantId: TENANT } as Mutable;
    Object.defineProperty(accessor, "source", { enumerable: true, get: () => valid.source });
    Object.freeze(accessor);
    rejected(accessor);
    const symbol = cloneOrder419(valid) as unknown as Mutable;
    Object.defineProperty(symbol, Symbol("authority"), { enumerable: true, value: "payload" });
    rejected(freeze(symbol));
    const sparse = cloneOrder419(valid) as unknown as Mutable;
    sparse.source.financialSource.roomNights.length = 2;
    rejected(freeze(sparse));
    const cycle = cloneOrder419(valid) as unknown as Mutable;
    cycle.source.loop = cycle.source;
    rejected(freeze(cycle));
  });

  const childCases = [
    ["pre", "source", "child source evidence is inconsistent"],
    ["pre", "lineageSource", "child source evidence is inconsistent"],
    ["pre", "count", "child item count evidence is inconsistent"],
    ["pre", "b2b", "child B2B or currency evidence is inconsistent"],
    ["pre", "taxScheme", "child B2B or currency evidence is inconsistent"],
    ["pre", "format", "child state evidence is inconsistent"],
    ["pre", "readiness", "child state evidence is inconsistent"],
    ["pre", "ancestry", "inherited item-candidate evidence is inconsistent"],
    ["pre", "evidence", "child evidence hash is inconsistent"],
    ["compatibility", "source", "child source evidence is inconsistent"],
    ["compatibility", "lineageSource", "child source evidence is inconsistent"],
    ["compatibility", "itemSource", "compatibility item order, family or source evidence is inconsistent"],
    ["compatibility", "count", "child item count evidence is inconsistent"],
    ["compatibility", "lineageCount", "child item count evidence is inconsistent"],
    ["compatibility", "family", "compatibility item order, family or source evidence is inconsistent"],
    ["compatibility", "itemFamily", "compatibility item order, family or source evidence is inconsistent"],
    ["compatibility", "currency", "child B2B or currency evidence is inconsistent"],
    ["compatibility", "b2b", "child B2B or currency evidence is inconsistent"],
    ["compatibility", "state", "child state evidence is inconsistent"],
    ["compatibility", "ancestry", "inherited item-candidate evidence is inconsistent"],
    ["compatibility", "order", "compatibility item order, family or source evidence is inconsistent"],
    ["compatibility", "qty", "compatibility item order, family or source evidence is inconsistent"],
    ["compatibility", "unit", "compatibility item order, family or source evidence is inconsistent"],
    ["compatibility", "item", "compatibility enrichment does not preserve pre-document items"],
    ["compatibility", "evidence", "child evidence hash is inconsistent"],
  ] as const;

  for (const [child, mutation, message] of childCases) {
    test(`rejects exact coherently rebound ${child} ${mutation} evidence`, () => {
      const probe = childProbe(child, mutation, message);
      if (probe.exitCode !== 0) console.error(probe.stdout?.toString(), probe.stderr?.toString());
      expect(probe.exitCode).toBe(0);
    });
  }
});
