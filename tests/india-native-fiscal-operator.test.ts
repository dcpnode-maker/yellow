import { describe, expect, test } from "bun:test";
import type { Tx } from "../src/kernel";
import { IndiaNativeFiscalDocumentReadService } from "../src/contexts/tax-fiscal/india-native-fiscal-document-read";
import { IndiaNativeFiscalOperatorReadService } from "../src/contexts/tax-fiscal/india-native-fiscal-operator";
import { FiscalSubmissionAdapterAvailabilityService } from "../src/contexts/tax-fiscal/fiscal-submission-adapter-availability";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = { tenantId: uuid(1), propertyNode: uuid(2), actorId: uuid(3) };
const input = { ...scope, issuedFrom: "2044-09-01", issuedBefore: "2044-10-01" };
const hash = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");

describe("Q208 configured provider choices", () => {
  const identity = { providerKey: "fictional-irp", providerExtensionId: uuid(60), providerExtensionVersion: 2 };
  const presentation = { ...identity, environment: "sandbox" as const };
  const row = { extension_id: uuid(60), extension_version: 2, provider_key: "fictional-irp", label: "Fictional IRP" };
  const service = new IndiaNativeFiscalOperatorReadService();
  const configured = () => new FiscalSubmissionAdapterAvailabilityService([identity], [presentation]);
  test("returns only exact current database and protected configuration intersection; read-only and detached", async () => {
    const db = query(Object.assign([row], { count: 1, command: "SELECT" }));
    const result = await service.providers(db.tx, scope, configured());
    expect(result).toEqual({ ok: true, value: [{ ...presentation, label: "Fictional IRP" }] });
    expect(db.calls[0]!.values).toEqual([scope.tenantId, scope.propertyNode, scope.actorId, "{" + uuid(60) + "}"]);
    expect(db.calls[0]!.sql).toContain("list_india_fiscal_submission_provider_options");
    expect(db.calls[0]!.sql).not.toMatch(/INSERT|UPDATE|DELETE/);
    if (!result.ok) throw new Error("expected success");
    expect(Object.isFrozen(result.value)).toBe(true); expect(Object.isFrozen(result.value[0])).toBe(true);
    for (const changed of [{ ...row, extension_version: 3 }, { ...row, provider_key: "other-irp" }, { ...row, extension_id: uuid(61) }]) {
      expect(await service.providers(query([changed]).tx, scope, configured())).toEqual({ ok: true, value: [] });
    }
    const empty = query([]);
    expect(await service.providers(empty.tx, scope, new FiscalSubmissionAdapterAvailabilityService([]))).toEqual({ ok: true, value: [] });
    expect(empty.calls).toHaveLength(1); // No configuration must not bypass current SQL authorization.
  });
  test("denies malformed identity, environment, duplicate and accessor configuration without invoking traps", () => {
    let traps = 0;
    const accessor = Object.defineProperty({ ...presentation }, "environment", { enumerable: true, get() { traps++; return "sandbox"; } });
    for (const bad of [[{ ...presentation, environment: "unknown" }], [{ ...presentation, providerExtensionVersion: 3 }],
      [{ ...presentation, credentials: "private" }], [presentation, presentation], [accessor],
      new Proxy([presentation], { getOwnPropertyDescriptor() { traps++; throw new Error(); } }), new Array(17)]) {
      expect(() => new FiscalSubmissionAdapterAvailabilityService([identity], bad)).toThrow();
    }
    expect(traps).toBe(0);
    expect(new FiscalSubmissionAdapterAvailabilityService([identity]).configured()).toEqual([]);
  });
  test("rejects malformed SQL rows, oversized results and metadata row accessors with sanitized errors", async () => {
    let traps = 0;
    const accessor = Object.defineProperty([row], "0", { enumerable: true, get() { traps++; return row; } });
    for (const bad of [[{ ...row, label: "Secret\nlabel" }], [{ ...row, secret: "secret" }], [row, row], new Array(17), accessor,
      new Proxy([row], { getOwnPropertyDescriptor() { traps++; throw new Error(); } })]) {
      expect(await service.providers(query(bad).tx, scope, configured())).toMatchObject({ ok: false, error: { code: "invalid_providers" } });
    }
    expect(traps).toBe(0);
    const badInput = query([]);
    expect(await service.providers(badInput.tx, { ...scope, tenant: uuid(90) }, configured())).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(badInput.calls).toHaveLength(0);
    for (const [state, code] of [["42501", "permission_denied"], ["P2082", "unsupported_jurisdiction"], ["XX000", "database_error"]] as const) {
      const tx = (async () => { throw Object.assign(new Error("private SQL"), { errno: state }); }) as unknown as Tx;
      expect(await service.providers(tx, scope, configured())).toMatchObject({ ok: false, error: { code } });
    }
  });
});

