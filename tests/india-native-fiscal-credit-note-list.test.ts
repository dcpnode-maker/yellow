import { describe, expect, test } from "bun:test";
import { IndiaNativeFiscalCreditNoteListService, snapshotIndiaNativeFiscalCreditNoteListInput } from "../src/contexts/tax-fiscal/india-native-fiscal-credit-note-list";
import { IndiaNativeFiscalCreditNoteAuthorizationError, IndiaNativeFiscalCreditNoteDatabaseError, IndiaNativeFiscalCreditNoteValidationError } from "../src/contexts/tax-fiscal/india-native-fiscal-credit-note";
import type { Tx } from "../src/kernel";

const tenantId = "11111111-1111-4111-8111-111111111111";
const propertyNode = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const id = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
const input = (extra: Record<string, unknown> = {}) => ({ tenantId, propertyNode, actorId, issuedFrom: "2026-09-01", issuedBefore: "2026-10-01", ...extra });
const service = new IndiaNativeFiscalCreditNoteListService();

function fake(rows: unknown) {
  const calls: {sql: string; values: unknown[]}[] = [];
  const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({sql: strings.join("?"), values});
    return rows;
  }) as unknown as Tx;
  return {tx, calls};
}

function row(n: number, businessDate = "2026-09-08", extra: Record<string, unknown> = {}) {
  const receipt = {documentId: id(n), documentKind: "credit_note", originalDocumentId: id(n + 1000),
    originalDocNo: `I/2627/${n}`, originalSha256: "a".repeat(64), correctionJournalId: id(n + 2000),
    seriesId: id(3000), docNo: `C/2627/${n}`, propertyNode, reservationId: id(4000), folioId: id(5000),
    supplierRegistrationId: id(6000), recipientRegistrationId: id(7000), financialYearStart: "2026-04-01",
    currency: "INR", status: "issued", businessDate, issuedAt: `${businessDate}T08:09:10.123Z`, prevHash: null,
    sha256: "b".repeat(64), sourceEvidenceHash: "c".repeat(64), totalMinor: "9223372036854775807", reason: "Credit 🧾", ...extra};
  const {totalMinor: _, ...metadata} = receipt;
  return {authority_receipt: null, tenant_id: tenantId, property_node: propertyNode, document_id: receipt.documentId,
    original_document_id: receipt.originalDocumentId, doc_no: receipt.docNo, original_doc_no: receipt.originalDocNo,
    business_date: receipt.businessDate, sha256: receipt.sha256, receipt_json: JSON.stringify(receipt),
    metadata_json: JSON.stringify(metadata), bindings_valid: true};
}

function empty() {
  return Object.fromEntries(Object.keys(row(1)).map(key => [key, null]));
}

