import { describe, expect, test } from "bun:test";

import {
  projectIssuedIndiaIrpWireCandidate,
  type IssuedIndiaIrpWireCandidateResult,
} from "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";

const DOCUMENT_ID = "00000000-0000-4000-8000-000000000440";

type Mutable = Record<string, any>;

function hash(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function issuedSource(family: "igst" | "split" = "igst", itemCount = 1): Mutable {
  const item = (index: number): Mutable => family === "igst"
    ? {
        SlNo: String(index + 1), IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH",
        UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00",
        IgstAmt: "5.00", TotItemVal: "105.00",
      }
    : {
        SlNo: String(index + 1), IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH",
        UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "12.00",
        CgstAmt: "6.00", SgstAmt: "6.00", TotItemVal: "112.00",
      };
  const total = family === "igst" ? 105 * itemCount : 112 * itemCount;
  const values = family === "igst"
    ? { AssVal: `${100 * itemCount}.00`, IgstVal: `${5 * itemCount}.00`, TotInvVal: `${total}.00` }
    : { AssVal: `${100 * itemCount}.00`, CgstVal: `${6 * itemCount}.00`, SgstVal: `${6 * itemCount}.00`, TotInvVal: `${total}.00` };
  return {
    BuyerDtls: {
      Pin: 400001, Loc: "Mumbai", Pos: "27", Stcd: "27", LglNm: "Buyer & Sons",
      Gstin: "27AAPFU0939F1ZV", Addr1: "1 Buyer Road", TrdNm: "Buyer Trading",
    },
    Version: "1.1",
    ItemList: Array.from({ length: itemCount }, (_, index) => item(index)),
    TranDtls: { SupTyp: "B2B", TaxSch: "GST" },
    SellerDtls: {
      Pin: 560001, Loc: "Bengaluru", Stcd: "29", LglNm: "Hôtel Yellow",
      Gstin: "29AAPFU0939F1ZR", Addr1: "1 Main Road",
    },
    ValDtls: values,
    DocDtls: { No: "INV/44-1", Dt: "06/09/2044", Typ: "INV" },
  };
}

function projectContent(contentJson: string): IssuedIndiaIrpWireCandidateResult {
  return projectIssuedIndiaIrpWireCandidate({
    documentId: DOCUMENT_ID,
    documentSha256: hash(contentJson),
    contentJson,
  });
}

function projectSource(source: Mutable): IssuedIndiaIrpWireCandidateResult {
  return projectContent(JSON.stringify(source));
}

function expectInvalid(source: Mutable): void {
  expect(projectSource(source)).toEqual({
    ok: false,
    error: { code: "invalid_issued_document", message: "issued fiscal document is invalid" },
  });
}

describe("Order440 issued India IRP wire candidate", () => {
  test("projects the exact seven issued sections with fixed numeric serialization", () => {
    const source = issuedSource();
    const before = JSON.stringify(source);
    const result = projectSource(source);
    expect(result.ok).toBeTrue();
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toEqual({
      kind: "india_irp_1_1_issued_wire_candidate",
      documentId: DOCUMENT_ID,
      documentSha256: hash(before),
      wireJson: '{"Version":"1.1","TranDtls":{"TaxSch":"GST","SupTyp":"B2B"},' +
        '"DocDtls":{"Typ":"INV","No":"INV/44-1","Dt":"06/09/2044"},' +
        '"SellerDtls":{"Gstin":"29AAPFU0939F1ZR","LglNm":"Hôtel Yellow","Addr1":"1 Main Road","Loc":"Bengaluru","Pin":560001,"Stcd":"29"},' +
        '"BuyerDtls":{"Gstin":"27AAPFU0939F1ZV","LglNm":"Buyer & Sons","TrdNm":"Buyer Trading","Addr1":"1 Buyer Road","Loc":"Mumbai","Pin":400001,"Stcd":"27","Pos":"27"},' +
        '"ItemList":[{"SlNo":"1","IsServc":"Y","HsnCd":"996311","Qty":1.000,"Unit":"OTH","UnitPrice":100.00,"TotAmt":100.00,"AssAmt":100.00,"GstRt":5.00,"IgstAmt":5.00,"TotItemVal":105.00}],' +
        '"ValDtls":{"AssVal":100.00,"IgstVal":5.00,"TotInvVal":105.00}}',
      wireSha256: hash(result.value.wireJson),
      authenticatedProviderSandboxCertified: false,
    });
    expect(result.value.wireJson).not.toContain('"100.00"');
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.isFrozen(result)).toBeTrue();
    expect(Object.isFrozen(result.value)).toBeTrue();
  });

  test("preserves exact source bytes for integrity while producing replay-stable wire bytes", () => {
    const compact = JSON.stringify(issuedSource("split"));
    const spaced = `  ${compact.replaceAll(":", ": ")}\n`;
    const first = projectContent(spaced);
    const second = projectContent(spaced);
    expect(first).toEqual(second);
    expect(first.ok && first.value.documentSha256).toBe(hash(spaced));
    expect(first.ok && first.value.wireSha256).toBe(first.ok ? hash(first.value.wireJson) : "");
    expect(first.ok && first.value.wireJson).toContain('"CgstAmt":6.00,"SgstAmt":6.00');
  });

  test("checks the exact original UTF-8 hash before parsing", () => {
    const invalidJson = "{guest-secret";
    const result = projectIssuedIndiaIrpWireCandidate({
      documentId: DOCUMENT_ID,
      documentSha256: "0".repeat(64),
      contentJson: invalidJson,
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "source_hash_mismatch", message: "issued fiscal document hash does not match" },
    });
    expect(JSON.stringify(result)).not.toContain("guest-secret");
  });

  test("rejects proxy, accessor, symbol, extra and malformed input without invoking accessors", () => {
    const contentJson = JSON.stringify(issuedSource());
    const valid = { documentId: DOCUMENT_ID, documentSha256: hash(contentJson), contentJson };
    let reads = 0;
    const accessor = { documentId: DOCUMENT_ID, documentSha256: hash(contentJson) } as Mutable;
    Object.defineProperty(accessor, "contentJson", { enumerable: true, get: () => { reads += 1; return contentJson; } });
    const symbol = { ...valid } as Mutable;
    Object.defineProperty(symbol, Symbol("authority"), { enumerable: true, value: true });
    const revocable = Proxy.revocable(valid, {});
    revocable.revoke();
    for (const candidate of [null, { ...valid, extra: true }, new Proxy(valid, {}), revocable.proxy, accessor, symbol]) {
      expect(projectIssuedIndiaIrpWireCandidate(candidate)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    }
    expect(reads).toBe(0);
  });

  test("rejects duplicate decoded keys and unsupported issued shapes", () => {
    const source = JSON.stringify(issuedSource());
    const duplicate = source.replace('"Version":"1.1"', '"Version":"1.1","\\u0056ersion":"1.1"');
    expect(projectContent(duplicate)).toMatchObject({ ok: false, error: { code: "invalid_issued_document" } });

    const cases: ((source: Mutable) => void)[] = [
      (candidate) => { candidate.extra = true; },
      (candidate) => { delete candidate.DocDtls; },
      (candidate) => { candidate.DocDtls.Typ = "CRN"; },
      (candidate) => { candidate.DocDtls.Dt = "31/02/2044"; },
      (candidate) => { candidate.TranDtls.SupTyp = "EXPWP"; },
      (candidate) => { candidate.SellerDtls.Gstin = "29AAPFU0939F1ZQ"; },
      (candidate) => { candidate.BuyerDtls.Pos = "25"; },
      (candidate) => { candidate.ItemList[0].Qty = "1.00"; },
      (candidate) => { candidate.ItemList[0].Unit = "NOS"; },
      (candidate) => { candidate.ItemList[0].Discount = "0.00"; },
    ];
    for (const mutate of cases) {
      const candidate = issuedSource();
      mutate(candidate);
      expectInvalid(candidate);
    }
  });

  test("uses bigint conservation without recalculating tax from the rate", () => {
    const accepted = issuedSource();
    accepted.ItemList[0].GstRt = "18.00";
    expect(projectSource(accepted).ok).toBeTrue();

    const cases: ((source: Mutable) => void)[] = [
      (source) => { source.ItemList[0].TotAmt = "99.99"; },
      (source) => { source.ItemList[0].TotItemVal = "105.01"; },
      (source) => { source.ValDtls.AssVal = "99.99"; },
      (source) => { source.ValDtls.IgstVal = "5.01"; },
      (source) => { source.ValDtls.TotInvVal = "105.01"; },
    ];
    for (const mutate of cases) {
      const source = issuedSource();
      mutate(source);
      expectInvalid(source);
    }
  });

  test("preserves the 14,2 lexical ceiling and rejects wider or noncanonical decimals", () => {
    const ceiling = issuedSource();
    for (const key of ["UnitPrice", "TotAmt", "AssAmt", "TotItemVal"]) ceiling.ItemList[0][key] = "99999999999999.99";
    ceiling.ItemList[0].IgstAmt = "0.00";
    ceiling.ValDtls = { AssVal: "99999999999999.99", IgstVal: "0.00", TotInvVal: "99999999999999.99" };
    const result = projectSource(ceiling);
    expect(result.ok && result.value.wireJson).toContain('"UnitPrice":99999999999999.99');

    for (const invalidMoney of ["100", "01.00", "1.0", "1e2", "100000000000000.00"]) {
      const source = issuedSource();
      source.ItemList[0].UnitPrice = invalidMoney;
      expectInvalid(source);
    }
  });

  test("accepts exactly 366 dense items and rejects larger or mixed-family lists", () => {
    expect(projectSource(issuedSource("igst", 366)).ok).toBeTrue();
    expectInvalid(issuedSource("igst", 367));
    const mixed = issuedSource("igst", 2);
    mixed.ItemList[1] = issuedSource("split").ItemList[0];
    mixed.ItemList[1].SlNo = "2";
    expectInvalid(mixed);
  });

  test("bounds source bytes and returns only generic errors", () => {
    const oversized = "x".repeat(1024 * 1024 + 1);
    const result = projectContent(oversized);
    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_issued_document", message: "issued fiscal document is invalid" },
    });
    expect(Object.isFrozen(result)).toBeTrue();
    expect(!result.ok && Object.isFrozen(result.error)).toBeTrue();
  });

  test("rejects lone UTF-16 surrogates while preserving valid Unicode", () => {
    const validUnicode = issuedSource();
    validUnicode.SellerDtls.LglNm = "Yellow 😀 Hotel";
    const accepted = projectSource(validUnicode);
    expect(accepted.ok && accepted.value.wireJson).toContain("Yellow 😀 Hotel");

    for (const malformed of ["Yellow \ud800 Hotel", "Yellow \udc00 Hotel"]) {
      const source = issuedSource();
      source.SellerDtls.LglNm = malformed;
      expectInvalid(source);
    }
    const escapedLoneSurrogate = JSON.stringify(issuedSource()).replace("Hôtel Yellow", "Yellow \\ud800 Hotel");
    expect(projectContent(escapedLoneSurrogate)).toMatchObject({
      ok: false,
      error: { code: "invalid_issued_document" },
    });
  });
});
