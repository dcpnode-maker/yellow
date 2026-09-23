import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { IssueIndiaNativeFiscalCreditNoteCommand } from "../src/commands/issue-india-native-fiscal-credit-note";
import { BearerTenantResolver, Hs256TokenSigner, type LocalLoginService } from "../src/contexts/identity";
import { IndiaNativeFiscalCreditNoteAuthorizationError } from "../src/contexts/tax-fiscal/india-native-fiscal-credit-note";
import { IndiaNativeFiscalCreditNoteListService } from "../src/contexts/tax-fiscal/india-native-fiscal-credit-note-list";
import { OperatorHttpApi } from "../src/http/operator";
import { createAuditEnvelope, Database, type Tx } from "../src/kernel";
import { createCreditCohort, createCreditFixture, type CreditFixture } from "./fixtures/india-native-fiscal-credit-note-fixture";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const readScope = "tax-fiscal.documents:read";
const signer = new Hs256TokenSigner("order450-fictional-list-signing-key-not-for-a-live-system");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const validQuery = { issuedFrom: "2044-09-01", issuedBefore: "2044-10-01" };
const encodeCursor = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

type Summary = {
  documentId: string; originalDocumentId: string; docNo: string; originalDocNo: string;
  businessDate: string; propertyNode: string; currency: "INR"; totalMinor: string; sha256: string;
};
type Row = {
  authority_receipt: string | null; tenant_id: string | null; property_node: string | null;
  document_id: string | null; original_document_id: string | null; doc_no: string | null;
  original_doc_no: string | null; business_date: string | null; sha256: string | null;
  receipt_json: string | null; metadata_json: string | null; bindings_valid: boolean | null;
};

function summary(n: number, date = "2044-09-07"): Summary {
  return {
    documentId: id(n), originalDocumentId: id(4), docNo: `C/4445/${n}`,
    originalDocNo: "I/4445/17", businessDate: date, propertyNode: id(2), currency: "INR",
    totalMinor: "11800", sha256: n.toString(16).padStart(2, "0").repeat(32),
  };
}

function row(value: Summary): Row {
  const receipt = {
    documentId: value.documentId, documentKind: "credit_note", originalDocumentId: value.originalDocumentId,
    originalDocNo: value.originalDocNo, originalSha256: "a".repeat(64), correctionJournalId: id(50),
    seriesId: id(60), docNo: value.docNo, propertyNode: value.propertyNode, reservationId: id(70),
    folioId: id(80), supplierRegistrationId: id(90), recipientRegistrationId: id(100),
    financialYearStart: "2044-04-01", currency: "INR", status: "issued", businessDate: value.businessDate,
    issuedAt: `${value.businessDate}T08:09:10.123Z`, prevHash: null, sha256: value.sha256,
    sourceEvidenceHash: "b".repeat(64), totalMinor: value.totalMinor, reason: "Order450 test credit",
  };
  const { totalMinor: _, ...metadata } = receipt;
  return {
    authority_receipt: null, tenant_id: id(1), property_node: value.propertyNode,
    document_id: value.documentId, original_document_id: value.originalDocumentId, doc_no: value.docNo,
    original_doc_no: value.originalDocNo, business_date: value.businessDate, sha256: value.sha256,
    receipt_json: JSON.stringify(receipt), metadata_json: JSON.stringify(metadata), bindings_valid: true,
  };
}

function receiptSummary(receipt: Record<string, string>): Summary {
  const documentId = receipt.documentId;
  const originalDocumentId = receipt.originalDocumentId;
  const docNo = receipt.docNo;
  const originalDocNo = receipt.originalDocNo;
  const businessDate = receipt.businessDate;
  const propertyNode = receipt.propertyNode;
  const currency = receipt.currency;
  const totalMinor = receipt.totalMinor;
  const sha256 = receipt.sha256;
  if (!documentId || !originalDocumentId || !docNo || !originalDocNo || !businessDate || !propertyNode
    || currency !== "INR" || !totalMinor || !sha256) throw new Error("Issued credit receipt is incomplete");
  return { documentId, originalDocumentId, docNo, originalDocNo, businessDate, propertyNode,
    currency, totalMinor, sha256 };
}

function emptyRow(): Row {
  return { authority_receipt: null, tenant_id: null, property_node: null, document_id: null,
    original_document_id: null, doc_no: null, original_doc_no: null, business_date: null, sha256: null,
    receipt_json: null, metadata_json: null, bindings_valid: null };
}