describe("Q208 purpose-limited operator readiness", () => {
  const service = new IndiaNativeFiscalOperatorReadService();
  const selected = { ...scope, reservationId: uuid(4), folioId: uuid(5), recipientRegistrationId: null, calendarEvidence: null };
  test("maps selection, blocked and issued truth with no writes or private selectors", async () => {
    for (const readiness of [{ kind: "selection_required", recipients: [{ recipientRegistrationId: uuid(6), legalName: "Buyer", gstin: "27AAPFU0939F1ZV", stateCode: "27" }] },
      { kind: "blocked", blocker: "working_day_calendar_required" }, { kind: "issued", documentId: uuid(10) }] as const) {
      const db = query([{ readiness }]);
      expect(await service.discover(db.tx, selected)).toEqual({ ok: true, value: readiness });
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0]!.sql).toContain("discover_india_native_fiscal_issue");
      expect(db.calls[0]!.sql).not.toMatch(/prepare_|INSERT|UPDATE|DELETE/);
      expect(db.calls[0]!.values).toEqual([uuid(1), uuid(2), uuid(3), uuid(4), uuid(5), null, null, null, null, "{}", "{}"]);
    }
  });
  test("accepts Bun SQL result metadata without reading it or relaxing nested JSON arrays", async () => {
    const readiness = { kind: "selection_required", recipients: [] } as const;
    const rows = Object.assign([{ readiness }], { count: 1, command: "SELECT", lastInsertRowid: null, affectedRows: null });
    expect(await service.discover(query(rows).tx, selected)).toEqual({ ok: true, value: readiness });
    let touched = 0;
    Object.defineProperty(rows, "count", { get() { touched++; throw new Error("not invoice data"); } });
    expect(await service.discover(query(rows).tx, selected)).toEqual({ ok: true, value: readiness });
    const recipients = Object.assign([], { count: 0 });
    expect(await service.discover(query([{ readiness: { ...readiness, recipients } }]).tx, selected))
      .toMatchObject({ ok: false, error: { code: "invalid_readiness" } });
    const accessor = Object.defineProperty([{}], "0", { enumerable: true, get() { touched++; return { readiness }; } });
    const proxy = new Proxy(rows, { getOwnPropertyDescriptor() { touched++; return undefined; } });
    for (const bad of [accessor, proxy, new Array(1), [{ readiness }, { readiness }]]) {
      expect(await service.discover(query(bad).tx, selected))
        .toMatchObject({ ok: false, error: { code: "invalid_readiness" } });
    }
    expect(touched).toBe(0);
  });
  test("rejects ill-formed legal text rather than publishing replacement characters", async () => {
    const readiness = readyFixture();
    readiness.confirmation.buyer.legalName = "Buyer\ud800";
    expect(await service.discover(query([{ readiness }]).tx, { ...selected, recipientRegistrationId: uuid(6) }))
      .toMatchObject({ ok: false, error: { code: "invalid_readiness" } });
  });
  test("rejects malformed input, calendar, result wrappers and unknown blockers", async () => {
    for (const bad of [{ ...selected, tenant: uuid(9) }, { ...selected, recipientRegistrationId: "bad" },
      { ...selected, calendarEvidence: {} }]) {
      const db = query([]);
      expect(await service.discover(db.tx, bad)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
      expect(db.calls).toHaveLength(0);
    }
    for (const bad of [[], [{ readiness: { kind: "blocked", blocker: "raw-secret" } }],
      [{ readiness: { kind: "issued", documentId: uuid(10), internalSelectors: {} } }]]) {
      const result = await service.discover(query(bad).tx, selected);
      expect(result).toMatchObject({ ok: false, error: { code: "invalid_readiness" } });
      expect(JSON.stringify(result)).not.toContain("raw-secret");
    }
  });
  test("projects exact legal buyer, amounts and dates without returning private discovery roots", async () => {
    const raw = readyFixture();
    const result = await service.discover(query([{ readiness: raw }]).tx, { ...selected, recipientRegistrationId: uuid(6) });
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "ready") throw new Error("Expected ready");
    const c = result.value.confirmation;
    expect(c.buyer).toEqual({ recipientRegistrationId: uuid(6), legalName: "Buyer", gstin: "27AAPFU0939F1ZV", stateCode: "27", addressLine: "1 Buyer Road", locality: "Mumbai", postalCode: "400001" });
    expect(c.taxableMinor).toBe("9007199254740993");
    expect(c.totalMinor).toBe("9007199254740993");
    expect(c.roomNights[0]!.taxableMinor).toBe(c.taxableMinor);
    expect(c.configuration).toEqual({ extensionId: uuid(20), version: 2, contentHash: "c".repeat(64) });
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c.roomNights[0]!.components)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/internalSelectors|valuationId|recordingRoots|private-source|partyId/);
  });
  test("rejects source rebound, inconsistent totals, selected configuration drift and hostile nested fields", async () => {
    const mutations: Array<(r: ReturnType<typeof readyFixture>) => void> = [
      r => { r.confirmation.tenantId = uuid(99); }, r => { r.internalSelectors.recipientRegistrationId = uuid(99); },
      r => { r.confirmation.buyer.registrationId = uuid(99); }, r => { r.confirmation.seller.propertyNode = uuid(99); },
      r => { r.confirmation.placeOfSupply.folioId = uuid(99); }, r => { r.confirmation.issue.businessDayOpen = false; },
      r => { r.confirmation.quotedTaxComposition.taxPreview.grandTotalMinor = "5"; },
      r => { r.confirmation.configuration.selectedExtensionContentHash = "d".repeat(64); },
      r => { r.confirmation.timing.invoiceIssueDate = "2044-09-05"; },
      r => { r.confirmation.quotedTaxComposition.taxPreview.persistenceRoomNights[0]!.taxMinor = "1"; },
    ];
    for (const mutate of mutations) {
      const raw = readyFixture(); mutate(raw);
      expect(await service.discover(query([{ readiness: raw }]).tx, { ...selected, recipientRegistrationId: uuid(6) }))
        .toMatchObject({ ok: false, error: { code: "invalid_readiness" } });
    }
    let touched = 0;
    const raw = readyFixture();
    Object.defineProperty(raw.confirmation.buyer, "legalName", { enumerable: true, get() { touched++; return "secret"; } });
    expect((await service.discover(query([{ readiness: raw }]).tx, { ...selected, recipientRegistrationId: uuid(6) })).ok).toBe(false);
    expect(touched).toBe(0);
    const tooMany = Array.from({ length: 501 }, (_, i) => ({ recipientRegistrationId: uuid(i + 100), legalName: "Buyer", gstin: "27AAPFU0939F1ZV", stateCode: "27" }));
    expect((await service.discover(query([{ readiness: { kind: "selection_required", recipients: tooMany } }]).tx, selected)).ok).toBe(false);
  });
});

