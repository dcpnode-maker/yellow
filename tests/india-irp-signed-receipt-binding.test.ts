import { beforeAll, describe, expect, test } from "bun:test";

import type { FiscalExactJsonValue } from "../src/contexts/tax-fiscal/fiscal-exact-json";
import { FISCAL_SIGNED_JWS_LIMITS } from "../src/contexts/tax-fiscal/fiscal-signed-jws";
import {
  INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS,
  INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION,
  createIndiaIrpSignedReceiptBindingVerifier,
  type IndiaIrpSignedReceiptBindingVerifier,
} from "../src/contexts/tax-fiscal/india-irp-signed-receipt-binding";
import { projectIssuedIndiaIrpWireCandidate } from
  "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";

const DOCUMENT_ID = "00000000-0000-4000-8000-000000000206";
const ISSUER = "YELLOW-FICTIONAL-IRP";
const KEY_ID = "yellow-fictional-rsa";
const NOW = 1_800_000_000_000;
const IRN = "a1".repeat(32);
const ACK_NO = "9223372036854775807";
const ACK_DT = "2044-09-06 12:34:56";
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Mutable = Record<string, any>;
type Family = "igst" | "split";

interface ItemSpec {
  readonly hsn?: string;
  readonly assessableMinor?: bigint;
  readonly igstMinor?: bigint;
  readonly cgstMinor?: bigint;
  readonly sgstMinor?: bigint;
}

interface ReceiptOptions {
  readonly invoiceInner?: string;
  readonly qrInner?: string;
  readonly issuer?: string;
  readonly pair?: CryptoKeyPair;
  readonly headerKid?: string;
  readonly irn?: string;
  readonly ackNo?: string;
  readonly ackDt?: string;
}

let signingPair: CryptoKeyPair;
let wrongPair: CryptoKeyPair;
let signingSpki = "";
let wrongSpki = "";

beforeAll(async () => {
  [signingPair, wrongPair] = await Promise.all([generateRsa(), generateRsa()]);
  [signingSpki, wrongSpki] = await Promise.all([
    exportSpki(signingPair.publicKey), exportSpki(wrongPair.publicKey),
  ]);
}, 30_000);

function generateRsa(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
  }, true, ["sign", "verify"]);
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(bytes: Uint8Array): string {
  return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function exportSpki(key: CryptoKey): Promise<string> {
  return base64(new Uint8Array(await crypto.subtle.exportKey("spki", key)));
}

function trust(spki = signingSpki, id = KEY_ID, start = NOW - 1000, end = NOW + 1000): string {
  return JSON.stringify({
    version: "yellow-fictional-trust-v1",
    keys: [{ id, spkiDerBase64: spki, notBeforeUnixMs: start, notAfterUnixMs: end }],
  });
}

function configuration(
  trustBundleJson = trust(),
  issuer = ISSUER,
  profileVersion: string = INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION,
): string {
  return JSON.stringify({ profileVersion, issuer, trustBundleJson });
}

async function verifier(config = configuration()): Promise<IndiaIrpSignedReceiptBindingVerifier> {
  const result = await createIndiaIrpSignedReceiptBindingVerifier(config);
  if (!result.ok) throw new Error(`test binding configuration failed: ${result.error.code}`);
  return result.value;
}

function gstin(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const point = GST_ALPHABET.indexOf(body[index]!);
    const product = factor * point;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(product / 36) + product % 36;
  }
  return body + GST_ALPHABET[(36 - sum % 36) % 36]!;
}

const SELLER_GSTIN = gstin("29ABCDE1234F1Z");
const BUYER_GSTIN = gstin("27FGHIJ5678K1Z");