function harness(options: { rows?: Row[]; grants?: boolean; sqlError?: string } = {}) {
  const log: string[] = [];
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const control = { grants: options.grants ?? true, sqlError: options.sqlError ?? null,
    rows: options.rows ?? [emptyRow()] };
  const connection = Object.assign(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    if (sql.includes("set_config('app.tenant_id'")) { log.push(`tenant:${values[0]}`); return [{ tenant_id: values[0] }]; }
    if (sql.includes("current_user = session_user")) return [{ role_reset: true, tenant_reset: true }];
    if (sql.includes("FROM user_role")) {
      log.push(`grant:${values.at(-1) ?? values[0]}`);
      return control.grants ? [{ id: id(2), name: "Fictional hotel", timezone: "Asia/Kolkata", currency: "INR" }] : [];
    }
    calls.push({ sql, values });
    if (control.sqlError) throw Object.assign(new Error("private SQL details"), { errno: control.sqlError });
    if (sql.includes("read_india_native_fiscal_credit_note")) return control.rows;
    throw new Error("Unexpected SQL in Order450 credit-note list composition");
  }, {
    async unsafe(sql: string) { log.push(sql); return []; },
    release() { log.push("release"); }, async close() { log.push("close"); },
  }) as unknown as Tx;
  const database = new Database({ async reserve() { log.push("reserve"); return connection; } });
  const operator = new OperatorHttpApi({} as LocalLoginService);
  return { log, calls, control, app: createApp({ database, tenantResolver: new BearerTenantResolver(signer), operatorApi: operator }) };
}

async function token(scopes: readonly string[] = [readScope], tenant = id(1)): Promise<string> {
  return `Bearer ${await signer.issue({ userId: id(3), tenantId: tenant, scopes })}`;
}

async function list(h: ReturnType<typeof harness>, options: {
  scopes?: readonly string[]; tenant?: string; property?: string; query?: Record<string, string>; authenticated?: boolean;
} = {}): Promise<Response> {
  const query = new URLSearchParams(options.query === undefined ? validQuery : options.query);
  const headers: Record<string, string> = options.authenticated === false ? {} : {
    authorization: await token(options.scopes, options.tenant ?? id(1)),
    "x-correlation-id": id(90),
  };
  return h.app.handle(new Request(
    `http://yellow.test/api/v1/properties/${options.property ?? id(2)}/credit-notes?${query.toString()}`,
    { headers },
  ));
}