function readyFixture() {
  const internalSelectors = { valuationId: uuid(11), serviceProvisionSnapshotId: uuid(12), paymentReceiptSnapshotId: uuid(13), ordinaryRegimeEvidenceId: uuid(14), supplierServiceLocationId: uuid(15), supplierRegistrationStatusId: uuid(16), supplierSezStatusId: uuid(17), recipientRegistrationId: uuid(6), recipientSezStatusId: uuid(18), classificationId: uuid(19) };
  return { kind: "ready", selectorHash: "a".repeat(64), evidenceHash: "b".repeat(64), internalSelectors,
    confirmation: { version: 1, kind: "india_native_operator_confirmation_v1", tenantId: scope.tenantId, propertyNode: scope.propertyNode, reservationId: uuid(4), folioId: uuid(5), recipientRegistrationId: uuid(6), selectorHash: "a".repeat(64),
      buyer: { registrationId: uuid(6), partyId: uuid(21), legalName: "Buyer", gstin: "27AAPFU0939F1ZV", stateCode: "27", addressLine1: "1 Buyer Road", locality: "Mumbai", pin: "400001" },
      seller: { registrationId: uuid(22), propertyNode: scope.propertyNode, currency: "INR", legalName: "Hotel", gstin: "29AAPFU0939F1ZR", stateCode: "29", addressLine: "1 Main Road", locality: "Bengaluru", postalCode: "560001" },
      placeOfSupply: { propertyNode: scope.propertyNode, reservationId: uuid(4), folioId: uuid(5), pos: "29" },
      timing: { propertyNode: scope.propertyNode, reservationId: uuid(4), currency: "INR", invoiceIssueDate: "2044-09-06", timeOfSupplyDate: "2044-09-05", serviceProvisionDate: "2044-09-05", paymentReceiptDate: "2044-09-06" },
      issue: { businessDayOpen: true, supplierRegistrationId: uuid(22), issueDate: "2044-09-06", financialYearStart: "2044-04-01", prefix: "INV/" },
      configuration: { selectedExtensionId: uuid(20), selectedExtensionVersion: 2, selectedExtensionContentHash: "c".repeat(64) },
      classification: {}, serviceSupplyNature: {}, valuationEvidence: { note: "private-source" }, recordingRoots: {},
      quotedTaxComposition: { taxPreview: { valuationId: uuid(11), selectedExtensionId: uuid(20), selectedExtensionVersion: 2, selectedContentHash: "c".repeat(64), transactionValueMinor: "9007199254740993", taxMinor: "0", grandTotalMinor: "9007199254740993",
        persistenceRoomNights: [{ ordinal: 0, businessDate: "2044-09-05", finalValueMinor: "9007199254740993", slabUptoMinor: null, aggregateRateBasisPoints: 0, itcEligible: false, taxMinor: "0", components: [{ identity: "igst", rateBasisPoints: 0, taxMinor: "0" }] }] } } } };
}

