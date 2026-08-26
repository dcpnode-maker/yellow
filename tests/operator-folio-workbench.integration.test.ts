import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { ChargeCorrectionService, ChargeService, FolioStatementService } from "../src/contexts/financials";
import { BearerTenantResolver, hashLocalPassword, Hs256TokenSigner, LocalLoginService, verifyLocalPassword } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency, type TenantRequestContext, type Tx } from "../src/kernel";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const TENANT = "00000000-0000-0000-0000-000000010501";
const ACTOR = "00000000-0000-0000-0000-000000010502";
const PROPERTY = "00000000-0000-0000-0000-000000010503";
const FOLIO = "00000000-0000-0000-0000-000000010504";

function operatorWithFinancials(statements: unknown, charges: unknown, corrections?: unknown): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as never, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, statements as never, charges as never,
    undefined, undefined, undefined, corrections as never,
  );
}

function financialContext(request: Request, scopes: readonly string[], granted = true): TenantRequestContext {
  const tx = (async () => granted ? [{ id: PROPERTY, name: "Yellow", timezone: "UTC", currency: "USD" }] : []) as unknown as Tx;
  return { request, tenantId: TENANT, identity: { tenantId: TENANT, actorId: ACTOR, scopes }, tx };
}

function functionSlice(name: string, nextName: string): string {
  const start = script.indexOf(`  function ${name}`);
  const end = script.indexOf(`  function ${nextName}`, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return script.slice(start, end);
}

function asyncFunctionSlice(name: string, nextMarker: string): string {
  const start = script.indexOf(`  async function ${name}`);
  const end = script.indexOf(`  ${nextMarker}`, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return script.slice(start, end);
}

describe("Order 105 operator folio workbench", () => {
  test("P3: the folio journey is semantic, explicit and accessible", () => {
    expect(html).toContain('data-view="folios"');
    expect(html).toContain('id="folio-statement-lookup-form"');
    expect(html).toContain('id="folio-reference"');
    expect(html).toContain('<table class="folio-lines">');
    expect(html).toContain('<caption id="folio-lines-caption">Immutable folio statement');
    expect(html.match(/<th scope="col">/g)).toHaveLength(6);
    expect(html).toContain('id="folio-load-older"');
    expect(html).toContain('id="folio-charge-code" name="txCode"');
    expect(html).toContain("I understand this irreversibly posts an untaxed charge.");
    expect(html).toContain('id="folio-error" role="alert" aria-live="assertive"');
    expect(html).toContain("This is not tax calculation, invoicing, payment, settlement, fiscalization or checkout.");
    expect(css).toContain(".folio-lines");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  test("P3: browser renders exact server strings and exposes no ledger authority", () => {
    const folioSurface = script.slice(
      script.indexOf("  function isCurrentFolioRequest("),
      script.indexOf("  function setView(", script.indexOf("  function isCurrentFolioRequest(")),
    );
    expect(folioSurface).toContain("cell.textContent");
    expect(folioSurface).toContain('folioBalance.textContent = exactFolioMinor(statement.balanceMinor, "server balance")');
    expect(folioSurface).toContain('const amount = exactFolioMinor(row.amountMinor, "amount")');
    expect(folioSurface).toContain('const running = exactFolioMinor(row.runningBalanceMinor, "running balance")');
    expect(folioSurface).not.toMatch(/\bNumber\s*\(|parseInt\s*\(|parseFloat\s*\(|Math\.|\.toFixed\s*\(/);
    expect(folioSurface).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
    expect(folioSurface).not.toMatch(/accountId|businessDate\s*:|currency\s*:|journalKind|debit|credit|routeId|balanceMinor\s*:/);
    expect(folioSurface).toContain('txCode: String(fields.get("txCode") || "")');
    expect(folioSurface).toContain('amountMinor: String(fields.get("amountMinor") || "")');
  });

  test("P3: lookup and older-page requests are bounded and stale-safe", () => {
    const lookup = asyncFunctionSlice("lookupFolioStatement", "async function loadFolioWorkspace");
    const page = functionSlice("loadOlderFolioRows", "openFolioWorkspace");
    const workspace = asyncFunctionSlice("loadFolioWorkspace", "function loadOlderFolioRows");
    expect(lookup).toContain("/statement?limit=50");
    expect(workspace).toContain("?after=");
    expect(workspace).toContain("&limit=50");
    expect(lookup.match(/isCurrentFolioRequest\(generation, property, identity\)/g)).toHaveLength(1);
    expect(lookup.match(/generation !== folioGeneration \|\| property !== propertySelect\.value \|\| activeView !== "folios"/g)).toHaveLength(1);
    expect(workspace.match(/isCurrentFolioRequest\(generation, property, identity, folioId\)/g)).toHaveLength(2);
    expect(workspace).toContain("renderFolioStatement(statement)");
    expect(page).toContain("void loadFolioWorkspace(folioStatementData.folio.id, cursor)");
  });

  test("P3: charge uses one retry key and refetches only after server success", () => {
    const charge = asyncFunctionSlice("postFolioCharge", "function setView");
    expect(charge).toContain("folioChargeAttemptKey = crypto.randomUUID()");
    expect(charge).toContain('headers: { "idempotency-key": attemptKey }');
    expect(charge.match(/isCurrentFolioRequest\(generation, property, identity, folioId\)/g)).toHaveLength(4);
    const postAt = charge.indexOf('method: "POST"');
    const refetchAt = charge.indexOf("/statement?limit=50", postAt);
    const renderAt = charge.indexOf("renderFolioStatement(refreshed)", refetchAt);
    expect(postAt).toBeGreaterThanOrEqual(0);
    expect(refetchAt).toBeGreaterThan(postAt);
    expect(renderAt).toBeGreaterThan(refetchAt);
    expect(charge.slice(0, refetchAt)).not.toContain("renderFolioRows(");
    expect(charge).toContain("Retry keeps the same idempotency key.");
  });

  test("P3 extracted canary: generation, property and folio identity all guard repaint", () => {
    const source = functionSlice("folioRefreshDecision", "isCurrentFolioRequest");
    const decide = Function(`${source}\nreturn folioRefreshDecision;`)() as
      (origin: Record<string, unknown>, current: Record<string, unknown>) => string;
    const origin = { generation: 7, property: "property-a", identity: "folio-a", folioId: "folio-a" };
    const current = { ...origin, active: true };
    expect(decide(origin, current)).toBe("render");
    expect(decide(origin, { ...current, generation: 6 })).toBe("suppress");
    expect(decide(origin, { ...current, property: "property-b" })).toBe("suppress");
    expect(decide(origin, { ...current, identity: "folio-b" })).toBe("suppress");
    expect(decide(origin, { ...current, active: false })).toBe("suppress");
  });

  test("P3: property change and sign-out invalidate and clear all folio state", () => {
    const clear = functionSlice("clearFolioState", "folioCell");
    expect(clear).toContain("folioGeneration += 1");
    expect(clear).toContain('folioIdentity = ""');
    expect(clear).toContain("resetFolioPresentation()");
    const showLoginStart = script.indexOf("  function showLogin()");
    const showLogin = script.slice(showLoginStart, script.indexOf("  async function loadProperties()", showLoginStart));
    expect(showLogin).toContain("clearFolioState()");
    const propertyChange = script.slice(
      script.indexOf('propertySelect.addEventListener("change"'),
      script.indexOf("  for (const tab of navigation)", script.indexOf('propertySelect.addEventListener("change"')),
    );
    expect(propertyChange).toContain("clearFolioState()");
  });

  test("Order 183 P3: correction UI uses server eligibility, exact BigInt preview and immutable language", () => {
    expect(html).not.toContain('id="folio-tab-correction"');
    expect(html).toContain('id="folio-correction-panel" hidden aria-labelledby="folio-correction-heading"');
    expect(script).toContain('action.textContent = "Correct a wrong charge"');
    expect(html).toContain('id="folio-correction-reason" name="reason" required minlength="1" maxlength="500"');
    expect(html).toContain("new immutable balanced adjustment and does not edit or delete the original");
    const render = functionSlice("renderFolioRows", "renderFolioChargeOptions");
    expect(render).toContain("row.correctionEligible === true");
    expect(render).toContain("row.reversesJournalId");
    expect(render).toContain("row.reversedByJournalId");
    expect(render).not.toContain("reversalJournalId");
    const open = functionSlice("openFolioCorrection", "folioCorrectionBody");
    expect(open).toContain("BigInt(exactFolioMinor");
    expect(open).toContain("const effect = -original");
    expect(open).not.toMatch(/\bNumber\s*\(|parseInt\s*\(|parseFloat\s*\(|Math\.|\.toFixed\s*\(/);
    const post = asyncFunctionSlice("postFolioCorrection", "function setFolioTab");
    expect(post).toContain("/adjustments");
    expect(post).toContain('headers: { "idempotency-key": attemptKey }');
    expect(post.indexOf("/statement?limit=50")).toBeGreaterThan(post.indexOf('method: "POST"'));
    expect(post).toContain("Retry keeps the same idempotency key.");
  });

  test("Order 183 P2: exact correction adapter derives all authority and rejects forged body fields", async () => {
    let captured: Record<string, unknown> | null = null;
    const operator = operatorWithFinancials({ async get() { throw new Error("must not run"); } },
      { async postCharge() { throw new Error("must not run"); } }, {
        async reverseCharge(_tx: Tx, input: Record<string, unknown>) {
          captured = input;
          return { journalId: "00000000-0000-0000-0000-000000018399", folioId: FOLIO,
            reversesJournalId: "00000000-0000-0000-0000-000000018398", businessDate: "2026-08-26",
            currency: "USD", amountMinor: "-100", replayed: false };
        },
      });
    const request = new Request("http://yellow.test/", { method: "POST", headers: {
      "idempotency-key": "order183-http-key",
      "x-correlation-id": "00000000-0000-0000-0000-000000018397",
      "x-post-seal-authorized": "true",
    } });
    const response = await operator.correctFolioCharge(financialContext(request,
      ["financials.adjustments:write", "financials.adjustments:post-seal"]), PROPERTY, FOLIO,
    { reversesJournalId: "00000000-0000-0000-0000-000000018398", reason: "Wrong room charge" });
    expect(response.status).toBe(201);
    expect(captured as unknown).toEqual({
      tenantId: TENANT, folioId: FOLIO,
      reversesJournalId: "00000000-0000-0000-0000-000000018398", reason: "Wrong room charge",
      postSealAuthorized: true, idempotencyKey: "order183-http-key",
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY,
        requestId: "00000000-0000-0000-0000-000000018397", operation: "journal.posted" },
    });
    const bad = await operator.correctFolioCharge(financialContext(request,
      ["financials.adjustments:write", "financials.adjustments:post-seal"]), PROPERTY, FOLIO,
    { reversesJournalId: "00000000-0000-0000-0000-000000018398", reason: "Wrong room charge",
      postSealAuthorized: true });
    expect(bad.status).toBe(400);
  });

  test("P2: read and write permissions remain separate before financial services", async () => {
    let statementCalls = 0;
    let chargeCalls = 0;
    const operator = operatorWithFinancials({
      async get(_tx: Tx, input: unknown) {
        statementCalls += 1;
        expect(input).toEqual({ tenantId: TENANT, propertyNode: PROPERTY, reference: "FOL-105", limit: 100,
          canCorrectCharge: false, canPostSealAdjustment: false });
        return {
          folio: { id: FOLIO, reference: "FOL-105", name: null, windowNo: 1, status: "open", currency: "USD", createdAt: "2026-08-24T00:00:00.000000Z" },
          balanceMinor: "0", lineCount: 0, rows: [], chargeOptions: [],
          chargeAvailability: { allowed: false, reason: "No route" }, nextCursor: null,
        };
      },
    }, {
      async postCharge() { chargeCalls += 1; throw new Error("must not run"); },
    });
    const getRequest = new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/folios/FOL-105/statement?limit=100`);
    const getResponse = await operator.folioStatement(
      financialContext(getRequest, ["financials.folios:read"]), PROPERTY, "FOL-105",
    );
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("cache-control")).toBe("no-store");
    expect((await getResponse.json() as { folio: { id: string } }).folio.id).toBe(FOLIO);
    const forbiddenPost = await operator.postFolioCharge(
      financialContext(new Request("http://yellow.test/", {
        method: "POST", headers: { "idempotency-key": "order105-read-only" },
      }), ["financials.folios:read"]), PROPERTY, FOLIO,
      { txCode: "ROOM", amountMinor: "100" },
    );
    expect(forbiddenPost.status).toBe(403);
    expect(statementCalls).toBe(1);
    expect(chargeCalls).toBe(0);
  });

  test("P2: charge adapter accepts only the governed body/header and builds one server envelope", async () => {
    let captured: Record<string, unknown> | null = null;
    const operator = operatorWithFinancials({ async get() { throw new Error("must not run"); } }, {
      async postCharge(_tx: Tx, input: Record<string, unknown>) {
        captured = input;
        return { journalId: "00000000-0000-0000-0000-000000010505", folioId: FOLIO,
          businessDate: "2026-08-24", currency: "USD", txCode: "ROOM", amountMinor: "9007199254740993",
          quantity: "1.000", replayed: false };
      },
    });
    const request = new Request("http://yellow.test/", {
      method: "POST",
      headers: { "idempotency-key": "order105-same-retry-key", "x-correlation-id": "00000000-0000-0000-0000-000000010506" },
    });
    const forbiddenGet = await operator.folioStatement(
      financialContext(new Request("http://yellow.test/"), ["financials.charges:write"]), PROPERTY, "FOL-105",
    );
    expect(forbiddenGet.status).toBe(403);
    const response = await operator.postFolioCharge(
      financialContext(request, ["financials.charges:write"]), PROPERTY, FOLIO,
      { txCode: "ROOM", amountMinor: "9007199254740993" },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(captured as unknown).toEqual({
      tenantId: TENANT, folioId: FOLIO, txCode: "ROOM", amountMinor: "9007199254740993",
      idempotencyKey: "order105-same-retry-key",
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY,
        requestId: "00000000-0000-0000-0000-000000010506", operation: "journal.posted" },
    });
  });

  test("P2: hostile query, body and property grant fail without a domain call", async () => {
    let calls = 0;
    const operator = operatorWithFinancials({ async get() { calls += 1; throw new Error("must not run"); } }, {
      async postCharge() { calls += 1; throw new Error("must not run"); },
    });
    const badQuery = await operator.folioStatement(financialContext(new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/folios/FOL-105/statement?limit=50&limit=51`,
    ), ["financials.folios:read"]), PROPERTY, "FOL-105");
    expect(badQuery.status).toBe(400);
    const badBody = await operator.postFolioCharge(financialContext(new Request("http://yellow.test/", {
      method: "POST", headers: { "idempotency-key": "order105-hostile-body" },
    }), ["financials.charges:write"]), PROPERTY, FOLIO,
    { txCode: "ROOM", amountMinor: "100", currency: "USD" });
    expect(badBody.status).toBe(400);
    const ungranted = await operator.folioStatement(financialContext(new Request("http://yellow.test/"),
      ["financials.folios:read"], false), PROPERTY, "FOL-105");
    expect(ungranted.status).toBe(403);
    expect(calls).toBe(0);
  });
});

const FOLIO_HTTP_URL = process.env.YELLOW_OPERATOR_FOLIO_URL;
if (process.env.YELLOW_REQUIRE_OPERATOR_FOLIO === "1" && !FOLIO_HTTP_URL) {
  throw new Error("YELLOW_OPERATOR_FOLIO_URL is required by the Order 105 HTTP proof");
}
const folioHttpDescribe = FOLIO_HTTP_URL ? describe.serial : describe.skip;
const HTTP_PASSWORD = "Order105-local-proof-password";
const HTTP_SECRET = "yellow-order-105-http-proof-secret-long-enough";
const HTTP_TENANT_A = "00000000-0000-0000-0000-000000010511";
const HTTP_TENANT_B = "00000000-0000-0000-0000-000000010512";
const HTTP_GROUP_A = "00000000-0000-0000-0000-000000010521";
const HTTP_PROPERTY_A = "00000000-0000-0000-0000-000000010522";
const HTTP_PROPERTY_CHILD = "00000000-0000-0000-0000-000000010523";
const HTTP_PROPERTY_B = "00000000-0000-0000-0000-000000010524";
const HTTP_READ_USER = "00000000-0000-0000-0000-000000010531";
const HTTP_WRITE_USER = "00000000-0000-0000-0000-000000010532";
const HTTP_FOREIGN_USER = "00000000-0000-0000-0000-000000010533";
const HTTP_APPROVER_USER = "00000000-0000-0000-0000-000000010534";
const HTTP_READ_ROLE = "00000000-0000-0000-0000-000000010541";
const HTTP_WRITE_ROLE = "00000000-0000-0000-0000-000000010542";
const HTTP_FOREIGN_ROLE = "00000000-0000-0000-0000-000000010543";
const HTTP_APPROVER_ROLE = "00000000-0000-0000-0000-000000010544";
const HTTP_GUEST_A = "00000000-0000-0000-0000-000000010551";
const HTTP_GUEST_CHILD = "00000000-0000-0000-0000-000000010552";
const HTTP_GUEST_B = "00000000-0000-0000-0000-000000010553";
const HTTP_REVENUE_A = "00000000-0000-0000-0000-000000010561";
const HTTP_REVENUE_CHILD = "00000000-0000-0000-0000-000000010562";
const HTTP_REVENUE_B = "00000000-0000-0000-0000-000000010563";
const HTTP_FOLIO_A = "00000000-0000-0000-0000-000000010571";
const HTTP_FOLIO_CHILD = "00000000-0000-0000-0000-000000010572";
const HTTP_FOLIO_B = "00000000-0000-0000-0000-000000010573";
const HTTP_TX_CODE = "O105ROOM";

let folioAdmin: SQL | undefined;
let folioLoginPool: SQL | undefined;
let folioEventPool: SQL | undefined;
let folioDatabase: Database | undefined;
let folioHttpApp: ReturnType<typeof createApp> | undefined;
let folioBusinessDate = "";
let readToken = "";
let writeToken = "";
let approverToken = "";

async function cleanFolioHttpFixture(): Promise<void> {
  if (!folioAdmin) return;
  for (const table of [
    "api_idempotency", "outbox", "fact_log", "posting_line", "journal", "tx_code_route",
    "business_day", "folio", "account",
  ]) {
    await folioAdmin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`,
      [HTTP_TENANT_A, HTTP_TENANT_B]);
  }
  await folioAdmin`DELETE FROM user_role WHERE tenant_id IN (${HTTP_TENANT_A}::uuid,${HTTP_TENANT_B}::uuid)`;
  await folioAdmin`DELETE FROM role_permission WHERE role_id IN
    (${HTTP_READ_ROLE}::uuid,${HTTP_WRITE_ROLE}::uuid,${HTTP_FOREIGN_ROLE}::uuid,${HTTP_APPROVER_ROLE}::uuid)`;
  await folioAdmin`DELETE FROM role WHERE id IN
    (${HTTP_READ_ROLE}::uuid,${HTTP_WRITE_ROLE}::uuid,${HTTP_FOREIGN_ROLE}::uuid,${HTTP_APPROVER_ROLE}::uuid)`;
  await folioAdmin`DELETE FROM app_user WHERE tenant_id IN (${HTTP_TENANT_A}::uuid,${HTTP_TENANT_B}::uuid)`;
  await folioAdmin`DELETE FROM org_node WHERE tenant_id IN (${HTTP_TENANT_A}::uuid,${HTTP_TENANT_B}::uuid)`;
  await folioAdmin`DELETE FROM tenant WHERE id IN (${HTTP_TENANT_A}::uuid,${HTTP_TENANT_B}::uuid)`;
  await folioAdmin`DELETE FROM tx_code WHERE code=${HTTP_TX_CODE}`;
}

function folioHttpRequest(path: string, init: RequestInit = {}): Promise<Response> {
  if (!folioHttpApp) throw new Error("Order 105 HTTP app is not initialized");
  return folioHttpApp.handle(new Request(`http://yellow.test${path}`, init));
}

function folioAuth(token: string, key?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    ...(key ? { "idempotency-key": key } : {}),
  };
}

async function folioLogin(email: string): Promise<string> {
  const response = await folioHttpRequest("/api/v1/auth/local:login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant: "order105-http-a", email, password: HTTP_PASSWORD }),
  });
  expect(response.status).toBe(200);
  return (await response.json() as { accessToken: string }).accessToken;
}

async function folioArtifacts(): Promise<{
  journals: number; lines: number; facts: number; events: number; keys: number;
}> {
  const rows = await folioAdmin!<Array<{
    journals: number; lines: number; facts: number; events: number; keys: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${HTTP_TENANT_A}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${HTTP_TENANT_A}::uuid) lines,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${HTTP_TENANT_A}::uuid AND fact_type='journal.posted') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${HTTP_TENANT_A}::uuid AND event_type='journal.posted') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${HTTP_TENANT_A}::uuid
        AND operation='financials.charge.post') keys
  `;
  return rows[0]!;
}

beforeAll(async () => {
  if (!FOLIO_HTTP_URL) return;
  folioAdmin = new SQL(FOLIO_HTTP_URL, { max: 12 });
  folioLoginPool = new SQL(FOLIO_HTTP_URL, { max: 4 });
  folioEventPool = new SQL(FOLIO_HTTP_URL, { max: 8 });
  folioDatabase = Database.connect(FOLIO_HTTP_URL, { maxConnections: 16 });
  await cleanFolioHttpFixture();
  folioBusinessDate = (await folioAdmin<Array<{ business_date: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS business_date`)[0]!.business_date;
  const auth = await hashLocalPassword(HTTP_PASSWORD);
  await folioAdmin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${HTTP_TENANT_A}::uuid,'order105-http-a','Order 105 HTTP A','shared','active'),
    (${HTTP_TENANT_B}::uuid,'order105-http-b','Order 105 HTTP B','shared','active')`;
  await folioAdmin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${HTTP_GROUP_A}::uuid,${HTTP_TENANT_A}::uuid,'order105_http','group','Order 105 group',NULL,NULL),
    (${HTTP_PROPERTY_A}::uuid,${HTTP_TENANT_A}::uuid,'order105_http.exact','property','Order 105 exact','UTC','USD'),
    (${HTTP_PROPERTY_CHILD}::uuid,${HTTP_TENANT_A}::uuid,'order105_http.child','property','Order 105 child','UTC','USD'),
    (${HTTP_PROPERTY_B}::uuid,${HTTP_TENANT_B}::uuid,'order105_http_b','property','Order 105 foreign','UTC','USD')`;
  await folioAdmin`INSERT INTO app_user(id,tenant_id,email,display_name,auth,status) VALUES
    (${HTTP_READ_USER}::uuid,${HTTP_TENANT_A}::uuid,'read@order105.test','Order 105 reader',${JSON.stringify(auth)}::text::jsonb,'active'),
    (${HTTP_WRITE_USER}::uuid,${HTTP_TENANT_A}::uuid,'write@order105.test','Order 105 writer',${JSON.stringify(auth)}::text::jsonb,'active'),
    (${HTTP_FOREIGN_USER}::uuid,${HTTP_TENANT_B}::uuid,'foreign@order105.test','Order 105 foreign',${JSON.stringify(auth)}::text::jsonb,'active'),
    (${HTTP_APPROVER_USER}::uuid,${HTTP_TENANT_A}::uuid,'approver@order105.test','Order 105 approver',${JSON.stringify(auth)}::text::jsonb,'active')`;
  await folioAdmin`INSERT INTO permission(code,description) VALUES
    ('financials.folios:read','Read property folio statements'),
    ('financials.charges:write','Post governed charges to property folios'),
    ('financials.adjustments:write','Correct governed folio charges'),
    ('financials.adjustments:post-seal','Correct charges after business-day seal')
    ON CONFLICT (code) DO NOTHING`;
  await folioAdmin`INSERT INTO role(id,tenant_id,name) VALUES
    (${HTTP_READ_ROLE}::uuid,${HTTP_TENANT_A}::uuid,'Order 105 exact reader'),
    (${HTTP_WRITE_ROLE}::uuid,${HTTP_TENANT_A}::uuid,'Order 105 ancestor writer'),
    (${HTTP_FOREIGN_ROLE}::uuid,${HTTP_TENANT_B}::uuid,'Order 105 foreign reader'),
    (${HTTP_APPROVER_ROLE}::uuid,${HTTP_TENANT_A}::uuid,'Order 105 post-seal approver')`;
  await folioAdmin`INSERT INTO role_permission(role_id,permission_code) VALUES
    (${HTTP_READ_ROLE}::uuid,'financials.folios:read'),
    (${HTTP_WRITE_ROLE}::uuid,'financials.charges:write'),
    (${HTTP_WRITE_ROLE}::uuid,'financials.adjustments:write'),
    (${HTTP_FOREIGN_ROLE}::uuid,'financials.folios:read'),
    (${HTTP_APPROVER_ROLE}::uuid,'financials.adjustments:write'),
    (${HTTP_APPROVER_ROLE}::uuid,'financials.adjustments:post-seal')`;
  await folioAdmin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
    (${HTTP_TENANT_A}::uuid,${HTTP_READ_USER}::uuid,${HTTP_READ_ROLE}::uuid,${HTTP_PROPERTY_A}::uuid),
    (${HTTP_TENANT_A}::uuid,${HTTP_WRITE_USER}::uuid,${HTTP_WRITE_ROLE}::uuid,${HTTP_GROUP_A}::uuid),
    (${HTTP_TENANT_B}::uuid,${HTTP_FOREIGN_USER}::uuid,${HTTP_FOREIGN_ROLE}::uuid,${HTTP_PROPERTY_B}::uuid),
    (${HTTP_TENANT_A}::uuid,${HTTP_APPROVER_USER}::uuid,${HTTP_APPROVER_ROLE}::uuid,${HTTP_PROPERTY_A}::uuid)`;
  await folioAdmin`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES
    (${HTTP_GUEST_A}::uuid,${HTTP_TENANT_A}::uuid,${HTTP_PROPERTY_A}::uuid,'guest','Order 105 exact guest','USD','open'),
    (${HTTP_GUEST_CHILD}::uuid,${HTTP_TENANT_A}::uuid,${HTTP_PROPERTY_CHILD}::uuid,'guest','Order 105 child guest','USD','open'),
    (${HTTP_GUEST_B}::uuid,${HTTP_TENANT_B}::uuid,${HTTP_PROPERTY_B}::uuid,'guest','Order 105 foreign guest','USD','open'),
    (${HTTP_REVENUE_A}::uuid,${HTTP_TENANT_A}::uuid,${HTTP_PROPERTY_A}::uuid,'revenue','Order 105 exact revenue','USD','open'),
    (${HTTP_REVENUE_CHILD}::uuid,${HTTP_TENANT_A}::uuid,${HTTP_PROPERTY_CHILD}::uuid,'revenue','Order 105 child revenue','USD','open'),
    (${HTTP_REVENUE_B}::uuid,${HTTP_TENANT_B}::uuid,${HTTP_PROPERTY_B}::uuid,'revenue','Order 105 foreign revenue','USD','open')`;
  await folioAdmin`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,status) VALUES
    (${HTTP_FOLIO_A}::uuid,${HTTP_TENANT_A}::uuid,${HTTP_GUEST_A}::uuid,'O105-EXACT',1,'open'),
    (${HTTP_FOLIO_CHILD}::uuid,${HTTP_TENANT_A}::uuid,${HTTP_GUEST_CHILD}::uuid,'O105-CHILD',1,'open'),
    (${HTTP_FOLIO_B}::uuid,${HTTP_TENANT_B}::uuid,${HTTP_GUEST_B}::uuid,'O105-FOREIGN',1,'open')`;
  await folioAdmin`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
    VALUES(${HTTP_TX_CODE},'Order 105 room charge','revenue','Rooms','guest','revenue')`;
  await folioAdmin`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id) VALUES
    (${HTTP_TENANT_A}::uuid,${HTTP_PROPERTY_A}::uuid,'USD',${HTTP_TX_CODE},${HTTP_REVENUE_A}::uuid),
    (${HTTP_TENANT_A}::uuid,${HTTP_PROPERTY_CHILD}::uuid,'USD',${HTTP_TX_CODE},${HTTP_REVENUE_CHILD}::uuid),
    (${HTTP_TENANT_B}::uuid,${HTTP_PROPERTY_B}::uuid,'USD',${HTTP_TX_CODE},${HTTP_REVENUE_B}::uuid)`;
  await folioAdmin`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
    (${HTTP_TENANT_A}::uuid,${HTTP_PROPERTY_A}::uuid,${folioBusinessDate}::date),
    (${HTTP_TENANT_A}::uuid,${HTTP_PROPERTY_CHILD}::uuid,${folioBusinessDate}::date),
    (${HTTP_TENANT_B}::uuid,${HTTP_PROPERTY_B}::uuid,${folioBusinessDate}::date)`;

  const tokens = new Hs256TokenSigner(HTTP_SECRET);
  const storedAuth = (await folioAdmin<Array<{ auth: unknown }>>`
    SELECT auth FROM app_user WHERE id=${HTTP_READ_USER}::uuid`)[0]?.auth;
  expect(await verifyLocalPassword(HTTP_PASSWORD, storedAuth)).toBeTrue();
  const login = new LocalLoginService(folioLoginPool, tokens);
  const events = new PostgresEventBus(folioEventPool);
  const statements = new FolioStatementService();
  const charges = new ChargeService({ events, idempotency: new PostgresIdempotency() });
  const corrections = new ChargeCorrectionService({ events, idempotency: new PostgresIdempotency() });
  folioHttpApp = createApp({
    database: folioDatabase,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      login, undefined, undefined, new PostgresIdempotency(),
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, statements, charges,
      undefined, undefined, undefined, corrections,
    ),
  });
  readToken = await folioLogin("read@order105.test");
  writeToken = await folioLogin("write@order105.test");
  approverToken = await folioLogin("approver@order105.test");
}, 60_000);

afterAll(async () => {
  if (!FOLIO_HTTP_URL) return;
  await cleanFolioHttpFixture();
  await folioDatabase?.close();
  await folioEventPool?.close();
  await folioLoginPool?.close();
  await folioAdmin?.close();
}, 60_000);

folioHttpDescribe("Order 105 real authenticated folio HTTP proof", () => {
  test("P2: exact read and ancestor write grants remain separate", async () => {
    const exactRead = await folioHttpRequest(
      `/api/v1/properties/${HTTP_PROPERTY_A}/folios/O105-EXACT/statement?limit=50`,
      { headers: folioAuth(readToken) },
    );
    expect(exactRead.status).toBe(200);
    expect(exactRead.headers.get("cache-control")).toBe("no-store");
    expect(await exactRead.json()).toMatchObject({
      folio: { id: HTTP_FOLIO_A, reference: "O105-EXACT", currency: "USD", status: "open" },
      balanceMinor: "0", lineCount: 0,
      chargeOptions: [{ code: HTTP_TX_CODE, name: "Order 105 room charge", usaliLine: "Rooms" }],
    });
    const readCannotPost = await folioHttpRequest(
      `/api/v1/properties/${HTTP_PROPERTY_A}/folios/${HTTP_FOLIO_A}/charges`, {
        method: "POST", headers: folioAuth(readToken, "order105-read-cannot-post"),
        body: JSON.stringify({ txCode: HTTP_TX_CODE, amountMinor: "1" }),
      });
    expect(readCannotPost.status).toBe(403);
    const exactDoesNotReachSibling = await folioHttpRequest(
      `/api/v1/properties/${HTTP_PROPERTY_CHILD}/folios/O105-CHILD/statement`,
      { headers: folioAuth(readToken) },
    );
    expect(exactDoesNotReachSibling.status).toBe(403);
    const writeCannotRead = await folioHttpRequest(
      `/api/v1/properties/${HTTP_PROPERTY_CHILD}/folios/O105-CHILD/statement`,
      { headers: folioAuth(writeToken) },
    );
    expect(writeCannotRead.status).toBe(403);
    expect(await folioArtifacts()).toEqual({ journals: 0, lines: 0, facts: 0, events: 0, keys: 0 });
  }, 30_000);

  test("P2: cross-property and cross-tenant references share one generic not-found response", async () => {
    const bodies = [];
    for (const reference of [HTTP_FOLIO_CHILD, HTTP_FOLIO_B]) {
      const response = await folioHttpRequest(
        `/api/v1/properties/${HTTP_PROPERTY_A}/folios/${reference}/statement`,
        { headers: folioAuth(readToken) },
      );
      expect(response.status).toBe(404);
      const { correlation_id: _correlation, ...body } = await response.json() as Record<string, unknown>;
      bodies.push(body);
    }
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[0]).toEqual({
      type: "financials/not_found", title: "Not found", status: 404,
      detail: "The requested folio or charge configuration was not found",
    });
    expect(await folioArtifacts()).toEqual({ journals: 0, lines: 0, facts: 0, events: 0, keys: 0 });
  }, 30_000);

  test("P2: hostile queries and charge bodies fail before financial effects", async () => {
    const hostileGet = await folioHttpRequest(
      `/api/v1/properties/${HTTP_PROPERTY_A}/folios/O105-EXACT/statement?limit=50&limit=51`,
      { headers: folioAuth(readToken) },
    );
    expect(hostileGet.status).toBe(400);
    for (const body of [
      { txCode: HTTP_TX_CODE, amountMinor: "1", account: HTTP_REVENUE_CHILD },
      { txCode: HTTP_TX_CODE, amountMinor: "9007199254740993", currency: "USD" },
      { txCode: HTTP_TX_CODE, amountMinor: 1 },
    ]) {
      const response = await folioHttpRequest(
        `/api/v1/properties/${HTTP_PROPERTY_CHILD}/folios/${HTTP_FOLIO_CHILD}/charges`, {
          method: "POST", headers: folioAuth(writeToken, `order105-hostile-${crypto.randomUUID()}`),
          body: JSON.stringify(body),
        });
      expect(response.status).toBe(400);
    }
    expect(await folioArtifacts()).toEqual({ journals: 0, lines: 0, facts: 0, events: 0, keys: 0 });
  }, 30_000);

  test("P2: ancestor-granted POST creates only the canonical Order 104 journal and replays exactly", async () => {
    const key = "order105-http-canonical-replay";
    const correlation = "00000000-0000-0000-0000-000000010599";
    const post = (amountMinor: string) => folioHttpRequest(
      `/api/v1/properties/${HTTP_PROPERTY_CHILD}/folios/${HTTP_FOLIO_CHILD}/charges`, {
        method: "POST",
        headers: { ...folioAuth(writeToken, key), "x-correlation-id": correlation },
        body: JSON.stringify({ txCode: HTTP_TX_CODE, amountMinor, quantity: "2.500" }),
      });
    const first = await post("9007199254740993");
    expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    const firstBody = await first.json() as { journalId: string; replayed: boolean };
    expect(firstBody).toMatchObject({ folioId: HTTP_FOLIO_CHILD, businessDate: folioBusinessDate,
      currency: "USD", txCode: HTTP_TX_CODE, amountMinor: "9007199254740993", quantity: "2.500", replayed: false });
    const lines = await folioAdmin!<Array<Record<string, unknown>>>`
      SELECT seq,account_id,folio_id,tx_code,amount_minor::text,quantity::text,business_date::text,currency,tax_detail
      FROM posting_line WHERE journal_id=${firstBody.journalId}::uuid ORDER BY seq`;
    expect(lines).toEqual([
      { seq: 1, account_id: HTTP_GUEST_CHILD, folio_id: HTTP_FOLIO_CHILD, tx_code: HTTP_TX_CODE,
        amount_minor: "9007199254740993", quantity: "2.500", business_date: folioBusinessDate,
        currency: "USD", tax_detail: null },
      { seq: 2, account_id: HTTP_REVENUE_CHILD, folio_id: null, tx_code: HTTP_TX_CODE,
        amount_minor: "-9007199254740993", quantity: "2.500", business_date: folioBusinessDate,
        currency: "USD", tax_detail: null },
    ]);
    const evidence = (await folioAdmin!<Array<{ created_by: string; fact: unknown; event: unknown }>>`
      SELECT j.created_by,f.payload fact,o.payload event
      FROM journal j
      JOIN fact_log f ON f.tenant_id=j.tenant_id AND f.entity_id=j.id AND f.fact_type='journal.posted'
      JOIN outbox o ON o.tenant_id=j.tenant_id AND o.aggregate_id=j.id AND o.event_type='journal.posted'
      WHERE j.id=${firstBody.journalId}::uuid`)[0]!;
    expect(evidence.created_by).toBe(HTTP_WRITE_USER);
    const { request_id: factRequestId, ...factPayload } = evidence.fact as Record<string, unknown>;
    expect(factRequestId).toBe(correlation);
    expect(factPayload).toEqual(evidence.event as Record<string, unknown>);
    expect(JSON.stringify(evidence)).not.toMatch(/password|email|party|token|tax_detail/i);
    expect(await folioArtifacts()).toEqual({ journals: 1, lines: 2, facts: 1, events: 1, keys: 1 });

    const replay = await post("9007199254740993");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual({ ...firstBody, replayed: true });
    expect(await folioArtifacts()).toEqual({ journals: 1, lines: 2, facts: 1, events: 1, keys: 1 });

    const changed = await post("9007199254740994");
    expect(changed.status).toBe(409);
    expect((await changed.json() as { type: string }).type).toBe("request/idempotency_conflict");
    expect(await folioArtifacts()).toEqual({ journals: 1, lines: 2, facts: 1, events: 1, keys: 1 });
  }, 30_000);

  test("Order 183 real HTTP correction honors open-day and post-seal authority", async () => {
    const charge = await folioHttpRequest(
      `/api/v1/properties/${HTTP_PROPERTY_A}/folios/${HTTP_FOLIO_A}/charges`, {
        method: "POST", headers: folioAuth(writeToken, "order183-http-original"),
        body: JSON.stringify({ txCode: HTTP_TX_CODE, amountMinor: "700", quantity: "1.000" }),
      });
    expect(charge.status).toBe(201);
    const original = await charge.json() as { journalId: string };
    const adjustmentPath = `/api/v1/properties/${HTTP_PROPERTY_A}/folios/${HTTP_FOLIO_A}/adjustments`;
    const post = (token: string, key: string, body: Record<string, unknown>, extra: Record<string, string> = {}) =>
      folioHttpRequest(adjustmentPath, {
        method: "POST", headers: { ...folioAuth(token, key), ...extra }, body: JSON.stringify(body),
      });
    const corrected = await post(writeToken, "order183-http-correction", {
      reversesJournalId: original.journalId, reason: "Corrected room charge",
    });
    expect(corrected.status).toBe(201);
    const correctedBody = await corrected.json() as { journalId: string; reversesJournalId: string; amountMinor: string; replayed: boolean };
    expect(correctedBody).toMatchObject({ reversesJournalId: original.journalId, amountMinor: "-700", replayed: false });
    expect(corrected.headers.get("idempotency-replayed")).toBe("false");
    const exactReplay = await post(writeToken, "order183-http-correction", {
      reversesJournalId: original.journalId, reason: "Corrected room charge",
    });
    expect(exactReplay.status).toBe(201);
    expect(exactReplay.headers.get("idempotency-replayed")).toBe("true");
    expect(await exactReplay.json()).toEqual({ ...correctedBody, replayed: true });
    const changed = await post(writeToken, "order183-http-correction", {
      reversesJournalId: original.journalId, reason: "Changed reason",
    });
    expect(changed.status).toBe(409);
    expect((await changed.json() as { type: string }).type).toBe("request/idempotency_conflict");

    const sealedCharge = await folioHttpRequest(
      `/api/v1/properties/${HTTP_PROPERTY_A}/folios/${HTTP_FOLIO_A}/charges`, {
        method: "POST", headers: folioAuth(writeToken, "order183-http-sealed-original"),
        body: JSON.stringify({ txCode: HTTP_TX_CODE, amountMinor: "99", quantity: "1.000" }),
      });
    expect(sealedCharge.status).toBe(201);
    const sealedOriginal = await sealedCharge.json() as { journalId: string };
    await folioAdmin!`UPDATE business_day SET sealed_at=now(),sealed_by=${HTTP_WRITE_USER}::uuid
      WHERE tenant_id=${HTTP_TENANT_A}::uuid AND property_node=${HTTP_PROPERTY_A}::uuid AND business_date=${folioBusinessDate}::date`;
    const beforeForged = (await folioAdmin!<Array<{ n: number }>>`
      SELECT count(*)::int n FROM journal WHERE tenant_id=${HTTP_TENANT_A}::uuid`)[0]!.n;
    const forgedBody = await post(writeToken, "order183-http-sealed-forged-body", {
      reversesJournalId: sealedOriginal.journalId, reason: "Forged authority", postSealAuthorized: true,
    });
    expect(forgedBody.status).toBe(400);
    expect((await forgedBody.json() as { type: string }).type).toBe("request/invalid");
    const forgedHeader = await post(writeToken, "order183-http-sealed-forged-header", {
      reversesJournalId: sealedOriginal.journalId, reason: "Forged authority",
    }, { "x-post-seal-authorized": "true" });
    expect(forgedHeader.status).toBe(403);
    expect((await forgedHeader.json() as { type: string }).type).toBe("auth/scope_missing");
    expect((await folioAdmin!<Array<{ n: number }>>`
      SELECT count(*)::int n FROM journal WHERE tenant_id=${HTTP_TENANT_A}::uuid`)[0]!.n).toBe(beforeForged);
    const authorized = await post(approverToken, "order183-http-sealed-authorized", {
      reversesJournalId: sealedOriginal.journalId, reason: "Authorized sealed correction",
    });
    expect(authorized.status).toBe(201);
    expect((await authorized.json() as { amountMinor: string }).amountMinor).toBe("-99");
    const counts = await folioAdmin!<Array<{ journals: number; lines: number; facts: number; events: number; correctionKeys: number }>>`
      SELECT (SELECT count(*)::int FROM journal WHERE tenant_id=${HTTP_TENANT_A}::uuid) journals,
        (SELECT count(*)::int FROM posting_line WHERE tenant_id=${HTTP_TENANT_A}::uuid) lines,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${HTTP_TENANT_A}::uuid AND fact_type='journal.posted') facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${HTTP_TENANT_A}::uuid AND event_type='journal.posted') events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${HTTP_TENANT_A}::uuid AND operation='financials.charge.reverse') AS "correctionKeys"`;
    expect(counts[0]!.correctionKeys).toBe(2);
  }, 30_000);
});
