import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { ChargeCorrectionService, ChargeService, FolioStatementService, HostedDepositConflictError } from "../src/contexts/financials";
import { BearerTenantResolver, hashLocalPassword, Hs256TokenSigner, LocalLoginService, verifyLocalPassword } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency, type TenantRequestContext, type Tx } from "../src/kernel";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const depositScript = readFileSync(new URL("../src/http/operator/operator-deposits.js", import.meta.url), "utf8");
const depositCss = readFileSync(new URL("../src/http/operator/operator-deposits.css", import.meta.url), "utf8");
const TENANT = "00000000-0000-0000-0000-000000010501";
const ACTOR = "00000000-0000-0000-0000-000000010502";
const PROPERTY = "00000000-0000-0000-0000-000000010503";
const FOLIO = "00000000-0000-0000-0000-000000010504";

function operatorWithFinancials(
  statements: unknown,
  charges: unknown,
  corrections?: unknown,
  hosted?: unknown,
  settlements?: unknown,
): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as never, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, statements as never, charges as never,
    undefined, undefined, undefined, corrections as never, undefined, hosted as never,
    settlements as never,
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

  test("Order193 P5: startup tablist exists and native login stays disabled until boot completes", () => {
    expect(html).toContain('id="folio-workspace-tabs" role="tablist" aria-label="Folio workspace"');
    expect(script).toContain('const tabs = [...$("#folio-workspace-tabs").children]');
    expect(html).toContain('<button class="primary" type="submit" disabled>Enter workbench</button>');
    const listener = script.indexOf('loginForm.addEventListener("submit"');
    const boot = script.indexOf("setView(initialView, false)");
    const enabled = script.indexOf('loginForm.querySelector("button[type=submit]").disabled = false');
    expect(listener).toBeGreaterThanOrEqual(0);
    expect(boot).toBeGreaterThan(listener);
    expect(enabled).toBeGreaterThan(boot);
  });

  test("Order193 P5: the 375px folio deposit workspace cannot grow its grid track", () => {
    expect(depositCss).toContain("#folio-workspace{grid-template-columns:minmax(0,1fr)}");
    expect(depositCss).toContain("@media(max-width:480px){#folio-workspace-tabs{flex-wrap:wrap}}");
  });

  test("Order193 P5: clean folio exit never prompts while every dirty family does", () => {
    const source = functionSlice("confirmFolioExit", "folioRefreshDecision");
    const run = Function("state", `
      const prompts=[];
      const confirm=message=>(prompts.push(message),true);
      const currentFolioCorrectionIsDirty=()=>state.correction===true;
      const currentFolioChargeIsDirty=()=>state.charge===true;
      const currentFolioWindowIsDirty=()=>state.window===true;
      const currentFolioOrganizeIsDirty=()=>state.organize===true;
      const d=state.deposit?{d:()=>true}:undefined;
      const currentFolioDraftIsDirty=()=>currentFolioChargeIsDirty()||d?.d()||currentFolioCorrectionIsDirty()||currentFolioWindowIsDirty()||currentFolioOrganizeIsDirty();
      ${source}
      return {allowed:confirmFolioExit(),prompts};
    `) as (state: Record<string, boolean>) => { allowed: boolean; prompts: string[] };
    expect(run({})).toEqual({ allowed: true, prompts: [] });
    for (const dirty of ["correction", "charge", "deposit", "window", "organize"]) {
      const result = run({ [dirty]: true });
      expect(result.allowed).toBe(true);
      expect(result.prompts).toHaveLength(1);
    }
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

  test("Order196 P4: zero-balance settlement UI is explicit, retry-safe and server-refetched", () => {
    expect(html).toContain('id="folio-settlement-panel"');
    expect(html).toContain('id="folio-settlement-action" type="button" hidden disabled');
    expect(html).toContain('id="folio-settlement-status" role="status" aria-live="assertive"');
    const submit = asyncFunctionSlice("submitFolioStatus", "function renderFolioStatement");
    expect(submit).toContain('body: JSON.stringify({ action, idempotencyKey: attemptKey })');
    expect(submit).toContain("folioStatusAttemptKey = crypto.randomUUID()");
    expect(submit).toContain("Retry keeps the same idempotency key.");
    expect(submit).toContain("/statement?limit=50");
    expect(submit.indexOf("renderFolioStatement(refreshed)")).toBeGreaterThan(
      submit.indexOf("/statement?limit=50"),
    );
    expect(submit.match(/isCurrentFolioRequest\(generation, property, identity, folioId\)/g))
      .toHaveLength(3);
  });

  test("Order196 P4: action-specific authority and server envelope precede settlement calls", async () => {
    const calls: Array<{ action: string; input: Record<string, unknown> }> = [];
    const settlements = {
      async settle(input: Record<string, unknown>) {
        calls.push({ action: "settle", input });
        return { folioId: FOLIO, accountId: ACTOR, reservationId: null, windowNo: 1,
          previousStatus: "open", status: "settled", balanceMinor: "0", replayed: false };
      },
      async close(input: Record<string, unknown>) {
        calls.push({ action: "close", input });
        return { folioId: FOLIO, accountId: ACTOR, reservationId: null, windowNo: 1,
          previousStatus: "settled", status: "closed", balanceMinor: "0", replayed: false };
      },
    };
    const api = operatorWithFinancials(undefined, undefined, undefined, undefined, settlements);
    const request = new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/folios/${FOLIO}/status`, {
      method: "POST", headers: { "x-correlation-id": "order196-http-request" },
    });
    const missing = await api.transitionFolioStatus(
      financialContext(request, ["financials.folios:read"]), PROPERTY, FOLIO,
      { action: "settle", idempotencyKey: "order196-http-settle" },
    );
    expect(missing.status).toBe(403);
    expect(calls).toHaveLength(0);

    const settled = await api.transitionFolioStatus(
      financialContext(request, ["financials.folios:settle"]), PROPERTY, FOLIO,
      { action: "settle", idempotencyKey: "order196-http-settle" },
    );
    expect(settled.status).toBe(200);
    expect(await settled.json()).toMatchObject({
      folioId: FOLIO, previousStatus: "open", status: "settled", balanceMinor: "0",
    });
    expect(calls[0]).toMatchObject({ action: "settle", input: {
      tenantId: TENANT, folioId: FOLIO, idempotencyKey: "order196-http-settle",
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY, operation: "folio.settled" },
    } });

    const malformed = await api.transitionFolioStatus(
      financialContext(request, ["financials.folios:close"]), PROPERTY, FOLIO,
      { action: "close", idempotencyKey: "order196-http-close", balanceMinor: "0" },
    );
    expect(malformed.status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  test("Order193 P5: hosted deposit workbench is token-only, server-truth and retry-safe", () => {
    expect(html).toContain('id="folio-tab-deposit" type="button" role="tab" aria-controls="folio-deposit-panel" aria-selected="false"');
    expect(html).toContain('id="folio-deposit-panel"');
    expect(html).not.toContain('id="folio-deposit-instrument"');
    expect(script).toContain('import("/assets/operator-deposits.js")');
    expect(depositScript).toContain('id="folio-deposit-instrument" name="instrumentId"');
    expect(depositScript).toContain("No card, bank or VPA details belong here.");
    expect(depositScript).toContain("Append one immutable balanced liability-to-folio journal.");
    expect(depositCss).toContain(".folio-deposit-status");
    const create = depositScript.slice(depositScript.indexOf(" async function create()"), depositScript.indexOf(" async function applyDeposit()"));
    expect(create).toContain("createKey = crypto.randomUUID()");
    expect(create).toContain('headers:{"idempotency-key":createKey}');
    expect(create.indexOf("refreshStatus(false)")).toBeGreaterThan(create.indexOf('method:"POST"'));
    expect(create).toContain("Retry keeps the same idempotency key.");
    const apply = depositScript.slice(depositScript.indexOf(" async function applyDeposit()"));
    expect(apply).toContain("applyKey = crypto.randomUUID()");
    expect(apply).toContain('headers:{"idempotency-key":applyKey}');
    expect(apply.indexOf("/statement?limit=50")).toBeGreaterThan(apply.indexOf('method:"POST"'));
    expect(apply.indexOf("refreshStatus(false)")).toBeGreaterThan(apply.indexOf("renderStatement(statement)"));
    expect(apply).toContain("Retry keeps the same idempotency key.");
    expect(`${create}\n${apply}`).not.toMatch(/localStorage|sessionStorage|document\.cookie|optimistic/i);
    expect(script).toContain("d?.r()");
    expect(script).toContain('if(d)d.s();else if(!p){const g=folioGeneration;p=import("/assets/operator-deposits.js")');
    expect(script).toContain("])).s(g)");
    expect(script).toContain('p=g==folioGeneration&&folioActiveTab==="deposit"&&announceOperation("error")');
    expect(depositScript).toContain("s: (g=context().generation) => g===context().generation");
    expect(depositScript).toContain('return !panel.hidden && !panel.closest("#folio-workspace").hidden');
  });

  test("Order193 P5: lazy deposit load is single-flight, stale-safe and retryable after bounded failure", async () => {
    const source = functionSlice("setFolioTab", "renderFolioStatement")
      .replace('import("/assets/operator-deposits.js")', "load()");
    const build = Function("load", `
      let d,p,folioGeneration=1,folioActiveTab="postings",folioStatementData={folio:{id:"folio-a"}},folioIdentity="folio-a";
      const propertySelect={value:"property-a"}, request=()=>{}, renderFolioStatement=()=>{};
      const currentFolioDraftIsDirty=()=>false,confirmFolioExit=()=>true,clearFolioCorrection=()=>{};
      const folioChargeForm={reset(){}},syncFolioChargeConfirmation=()=>{};let folioChargeAttemptKey="",folioChargeDraft="";
      const buttons=Object.fromEntries(["postings","charge","deposit","organize"].map(name=>[name,{setAttribute(){},focus(){}}]));
      const panels=Object.fromEntries(Object.keys(buttons).map(name=>["#folio-"+name+"-panel",{hidden:false}]));
      const tabs=Object.entries(buttons),$=selector=>panels[selector],folioCorrectionPanel={hidden:true},folioCorrectionHeading={focus(){}};
      const history={pushState(){}},canonicalFolioPath=()=>"/",announcements=[];
      const announceOperation=value=>announcements.push(value);
      ${source}
      return {select:name=>setFolioTab(name,{updateHistory:false,focus:false}),bump:()=>folioGeneration++,active:()=>folioActiveTab,announcements};
    `) as (load: () => Promise<unknown>) => { select(name: string): boolean; bump(): void; active(): string; announcements: string[] };
    let loads = 0, resolve!: (value: unknown) => void;
    const deferred = new Promise((done) => { resolve = done; });
    const harness = build(async () => { loads += 1; return deferred; });
    const generations: number[] = [];
    const ui = { d: () => false, r: () => resets++, s: (generation = 1) => generations.push(generation) };
    let resets = 0;
    harness.select("deposit"); harness.select("deposit");
    expect(loads).toBe(1);
    harness.select("postings"); resolve({ default: () => ui });
    await deferred; await Bun.sleep(0);
    expect({ resets, generations }).toEqual({ resets: 0, generations: [1] });
    harness.select("deposit"); await Promise.resolve();
    expect(loads).toBe(1); expect(generations).toEqual([1, 1]);

    let rejects = 0, reject!: (error: Error) => void;
    let failed = new Promise((_done, fail) => { reject = fail; });
    const failure = build(() => { rejects += 1; return failed; });
    failure.select("deposit"); failure.bump(); reject(new Error("asset failed"));
    await failed.catch(() => {}); await Bun.sleep(0);
    expect(failure.announcements).toEqual([]);
    failed = Promise.reject(new Error("retry failed")); failed.catch(() => {});
    failure.select("deposit"); await Bun.sleep(0);
    expect(rejects).toBe(2);
    expect(failure.announcements).toEqual(["error"]);
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

  test("Order193 P2: payment read/write/apply scopes and exact property grants precede every domain call", async () => {
    const calls:{create:unknown[];apply:unknown[];status:unknown[]}={create:[],apply:[],status:[]};
    const hosted = {
      async create(input:unknown) { calls.create.push(input); return { requestId:FOLIO,operationId:PROPERTY,
        bearer:"one-time",expiresAt:new Date().toISOString(),amountMinor:"1000",currency:"USD",generation:1,replayed:false }; },
      async apply(input:unknown) { calls.apply.push(input); return { applicationId:ACTOR,journalId:PROPERTY,
        hostedRequestId:FOLIO,amountMinor:"100",currency:"USD",replayed:false }; },
      async statusForOperator(tenantId:string,requestId:string) { calls.status.push({tenantId,requestId}); return {
        tenantId,requestId,propertyNode:PROPERTY,propertyName:"Yellow",folioId:FOLIO,folioReference:"FOL-1",
        operationId:ACTOR,amountMinor:"1000",currency:"USD",generation:1,expiresAt:new Date().toISOString(),
        state:"captured",capturedMinor:"1000",appliedMinor:"0",remainingMinor:"1000" }; },
    };
    const api=operatorWithFinancials({}, {}, undefined, hosted);
    const createRequest=()=>new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/folios/${FOLIO}/hosted-deposits`,
      {method:"POST",headers:{"idempotency-key":"order193-http-create"}});
    const applyRequest=()=>new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/hosted-deposits/${FOLIO}/applications`,
      {method:"POST",headers:{"idempotency-key":"order193-http-apply"}});
    expect((await api.createHostedDeposit(financialContext(createRequest(),[]),PROPERTY,FOLIO,
      {instrumentId:ACTOR,amountMinor:"1000"})).status).toBe(403);
    expect((await api.applyHostedDeposit(financialContext(applyRequest(),[]),PROPERTY,FOLIO,{amountMinor:"100"})).status).toBe(403);
    expect((await api.hostedDepositReadAuthority(financialContext(new Request("http://yellow.test"),[]),PROPERTY)).status).toBe(403);
    expect(calls).toEqual({create:[],apply:[],status:[]});
    expect((await api.createHostedDeposit(financialContext(createRequest(),["financials.payments:write"],false),PROPERTY,FOLIO,
      {instrumentId:ACTOR,amountMinor:"1000"})).status).toBe(403);
    expect((await api.applyHostedDeposit(financialContext(applyRequest(),["financials.deposits:apply"],false),PROPERTY,FOLIO,
      {amountMinor:"100"})).status).toBe(403);
    expect((await api.hostedDepositReadAuthority(financialContext(new Request("http://yellow.test"),["financials.payments:read"],false),PROPERTY)).status).toBe(403);
    expect(calls).toEqual({create:[],apply:[],status:[]});
    expect((await api.createHostedDeposit(financialContext(createRequest(),["financials.payments:write"]),PROPERTY,FOLIO,
      {instrumentId:ACTOR,amountMinor:"1000"})).status).toBe(201);
    expect((await api.applyHostedDeposit(financialContext(applyRequest(),["financials.deposits:apply"]),PROPERTY,FOLIO,
      {amountMinor:"100"})).status).toBe(201);
    expect((await api.hostedDepositStatus(financialContext(new Request("http://yellow.test"),["financials.payments:read"]),PROPERTY,FOLIO)).status).toBe(200);
    expect(calls.create).toHaveLength(1); expect(calls.apply).toHaveLength(1); expect(calls.status).toHaveLength(1);
    const otherProperty="00000000-0000-0000-0000-000000010599";
    expect((await api.hostedDepositStatus(financialContext(new Request("http://yellow.test"),["financials.payments:read"]),otherProperty,FOLIO)).status).toBe(403);
    expect(calls.status).toHaveLength(1);
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
let foreignToken = "";
const hostedHttpCalls = { create: 0, apply: 0, status: 0 };
const hostedHttpKeys = new Map<string, string>();

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

async function folioLogin(email: string, tenant = "order105-http-a"): Promise<string> {
  const response = await folioHttpRequest("/api/v1/auth/local:login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant, email, password: HTTP_PASSWORD }),
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
    ('financials.adjustments:post-seal','Correct charges after business-day seal'),
    ('financials.payments:read','Read hosted payment status'),
    ('financials.payments:write','Create hosted payment requests'),
    ('financials.deposits:apply','Apply captured deposit liability')
    ON CONFLICT (code) DO NOTHING`;
  await folioAdmin`INSERT INTO role(id,tenant_id,name) VALUES
    (${HTTP_READ_ROLE}::uuid,${HTTP_TENANT_A}::uuid,'Order 105 exact reader'),
    (${HTTP_WRITE_ROLE}::uuid,${HTTP_TENANT_A}::uuid,'Order 105 ancestor writer'),
    (${HTTP_FOREIGN_ROLE}::uuid,${HTTP_TENANT_B}::uuid,'Order 105 foreign reader'),
    (${HTTP_APPROVER_ROLE}::uuid,${HTTP_TENANT_A}::uuid,'Order 105 post-seal approver')`;
  await folioAdmin`INSERT INTO role_permission(role_id,permission_code) VALUES
    (${HTTP_READ_ROLE}::uuid,'financials.folios:read'),
    (${HTTP_READ_ROLE}::uuid,'financials.payments:read'),
    (${HTTP_WRITE_ROLE}::uuid,'financials.charges:write'),
    (${HTTP_WRITE_ROLE}::uuid,'financials.adjustments:write'),
    (${HTTP_WRITE_ROLE}::uuid,'financials.payments:write'),
    (${HTTP_WRITE_ROLE}::uuid,'financials.deposits:apply'),
    (${HTTP_FOREIGN_ROLE}::uuid,'financials.folios:read'),
    (${HTTP_FOREIGN_ROLE}::uuid,'financials.payments:read'),
    (${HTTP_FOREIGN_ROLE}::uuid,'financials.payments:write'),
    (${HTTP_FOREIGN_ROLE}::uuid,'financials.deposits:apply'),
    (${HTTP_APPROVER_ROLE}::uuid,'financials.adjustments:write'),
    (${HTTP_APPROVER_ROLE}::uuid,'financials.adjustments:post-seal')`;
  await folioAdmin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
    (${HTTP_TENANT_A}::uuid,${HTTP_READ_USER}::uuid,${HTTP_READ_ROLE}::uuid,${HTTP_PROPERTY_A}::uuid),
    (${HTTP_TENANT_A}::uuid,${HTTP_WRITE_USER}::uuid,${HTTP_WRITE_ROLE}::uuid,${HTTP_GROUP_A}::uuid),
    (${HTTP_TENANT_B}::uuid,${HTTP_FOREIGN_USER}::uuid,${HTTP_FOREIGN_ROLE}::uuid,${HTTP_PROPERTY_B}::uuid),
    (${HTTP_TENANT_A}::uuid,${HTTP_APPROVER_USER}::uuid,${HTTP_APPROVER_ROLE}::uuid,${HTTP_PROPERTY_A}::uuid),
    (${HTTP_TENANT_A}::uuid,${HTTP_APPROVER_USER}::uuid,${HTTP_WRITE_ROLE}::uuid,${HTTP_GROUP_A}::uuid)`;
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
  const remember = (kind: string, input: Record<string, unknown>) => {
    const key = `${kind}:${input.tenantId}:${input.idempotencyKey}`;
    const value = JSON.stringify({ actorId: (input.envelope as { actorId: string }).actorId,
      folioId: input.folioId, hostedRequestId: input.hostedRequestId,
      instrumentId: input.instrumentId, amountMinor: input.amountMinor });
    const prior = hostedHttpKeys.get(key);
    if (prior && prior !== value) throw new HostedDepositConflictError("Changed idempotent request");
    hostedHttpKeys.set(key, value);
    return prior !== undefined;
  };
  const hosted = {
    async create(input: Record<string, unknown>) {
      hostedHttpCalls.create += 1; const replayed = remember("create", input);
      return { requestId: HTTP_FOLIO_CHILD, operationId: HTTP_PROPERTY_CHILD,
        ...(replayed ? {} : { bearer: "one-time-http-bearer" }), expiresAt: "2026-08-28T00:00:00.000Z",
        amountMinor: input.amountMinor, currency: "USD", generation: 1, replayed };
    },
    async apply(input: Record<string, unknown>) {
      hostedHttpCalls.apply += 1; const replayed = remember("apply", input);
      return { applicationId: HTTP_GUEST_CHILD, journalId: HTTP_REVENUE_CHILD,
        hostedRequestId: input.hostedRequestId, amountMinor: input.amountMinor, currency: "USD", replayed };
    },
    async statusForOperator(tenantId: string, requestId: string) {
      hostedHttpCalls.status += 1;
      return { tenantId, requestId, propertyNode: HTTP_PROPERTY_A, propertyName: "Order 105 exact",
        folioId: HTTP_FOLIO_A, folioReference: "O105-EXACT", operationId: HTTP_REVENUE_A,
        amountMinor: "1000", currency: "USD", generation: 1, expiresAt: "2026-08-28T00:00:00.000Z",
        state: "captured", capturedMinor: "1000", appliedMinor: "0", remainingMinor: "1000" };
    },
  };
  folioHttpApp = createApp({
    database: folioDatabase,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      login, undefined, undefined, new PostgresIdempotency(),
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, statements, charges,
      undefined, undefined, undefined, corrections, undefined, hosted as never,
    ),
  });
  readToken = await folioLogin("read@order105.test");
  writeToken = await folioLogin("write@order105.test");
  approverToken = await folioLogin("approver@order105.test");
  foreignToken = await folioLogin("foreign@order105.test", "order105-http-b");
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

  test("Order193 P4: authenticated routes enforce every scope, hierarchy, tenant and actor-bound retry", async () => {
    const before = { ...hostedHttpCalls };
    const createPath = `/api/v1/properties/${HTTP_PROPERTY_CHILD}/folios/${HTTP_FOLIO_CHILD}/hosted-deposits`;
    const applyPath = `/api/v1/properties/${HTTP_PROPERTY_CHILD}/hosted-deposits/${HTTP_FOLIO_CHILD}/applications`;
    const statusPath = `/api/v1/properties/${HTTP_PROPERTY_A}/hosted-deposits/${HTTP_FOLIO_A}`;
    const post = (path: string, token: string, key: string, body: Record<string, unknown>) =>
      folioHttpRequest(path, { method: "POST", headers: folioAuth(token, key), body: JSON.stringify(body) });

    expect((await post(createPath, readToken, "order193-missing-write", {
      instrumentId: HTTP_REVENUE_CHILD, amountMinor: "1000",
    })).status).toBe(403);
    expect((await post(applyPath, readToken, "order193-missing-apply", { amountMinor: "100" })).status).toBe(403);
    expect((await folioHttpRequest(statusPath, { headers: folioAuth(writeToken) })).status).toBe(403);
    for (const [path, method, body] of [
      [statusPath, "GET", undefined],
      [createPath, "POST", { instrumentId: HTTP_REVENUE_CHILD, amountMinor: "1000" }],
      [applyPath, "POST", { amountMinor: "100" }],
    ] as const) {
      const response = await folioHttpRequest(path, {
        method, headers: folioAuth(foreignToken, `order193-foreign-${method}`),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      expect(response.status).toBe(403);
      expect((await response.json() as { type: string }).type).toBe("auth/property_forbidden");
    }
    expect(hostedHttpCalls).toEqual(before);
    expect(await folioArtifacts()).toEqual({ journals: 0, lines: 0, facts: 0, events: 0, keys: 0 });

    const exact = await folioHttpRequest(statusPath, { headers: folioAuth(readToken) });
    expect(exact.status).toBe(200);
    expect(await exact.json()).toMatchObject({ propertyNode: HTTP_PROPERTY_A, state: "captured" });
    const key = "order193-real-http-create";
    const created = await post(createPath, writeToken, key, { instrumentId: HTTP_REVENUE_CHILD, amountMinor: "1000" });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ requestId: HTTP_FOLIO_CHILD, bearer: "one-time-http-bearer", replayed: false });
    const replay = await post(createPath, writeToken, key, { instrumentId: HTTP_REVENUE_CHILD, amountMinor: "1000" });
    expect(replay.status).toBe(201);
    expect(await replay.json()).toMatchObject({ requestId: HTTP_FOLIO_CHILD, replayed: true });
    const changed = await post(createPath, writeToken, key, { instrumentId: HTTP_REVENUE_CHILD, amountMinor: "1001" });
    expect(changed.status).toBe(409);
    const changedActor = await post(createPath, approverToken, key, { instrumentId: HTTP_REVENUE_CHILD, amountMinor: "1000" });
    expect(changedActor.status).toBe(409);
    const applied = await post(applyPath, writeToken, "order193-real-http-apply", { amountMinor: "100" });
    expect(applied.status).toBe(201);
    const appliedReplay = await post(applyPath, writeToken, "order193-real-http-apply", { amountMinor: "100" });
    expect(appliedReplay.status).toBe(200);
    expect(await appliedReplay.json()).toMatchObject({ hostedRequestId: HTTP_FOLIO_CHILD, replayed: true });
    expect(hostedHttpCalls).toEqual({ create: before.create + 4, apply: before.apply + 2, status: before.status + 1 });
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