describe("Q208 reload-safe document delivery reads", () => {
  const service = new IndiaNativeFiscalOperatorReadService();
  const selected = { ...scope, documentId: uuid(10) };
  const pending = { kind: "pending", submissionId: uuid(20), tenantId: uuid(1), propertyNode: uuid(2),
    documentId: uuid(10), documentSha256: "a".repeat(64), wireSha256: "b".repeat(64),
    providerKey: "clearirp", attemptId: uuid(21), attemptNumber: 1, status: "pending",
    disposition: "send", transitionSeq: 1 } as const;

  test("retains exact no-request, ambiguous, legacy and absent outcomes", async () => {
    for (const delivery of [null, { kind: "not_requested", documentId: uuid(10) },
      { kind: "ambiguous", documentId: uuid(10) },
      { kind: "legacy_unsupported", documentId: uuid(10), submissionId: uuid(20) }] as const) {
      const db = query([{ delivery }]);
      expect(await service.readDelivery(db.tx, selected)).toEqual({ ok: true, value: delivery });
      expect(db.calls[0]!.values).toEqual([uuid(1), uuid(2), uuid(10), uuid(3)]);
      expect(db.calls[0]!.sql).toContain("read_india_fiscal_submission_delivery_receipt_by_document");
    }
  });

  test("validates the existing receipt and rebinds its tenant/property/document", async () => {
    const delivery = { kind: "receipt", documentId: uuid(10), receipt: pending } as const;
    expect(await service.readDelivery(query([{ delivery }]).tx, selected)).toEqual({ ok: true, value: delivery });
    for (const receipt of [{ ...pending, documentId: uuid(99) }, { ...pending, tenantId: uuid(99) },
      { ...pending, propertyNode: uuid(99) }, { ...pending, kind: "accepted_signed_v1" },
      { ...pending, secret: "must-not-leak" }]) {
      const result = await service.readDelivery(query([{ delivery: { ...delivery, receipt } }]).tx, selected);
      expect(result).toMatchObject({ ok: false, error: { code: "invalid_receipt" } });
      expect(JSON.stringify(result)).not.toContain("must-not-leak");
    }
  });

  test("rejects malformed wrappers and hostile input without executing accessors", async () => {
    let touched = 0;
    const hostile = Object.defineProperty({}, "documentId", { get() { touched++; return uuid(10); }, enumerable: true });
    for (const raw of [hostile, new Proxy({}, { ownKeys() { touched++; return []; } }), { ...selected, extra: true }]) {
      const db = query([]);
      expect((await service.readDelivery(db.tx, raw)).ok).toBe(false);
      expect(db.calls).toHaveLength(0);
    }
    for (const result of [[], [{ delivery: null }, { delivery: null }], [hostile],
      [{ delivery: { kind: "not_requested", documentId: uuid(99) } }],
      [{ delivery: { kind: "not_requested", documentId: uuid(10), receipt: pending } }]]) {
      expect((await service.readDelivery(query(result).tx, selected)).ok).toBe(false);
    }
    expect(touched).toBe(0);
  });

  test("maps real-driver own SQLSTATE fields without leaking errors or executing traps", async () => {
    for (const name of ["code", "errno", "sqlState"]) {
      const error = Object.assign(new Error("private"), { [name]: "42501" });
      expect(await service.readDelivery(query(() => { throw error; }).tx, selected))
        .toMatchObject({ ok: false, error: { code: "permission_denied" } });
    }
    let touched = 0;
    const hostile = new Proxy({}, { getOwnPropertyDescriptor() { touched++; return undefined; } });
    expect(await service.readDelivery(query(() => { throw hostile; }).tx, selected))
      .toMatchObject({ ok: false, error: { code: "database_error" } });
    expect(touched).toBe(0);
  });
});

