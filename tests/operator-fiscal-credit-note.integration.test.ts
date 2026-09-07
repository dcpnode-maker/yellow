import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, type LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, type Tx } from "../src/kernel";
import {
  createCreditFixture,
  originalCreditGraph,
  type CreditFixture,
} from "./fixtures/india-native-fiscal-credit-note-fixture";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const issueScopes = ["tax-fiscal.documents:issue", "financials.adjustments:write"];
const readScope = "tax-fiscal.documents:read";
const signer = new Hs256TokenSigner("order446-fictional-http-signing-key-not-for-a-live-system");
const receipt = Object.freeze({
  documentId: id(10), documentKind: "credit_note", originalDocumentId: id(4),
  originalDocNo: "I/4445/17", originalSha256: "a".repeat(64),
  correctionJournalId: id(11), seriesId: id(12), docNo: "C/4445/1",
  propertyNode: id(2), reservationId: id(5), folioId: id(6),
  supplierRegistrationId: id(7), recipientRegistrationId: id(8),
  financialYearStart: "2044-04-01", currency: "INR", status: "issued",
  businessDate: "2044-09-07", issuedAt: "2044-09-07T12:00:00.000Z",
  prevHash: null, sha256: "b".repeat(64), sourceEvidenceHash: "c".repeat(64),
  totalMinor: "11800", reason: "Incorrect invoice — पूर्ण सुधार",
});
// Deliberate whitespace proves HTTP does not parse/re-serialize durable receipt bytes.
const receiptJson = JSON.stringify(receipt, null, 2);

function harness() {
  const log: string[] = [];
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const control = {
    revokedScope: null as string | null,
    sqlError: null as string | null,
    replayed: false,
    missing: false,
    receiptJson,
  };
  const connection = Object.assign(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    if (sql.includes("set_config('app.tenant_id'")) {
      log.push(`tenant:${values[0]}`); return [{ tenant_id: values[0] }];
    }
    if (sql.includes("current_user = session_user")) return [{ role_reset: true, tenant_reset: true }];
    if (sql.includes("FROM user_role")) {
      log.push(`grant:${values[0]}`);
      return values[0] === control.revokedScope ? []
        : [{ id: id(2), name: "Fictional hotel", timezone: "Asia/Kolkata", currency: "INR" }];
    }
    calls.push({ sql, values });
    if (control.sqlError) throw Object.assign(new Error("private SQL and credential details"), {
      code: "ERR_POSTGRES_SERVER_ERROR", errno: control.sqlError,
    });
    if (sql.includes("commit_india_native_fiscal_credit_note")) {
      return [{ receipt_json: control.receiptJson, replayed: control.replayed }];
    }
    if (sql.includes("read_india_native_fiscal_credit_note")) {
      return [{ receipt_json: control.missing ? null : control.receiptJson }];
    }
    throw new Error("Unexpected SQL in credit-note HTTP composition");
  }, {
    async unsafe(sql: string) { log.push(sql); return []; },
    release() { log.push("release"); }, async close() { log.push("close"); },
  }) as unknown as Tx;
  const database = new Database({ async reserve() { log.push("reserve"); return connection; } });
  const operator = new OperatorHttpApi({} as LocalLoginService);
  return {
    log, calls, control,
    app: createApp({ database, tenantResolver: new BearerTenantResolver(signer), operatorApi: operator }),
  };
}

async function authorization(scopes: readonly string[]) {
  return `Bearer ${await signer.issue({ userId: id(3), tenantId: id(1), scopes })}`;
}

async function issue(h: ReturnType<typeof harness>, options: {
  scopes?: readonly string[]; body?: unknown; key?: string; suffix?: string;
  property?: string; original?: string; contentType?: string; authenticated?: boolean; correlation?: string | null;
} = {}) {
  const headers: Record<string, string> = {
    "content-type": options.contentType ?? "application/json",
    "idempotency-key": options.key ?? "order446-credit-note-0001",
  };
  if (options.correlation !== null) headers["x-correlation-id"] = options.correlation ?? id(90);
  if (options.authenticated !== false) headers.authorization = await authorization(options.scopes ?? issueScopes);
  return h.app.handle(new Request(
    `http://yellow.test/api/v1/properties/${options.property ?? id(2)}/invoices/${options.original ?? id(4)}/credit-notes${options.suffix ?? ""}`,
    { method: "POST", headers, body: JSON.stringify(options.body === undefined ? { reason: receipt.reason } : options.body) },
  ));
}

