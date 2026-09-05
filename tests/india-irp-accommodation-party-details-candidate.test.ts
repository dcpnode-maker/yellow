import { describe, expect, test } from "bun:test";
import {
  buildIndiaIrpBuyerDetails,
  buildIndiaIrpSellerDetails,
  composeIndiaIrpAccommodationPartyDetailsCandidate,
  type IndiaIrpAccommodationSourceResult,
} from "../src/contexts/tax-fiscal";
import {
  cloneOrder419,
  makeOrder419Input,
  makeOrder419Source,
  rehashOrder419Source,
} from "./fixtures/india-irp-order419-fixture";

const TENANT = "10000000-0000-4000-8000-000000000001";
type Mutable = Record<string, any>;

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function digestText(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

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
  return Object.isFrozen(value) && Object.values(value as Mutable).every((child) => allFrozen(child, seen));
}

function withTradeNames(sellerTradeName: string | null, buyerTradeName: string | null) {
  const source = cloneOrder419(makeOrder419Source()) as unknown as Mutable;
  source.sellerRegistration.tradeName = sellerTradeName;
  const { evidenceHash: _sellerHash, ...sellerBody } = source.sellerRegistration;
  source.sellerRegistration = {
    ...sellerBody,
    evidenceHash: digest({
      registrationId: sellerBody.registrationId,
      tenantId: TENANT,
      propertyNode: sellerBody.propertyNode,
      scheme: sellerBody.scheme,
      currency: sellerBody.currency,
      jurisdiction: sellerBody.jurisdiction,
      gstin: sellerBody.gstin,
      stateCode: sellerBody.stateCode,
      legalName: sellerBody.legalName,
      tradeName: sellerBody.tradeName,
      addressLine: sellerBody.addressLine,
      locality: sellerBody.locality,
      postalCode: sellerBody.postalCode,
    }),
  };
  source.sellerDetails = buildIndiaIrpSellerDetails(freeze(source.sellerRegistration));

  source.recipientRegistration.tradeName = buyerTradeName;
  const { evidenceHash: _buyerHash, ...buyerBody } = source.recipientRegistration;
  source.recipientRegistration = {
    ...buyerBody,
    evidenceHash: digest({
      registrationId: buyerBody.registrationId,
      tenantId: TENANT,
      partyId: buyerBody.partyId,
      scheme: buyerBody.scheme,
      gstin: buyerBody.gstin,
      stateCode: buyerBody.stateCode,
      legalName: buyerBody.legalName,
      tradeName: buyerBody.tradeName,
      addressLine1: buyerBody.addressLine1,
      locality: buyerBody.locality,
      pin: buyerBody.pin,
    }),
  };
  source.buyerDetails = buildIndiaIrpBuyerDetails(freeze(source.recipientRegistration));

  source.placeOfSupply.supplier.evidenceHash = source.sellerRegistration.evidenceHash;
  source.placeOfSupply.recipient.evidenceHash = source.recipientRegistration.evidenceHash;
  const { candidateJson: _json, candidateHash: _hash, ...placeBody } = source.placeOfSupply;
  source.placeOfSupply = {
    ...placeBody,
    candidateJson: JSON.stringify(placeBody),
    candidateHash: digest({ tenantId: TENANT, candidate: placeBody }),
  };
  return freeze({ tenantId: TENANT, source: rehashOrder419Source(
    freeze(source) as IndiaIrpAccommodationSourceResult,
  ) });
}

function rejected(value: unknown): void {
  expect(() => composeIndiaIrpAccommodationPartyDetailsCandidate(value as never)).toThrow();
}