describe("Order450 signed-session issued-credit list composition (future list integration)", () => {
  test("lists exact summaries through one current-authority query with no cache or count side channel", async () => {
    const first = summary(12), second = summary(11);
    const h = harness({ rows: [row(first), row(second)] });
    const response = await list(h, { query: { ...validQuery, limit: "1" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe(id(90));
    const body = await response.json() as { items: Summary[]; nextCursor: string | null };
    expect(body.items).toEqual([first]);
    expect(body.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Object.keys(body).sort()).toEqual(["items", "nextCursor"]);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.values.slice(0, 3)).toEqual([id(1), id(2), id(3)]);
    expect(h.calls[0]!.sql).not.toMatch(/OFFSET|COUNT\s*\(/i);
    expect(h.calls[0]!.sql).toContain("read_india_native_fiscal_credit_note");
    expect(h.log).toContain("tenant:" + id(1));
    expect(h.log).toContain("reserve"); expect(h.log).toContain("COMMIT");

    const cursor = body.nextCursor!;
    for (const options of [
      { query: { ...validQuery, after: cursor, docNo: first.docNo } },
      { tenant: id(99), query: { ...validQuery, after: cursor } },
      { property: id(99), query: { ...validQuery, after: cursor } },
    ]) {
      const crossFilter = harness();
      expect((await list(crossFilter, options)).status).toBe(400);
      expect(crossFilter.calls).toHaveLength(0);
    }
  });

  test("rejects missing, duplicate, malformed and cross-filter selectors before SQL", async () => {
    const invalidQueries = [
      {},
      { ...validQuery, issuedFrom: "2044-02-30" },
      { ...validQuery, issuedBefore: "2045-10-01" },
      { ...validQuery, docNo: "C/1/2/3/4/5/6/7/8/9" },
      { ...validQuery, unknown: "selector" },
      { ...validQuery, after: "%%%" },
      { ...validQuery, limit: "0" },
      { ...validQuery, limit: "101" },
      { ...validQuery, limit: "1.5" },
    ];
    for (const query of invalidQueries) {
      const h = harness();
      expect((await list(h, { query })).status).toBe(400);
      expect(h.calls).toHaveLength(0);
    }
    const duplicate = harness();
    expect((await duplicate.app.handle(new Request(
      `http://yellow.test/api/v1/properties/${id(2)}/credit-notes?issuedFrom=2044-09-01&issuedFrom=2044-09-01&issuedBefore=2044-10-01`,
      { headers: { authorization: await token() } },
    ))).status).toBe(400);
    expect(duplicate.calls).toHaveLength(0);
    const property = harness();
    expect((await list(property, { property: "not-a-uuid" })).status).toBe(400);
    expect(property.calls).toHaveLength(0);

    const cursorBase = { version: 1, tenantId: id(1), propertyNode: id(2),
      issuedFrom: validQuery.issuedFrom, issuedBefore: validQuery.issuedBefore, docNo: null,
      businessDate: "2044-09-07", documentId: id(12) };
    for (const after of [
      encodeCursor({ ...cursorBase, docNo: "C/4445/12" }),
      encodeCursor({ ...cursorBase, tenantId: id(99) }),
      encodeCursor({ ...cursorBase, propertyNode: id(99) }),
    ]) {
      const h = harness();
      expect((await list(h, { query: { ...validQuery, after } })).status).toBe(400);
      expect(h.calls).toHaveLength(0);
    }
  });

  test("requires signed read scope and a current property grant, with sanitized authority/storage errors", async () => {
    for (const scopes of [[], ["tax-fiscal.documents:issue"], ["tax-fiscal.submissions:read"]]) {
      const h = harness(); expect((await list(h, { scopes })).status).toBe(403); expect(h.calls).toHaveLength(0);
    }
    const unauthenticated = harness();
    expect((await list(unauthenticated, { authenticated: false })).status).toBe(401);
    expect(unauthenticated.calls).toHaveLength(0);
    const revoked = harness({ grants: false });
    expect((await list(revoked)).status).toBe(403); expect(revoked.calls).toHaveLength(0);
    const foreignProperty = harness();
    expect((await list(foreignProperty, { property: id(99) })).status).toBe(403);
    expect(foreignProperty.calls).toHaveLength(0);
    for (const [sqlError, expected] of [["42501", 403], ["XX000", 503]] as const) {
      const h = harness({ sqlError }); const response = await list(h);
      expect(response.status).toBe(expected); expect(await response.text()).not.toContain("private SQL details");
    }
  });

  test("returns exact filtered and authorized empty pages without leaking a cursor", async () => {
    const filtered = summary(12);
    const filteredResponse = await list(harness({ rows: [row(filtered)] }),
      { query: { ...validQuery, docNo: filtered.docNo } });
    expect(filteredResponse.status).toBe(200);
    expect(await filteredResponse.json()).toEqual({ items: [filtered], nextCursor: null });

    const empty = harness({ rows: [emptyRow()] });
    const response = await list(empty, { query: { ...validQuery, docNo: "C/4445/13" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
    expect(empty.calls).toHaveLength(1);
    expect(empty.calls[0]!.values).toContain("C/4445/13");
    const badCursor = harness();
    expect((await list(badCursor, { query: { ...validQuery, after: "e30" } })).status).toBe(400);
    expect(badCursor.calls).toHaveLength(0);
  });
});

const deployUrl = process.env.YELLOW_ORDER446_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER446_RUNTIME_DATABASE_URL;
const requireOrder450Database = process.env.YELLOW_REQUIRE_ORDER450_DATABASE === "1";
if (requireOrder450Database && (!deployUrl || !runtimeUrl)) {
  throw new Error("YELLOW_REQUIRE_ORDER450_DATABASE=1 requires YELLOW_ORDER446_DEPLOY_DATABASE_URL and YELLOW_ORDER446_RUNTIME_DATABASE_URL");
}
const actualDatabaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const actualSigner = new Hs256TokenSigner("order450-actual-fictional-signing-key-not-for-a-live-system");

async function actualAuth(candidate: CreditFixture): Promise<string> {
  return `Bearer ${await actualSigner.issue({ userId: candidate.fixture.actor, tenantId: candidate.fixture.tenant, scopes: [readScope] })}`;
}

async function actualList(app: ReturnType<typeof createApp>, candidate: CreditFixture, query: Record<string, string>, property = candidate.fixture.property): Promise<Response> {
  const params = new URLSearchParams(query);
  return app.handle(new Request(`http://yellow.test/api/v1/properties/${property}/credit-notes?${params.toString()}`, {
    headers: { authorization: await actualAuth(candidate), "x-correlation-id": crypto.randomUUID() },
  }));
}

async function actualFinancialFiscalGraph(deploy: SQL, candidate: CreditFixture): Promise<string> {
  const tenant = candidate.fixture.tenant;
  const invoice = candidate.invoice.documentId;
  const [row] = await deploy<{ graph: string }[]>`SELECT jsonb_build_object(
    'documents',(SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]'::jsonb)
      FROM public.document d WHERE d.tenant_id=${tenant}::uuid),
    'origins',(SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.id),'[]'::jsonb)
      FROM public.india_gst_native_fiscal_document_origin o WHERE o.tenant_id=${tenant}::uuid),
    'credits',(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb)
      FROM public.india_native_fiscal_credit_note c WHERE c.tenant_id=${tenant}::uuid),
    'series',(SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb)
      FROM public.document_series s WHERE s.tenant_id=${tenant}::uuid),
    'journals',(SELECT COALESCE(jsonb_agg(to_jsonb(j) ORDER BY j.id),'[]'::jsonb)
      FROM public.journal j WHERE j.tenant_id=${tenant}::uuid),
    'postings',(SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.journal_id,l.seq),'[]'::jsonb)
      FROM public.posting_line l WHERE l.tenant_id=${tenant}::uuid),
    'facts',(SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.recorded_at,f.id),'[]'::jsonb)
      FROM public.fact_log f WHERE f.tenant_id=${tenant}::uuid),
    'outbox',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.seq),'[]'::jsonb)
      FROM public.outbox e WHERE e.tenant_id=${tenant}::uuid),
    'idempotency',(SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.key_hash),'[]'::jsonb)
      FROM public.api_idempotency i WHERE i.tenant_id=${tenant}::uuid),
    'submissions',(SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb)
      FROM public.fiscal_submission s WHERE s.tenant_id=${tenant}::uuid),
    'fixtureInvoice',(SELECT to_jsonb(d) FROM public.document d
      WHERE d.tenant_id=${tenant}::uuid AND d.id=${invoice}::uuid)
  )::text AS graph`;
  if (!row) throw new Error("Order450 financial/fiscal graph is unavailable");
  return row.graph;
}

actualDatabaseDescribe("Order450 actual native credit-list journey (requires separate root admission)", () => {
  let deploy: SQL;
  let database: Database;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 3, prepare: false });
    database = Database.connect(runtimeUrl!, { maxConnections: 8, prepare: false });
    const [ready] = await deploy<{ read_ready: boolean }[]>`SELECT
      to_regprocedure('public.read_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid)') IS NOT NULL AS read_ready`;
    if (!ready?.read_ready) throw new Error("Order450 native read capability is not installed; no actual proof claimed");
    app = createApp({ database, tenantResolver: new BearerTenantResolver(actualSigner), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
  });

  afterAll(async () => { await database?.close(); await deploy?.close(); });

  test("paginates same-day credits without duplicates, isolates tenants/properties, and denies revoked authority even when empty", async () => {
    const cohort = await createCreditCohort(deploy, database, 2);
    const first = cohort[0]!;
    const second = cohort[1]!;
    const foreign = await createCreditFixture(deploy, database, { label: `credit450-f-${crypto.randomUUID().slice(0, 8)}` });
    const issue = async (candidate: CreditFixture, key: string) => new IssueIndiaNativeFiscalCreditNoteCommand(database).execute({
      tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property, actorId: candidate.fixture.actor,
      originalDocumentId: candidate.invoice.documentId, reason: "Order450 exact issued-credit list journey", idempotencyKey: key,
      envelope: createAuditEnvelope({ tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property,
        actorId: candidate.fixture.actor, requestId: crypto.randomUUID(), operation: "document.issued" }),
    });
    const issuedFirst = await issue(first, `credit450-list-${first.invoice.documentId}`);
    const issuedSecond = await issue(second, `credit450-list-${second.invoice.documentId}`);
    const issuedForeign = await issue(foreign, `credit450-list-${foreign.invoice.documentId}`);
    const receiptFirst = JSON.parse(issuedFirst.receiptJson) as Record<string, string>;
    const receiptSecond = JSON.parse(issuedSecond.receiptJson) as Record<string, string>;
    expect(receiptFirst.businessDate).toBe(receiptSecond.businessDate);
    const graphBeforeReads = [
      await actualFinancialFiscalGraph(deploy, first),
      await actualFinancialFiscalGraph(deploy, foreign),
    ];
    const expected = [receiptSummary(receiptFirst), receiptSummary(receiptSecond)]
      .sort((a, b) => b.businessDate.localeCompare(a.businessDate) || b.documentId.localeCompare(a.documentId));
    const year = Number(expected[0]!.businessDate.slice(0, 4));
    const query = { issuedFrom: `${year}-01-01`, issuedBefore: `${year + 1}-01-01`, limit: "1" };
    const pageOne = await actualList(app, first, query);
    expect(pageOne.status).toBe(200); expect(pageOne.headers.get("cache-control")).toBe("no-store");
    const one = await pageOne.json() as { items: Summary[]; nextCursor: string | null };
    expect(one.items).toEqual([expected[0]!]); expect(one.nextCursor).toBeString();
    const heldCursor = one.nextCursor!;
    const pageTwo = await actualList(app, first, { ...query, after: heldCursor });
    expect(pageTwo.status).toBe(200);
    const two = await pageTwo.json() as { items: Summary[]; nextCursor: string | null };
    expect(two.items).toEqual([expected[1]!]); expect(two.nextCursor).toBeNull();
    expect(new Set([...one.items, ...two.items].map(item => item.documentId)).size).toBe(2);
    const filtered = await actualList(app, first, { ...query, docNo: expected[0]!.docNo });
    expect(filtered.status).toBe(200);
    expect(await filtered.json()).toEqual({ items: [expected[0]!], nextCursor: null });
    expect((await actualList(app, first, { ...query }, foreign.fixture.property)).status).toBe(403);
    const foreignReceipt = receiptSummary(JSON.parse(issuedForeign.receiptJson) as Record<string, string>);
    const foreignList = await actualList(app, foreign, { ...query, limit: "1" });
    expect(foreignList.status).toBe(200);
    expect((await foreignList.json() as { items: Summary[] }).items).toEqual([foreignReceipt]);
    const previousYear = year - 1;
    const emptyPreviousYear = await actualList(app, first,
      { issuedFrom: `${previousYear}-01-01`, issuedBefore: `${previousYear}-02-01`, limit: "1" });
    expect(emptyPreviousYear.status).toBe(200);
    expect(await emptyPreviousYear.json()).toEqual({ items: [], nextCursor: null });
    const removed = await deploy<{ role_id: string }[]>`DELETE FROM public.user_role
      WHERE tenant_id=${first.fixture.tenant}::uuid AND user_id=${first.fixture.actor}::uuid RETURNING role_id`;
    expect(removed.length).toBeGreaterThan(0);
    expect((await actualList(app, first, query)).status).toBe(403);
    expect((await actualList(app, first, { ...query, after: heldCursor })).status).toBe(403);
    expect((await actualList(app, first, { ...validQuery, limit: "1", docNo: "C/never" })).status).toBe(403);
    await expect(database.withTenantTransaction(first.fixture.tenant, tx =>
      new IndiaNativeFiscalCreditNoteListService().list(tx, {
        tenantId: first.fixture.tenant, propertyNode: first.fixture.property, actorId: first.fixture.actor,
        issuedFrom: query.issuedFrom!, issuedBefore: query.issuedBefore!, docNo: "C/never",
      }))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteAuthorizationError);
    await expect(database.withTenantTransaction(first.fixture.tenant, tx =>
      new IndiaNativeFiscalCreditNoteListService().list(tx, {
        tenantId: first.fixture.tenant, propertyNode: first.fixture.property, actorId: first.fixture.actor,
        issuedFrom: query.issuedFrom!, issuedBefore: query.issuedBefore!, after: heldCursor,
      }))).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteAuthorizationError);
    expect(await actualFinancialFiscalGraph(deploy, first)).toBe(graphBeforeReads[0]!);
    expect(await actualFinancialFiscalGraph(deploy, foreign)).toBe(graphBeforeReads[1]!);
  }, 180_000);
});