async function read(h: ReturnType<typeof harness>, options: {
  scopes?: readonly string[]; suffix?: string; property?: string; document?: string; authenticated?: boolean;
} = {}) {
  const headers: Record<string, string> = options.authenticated === false ? {} : { authorization: await authorization(options.scopes ?? [readScope]) };
  return h.app.handle(new Request(
    `http://yellow.test/api/v1/properties/${options.property ?? id(2)}/credit-notes/${options.document ?? id(10)}${options.suffix ?? ""}`,
    { headers },
  ));
}

describe("Order446 signed-session credit-note HTTP composition (database authority proven separately)", () => {
  test("issues in the middleware transaction with verified identities and exact stored receipt bytes", async () => {
    const h = harness(), response = await issue(h);
    expect(response.status).toBe(201);
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe(id(90));
    expect(await response.text()).toBe(receiptJson);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.values).toEqual([id(1), id(2), id(3), id(4), receipt.reason, "order446-credit-note-0001", id(90)]);
    expect(h.log).toContain(`grant:${issueScopes[0]}`);
    expect(h.log).toContain(`grant:${issueScopes[1]}`);
    expect(h.log.filter(item => item === "reserve")).toHaveLength(1);
    expect(h.log).toContain("COMMIT");
    expect(h.log).not.toContain("ROLLBACK");
  });

  test("replays as 200 without putting changed replay or correlation metadata in the immutable body", async () => {
    const first = harness(), replay = harness(); replay.control.replayed = true;
    const a = await issue(first), b = await issue(replay, { correlation: id(91) });
    expect(a.status).toBe(201); expect(b.status).toBe(200);
    expect(b.headers.get("idempotency-replayed")).toBe("true");
    expect(b.headers.get("x-correlation-id")).toBe(id(91));
    expect(await a.text()).toBe(await b.text());
  });

  test("uses one generated correlation identity for the command and response when absent or malformed", async () => {
    for (const correlation of [null, "not-a-uuid"]) {
      const h = harness(), response = await issue(h, { correlation });
      expect(response.status).toBe(201);
      expect(response.headers.get("x-correlation-id")).toBe(h.calls[0]!.values[6] as string);
      expect(await response.text()).toBe(receiptJson);
    }
  });

  test("reads the same receipt under its separate current read authority", async () => {
    const h = harness(), response = await read(h);
    expect(response.status).toBe(200); expect(await response.text()).toBe(receiptJson);
    expect(response.headers.get("idempotency-replayed")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.values).toEqual([id(1), id(2), id(3), id(10)]);
    expect(h.log).toContain(`grant:${readScope}`);
  });

  test("requires authentication and both issue scopes without calling the financial capability", async () => {
    for (const scopes of [[], [readScope], [issueScopes[0]!], [issueScopes[1]!]]) {
      const h = harness(); expect((await issue(h, { scopes })).status).toBe(403); expect(h.calls).toHaveLength(0);
    }
    for (const execute of [issue, read]) {
      const h = harness(); expect((await execute(h, { authenticated: false })).status).toBe(401); expect(h.calls).toHaveLength(0);
    }
    const h = harness(); expect((await read(h, { scopes: issueScopes })).status).toBe(403); expect(h.calls).toHaveLength(0);
  });

  test("checks each current property grant even with an otherwise valid signed session or replay", async () => {
    for (const scope of issueScopes) {
      const h = harness(); h.control.revokedScope = scope; h.control.replayed = true;
      expect((await issue(h)).status).toBe(403); expect(h.calls).toHaveLength(0);
    }
    const h = harness(); h.control.revokedScope = readScope;
    expect((await read(h)).status).toBe(403); expect(h.calls).toHaveLength(0);
    const foreign = harness(); expect((await issue(foreign, { property: id(99) })).status).toBe(403);
    expect(foreign.calls).toHaveLength(0);
  });

  test("rejects overposted identities, financial selectors, malformed reason, query and missing key", async () => {
    for (const body of [null, [], {}, { reason: "" }, { reason: "   " }, { reason: 23 },
      { reason: "a\u0000b" }, { reason: "x".repeat(501) },
      ...["tenantId", "actorId", "originalDocumentId", "amountMinor", "folioId", "seriesId", "businessDate", "envelope"]
        .map(key => ({ reason: receipt.reason, [key]: id(99) }))]) {
      const h = harness(); expect((await issue(h, { body })).status).toBe(400); expect(h.calls).toHaveLength(0);
    }
    for (const options of [{ key: "" }, { key: "has spaces" }, { suffix: "?amountMinor=1" },
      { original: "bad" }, { property: "bad" }, { contentType: "text/plain" }]) {
      const h = harness(); expect((await issue(h, options)).status).toBe(400); expect(h.calls).toHaveLength(0);
    }
    for (const options of [{ document: "bad" }, { suffix: "?tenant=other" }]) {
      const h = harness(); expect((await read(h, options)).status).toBe(400); expect(h.calls).toHaveLength(0);
    }
  });

  test("conceals missing and cross-tenant credit notes behind the same not-found response", async () => {
    const a = harness(), b = harness(); a.control.missing = b.control.missing = true;
    const first = await read(a), second = await read(b, { document: id(99) });
    expect(first.status).toBe(404); expect(second.status).toBe(404);
    const one = await first.json() as Record<string, unknown>, two = await second.json() as Record<string, unknown>;
    delete one.correlation_id; delete two.correlation_id; expect(one).toEqual(two);
  });

  test("rolls back authority, validation, conflict and unexpected failures without exposing SQL details", async () => {
    for (const [state, status] of [["42501", 403], ["22023", 400], ["23505", 409], ["55000", 409], ["XX000", 503]] as const) {
      const h = harness(); h.control.sqlError = state;
      const response = await issue(h); expect(response.status).toBe(status);
      expect(await response.text()).not.toContain("private SQL");
      expect(h.log).toContain("ROLLBACK"); expect(h.log).not.toContain("COMMIT");
    }
  });

  test("malformed or foreign durable receipts fail closed and roll back, rather than returning successful issuance", async () => {
    for (const invalid of ["not-json", "null", JSON.stringify({ ...receipt, propertyNode: id(99) }),
      JSON.stringify({ ...receipt, originalDocumentId: id(99) }), JSON.stringify({ ...receipt, totalMinor: 11800 })]) {
      const h = harness(); h.control.receiptJson = invalid;
      const response = await issue(h); expect(response.status).toBe(503);
      expect(h.log).toContain("ROLLBACK"); expect(h.log).not.toContain("COMMIT");
    }
  });
});