describe("Order422 India IRP accommodation party details", () => {
  test("emits exact fixed-order seller and buyer-with-POS payload", () => {
    const input = makeOrder419Input();
    const result = composeIndiaIrpAccommodationPartyDetailsCandidate(input);
    expect(Object.keys(result)).toEqual([
      "state", "format", "payload", "payloadJson", "lineage", "sourceEvidenceHash", "evidenceHash",
    ]);
    expect(Object.keys(result.payload)).toEqual(["SellerDtls", "BuyerDtls"]);
    expect(result.payload.SellerDtls).toEqual(input.source.sellerDetails.payload.SellerDtls);
    expect(result.payload.BuyerDtls).toEqual({
      ...input.source.buyerDetails.payload.BuyerDtls,
      Pos: input.source.placeOfSupply.pos,
    });
    expect(Object.keys(result.payload.BuyerDtls).at(-1)).toBe("Pos");
    expect(result.payloadJson).toBe(JSON.stringify(result.payload));
  });

  test("preserves or omits each independently approved trade name", () => {
    const present = composeIndiaIrpAccommodationPartyDetailsCandidate(withTradeNames("Seller Trade", "Buyer Trade"));
    expect(present.payload.SellerDtls.TrdNm).toBe("Seller Trade");
    expect(present.payload.BuyerDtls.TrdNm).toBe("Buyer Trade");
    expect(Object.keys(present.payload.SellerDtls)).toEqual(["Gstin", "LglNm", "TrdNm", "Addr1", "Loc", "Pin", "Stcd"]);
    expect(Object.keys(present.payload.BuyerDtls)).toEqual(["Gstin", "LglNm", "TrdNm", "Addr1", "Loc", "Pin", "Stcd", "Pos"]);

    const absent = composeIndiaIrpAccommodationPartyDetailsCandidate(withTradeNames(null, null));
    expect("TrdNm" in absent.payload.SellerDtls).toBeFalse();
    expect("TrdNm" in absent.payload.BuyerDtls).toBeFalse();
    expect(Object.keys(absent.payload.SellerDtls)).toEqual(["Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd"]);
    expect(Object.keys(absent.payload.BuyerDtls)).toEqual(["Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd", "Pos"]);
  });

  test("binds exact lineage, remains byte-stable, deeply frozen and tenant-hidden", () => {
    const input = makeOrder419Input();
    const before = JSON.stringify(input);
    const first = composeIndiaIrpAccommodationPartyDetailsCandidate(input);
    const second = composeIndiaIrpAccommodationPartyDetailsCandidate(input);
    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
    expect(allFrozen(first)).toBeTrue();
    expect(first.lineage).toEqual({
      sourceEvidenceHash: input.source.evidenceHash,
      sellerPayloadHash: input.source.sellerDetails.payloadHash,
      buyerPayloadHash: input.source.buyerDetails.payloadHash,
      placeOfSupplyCandidateHash: input.source.placeOfSupply.candidateHash,
    });
    expect(JSON.stringify(first)).not.toContain(TENANT);
  });

  test("tenant changes authority hashes but never party payload", () => {
    const otherTenant = "20000000-0000-4000-8000-000000000002";
    const first = composeIndiaIrpAccommodationPartyDetailsCandidate(makeOrder419Input({}, TENANT));
    const second = composeIndiaIrpAccommodationPartyDetailsCandidate(makeOrder419Input({}, otherTenant));
    expect(second.payload).toEqual(first.payload);
    expect(second.payloadJson).toBe(first.payloadJson);
    expect(second.state).toBe(first.state);
    expect(second.format).toBe(first.format);
    expect(second.evidenceHash).not.toBe(first.evidenceHash);
    expect(second.sourceEvidenceHash).not.toBe(first.sourceEvidenceHash);
    expect(second.lineage.placeOfSupplyCandidateHash).not.toBe(first.lineage.placeOfSupplyCandidateHash);
    expect(JSON.stringify(second)).not.toContain(otherTenant);
  });

  test("Order414 validation is load-bearing for coherently rehashed party forgery", () => {
    const raw = cloneOrder419(makeOrder419Input()) as unknown as Mutable;
    raw.source.sellerDetails.payload.SellerDtls.LglNm = "Forged Hotel";
    raw.source.sellerDetails.payloadJson = JSON.stringify(raw.source.sellerDetails.payload);
    raw.source.sellerDetails.payloadHash = digestText(raw.source.sellerDetails.payloadJson);
    raw.source = cloneOrder419(rehashOrder419Source(freeze(raw.source) as IndiaIrpAccommodationSourceResult));
    rejected(freeze(raw));
  });

  test("rejects caller POS, stale hashes and hostile input graphs", () => {
    const surplus = cloneOrder419(makeOrder419Input()) as unknown as Mutable;
    surplus.pos = "01";
    rejected(freeze(surplus));

    const stale = cloneOrder419(makeOrder419Input()) as unknown as Mutable;
    stale.source.placeOfSupply.pos = "01";
    rejected(freeze(stale));

    const valid = makeOrder419Input();
    rejected({ ...valid });
    rejected(Object.freeze({ ...valid, source: new Proxy(valid.source, {}) }));
    const accessor = { tenantId: TENANT } as Mutable;
    Object.defineProperty(accessor, "source", { enumerable: true, get: () => valid.source });
    Object.freeze(accessor);
    rejected(accessor);
    const symbol = cloneOrder419(valid) as unknown as Mutable;
    Object.defineProperty(symbol, Symbol("authority"), { enumerable: true, value: "01" });
    rejected(freeze(symbol));
    const sparse = cloneOrder419(valid) as unknown as Mutable;
    sparse.source.financialSource.roomNights.length = 2;
    rejected(freeze(sparse));
    const cycle = cloneOrder419(valid) as unknown as Mutable;
    cycle.source.loop = cycle.source;
    rejected(freeze(cycle));
  });
});