function money(minor: bigint): string {
  return `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
}

function issuedSource(family: Family = "igst", specs: readonly ItemSpec[] = [{}]): Mutable {
  let assessableTotal = 0n;
  let igstTotal = 0n;
  let cgstTotal = 0n;
  let sgstTotal = 0n;
  const items = specs.map((spec, index) => {
    const assessable = spec.assessableMinor ?? 10_000n;
    const igst = family === "igst" ? spec.igstMinor ?? 500n : 0n;
    const cgst = family === "split" ? spec.cgstMinor ?? 600n : 0n;
    const sgst = family === "split" ? spec.sgstMinor ?? 600n : 0n;
    assessableTotal += assessable;
    igstTotal += igst;
    cgstTotal += cgst;
    sgstTotal += sgst;
    return {
      SlNo: String(index + 1), IsServc: "Y", HsnCd: spec.hsn ?? "996311", Qty: "1.000", Unit: "OTH",
      UnitPrice: money(assessable), TotAmt: money(assessable), AssAmt: money(assessable),
      GstRt: family === "igst" ? "5.00" : "12.00",
      ...(family === "igst" ? { IgstAmt: money(igst) } : { CgstAmt: money(cgst), SgstAmt: money(sgst) }),
      TotItemVal: money(assessable + igst + cgst + sgst),
    };
  });
  return {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "INV", No: "INV/206-1", Dt: "06/09/2044" },
    SellerDtls: {
      Gstin: SELLER_GSTIN, LglNm: "Hôtel Yellow Fictional", Addr1: "1 Fictional Road",
      Loc: "Bengaluru", Pin: 560001, Stcd: "29",
    },
    BuyerDtls: {
      Gstin: BUYER_GSTIN, LglNm: "Fictional Buyer", TrdNm: "Fictional Buyer Trading",
      Addr1: "2 Fictional Road", Loc: "Mumbai", Pin: 400001, Stcd: "27", Pos: "27",
    },
    ItemList: items,
    ValDtls: family === "igst"
      ? { AssVal: money(assessableTotal), IgstVal: money(igstTotal), TotInvVal: money(assessableTotal + igstTotal) }
      : { AssVal: money(assessableTotal), CgstVal: money(cgstTotal), SgstVal: money(sgstTotal),
          TotInvVal: money(assessableTotal + cgstTotal + sgstTotal) },
  };
}

function hash(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function project(source: Mutable): { contentJson: string; wireJson: string; wireSha256: string } {
  const contentJson = JSON.stringify(source);
  const result = projectIssuedIndiaIrpWireCandidate({
    documentId: DOCUMENT_ID, documentSha256: hash(contentJson), contentJson,
  });
  if (!result.ok) throw new Error(`test issued source failed: ${result.error.code}`);
  return { contentJson, wireJson: result.value.wireJson, wireSha256: result.value.wireSha256 };
}

function invoiceInner(wireJson: string, ackNo = ACK_NO, ackDt = ACK_DT, irn = IRN): string {
  return `${wireJson.slice(0, -1)},"AckNo":${ackNo},"AckDt":${JSON.stringify(ackDt)},"Irn":${JSON.stringify(irn)}}`;
}

function maximumHsnFromSource(source: Mutable): string {
  let maximum = -1n;
  let hsn = "";
  for (const item of source.ItemList as Mutable[]) {
    const minor = BigInt((item.AssAmt as string).replace(".", ""));
    if (minor > maximum) { maximum = minor; hsn = item.HsnCd; }
  }
  return hsn;
}

function qrInner(
  source: Mutable,
  options: { readonly total?: string; readonly count?: string; readonly hsn?: string;
    readonly irn?: string; readonly irnDt?: string | null } = {},
): string {
  const fields = [
    `"SellerGstin":${JSON.stringify(source.SellerDtls.Gstin)}`,
    `"BuyerGstin":${JSON.stringify(source.BuyerDtls.Gstin)}`,
    `"DocNo":${JSON.stringify(source.DocDtls.No)}`,
    `"DocTyp":${JSON.stringify(source.DocDtls.Typ)}`,
    `"DocDt":${JSON.stringify(source.DocDtls.Dt)}`,
    `"TotInvVal":${options.total ?? source.ValDtls.TotInvVal}`,
    `"ItemCnt":${options.count ?? String(source.ItemList.length)}`,
    `"MainHsnCode":${JSON.stringify(options.hsn ?? maximumHsnFromSource(source))}`,
    `"Irn":${JSON.stringify(options.irn ?? IRN)}`,
  ];
  if (options.irnDt !== undefined) fields.push(`"IrnDt":${JSON.stringify(options.irnDt)}`);
  return `{${fields.join(",")}}`;
}

async function signPayload(payloadText: string, pair = signingPair, kid = KEY_ID): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid })));
  const payload = base64Url(encoder.encode(payloadText));
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", pair.privateKey, encoder.encode(signingInput),
  ));
  return `${signingInput}.${base64Url(signature)}`;
}

function signInner(inner: string, issuer = ISSUER, pair = signingPair, kid = KEY_ID): Promise<string> {
  return signPayload(JSON.stringify({ data: inner, iss: issuer }), pair, kid);
}

async function receiptInput(source: Mutable, options: ReceiptOptions = {}): Promise<Mutable> {
  const projected = project(source);
  const irn = options.irn ?? IRN;
  const ackNo = options.ackNo ?? ACK_NO;
  const ackDt = options.ackDt ?? ACK_DT;
  const [signedInvoice, signedQRCode] = await Promise.all([
    signInner(options.invoiceInner ?? invoiceInner(projected.wireJson, ackNo, ackDt, irn),
      options.issuer, options.pair, options.headerKid),
    signInner(options.qrInner ?? qrInner(source, { irn }), options.issuer, options.pair, options.headerKid),
  ]);
  return {
    documentId: DOCUMENT_ID, documentSha256: hash(projected.contentJson), contentJson: projected.contentJson,
    signedInvoice, signedQRCode, irn, ackNo, ackDt,
  };
}

async function code(target: IndiaIrpSignedReceiptBindingVerifier, input: unknown, instant: unknown = NOW): Promise<string> {
  const result = await target.verify(input, instant);
  if (result.ok) throw new Error("invalid signed receipt unexpectedly bound");
  return result.error.code;
}

async function factoryCode(input: unknown): Promise<string> {
  const result = await createIndiaIrpSignedReceiptBindingVerifier(input);
  if (result.ok) throw new Error("invalid binding configuration unexpectedly succeeded");
  return result.error.code;
}

function replaceOnce(source: string, before: string, after: string): string {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`test fixture marker absent: ${before}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function expectFrozenJson(value: FiscalExactJsonValue): void {
  expect(Object.isFrozen(value)).toBe(true);
  if (value.kind === "array") {
    expect(Object.isFrozen(value.items)).toBe(true);
    for (const item of value.items) expectFrozenJson(item);
  } else if (value.kind === "object") {
    expect(Object.getPrototypeOf(value.members)).toBeNull();
    expect(Object.isFrozen(value.members)).toBe(true);
    for (const member of Object.values(value.members)) expectFrozenJson(member);
  }
}