const order446DeployUrl = process.env.YELLOW_ORDER446_DEPLOY_DATABASE_URL;
const order446RuntimeUrl = process.env.YELLOW_ORDER446_RUNTIME_DATABASE_URL;
const requireOrder446Database = process.env.YELLOW_REQUIRE_ORDER446_DATABASE === "1";
if (requireOrder446Database && (!order446DeployUrl || !order446RuntimeUrl)) {
  throw new Error("Order446 actual signed-session HTTP proof requires explicit deploy and runtime database URLs");
}
const actualDatabaseDescribe = order446DeployUrl && order446RuntimeUrl ? describe.serial : describe.skip;
const actualSigner = new Hs256TokenSigner("order446-actual-http-proof-signing-key-is-local-and-fictional");

async function actualAuthorization(candidate: CreditFixture): Promise<string> {
  return `Bearer ${await actualSigner.issue({
    userId: candidate.fixture.actor,
    tenantId: candidate.fixture.tenant,
    scopes: [...issueScopes, readScope],
  })}`;
}

async function actualIssue(
  app: ReturnType<typeof createApp>,
  candidate: CreditFixture,
  options: { reason?: string; key?: string; property?: string; original?: string } = {},
): Promise<Response> {
  return app.handle(new Request(
    `http://yellow.test/api/v1/properties/${options.property ?? candidate.fixture.property}` +
      `/invoices/${options.original ?? candidate.invoice.documentId}/credit-notes`,
    {
      method: "POST",
      headers: {
        authorization: await actualAuthorization(candidate),
        "content-type": "application/json",
        "idempotency-key": options.key ?? `actual-http-credit-${candidate.invoice.documentId}`,
        "x-correlation-id": crypto.randomUUID(),
      },
      body: JSON.stringify({ reason: options.reason ?? "Full cancellation through signed-session HTTP" }),
    },
  ));
}

async function actualRead(
  app: ReturnType<typeof createApp>,
  candidate: CreditFixture,
  creditDocumentId: string,
): Promise<Response> {
  return app.handle(new Request(
    `http://yellow.test/api/v1/properties/${candidate.fixture.property}/credit-notes/${creditDocumentId}`,
    { headers: { authorization: await actualAuthorization(candidate) } },
  ));
}