function query(result: unknown) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const tx = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: parts.join("?"), values });
    return typeof result === "function" ? result() : result;
  }) as unknown as Tx;
  return { tx, calls };
}

function item(n: number, stamp = "2044-09-06T10:00:00.000001Z") {
  return { documentId: uuid(n), documentNumber: `INV/${n}`, businessDate: "2044-09-06",
    issuedAt: stamp, reservationId: uuid(4), folioId: uuid(5), recipientRegistrationId: uuid(6),
    buyerName: "Buyer & Sons", buyerGstin: "27AAPFU0939F1ZV", currency: "INR",
    taxableMinor: "10000", taxMinor: "500", totalMinor: "10500" };
}

function row(n: number, count = "3", stamp?: string) {
  const summary = item(n, stamp);
  return { document_id: summary.documentId, business_date: summary.businessDate,
    issued_at: summary.issuedAt, summary, matching_count: count };
}

function detail() {
  const source = {
    Version: "1.1", TranDtls: { SupTyp: "B2B", TaxSch: "GST" },
    DocDtls: { No: "INV/10", Dt: "06/09/2044", Typ: "INV" },
    SellerDtls: { Pin: 560001, Loc: "Bengaluru", Stcd: "29", LglNm: "Yellow",
      Gstin: "29AAPFU0939F1ZR", Addr1: "1 Main Road" },
    BuyerDtls: { Pin: 400001, Loc: "Mumbai", Pos: "27", Stcd: "27", LglNm: "Buyer & Sons",
      Gstin: "27AAPFU0939F1ZV", Addr1: "1 Buyer Road" },
    ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH",
      UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00",
      IgstAmt: "5.00", TotItemVal: "105.00" }],
    ValDtls: { AssVal: "100.00", IgstVal: "5.00", TotInvVal: "105.00" },
  };
  const contentJson = JSON.stringify(source);
  return { kind: "india_native_invoice_v1" as const, documentId: uuid(10), propertyNode: uuid(2),
    reservationId: uuid(4), folioId: uuid(5), seriesId: uuid(7), documentNumber: "INV/10",
    businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z",
    recipientRegistrationId: uuid(6), sourceEvidenceHash: "a".repeat(64),
    documentSha256: hash(contentJson), previousHash: "b".repeat(64), contentJson };
}

