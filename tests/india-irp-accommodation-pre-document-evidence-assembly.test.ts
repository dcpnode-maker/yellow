import { describe, expect, test } from "bun:test";
import {
  composeIndiaIrpAccommodationInvoiceValueCandidate,
  composeIndiaIrpAccommodationPartyDetailsCandidate,
  composeIndiaIrpAccommodationPreDocumentEvidenceAssembly,
  composeIndiaIrpAccommodationRoomNightItemCandidates,
  composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate,
} from "../src/contexts/tax-fiscal";
import {
  cloneOrder419,
  makeOrder419Input,
  makeOrder419UnsupportedExportInput,
  TENANT,
} from "./fixtures/india-irp-order419-fixture";

type Mutable = Record<string, any>;

function freeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    for (const child of Object.values(value as Mutable)) freeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function allFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) &&
    Object.values(value as Mutable).every((child) => allFrozen(child, seen));
}

function rejected(value: unknown): void {
  expect(() => composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(value as never)).toThrow();
}

function structuralKeys(value: unknown, keys = new Set<string>(), seen = new Set<object>()): Set<string> {
  if (value === null || typeof value !== "object" || seen.has(value)) return keys;
  seen.add(value);
  for (const key of Object.keys(value)) {
    keys.add(key);
    structuralKeys((value as Mutable)[key], keys, seen);
  }
  return keys;
}