actualDatabaseDescribe("Order446 ACTUAL PostgreSQL + signed-session HTTP proof (not a database mock)", () => {
  let deploy: SQL;
  let realDatabase: Database;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    deploy = new SQL(order446DeployUrl!, { max: 3, prepare: false });
    realDatabase = Database.connect(order446RuntimeUrl!, { maxConnections: 8, prepare: false });
    const [ready] = await deploy<{ commit_ready: boolean; read_ready: boolean }[]>`SELECT
      to_regprocedure('public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid)') IS NOT NULL AS commit_ready,
      to_regprocedure('public.read_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid)') IS NOT NULL AS read_ready`;
    if (!ready?.commit_ready || !ready.read_ready) {
      throw new Error("Order446 SQL is not installed; no actual signed-session HTTP proof claimed");
    }
    app = createApp({
      database: realDatabase,
      tenantResolver: new BearerTenantResolver(actualSigner),
      operatorApi: new OperatorHttpApi({} as LocalLoginService),
    });
  });

  afterAll(async () => {
    await realDatabase?.close();
    await deploy?.close();
  });

  test("issues, reads and replays exact durable bytes while authority and source invariants remain real", async () => {
    const candidate = await createCreditFixture(deploy, realDatabase);
    const foreign = await createCreditFixture(deploy, realDatabase);
    const sourceBefore = await originalCreditGraph(deploy, candidate);
    const key = `actual-http-credit-${candidate.invoice.documentId}`;
    const reason = "Full cancellation through signed-session HTTP";

    const issued = await actualIssue(app, candidate, { reason, key });
    expect(issued.status).toBe(201);
    expect(issued.headers.get("idempotency-replayed")).toBe("false");
    const exactReceipt = await issued.text();
    const parsed = JSON.parse(exactReceipt) as { documentId: string; correctionJournalId: string };

    const readResponse = await actualRead(app, candidate, parsed.documentId);
    expect(readResponse.status).toBe(200);
    expect(await readResponse.text()).toBe(exactReceipt);

    const replay = await actualIssue(app, candidate, { reason, key });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(exactReceipt);

    expect((await actualIssue(app, candidate, { reason: `${reason} changed`, key })).status).toBe(409);
    expect((await actualIssue(app, candidate, { reason, key: `${key}-changed` })).status).toBe(409);

    // The signed main-tenant session cannot select a foreign property or resolve a
    // foreign invoice through an otherwise authorized property route.
    expect((await actualIssue(app, candidate, { property: foreign.fixture.property })).status).toBe(403);
    expect((await actualIssue(app, candidate, { original: foreign.invoice.documentId, key: `${key}-foreign` })).status).toBe(404);
    // Reusing a completed key with any changed original conflicts consistently;
    // it reveals neither the existence nor the content of that changed target.
    expect((await actualIssue(app, candidate, { original: crypto.randomUUID(), key })).status).toBe(409);

    expect(await originalCreditGraph(deploy, candidate)).toBe(sourceBefore);
    const [effects] = await deploy<{
      credits: number; journals: number; documents: number; facts: number; events: number; replays: number;
    }[]>`SELECT
      (SELECT count(*)::int FROM public.india_native_fiscal_credit_note credit
        WHERE credit.tenant_id=${candidate.fixture.tenant}::uuid
          AND credit.original_document_id=${candidate.invoice.documentId}::uuid) AS credits,
      (SELECT count(*)::int FROM public.journal journal
        WHERE journal.tenant_id=${candidate.fixture.tenant}::uuid
          AND journal.id=${parsed.correctionJournalId}::uuid AND journal.kind='correction') AS journals,
      (SELECT count(*)::int FROM public.document document
        WHERE document.tenant_id=${candidate.fixture.tenant}::uuid
          AND document.id=${parsed.documentId}::uuid AND document.kind='credit_note') AS documents,
      (SELECT count(*)::int FROM public.fact_log fact
        WHERE fact.tenant_id=${candidate.fixture.tenant}::uuid AND fact.entity_type='document'
          AND fact.entity_id=${parsed.documentId}::uuid AND fact.fact_type='issued'
          AND fact.payload=${exactReceipt}::jsonb) AS facts,
      (SELECT count(*)::int FROM public.outbox event
        WHERE event.tenant_id=${candidate.fixture.tenant}::uuid AND event.aggregate_type='document'
          AND event.aggregate_id=${parsed.documentId}::uuid AND event.event_type='document.issued'
          AND event.payload=${exactReceipt}::jsonb) AS events,
      (SELECT count(*)::int FROM public.api_idempotency replay
        WHERE replay.tenant_id=${candidate.fixture.tenant}::uuid
          AND replay.operation='document.credit_note.issued' AND replay.response_body=${exactReceipt}::jsonb) AS replays`;
    expect(effects).toEqual({ credits: 1, journals: 1, documents: 1, facts: 1, events: 1, replays: 1 });

    const removed = await deploy<{ role_id: string }[]>`DELETE FROM public.user_role
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND user_id=${candidate.fixture.actor}::uuid RETURNING role_id`;
    expect(removed.length).toBeGreaterThan(0);
    expect((await actualIssue(app, candidate, { reason, key })).status).toBe(403);
  }, 180_000);
});