function cursorJson(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

describe("native issued credit list", () => {
  test("detaches canonical inputs and rejects malformed selectors before SQL", async () => {
    const value = input();
    const snapshot = snapshotIndiaNativeFiscalCreditNoteListInput(value);
    expect(snapshot?.limit).toBe(25);
    expect(Object.isFrozen(snapshot)).toBe(true);
    value.issuedFrom = "2020-01-01";
    expect(snapshot?.issuedFrom).toBe("2026-09-01");
    const db = fake([]);
    for (const extra of [{limit: 0}, {limit: 101}, {limit: "25"}, {limit: 1.5}, {issuedFrom: "2026-02-30"}, {issuedBefore: "2026-09-01"}, {issuedBefore: "2028-01-01"}, {docNo: "%"}, {docNo: ""}, {docNo: "\ud800"}, {after: ""}, {after: "e30="}, {actorId: actorId.toUpperCase()}, {unknown: true}]) {
      // This UUID uses only decimal hex digits; explicitly mutate its syntax.
      if ("actorId" in extra) extra.actorId = "ABC";
      await expect(service.list(db.tx, input(extra))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    }
    expect(db.calls).toHaveLength(0);
  });

  test("rejects hostile input descriptors without invoking getters or proxy traps", async () => {
    let effects = 0;
    const accessor = input();
    Object.defineProperty(accessor, "issuedFrom", {enumerable: true, get() {effects++; return "2026-09-01";}});
    const hidden = input();
    Object.defineProperty(hidden, "actorId", {enumerable: false, value: actorId});
    const proxy = new Proxy(input(), {get() {effects++; throw new Error("private");}, ownKeys() {effects++; return [];}});
    const revoked = Proxy.revocable(input(), {}); revoked.revoke();
    const values = [null, [], accessor, hidden, proxy, revoked.proxy, Object.create(input()) as unknown,
      {...input(), [Symbol("private")]: true}, input({after: undefined}), input({docNo: null}), input({limit: NaN})];
    const db = fake([]);
    for (const value of values) await expect(service.list(db.tx, value)).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    expect(effects).toBe(0);
    expect(db.calls).toHaveLength(0);
    expect(snapshotIndiaNativeFiscalCreditNoteListInput(Object.assign(Object.create(null), input()))).not.toBeNull();
  });

  test("empty page retains one materialized authority query and a strict sentinel", async () => {
    const db = fake([empty()]);
    const result = await service.list(db.tx, input());
    expect(result).toEqual({items: [], nextCursor: null});
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.items)).toBe(true);
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0]!;
    expect(call.sql).toContain("authority AS MATERIALIZED");
    expect(call.sql.match(/read_india_native_fiscal_credit_note/g)).toHaveLength(1);
    expect(call.sql).toContain("input.tenant_id, input.property_node, input.actor_id, NULL::uuid");
    expect(call.sql).toContain("FROM authority LEFT JOIN LATERAL");
    expect(call.sql).toContain("c.tenant_id=authority.tenant_id AND c.property_node=authority.property_node");
    expect(call.sql).toContain("ORDER BY c.business_date DESC,c.document_id DESC LIMIT ?::integer");
    expect(call.sql).not.toMatch(/\bOFFSET\b|\bcount\s*\(|\bILIKE\b|document\.content|->>/i);
    expect(call.values).toEqual([tenantId, propertyNode, actorId, "2026-09-01", "2026-10-01", null, null, null, null, null, 26]);
    for (const rows of [[], [empty(), empty()], [{...empty(), authority_receipt: "{}"}], [{...empty(), sha256: "b".repeat(64)}]]) {
      await expect(service.list(fake(rows).tx, input())).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    }
  });

  test("pages limit+1 with same-day UUID ordering, no skipped rows and exact int64", async () => {
    const first = fake([row(4), row(3), row(2)]);
    const page1 = await service.list(first.tx, input({limit: 2}));
    expect(page1.items.map(item => item.documentId)).toEqual([id(4), id(3)]);
    expect(Object.keys(page1.items[0]!)).toEqual(["documentId", "originalDocumentId", "docNo", "originalDocNo", "businessDate", "propertyNode", "currency", "totalMinor", "sha256"]);
    expect(page1.items[0]!.totalMinor).toBe("9223372036854775807");
    expect(Object.isFrozen(page1.items[0])).toBe(true);
    expect(cursorJson(page1.nextCursor!)).toEqual({version: 1, tenantId, propertyNode, issuedFrom: "2026-09-01", issuedBefore: "2026-10-01", docNo: null, businessDate: "2026-09-08", documentId: id(3)});
    const second = fake([row(2), row(1, "2026-09-07")]);
    const page2 = await service.list(second.tx, input({limit: 2, after: page1.nextCursor}));
    expect(page2.items.map(item => item.documentId)).toEqual([id(2), id(1)]);
    expect(page2.nextCursor).toBeNull();
    expect(second.calls[0]!.values.slice(-4)).toEqual(["2026-09-08", "2026-09-08", id(3), 3]);
    expect((await service.list(fake([empty()]).tx, input({after: page1.nextCursor}))).items).toHaveLength(0);
    expect(new Set([...page1.items, ...page2.items].map(item => item.documentId)).size).toBe(4);
    const exact = fake([row(4)]);
    expect((await service.list(exact.tx, input({docNo: "C/2627/4", limit: 1}))).nextCursor).toBeNull();
    expect(exact.calls[0]!.values.slice(5, 7)).toEqual(["C/2627/4", "C/2627/4"]);
  });

  test("cursor is canonical and bound to scope and filters, not page size or actor", async () => {
    const next = (await service.list(fake([row(4), row(3)]).tx, input({limit: 1}))).nextCursor!;
    const decoded = cursorJson(next);
    const malformed = [next + "=", " " + next, encode({...decoded, version: 2}), encode({...decoded, extra: 1}),
      encode({...decoded, tenantId: id(100)}), encode({...decoded, propertyNode: id(100)}), encode({...decoded, docNo: "C/2627/4"}),
      encode({...decoded, issuedFrom: "2026-08-01"}), encode({...decoded, issuedBefore: "2026-11-01"}),
      encode({...decoded, businessDate: "2026-02-30"}), encode({...decoded, businessDate: "2026-10-01"}),
      encode({...decoded, documentId: "not-a-uuid"}), encode(Object.fromEntries(Object.entries(decoded).reverse())),
      Buffer.from(JSON.stringify(decoded).replace('"version":1', '"version":1,"version":1')).toString("base64url"),
      Buffer.from(JSON.stringify(decoded).replace('"version"', '"\\u0076ersion"')).toString("base64url")];
    const db = fake([empty()]);
    for (const after of malformed) await expect(service.list(db.tx, input({after}))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    for (const change of [{tenantId: id(10)}, {propertyNode: id(10)}, {docNo: "C/2627/4"}, {issuedBefore: "2026-09-20"}]) {
      await expect(service.list(db.tx, input({...change, after: next}))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteValidationError);
    }
    expect(db.calls).toHaveLength(0);
    await service.list(db.tx, input({after: next, actorId: id(30), limit: 100}));
    expect(db.calls[0]!.values[2]).toBe(id(30));
    expect(db.calls[0]!.values.at(-1)).toBe(101);
  });

  test("storage failures reject the whole page including malformed overfetch rows", async () => {
    const invalid = [
      row(1, "2026-09-08", {totalMinor: "0"}), row(1, "2026-09-08", {totalMinor: "01"}),
      row(1, "2026-09-08", {totalMinor: "9223372036854775808"}), row(1, "2026-09-08", {totalMinor: 9007199254740992}),
      row(1, "2026-09-08", {currency: "USD"}), row(1, "2026-09-08", {documentKind: "invoice"}),
      row(1, "2026-09-08", {status: "draft"}), row(1, "2026-09-08", {originalDocumentId: id(1)}),
      row(1, "2026-09-08", {reason: "\ud800"}), row(1, "2026-09-08", {reason: "\u007f"}),
      row(1, "2026-09-08", {originalSha256: "A".repeat(64)}), row(1, "2026-09-08", {issuedAt: "2026-02-30T01:00:00.000Z"}),
      row(1, "2026-09-08", {financialYearStart: "2026-01-01"}), row(1, "2026-09-08", {supplierRegistrationId: id(7000)}),
      {...row(1), authority_receipt: "{}"}, {...row(1), tenant_id: id(10)}, {...row(1), property_node: id(10)},
      {...row(1), bindings_valid: false}, {...row(1), bindings_valid: null}, {...row(1), receipt_json: "{}"},
      {...row(1), metadata_json: "{}"}, {...row(1), receipt_json: row(1).receipt_json.replace('"totalMinor":', '"totalMinor":"1","totalMinor":')},
      {...row(1), receipt_json: row(1).receipt_json.replace('"reason":', '"reason":"x","\\u0072eason":')},
      {...row(1), receipt_json: row(1).receipt_json.replace('"reason":"Credit 🧾"', '"reason":{}')},
      {...row(1), extra: true}, row(1, "2026-08-31"), row(1, "2026-10-01"),
    ];
    for (const bad of invalid) {
      await expect(service.list(fake([row(2), bad]).tx, input({limit: 1}))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    }
    // Every stored metadata field is independently compared, even fields not returned.
    for (const key of Object.keys(JSON.parse(row(1).metadata_json) as object)) {
      const metadata = JSON.parse(row(1).metadata_json) as Record<string, unknown>;
      metadata[key] = "mismatch";
      await expect(service.list(fake([{...row(1), metadata_json: JSON.stringify(metadata)}]).tx, input())).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    }
    for (const key of ["document_id", "original_document_id", "doc_no", "original_doc_no", "business_date", "sha256"]) {
      const changed = row(2, "2026-09-09", {sha256: "d".repeat(64)});
      await expect(service.list(fake([{...row(1), [key]: changed[key as keyof ReturnType<typeof row>]}]).tx, input())).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    }
  });

  test("rejects duplicates, bad order, oversized results and rows outside cursor/filter", async () => {
    for (const bad of [[row(1), row(1)], [row(1), row(2)], [row(2, "2026-09-07"), row(1)], [row(2), row(1), empty()]]) {
      await expect(service.list(fake(bad).tx, input({limit: 1}))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    }
    const next = (await service.list(fake([row(2), row(1)]).tx, input({limit: 1}))).nextCursor!;
    await expect(service.list(fake([row(2)]).tx, input({after: next}))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    await expect(service.list(fake([row(1)]).tx, input({docNo: "C/2627/2"}))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
  });

  test("hostile returned shapes and SQL error fields are never executed or exposed", async () => {
    let effects = 0;
    const getter = {...row(1)};
    Object.defineProperty(getter, "receipt_json", {enumerable: true, get() {effects++; return row(1).receipt_json;}});
    const arrayGetter: unknown[] = [];
    Object.defineProperty(arrayGetter, "0", {enumerable: true, get() {effects++; return row(1);}});
    // Promise resolution itself reads `then`; exclude that language-level read
    // and prove the service never inspects any other hostile proxy property.
    const rows = [new Proxy([row(1)], {get(_target, key) {if (key === "then") return undefined; effects++; throw new Error("secret");}}), [new Proxy(row(1), {})],
      [getter], arrayGetter, new Array(1), [{...row(1), [Symbol("private")]: true}], [{...row(1), receipt_json: "x".repeat(16385)}]];
    for (const returned of rows) await expect(service.list(fake(returned).tx, input())).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
    const metadataArray = [row(1)] as ReturnType<typeof row>[] & {count?: number; command?: string};
    metadataArray.count = 1; metadataArray.command = "SELECT";
    expect((await service.list(fake(metadataArray).tx, input())).items).toHaveLength(1);
    expect(effects).toBe(0);
    for (const error of [{code: "42501"}, {errno: "42501"}, {sqlState: "42501"}]) {
      const tx = (async () => {throw error;}) as unknown as Tx;
      await expect(service.list(tx, input())).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteAuthorizationError);
      const next = (await service.list(fake([row(2), row(1)]).tx, input({limit: 1}))).nextCursor!;
      await expect(service.list(tx, input({after: next}))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteAuthorizationError);
    }
    const hostileError = Object.defineProperty({}, "code", {get() {effects++; return "42501";}});
    for (const error of [hostileError, new Proxy({}, {}), {code: "55000", message: "private SQL"}, {code: "P0002"}]) {
      try { await service.list((async () => {throw error;}) as unknown as Tx, input()); throw new Error("unexpected success"); }
      catch (caught) { expect(caught).toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError); expect(String(caught)).not.toContain("private SQL"); }
    }
    expect(effects).toBe(0);
  });

  test("input mutation after query dispatch cannot change row binding or pagination", async () => {
    let resolve!: (rows: unknown) => void;
    const pending = new Promise<unknown>(done => {resolve = done;});
    const mutable = {...input(), limit: 1};
    const result = service.list((async () => pending) as unknown as Tx, mutable);
    mutable.tenantId = id(100); mutable.propertyNode = id(101); mutable.issuedFrom = "2030-01-01";
    mutable.limit = 100;
    resolve([row(2), row(1)]);
    const page = await result;
    expect(page.items).toHaveLength(1);
    expect(cursorJson(page.nextCursor!).tenantId).toBe(tenantId);
    expect(cursorJson(page.nextCursor!).propertyNode).toBe(propertyNode);
  });
});