describe("Order440 Q208 bounded immutable invoice reads", () => {
  const service = new IndiaNativeFiscalDocumentReadService();

  test("uses the authorized capability, sentinel and microsecond-preserving cursor", async () => {
    const first = query([row(12), row(11), row(10)]);
    const result = await service.list(first.tx, { ...input, limit: 2, query: "  Buyer  " });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.items.map(i => i.documentId)).toEqual([uuid(12), uuid(11)]);
    expect(result.value.matchingCount).toBe("3");
    expect(result.value.nextCursor).toBeString();
    expect(Object.isFrozen(result.value.items[0])).toBe(true);
    expect(first.calls).toHaveLength(1);
    expect(first.calls[0]!.sql).toContain("public.list_india_native_fiscal_documents");
    expect(first.calls[0]!.values).toEqual([uuid(1), uuid(2), uuid(3), "2044-09-01", "2044-10-01",
      null, null, "Buyer", null, null, null, 3]);
    const second = query([row(10)]);
    const next = await service.list(second.tx, { ...input, limit: 2, query: "Buyer", after: result.value.nextCursor });
    expect(next.ok && next.value.nextCursor).toBeNull();
    expect(second.calls[0]!.values.slice(-4)).toEqual(["2044-09-06", "2044-09-06T10:00:00.000001Z", uuid(11), 3]);
    const decoded = Buffer.from(result.value.nextCursor!, "base64url").toString("utf8");
    expect(decoded).not.toContain("Buyer");
  });

  test("keeps filtered total on an empty final page and accepts a real empty queue", async () => {
    const metadata = { document_id: null, business_date: null, issued_at: null, summary: null, matching_count: "0" };
    const empty = await service.list(query([metadata]).tx, input);
    expect(empty).toEqual({ ok: true, value: { items: [], matchingCount: "0", nextCursor: null } });
    const page = await service.list(query([row(12), row(11)]).tx, { ...input, limit: 1 });
    if (!page.ok) throw new Error(page.error.message);
    const end = await service.list(query([{ ...metadata, matching_count: "3" }]).tx,
      { ...input, limit: 1, after: page.value.nextCursor });
    expect(end).toEqual({ ok: true, value: { items: [], matchingCount: "3", nextCursor: null } });
  });

  test("rejects malformed and rebound cursors before executing SQL", async () => {
    const first = await service.list(query([row(12), row(11)]).tx, { ...input, limit: 1 });
    if (!first.ok) throw new Error(first.error.message);
    for (const changed of [{ propertyNode: uuid(8) }, { tenantId: uuid(8) }, { query: "different" },
      { issuedBefore: "2044-09-30" }, { reservationId: uuid(4) }, { folioId: uuid(5) }]) {
      const db = query([]);
      expect(await service.list(db.tx, { ...input, ...changed, after: first.value.nextCursor })).toMatchObject({ ok: false, error: { code: "invalid_input" } });
      expect(db.calls).toHaveLength(0);
    }
    for (const after of ["%%%", "A".repeat(2049), "e30", first.value.nextCursor + "="]) {
      const db = query([]);
      expect((await service.list(db.tx, { ...input, after })).ok).toBe(false);
      expect(db.calls).toHaveLength(0);
    }
  });

  test("bounds real calendar dates, input shape, unicode query and page size", async () => {
    for (const bad of [{ issuedFrom: "2044-02-30" }, { issuedFrom: "2045-01-01" },
      { issuedFrom: "2043-01-01" }, { limit: 0 }, { limit: 101 }, { limit: 1.5 },
      { query: "\nsecret" }, { query: "😀".repeat(121) }, { query: "\ud800" },
      { extra: "authority" }, { actorId: "not-an-actor" }]) {
      const db = query([]);
      expect((await service.list(db.tx, { ...input, ...bad })).ok).toBe(false);
      expect(db.calls).toHaveLength(0);
    }
    const exactBound = query([{ document_id: null, business_date: null, issued_at: null, summary: null, matching_count: "0" }]);
    expect((await service.list(exactBound.tx, { ...input, issuedFrom: "2044-01-01", issuedBefore: "2045-01-01", query: "😀".repeat(120), limit: 100 })).ok).toBe(true);
    expect(exactBound.calls[0]!.values.at(-1)).toBe(101);
  });

  test("rejects ambiguous, out-of-scope, unordered, inconsistent and oversized rows", async () => {
    for (const rows of [[], [row(10), row(11)], [row(10), row(10)], [row(10, "0")],
      [row(12, "3"), row(11, "4")], [row(12), row(11), row(10)],
      [{ ...row(10), document_id: uuid(99) }],
      [{ ...row(10), summary: { ...item(10), taxableMinor: 10000 } }],
      [{ ...row(10), summary: { ...item(10), totalMinor: "10501" } }],
      [{ ...row(10), summary: { ...item(10), totalMinor: "9223372036854775808" } }]]) {
      expect(await service.list(query(rows).tx, { ...input, limit: 1 })).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    }
    expect((await service.list(query([row(10)]).tx, { ...input, reservationId: uuid(99) })).ok).toBe(false);
    expect((await service.list(query([row(10)]).tx, { ...input, folioId: uuid(99) })).ok).toBe(false);
  });

  test("rejects proxies and accessors without invoking them; snapshots before awaiting", async () => {
    let invoked = 0;
    const accessor = { ...input };
    Object.defineProperty(accessor, "query", { enumerable: true, get: () => { invoked++; return "secret"; } });
    for (const bad of [accessor, new Proxy(input, {})]) {
      const db = query([]);
      expect((await service.list(db.tx, bad)).ok).toBe(false);
      expect(db.calls).toHaveLength(0);
    }
    const rows = [row(10)];
    Object.defineProperty(rows, "0", { enumerable: true, get: () => { invoked++; return row(10); } });
    expect((await service.list(query(rows).tx, input)).ok).toBe(false);
    expect(invoked).toBe(0);
    const mutable = { ...input, reservationId: uuid(4) };
    const db = query(() => { mutable.reservationId = uuid(99); return [row(10, "1")]; });
    expect((await service.list(db.tx, mutable)).ok).toBe(true);
  });

  test("rejects an incomplete first page when its coherent count proves missing rows", async () => {
    expect(await service.list(query([row(10, "3")]).tx, input)).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    expect(await service.list(query([row(12), row(11)]).tx, { ...input, limit: 2 })).toMatchObject({ ok: false, error: { code: "invalid_document" } });
  });

  test("rejects repeated invoice identities even with descending microseconds in a sentinel", async () => {
    const duplicate = [row(10, "2", "2044-09-06T10:00:00.000002Z"), row(10, "2", "2044-09-06T10:00:00.000001Z")];
    expect(await service.list(query(duplicate).tx, { ...input, limit: 1 })).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    const first = await service.list(query([row(12, "2", "2044-09-06T10:00:00.000002Z"), row(11, "2")]).tx, { ...input, limit: 1 });
    if (!first.ok) throw new Error(first.error.message);
    expect(await service.list(query([row(12, "2")]).tx,
      { ...input, limit: 1, after: first.value.nextCursor })).toMatchObject({ ok: false, error: { code: "invalid_document" } });
  });

  test("reads exact immutable content and validates issued hash, number, date and scope", async () => {
    const doc = detail();
    const db = query([{ document: doc }]);
    const result = await service.read(db.tx, { ...scope, documentId: uuid(10) });
    expect(result).toEqual({ ok: true, value: doc });
    expect(result.ok && Object.isFrozen(result.value)).toBe(true);
    expect(db.calls[0]!.sql).toContain("public.read_india_native_fiscal_document");
    for (const changed of [{ contentJson: doc.contentJson + " " }, { documentNumber: "INV/OTHER" },
      { businessDate: "2044-09-07" }, { propertyNode: uuid(99) }, { documentId: uuid(99) },
      { sourceEvidenceHash: "wrong" }, { extra: "secret" }]) {
      expect(await service.read(query([{ document: { ...doc, ...changed } }]).tx,
        { ...scope, documentId: uuid(10) })).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    }
    expect(await service.read(query([{ document: null }]).tx, { ...scope, documentId: uuid(10) })).toEqual({ ok: true, value: null });
  });

  test("preserves actual chain genesis NULL and handles real Bun SQLSTATE fields", async () => {
    const original = detail();
    const genesis = { ...original, previousHash: null };
    expect(await service.read(query([{ document: genesis }]).tx, { ...scope, documentId: uuid(10) }))
      .toMatchObject({ ok: true, value: { previousHash: null, documentSha256: original.documentSha256 } });
    for (const name of ["errno", "sqlState"]) {
      const denied = query(() => { throw Object.assign(new Error("private"), { code: "ERR_POSTGRES_SERVER_ERROR", [name]: "42501" }); });
      expect(await service.list(denied.tx, input)).toMatchObject({ ok: false, error: { code: "permission_denied" } });
    }
    expect(await service.list(query(() => { throw { errno: "P2082" }; }).tx, input))
      .toMatchObject({ ok: false, error: { code: "unsupported_jurisdiction" } });
  });

  test("sanitizes database errors, including permission denial", async () => {
    const fail = query(() => { throw Object.assign(new Error("guest-secret database password"), { code: "42501" }); });
    const result = await service.list(fail.tx, input);
    expect(result).toMatchObject({ ok: false, error: { code: "permission_denied" } });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