describe("Order440/Q206 original invoice and signed pair binding", () => {
  test("binds genuine IGST and split signed pairs as source-bound, not provider acceptance", async () => {
    const target = await verifier();
    for (const family of ["igst", "split"] as const) {
      const source = issuedSource(family);
      const input = await receiptInput(source);
      const result = await target.verify(input, NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error.code);
      const projected = project(source);
      expect(result.value).toMatchObject({
        kind: "india_irp_signed_receipt_binding_v1",
        profileVersion: INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION,
        issuer: ISSUER,
        verificationUnixMs: NOW,
        documentId: DOCUMENT_ID,
        documentSha256: hash(projected.contentJson),
        wireJson: projected.wireJson,
        wireSha256: projected.wireSha256,
        irn: IRN, ackNo: ACK_NO, ackDt: ACK_DT,
        providerAcceptanceEstablished: false,
        authenticatedProviderSandboxCertified: false,
      });
      expect(result.value.signedInvoice.compact).toBe(input.signedInvoice);
      expect(result.value.signedQRCode.compact).toBe(input.signedQRCode);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.signedInvoice)).toBe(true);
      expect(Object.isFrozen(result.value.signedQRCode)).toBe(true);
      expectFrozenJson(result.value.signedInvoice.payload);
      expectFrozenJson(result.value.signedQRCode.payload);
    }
    expect(Object.keys(target).sort()).toEqual(["issuer", "kind", "profileVersion", "verify"]);
    expect(Object.isFrozen(target)).toBe(true);
  }, 30_000);

  test("binds the maximum 366 original lines and uses line count rather than distinct HSN count", async () => {
    const source = issuedSource("igst", Array.from({ length: 366 }, (_, index) => ({
      hsn: index % 2 === 0 ? "996311" : "996312",
      ...(index === 365 ? { assessableMinor: 20_000n } : {}),
    })));
    const result = await (await verifier()).verify(await receiptInput(source), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.wireJson.match(/"SlNo":/gu)).toHaveLength(366);
  }, 30_000);

  test("compares exact decimals mathematically without rounding money or acknowledgement digits", async () => {
    const source = issuedSource();
    const wire = project(source).wireJson;
    const exactNumericLimit = `1${"0".repeat(122)}e-122`;
    expect(exactNumericLimit).toHaveLength(INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.maxNumericLexemeCharacters);
    const equivalentWire = wire.replaceAll(":100.00", ":1e2").replaceAll(":5.00", ":50e-1")
      .replaceAll(":105.00", ":1.0500e2").replace('"Qty":1.000', `"Qty":${exactNumericLimit}`)
      .replace('{"TaxSch":"GST","SupTyp":"B2B"}', '{"SupTyp":"B2B","TaxSch":"GST"}');
    const input = await receiptInput(source, {
      invoiceInner: invoiceInner(equivalentWire, `${ACK_NO}e0`),
      qrInner: qrInner(source, { total: "105000e-3", count: "10e-1" }),
    });
    const result = await (await verifier()).verify(input, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.ackNo).toBe(ACK_NO);
    expect(result.value.wireJson).toBe(wire);
  });

  test("rejects unsafe changed-cent and acknowledgement collisions in newly valid signatures", async () => {
    const target = await verifier();
    const originalAmount = "90071992547409.91";
    const changedAmount = "90071992547409.90";
    expect(Number(originalAmount)).toBe(Number(changedAmount));
    const parsedCollision = JSON.parse(`[${originalAmount},${changedAmount}]`) as [number, number];
    expect(parsedCollision[0]).toBe(parsedCollision[1]);
    const costly = issuedSource("igst", [{ assessableMinor: 9_007_199_254_740_991n, igstMinor: 0n }]);
    const costlyWire = project(costly).wireJson;
    expect(costlyWire).toContain(`:${originalAmount}`);
    expect((await target.verify(await receiptInput(costly), NOW)).ok).toBe(true);
    const changedCentInvoice = replaceOnce(costlyWire, `:${originalAmount}`, `:${changedAmount}`);
    expect(await code(target, await receiptInput(costly, { invoiceInner: invoiceInner(changedCentInvoice) })))
      .toBe("receipt_binding_mismatch");
    expect(await code(target, await receiptInput(costly, {
      qrInner: qrInner(costly, { total: changedAmount }),
    })))
      .toBe("receipt_binding_mismatch");
    const expectedAck = "9007199254740992";
    const input = await receiptInput(issuedSource(), {
      ackNo: expectedAck,
      invoiceInner: invoiceInner(project(issuedSource()).wireJson, "9007199254740993"),
    });
    expect(await code(target, input)).toBe("receipt_binding_mismatch");
  });

  test("rejects every original identity, line, tax, total and receipt metadata mismatch", async () => {
    const target = await verifier();
    const source = issuedSource();
    const wire = project(source).wireJson;
    const mutations: readonly [string, string][] = [
      ['"Version":"1.1"', '"Version":"1.0"'], ['"TaxSch":"GST"', '"TaxSch":"VAT"'],
      ['"SupTyp":"B2B"', '"SupTyp":"SEZWP"'], ['"Typ":"INV"', '"Typ":"CRN"'],
      ['"No":"INV/206-1"', '"No":"INV/206-2"'], ['"Dt":"06/09/2044"', '"Dt":"07/09/2044"'],
      [`"Gstin":"${SELLER_GSTIN}"`, '"Gstin":"29ABCDE1234F1ZA"'],
      ['"LglNm":"Hôtel Yellow Fictional"', '"LglNm":"Different Seller"'],
      ['"Addr1":"1 Fictional Road"', '"Addr1":"9 Different Road"'],
      ['"Loc":"Bengaluru"', '"Loc":"Other City"'], ['"Pin":560001', '"Pin":560002'],
      ['"Stcd":"29"', '"Stcd":"28"'],
      [`"Gstin":"${BUYER_GSTIN}"`, '"Gstin":"27FGHIJ5678K1ZA"'],
      ['"LglNm":"Fictional Buyer"', '"LglNm":"Different Buyer"'],
      ['"TrdNm":"Fictional Buyer Trading"', '"TrdNm":"Different Trade"'],
      ['"Addr1":"2 Fictional Road"', '"Addr1":"8 Different Road"'],
      ['"Loc":"Mumbai"', '"Loc":"Other Buyer City"'], ['"Pin":400001', '"Pin":400002'],
      ['"Stcd":"27"', '"Stcd":"26"'], ['"Pos":"27"', '"Pos":"26"'],
      ['"SlNo":"1"', '"SlNo":"2"'], ['"HsnCd":"996311"', '"HsnCd":"996312"'],
      ['"IsServc":"Y"', '"IsServc":"N"'], ['"Qty":1.000', '"Qty":2.000'],
      ['"Unit":"OTH"', '"Unit":"DAY"'], ['"UnitPrice":100.00', '"UnitPrice":100.01'],
      ['"TotAmt":100.00', '"TotAmt":100.01'], ['"AssAmt":100.00', '"AssAmt":100.01'],
      ['"GstRt":5.00', '"GstRt":5.01'], ['"IgstAmt":5.00', '"IgstAmt":5.01'],
      ['"TotItemVal":105.00', '"TotItemVal":105.01'], ['"AssVal":100.00', '"AssVal":100.01'],
      ['"IgstVal":5.00', '"IgstVal":5.01'], ['"TotInvVal":105.00', '"TotInvVal":105.01'],
    ];
    for (const [before, after] of mutations) {
      const changed = replaceOnce(wire, before, after);
      expect(await code(target, await receiptInput(source, { invoiceInner: invoiceInner(changed) })))
        .toBe("receipt_binding_mismatch");
    }
    expect(await code(target, await receiptInput(source, {
      invoiceInner: invoiceInner(wire, ACK_NO, "2044-09-06 12:34:57"),
    }))).toBe("receipt_binding_mismatch");
    expect(await code(target, await receiptInput(source, {
      invoiceInner: invoiceInner(wire, ACK_NO, ACK_DT, "b2".repeat(32)),
    }))).toBe("receipt_binding_mismatch");
    const two = issuedSource("igst", [{ hsn: "996311" }, { hsn: "996312", assessableMinor: 20_000n }]);
    const twoWire = project(two).wireJson;
    const match = /"ItemList":\[(\{.*?\}),(\{.*?\})\]/u.exec(twoWire);
    if (!match) throw new Error("test item list markers absent");
    const reversed = twoWire.replace(match[0], `"ItemList":[${match[2]},${match[1]}]`);
    expect(await code(target, await receiptInput(two, { invoiceInner: invoiceInner(reversed) })))
      .toBe("receipt_binding_mismatch");

    const split = issuedSource("split");
    const splitWire = project(split).wireJson;
    for (const [before, after] of [
      ['"CgstAmt":6.00', '"CgstAmt":6.01'], ['"SgstAmt":6.00', '"SgstAmt":6.01'],
      ['"CgstVal":6.00', '"CgstVal":6.01'], ['"SgstVal":6.00', '"SgstVal":6.01'],
    ] as const) {
      expect(await code(target, await receiptInput(split, {
        invoiceInner: invoiceInner(replaceOnce(splitWire, before, after)),
      }))).toBe("receipt_binding_mismatch");
    }
  }, 30_000);

  test("binds every QR identity and rejects newly signed mismatches", async () => {
    const target = await verifier();
    const source = issuedSource();
    const valid = qrInner(source);
    const mutations: readonly [string, string][] = [
      [SELLER_GSTIN, "29ABCDE1234F1ZA"], [BUYER_GSTIN, "27FGHIJ5678K1ZA"],
      ["INV/206-1", "INV/206-2"], ['"DocTyp":"INV"', '"DocTyp":"CRN"'],
      ["06/09/2044", "07/09/2044"], ['"TotInvVal":105.00', '"TotInvVal":105.01'],
      ['"ItemCnt":1', '"ItemCnt":2'], ["996311", "996312"], [IRN, "b2".repeat(32)],
    ];
    for (const [before, after] of mutations) {
      expect(await code(target, await receiptInput(source, { qrInner: replaceOnce(valid, before, after) })))
        .toBe("receipt_binding_mismatch");
    }
  }, 30_000);

  test("allows only the versioned absent-field defaults and never overrides an original field", async () => {
    const target = await verifier();
    const source = issuedSource();
    let compatible = project(source).wireJson;
    compatible = compatible.replace('"SupTyp":"B2B"}',
      '"SupTyp":"B2B","RegRev":"N","IgstOnIntra":null,"EcmGstin":null}');
    compatible = compatible.replace(`"Stcd":"29"}`,
      `"Stcd":"29","TrdNm":null,"Addr2":null,"Ph":null,"Em":null}`);
    compatible = compatible.replace('"TotItemVal":105.00}',
      '"TotItemVal":105.00,"ItemNo":1,"PrdDesc":null,"Barcde":null,"OrdLineRef":null,' +
      '"OrgCntry":null,"PrdSlNo":null,"BchDtls":null,"AttribDtls":null,"FreeQty":0,' +
      '"Discount":0e1000,"PreTaxVal":0.0,"CesRt":0,"CesAmt":0,"CesNonAdvlAmt":0,' +
      '"StateCesRt":0,"StateCesAmt":0,"StateCesNonAdvlAmt":0,"OthChrg":0,"CgstAmt":0,"SgstAmt":0}');
    compatible = compatible.replace('"TotInvVal":105.00}',
      '"TotInvVal":105.00,"CesVal":0,"StCesVal":0,"Discount":0,"OthChrg":0,' +
      '"RndOffAmt":0,"CgstVal":0,"SgstVal":0,"TotInvValFc":null}');
    const compatibleInvoice = `${compatible.slice(0, -1)},"DispDtls":null,"ShipDtls":null,"PayDtls":null,` +
      `"RefDtls":null,"AddlDocDtls":null,"ExpDtls":null,"EwbDtls":null,"AckNo":${ACK_NO},` +
      `"AckDt":${JSON.stringify(ACK_DT)},"Irn":${JSON.stringify(IRN)}}`;
    expect((await target.verify(await receiptInput(source, { invoiceInner: compatibleInvoice }), NOW)).ok).toBe(true);
    const split = issuedSource("split");
    let compatibleSplit = project(split).wireJson;
    compatibleSplit = compatibleSplit.replace('"TotItemVal":112.00}', '"TotItemVal":112.00,"IgstAmt":0}');
    compatibleSplit = compatibleSplit.replace('"TotInvVal":112.00}', '"TotInvVal":112.00,"IgstVal":0}');
    expect((await target.verify(await receiptInput(split, {
      invoiceInner: invoiceInner(compatibleSplit),
    }), NOW)).ok).toBe(true);

    const baseInvoice = invoiceInner(project(source).wireJson);
    expect(await code(target, await receiptInput(source, {
      invoiceInner: baseInvoice.replace('"Version":"1.1",', ""),
    }))).toBe("unsupported_signed_shape");
    expect(await code(target, await receiptInput(source, {
      invoiceInner: `${baseInvoice.slice(0, -1)},"Unknown":null}`,
    }))).toBe("unsupported_signed_shape");
    expect(await code(target, await receiptInput(source, {
      invoiceInner: baseInvoice.replace('"TrdNm":"Fictional Buyer Trading"', '"TrdNm":null'),
    }))).toBe("unsupported_signed_shape");
    expect(await code(target, await receiptInput(source, {
      invoiceInner: baseInvoice.replace('"TotItemVal":105.00}', '"TotItemVal":105.00,"ItemNo":2}'),
    }))).toBe("receipt_binding_mismatch");

    const invalidDefaults: string[] = [];
    for (const name of ["DispDtls", "ShipDtls", "PayDtls", "RefDtls", "AddlDocDtls", "ExpDtls", "EwbDtls"]) {
      invalidDefaults.push(`${baseInvoice.slice(0, -1)},${JSON.stringify(name)}:{}}`);
    }
    for (const [name, value] of [["RegRev", '"Y"'], ["IgstOnIntra", '"Y"'], ["EcmGstin", '"fictional"']]) {
      invalidDefaults.push(baseInvoice.replace('"SupTyp":"B2B"}',
        `"SupTyp":"B2B",${JSON.stringify(name)}:${value}}`));
    }
    for (const name of ["TrdNm", "Addr2", "Ph", "Em"]) {
      invalidDefaults.push(baseInvoice.replace(`"Stcd":"29"}`,
        `"Stcd":"29",${JSON.stringify(name)}:"nondefault"}`));
    }
    for (const name of ["PrdDesc", "Barcde", "OrdLineRef", "OrgCntry", "PrdSlNo", "BchDtls", "AttribDtls"]) {
      invalidDefaults.push(baseInvoice.replace('"TotItemVal":105.00}',
        `"TotItemVal":105.00,${JSON.stringify(name)}:{}}`));
    }
    for (const name of ["FreeQty", "Discount", "PreTaxVal", "CesRt", "CesAmt", "CesNonAdvlAmt",
      "StateCesRt", "StateCesAmt", "StateCesNonAdvlAmt", "OthChrg", "CgstAmt", "SgstAmt"]) {
      invalidDefaults.push(baseInvoice.replace('"TotItemVal":105.00}',
        `"TotItemVal":105.00,${JSON.stringify(name)}:1}`));
    }
    for (const name of ["CesVal", "StCesVal", "Discount", "OthChrg", "RndOffAmt", "CgstVal", "SgstVal"]) {
      invalidDefaults.push(baseInvoice.replace('"TotInvVal":105.00}',
        `"TotInvVal":105.00,${JSON.stringify(name)}:1}`));
    }
    invalidDefaults.push(baseInvoice.replace('"TotInvVal":105.00}',
      '"TotInvVal":105.00,"TotInvValFc":"nondefault"}'));
    const splitInvoice = invoiceInner(project(split).wireJson);
    invalidDefaults.push(splitInvoice.replace('"TotItemVal":112.00}', '"TotItemVal":112.00,"IgstAmt":1}'));
    invalidDefaults.push(splitInvoice.replace('"TotInvVal":112.00}', '"TotInvVal":112.00,"IgstVal":1}'));
    const reusable = await receiptInput(source);
    const reusableSplit = await receiptInput(split);
    for (const inner of invalidDefaults) {
      const base = inner.includes('"TotItemVal":112.00') ? reusableSplit : reusable;
      const candidate = { ...base, signedInvoice: await signInner(inner) };
      expect(await code(target, candidate)).toBe("unsupported_signed_shape");
    }
  }, 30_000);

  test("distinguishes authentic unsupported shapes from bad signatures and selector failures", async () => {
    const target = await verifier();
    const source = issuedSource();
    const projected = project(source);
    expect(await code(target, await receiptInput(source, { invoiceInner: "{malformed" })))
      .toBe("unsupported_signed_shape");
    const duplicate = invoiceInner(projected.wireJson).replace(
      '"Version":"1.1"', '"Version":"1.1","\\u0056ersion":"1.1"');
    expect(await code(target, await receiptInput(source, { invoiceInner: duplicate })))
      .toBe("unsupported_signed_shape");
    expect(await code(target, await receiptInput(source, {
      invoiceInner: qrInner(source), qrInner: invoiceInner(projected.wireJson),
    }))).toBe("unsupported_signed_shape");
    const ordinary = await receiptInput(source);
    const extraOuter = await signPayload(JSON.stringify({
      data: invoiceInner(projected.wireJson), iss: ISSUER, accepted: true,
    }));
    expect(await code(target, { ...ordinary, signedInvoice: extraOuter })).toBe("unsupported_signed_shape");
    const nonStringData = await signPayload(JSON.stringify({ data: {}, iss: ISSUER }));
    expect(await code(target, { ...ordinary, signedInvoice: nonStringData })).toBe("unsupported_signed_shape");
    const qrMissing = qrInner(source).replace(`"SellerGstin":"${SELLER_GSTIN}",`, "");
    expect(await code(target, { ...ordinary, signedQRCode: await signInner(qrMissing) }))
      .toBe("unsupported_signed_shape");
    const qrExtra = `${qrInner(source).slice(0, -1)},"Extra":null}`;
    expect(await code(target, { ...ordinary, signedQRCode: await signInner(qrExtra) }))
      .toBe("unsupported_signed_shape");
    expect(await code(target, await receiptInput(source, { pair: wrongPair })))
      .toBe("signature_verification_failed");
    expect(await code(target, await receiptInput(source, { issuer: "OTHER-FICTIONAL-ISSUER" })))
      .toBe("receipt_binding_mismatch");
    const removed = await verifier(configuration(trust(wrongSpki, "replacement")));
    expect(await code(removed, await receiptInput(source))).toBe("signature_verification_failed");
    const expired = await verifier(configuration(trust(signingSpki, KEY_ID, NOW - 2000, NOW)));
    expect(await code(expired, await receiptInput(source))).toBe("signature_verification_failed");
    const notYetValid = await verifier(configuration(trust(signingSpki, KEY_ID, NOW + 1, NOW + 2000)));
    expect(await code(notYetValid, await receiptInput(source))).toBe("signature_verification_failed");
    const unicodeChanged = invoiceInner(projected.wireJson).replace("Hôtel Yellow Fictional", "Hôtel Yellow Fictional");
    expect(await code(target, await receiptInput(source, { invoiceInner: unicodeChanged })))
      .toBe("receipt_binding_mismatch");
  }, 30_000);

  test("binds optional IrnDt exactly and rejects inferred date normalization", async () => {
    const target = await verifier();
    const source = issuedSource();
    expect((await target.verify(await receiptInput(source, { qrInner: qrInner(source, { irnDt: ACK_DT }) }), NOW)).ok)
      .toBe(true);
    expect(await code(target, await receiptInput(source, {
      qrInner: qrInner(source, { irnDt: "2044-09-06T12:34:56" }),
    }))).toBe("receipt_binding_mismatch");
  });

  test("uses the highest individual assessable line, rejects distinct-HSN ties and permits same-HSN ties", async () => {
    const target = await verifier();
    const groupedTrap = issuedSource("igst", [
      { hsn: "996311", assessableMinor: 10_000n, igstMinor: 0n },
      { hsn: "996311", assessableMinor: 9_000n, igstMinor: 0n },
      { hsn: "996312", assessableMinor: 15_000n, igstMinor: 0n },
    ]);
    expect((await target.verify(await receiptInput(groupedTrap, {
      qrInner: qrInner(groupedTrap, { hsn: "996312" }),
    }), NOW)).ok).toBe(true);
    expect(await code(target, await receiptInput(groupedTrap, {
      qrInner: qrInner(groupedTrap, { hsn: "996311" }),
    }))).toBe("receipt_binding_mismatch");
    const tiedDistinct = issuedSource("igst", [
      { hsn: "996311", assessableMinor: 10_000n, igstMinor: 0n },
      { hsn: "996312", assessableMinor: 10_000n, igstMinor: 0n },
    ]);
    expect(await code(target, await receiptInput(tiedDistinct))).toBe("unsupported_signed_shape");
    const tiedSame = issuedSource("igst", [
      { hsn: "996311", assessableMinor: 10_000n, igstMinor: 0n },
      { hsn: "996311", assessableMinor: 10_000n, igstMinor: 0n },
    ]);
    expect((await target.verify(await receiptInput(tiedSame), NOW)).ok).toBe(true);
  }, 30_000);

  test("bounds numeric normalization without expanding powers and rejects negative zero", async () => {
    const target = await verifier();
    const source = issuedSource();
    const baseInvoice = invoiceInner(project(source).wireJson);
    for (const [numeric, expected] of [
      ["1".repeat(129), "resource_exhausted"], ["1e1001", "resource_exhausted"],
      ["1e-1001", "resource_exhausted"], ["10e1000", "resource_exhausted"],
      ["0.1e-1000", "resource_exhausted"], ["-0", "unsupported_signed_shape"],
    ] as const) {
      const inner = replaceOnce(baseInvoice, '"Qty":1.000', `"Qty":${numeric}`);
      expect(await code(target, await receiptInput(source, { invoiceInner: inner }))).toBe(expected);
    }
  });

  test("rejects source-integrity failure before accepting signed evidence", async () => {
    const target = await verifier();
    const input = await receiptInput(issuedSource());
    input.documentSha256 = "0".repeat(64);
    expect(await code(target, input)).toBe("source_hash_mismatch");
    input.contentJson = "{not-issued";
    input.documentSha256 = hash(input.contentJson);
    expect(await code(target, input)).toBe("invalid_issued_document");
  });

  test("snapshots the exact plain input before await and rejects proxies, getters and shape surprises", async () => {
    const target = await verifier();
    const input = await receiptInput(issuedSource());
    const expectedInvoice = input.signedInvoice;
    const pending = target.verify(input, NOW);
    input.signedInvoice = "mutated";
    input.contentJson = "mutated";
    const result = await pending;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.signedInvoice.compact).toBe(expectedInvoice);
    const nullPrototype = Object.assign(Object.create(null) as Mutable, await receiptInput(issuedSource()));
    expect((await target.verify(nullPrototype, NOW)).ok).toBe(true);
    let getterReads = 0;
    const ordinary = await receiptInput(issuedSource());
    const accessor = { ...ordinary };
    Object.defineProperty(accessor, "signedInvoice", {
      enumerable: true, get: () => { getterReads += 1; return expectedInvoice; },
    });
    const symbol = { ...ordinary };
    Object.defineProperty(symbol, Symbol("bypass"), { enumerable: true, value: true });
    const revoked = Proxy.revocable(ordinary, {});
    revoked.revoke();
    for (const candidate of [new Proxy(ordinary, {}), revoked.proxy, accessor, symbol,
      { ...ordinary, accepted: true }, Object.create({ ...ordinary })]) {
      expect(await code(target, candidate)).toBe("invalid_input");
    }
    expect(getterReads).toBe(0);
  }, 30_000);

  test("validates metadata syntax and cheap resource ceilings before cryptographic work", async () => {
    const target = await verifier();
    const base = await receiptInput(issuedSource());
    for (const patch of [
      { irn: "A".repeat(64) }, { irn: "a".repeat(63) }, { ackNo: "0" }, { ackNo: "01" },
      { ackNo: "1".repeat(65) }, { ackDt: "2044-02-30 12:34:56" },
      { ackDt: "2044-09-06T12:34:56" },
    ]) expect(await code(target, { ...base, ...patch })).toBe("invalid_input");
    expect(await code(target, base, -1)).toBe("invalid_input");
    expect(await code(target, base, Number.MAX_SAFE_INTEGER + 1)).toBe("invalid_input");
    expect(await code(target, { ...base, signedInvoice: "x".repeat(FISCAL_SIGNED_JWS_LIMITS.maxCompactChars + 1) }))
      .toBe("resource_exhausted");
    expect(await code(target, { ...base,
      contentJson: "x".repeat(INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.maxContentCharacters + 1) }))
      .toBe("resource_exhausted");
  });

  test("constructs only an exact internally trusted profile with the 256 KiB UTF-8 bound", async () => {
    const created = await createIndiaIrpSignedReceiptBindingVerifier(configuration());
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.code);
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.value)).toBe(true);
    for (const candidate of [undefined, null, {}, new String(configuration())]) {
      expect(await factoryCode(candidate)).toBe("invalid_input");
    }
    for (const candidate of [
      configuration(trust(), ISSUER, "other-profile"), configuration(trust(), "नहीं"),
      JSON.stringify({ profileVersion: INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION, issuer: ISSUER,
        trustBundleJson: trust(), verifier: true }),
      '{"profileVersion":"yellow_native_india_1_1_v1","issuer":"one","\\u0069ssuer":"two","trustBundleJson":"{}"}',
      configuration("{}"),
    ]) expect(await factoryCode(candidate)).toBe("invalid_configuration");
    const base = configuration();
    const exact = base + " ".repeat(
      INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.maxConfigurationUtf8Bytes - new TextEncoder().encode(base).byteLength,
    );
    expect(new TextEncoder().encode(exact)).toHaveLength(
      INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.maxConfigurationUtf8Bytes);
    expect((await createIndiaIrpSignedReceiptBindingVerifier(exact)).ok).toBe(true);
    expect(await factoryCode(`${exact} `)).toBe("resource_exhausted");
  });

  test("returns fixed frozen errors without reflecting sources, tokens, keys or exception detail", async () => {
    const badFactory = await createIndiaIrpSignedReceiptBindingVerifier(
      '{"profileVersion":"secret-profile","issuer":"secret-issuer","trustBundleJson":"secret-key"}');
    expect(badFactory).toEqual({ ok: false, error: {
      code: "invalid_configuration", message: "India IRP signed receipt binding configuration is invalid",
    } });
    expect(JSON.stringify(badFactory)).not.toContain("secret");
    expect(Object.isFrozen(badFactory)).toBe(true);
    if (badFactory.ok) throw new Error("bad factory unexpectedly succeeded");
    expect(Object.isFrozen(badFactory.error)).toBe(true);
    const target = await verifier();
    const invalid = await receiptInput(issuedSource());
    invalid.signedInvoice = "secret-token.payload.signature";
    const result = await target.verify(invalid, NOW);
    expect(result).toEqual({ ok: false, error: {
      code: "invalid_signed_artifact", message: "India IRP signed receipt artifact is invalid",
    } });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(Object.isFrozen(result)).toBe(true);
    if (result.ok) throw new Error("bad receipt unexpectedly succeeded");
    expect(Object.isFrozen(result.error)).toBe(true);
  });
});