describe("Order424 India IRP accommodation pre-document evidence assembly", () => {
  test("projects exact fixed-order approved child sections and stays explicitly non-submit-ready", () => {
    const input = makeOrder419Input({ family: "cgst_utgst", nights: 2 });
    const transaction = composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(input);
    const parties = composeIndiaIrpAccommodationPartyDetailsCandidate(input);
    const items = composeIndiaIrpAccommodationRoomNightItemCandidates(input);
    const values = composeIndiaIrpAccommodationInvoiceValueCandidate(input);
    const result = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);

    expect(Object.keys(result)).toEqual([
      "state", "format", "submissionReady", "explicitlyExcludedEvidence", "sections",
      "sectionsJson", "lineage", "sourceEvidenceHash", "evidenceHash",
    ]);
    expect(result.state).toBe(
      "incomplete_non_submit_ready_irp_accommodation_pre_document_evidence",
    );
    expect(result.format).toBe("irp_json_1_1");
    expect(result.submissionReady).toBeFalse();
    expect(result.explicitlyExcludedEvidence).toEqual([
      "DocDtls", "ItemList[].Qty", "ItemList[].Unit",
    ]);
    expect(Object.keys(result.sections)).toEqual([
      "Version", "TranDtls", "SellerDtls", "BuyerDtls", "ItemList", "ValDtls",
    ]);
    expect(result.sections).toEqual({
      Version: "1.1",
      TranDtls: transaction.payload.TranDtls,
      SellerDtls: parties.payload.SellerDtls,
      BuyerDtls: parties.payload.BuyerDtls,
      ItemList: items.items.map((item) => item.irp),
      ValDtls: values.valDtls,
    });
    expect(result.sectionsJson).toBe(JSON.stringify(result.sections));
    const keys = structuralKeys(result.sections);
    for (const forbidden of ["DocDtls", "Qty", "Unit", "RegRev", "IgstOnIntra", "EcmGstin"]) {
      expect(keys.has(forbidden)).toBeFalse();
    }
  });

  test("preserves exact 5/12/18-percent child bytes across families and 1/2/366 nights", () => {
    const cases = [
      { family: "igst", aggregateRateBasisPoints: 500, nights: 1 },
      { family: "cgst_sgst", aggregateRateBasisPoints: 1200, nights: 2 },
      { family: "cgst_utgst", aggregateRateBasisPoints: 1800, nights: 366 },
    ] as const;
    for (const options of cases) {
      const input = makeOrder419Input(options);
      const items = composeIndiaIrpAccommodationRoomNightItemCandidates(input);
      const values = composeIndiaIrpAccommodationInvoiceValueCandidate(input);
      const result = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);
      expect(JSON.stringify(result.sections.ItemList)).toBe(
        JSON.stringify(items.items.map((item) => item.irp)),
      );
      expect(JSON.stringify(result.sections.ValDtls)).toBe(JSON.stringify(values.valDtls));
      expect(result.sections.ItemList).toHaveLength(options.nights);
      expect(values.lineage.itemCount).toBe(options.nights);
      expect(values.lineage.componentFamily).toBe(options.family);
      expect(result.lineage.itemCandidatesEvidenceHash).toBe(items.evidenceHash);
      expect(result.lineage.invoiceValueEvidenceHash).toBe(values.evidenceHash);
    }
  });

  test("binds every approved child and common source with exact ordered lineage", () => {
    const input = makeOrder419Input();
    const transaction = composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(input);
    const parties = composeIndiaIrpAccommodationPartyDetailsCandidate(input);
    const items = composeIndiaIrpAccommodationRoomNightItemCandidates(input);
    const values = composeIndiaIrpAccommodationInvoiceValueCandidate(input);
    const result = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);
    expect(result.lineage).toEqual({
      sourceEvidenceHash: input.source.evidenceHash,
      transactionDetailsEvidenceHash: transaction.evidenceHash,
      partyDetailsEvidenceHash: parties.evidenceHash,
      itemCandidatesEvidenceHash: items.evidenceHash,
      invoiceValueEvidenceHash: values.evidenceHash,
    });
    expect(values.lineage.itemCandidateEvidenceHash).toBe(items.evidenceHash);
  });

  test("replay is byte-equivalent, preserves input, deeply freezes output and hides tenant", () => {
    const input = makeOrder419Input();
    const before = JSON.stringify(input);
    const first = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);
    const second = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(input)).toBe(before);
    expect(allFrozen(first)).toBeTrue();
    expect(JSON.stringify(first)).not.toContain(TENANT);

    const otherTenant = "20000000-0000-4000-8000-000000000002";
    const other = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(
      makeOrder419Input({}, otherTenant),
    );
    expect(other.sections).toEqual(first.sections);
    expect(other.sectionsJson).toBe(first.sectionsJson);
    expect(other.evidenceHash).not.toBe(first.evidenceHash);
    expect(other.sourceEvidenceHash).not.toBe(first.sourceEvidenceHash);
    expect(JSON.stringify(other)).not.toContain(otherTenant);
  });

  test("keeps all four approved child composers structurally load-bearing", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-irp-accommodation-pre-document-evidence-assembly.ts",
      import.meta.url,
    )).text();
    for (const child of [
      "composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate",
      "composeIndiaIrpAccommodationPartyDetailsCandidate",
      "composeIndiaIrpAccommodationRoomNightItemCandidates",
      "composeIndiaIrpAccommodationInvoiceValueCandidate",
    ]) {
      expect(source.match(new RegExp(`const \\w+ = ${child}\\(input\\);`, "g"))?.length).toBe(1);
    }
    for (const guard of [
      "transaction.sourceEvidenceHash !== sourceEvidenceHash",
      "parties.sourceEvidenceHash !== sourceEvidenceHash",
      "items.sourceEvidenceHash !== sourceEvidenceHash",
      "values.sourceEvidenceHash !== sourceEvidenceHash",
      "values.lineage.itemCandidateEvidenceHash !== items.evidenceHash",
      "values.lineage.itemCount !== items.items.length",
      "transaction.payload.TranDtls.SupTyp !== items.supplyTypeCode",
      "items.supplyTypeCode !== values.supplyTypeCode",
      "items.currency !== values.currency",
    ]) expect(source).toContain(guard);
  });

  test("rejects unsupported transaction ancestry and hostile input graphs", () => {
    rejected(makeOrder419UnsupportedExportInput());
    const valid = makeOrder419Input();
    rejected({ ...valid });
    rejected(Object.freeze({ ...valid, source: new Proxy(valid.source, {}) }));
    const accessor = { tenantId: TENANT } as Mutable;
    Object.defineProperty(accessor, "source", {
      enumerable: true,
      get: () => valid.source,
    });
    Object.freeze(accessor);
    rejected(accessor);
    const symbol = cloneOrder419(valid) as unknown as Mutable;
    Object.defineProperty(symbol, Symbol("authority"), { enumerable: true, value: "B2B" });
    rejected(freeze(symbol));
    const sparse = cloneOrder419(valid) as unknown as Mutable;
    sparse.source.financialSource.roomNights.length = 2;
    rejected(freeze(sparse));
    const cycle = cloneOrder419(valid) as unknown as Mutable;
    cycle.source.loop = cycle.source;
    rejected(freeze(cycle));
  });
});
