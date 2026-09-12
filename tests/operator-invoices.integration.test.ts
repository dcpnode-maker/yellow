import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, type LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, type Tx } from "../src/kernel";
import { FiscalSubmissionAdapterAvailabilityService, FiscalSubmissionService } from "../src/contexts/tax-fiscal";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = "tax-fiscal.documents:read";
const signing = new Hs256TokenSigner("q208-fictional-test-signing-secret-not-for-any-live-system");

function harness(configured = false) {
  const log: string[] = [];
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const control = { grants: true, sqlError: null as string | null };
  const connection = Object.assign(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    if (sql.includes("set_config('app.tenant_id'")) { log.push(`tenant:${values[0]}`); return [{ tenant_id: values[0] }]; }
    if (sql.includes("current_user = session_user")) return [{ role_reset: true, tenant_reset: true }];
    if (sql.includes("FROM user_role")) {
      log.push(`grant:${values[1]}:${values[0]}`);
      return control.grants ? [{ id: id(2), name: "Fictional hotel", timezone: "Asia/Kolkata", currency: "INR" }] : [];
    }
    calls.push({ sql, values });
    if (control.sqlError) throw Object.assign(new Error("sensitive database details"), { code: "ERR_POSTGRES_SERVER_ERROR", errno: control.sqlError });
    if (sql.includes("list_india_fiscal_submission_provider_options")) return [{
      extension_id: id(60), extension_version: 2, provider_key: "fictional-irp", label: "Fictional IRP",
    }];
    if (sql.includes("discover_india_native_fiscal_issue")) return [{ readiness: { kind: "blocked", blocker: "working_day_calendar_required" } }];
    if (sql.includes("prepare_india_native_fiscal_invoice_v4")) return [{ native_timing_id: id(40), request_event_id: id(41), posting_binding_id: id(42), prepared_source_json: null,
      internal_selectors: { valuationId: id(11), serviceProvisionSnapshotId: id(12), paymentReceiptSnapshotId: id(13), ordinaryRegimeEvidenceId: id(14), supplierServiceLocationId: id(15), supplierRegistrationStatusId: id(16), supplierSezStatusId: id(17), recipientRegistrationId: id(6), recipientSezStatusId: id(18), classificationId: id(19) },
      completed_receipt: { document_id: id(10), document_kind: "invoice", series_id: id(7), doc_no: "INV/1", property_node: id(2), reservation_id: id(4), folio_id: id(5), supplier_registration_id: id(22), recipient_registration_id: id(6), financial_year_start: "2044-04-01", currency: "INR", status: "issued", business_date: "2044-09-06", issued_at: "2044-09-06T12:00:00.000Z", prev_hash: null, sha256: "a".repeat(64), source_evidence_hash: "b".repeat(64), pre_document_evidence_hash: "c".repeat(64), readiness_evidence_hash: "d".repeat(64), created: false } }];
    if (sql.includes("read_india_fiscal_submission_delivery_receipt_by_document")) return [{ delivery: { kind: "not_requested", documentId: id(10) } }];
    if (sql.includes("list_india_native_fiscal_documents")) return [{ document_id: null,
      business_date: null, issued_at: null, summary: null, matching_count: "0" }];
    if (sql.includes("read_india_native_fiscal_document")) return [{ document: null }];
    throw new Error("unexpected query");
  }, {
    async unsafe(sql: string) { log.push(sql); return []; },
    release() { log.push("release"); }, async close() { log.push("close"); },
  }) as unknown as Tx;
  const database = new Database({ async reserve() { log.push("reserve"); return connection; } });
  const identity = { providerExtensionId: id(60), providerExtensionVersion: 2, providerKey: "fictional-irp" };
  const OperatorConstructor = OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi;
  const operator = new OperatorConstructor({} as LocalLoginService, undefined, ...Array.from({ length: 44 }, () => undefined), {
    submissions: new FiscalSubmissionService(),
    adapters: new FiscalSubmissionAdapterAvailabilityService(configured ? [identity] : [],
      configured ? [{ ...identity, environment: "sandbox" }] : []),
  });
  return { log, calls, control, app: createApp({ database, tenantResolver: new BearerTenantResolver(signing), operatorApi: operator }) };
}

const token = (scopes: readonly string[] = [scope]) => signing.issue({ userId: id(3), tenantId: id(1), scopes });
function search(bearer: string, body: unknown = { issuedFrom: "2044-09-01", issuedBefore: "2044-10-01" }, suffix = "", property = id(2)) {
  return new Request(`http://yellow.test/api/v1/properties/${property}/invoices/search${suffix}`, {
    method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("Q208 signed-session invoice read HTTP composition (database authority proven separately)", () => {
  test("lists configured provider choices using current request authority, exact session scope and no secrets", async () => {
    const get = async (h: ReturnType<typeof harness>, scopes = ["tax-fiscal.submissions:request"], suffix = "") =>
      h.app.handle(new Request("http://yellow.test/api/v1/properties/" + id(2) + "/fiscal-provider-options" + suffix,
        { headers: { authorization: "Bearer " + await token(scopes) } }));
    const h = harness(true), response = await get(h);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ providers: [{ providerExtensionId: id(60), providerExtensionVersion: 2,
      providerKey: "fictional-irp", label: "Fictional IRP", environment: "sandbox" }] });
    expect(h.calls).toHaveLength(1); expect(h.calls[0]!.values.slice(0, 3)).toEqual([id(1), id(2), id(3)]);
    const empty = harness(); expect(await (await get(empty)).json()).toEqual({ providers: [] });
    expect(empty.calls).toHaveLength(1);
    for (const scopes of [[scope], ["tax-fiscal.submissions:read"], ["tax-fiscal.submissions:retry"], []]) {
      const denied = harness(true); expect((await get(denied, scopes)).status).toBe(403); expect(denied.calls).toHaveLength(0);
    }
    const revoked = harness(true); revoked.control.grants = false;
    expect((await get(revoked)).status).toBe(403); expect(revoked.calls).toHaveLength(0);
    const query = harness(true); expect((await get(query, ["tax-fiscal.submissions:request"], "?tenant=secret")).status).toBe(400);
    expect(query.calls).toHaveLength(0);
    for (const [state, status] of [["42501", 403], ["P2082", 422], ["XX000", 503]] as const) {
      const failed = harness(true); failed.control.sqlError = state; const result = await get(failed);
      expect(result.status).toBe(status); expect(await result.text()).not.toContain("sensitive database");
      expect(failed.log).toContain("ROLLBACK");
    }
  });
  const issueScopes = ["tax-fiscal.documents:issue", "tax-fiscal.india-valuation:finalize"];
  const issueBody = { recipientRegistrationId: id(6), calendarEvidence: null, expectedSelectorHash: "a".repeat(64), expectedConfirmationHash: "b".repeat(64) };
  async function staffRequest(h: ReturnType<typeof harness>, route: "readiness" | "issue", scopes = issueScopes, body: unknown = route === "issue" ? issueBody : { recipientRegistrationId: null, calendarEvidence: null }, suffix = "", key = "q208-operator-invoice-0001") {
    return h.app.handle(new Request("http://yellow.test/api/v1/properties/" + id(2) + "/reservations/" + id(4) + "/folios/" + id(5) + "/invoice-" + route + suffix,
      { method: "POST", headers: { authorization: "Bearer " + await token(scopes), "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) }));
  }
  test("reads issue readiness through its own current dual permission without fiscal writes", async () => {
    const h = harness();
    const response = await staffRequest(h, "readiness");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ readiness: { kind: "blocked", blocker: "working_day_calendar_required" } });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.sql).toContain("discover_india_native_fiscal_issue");
    expect(h.calls[0]!.values.slice(0, 5)).toEqual([id(1), id(2), id(3), id(4), id(5)]);
    expect(h.log).toContain("grant:" + id(3) + ":tax-fiscal.documents:issue");
    expect(h.log).toContain("grant:" + id(3) + ":tax-fiscal.india-valuation:finalize");
  });
  test("composes durable operator replay in the middleware transaction without exposing selectors", async () => {
    const h = harness();
    const response = await staffRequest(h, "issue");
    expect(response.status).toBe(200);
    expect(response.headers.get("idempotency-replayed")).toBe("true");
    const result = await response.json() as { invoice: { documentId: string; replayed: boolean } };
    expect(result.invoice.documentId).toBe(id(10));
    expect(result.invoice.replayed).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/internal_selectors|valuationId|native_timing_id/);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.sql).toContain("prepare_india_native_fiscal_invoice_v4");
    expect(h.calls[0]!.values).toHaveLength(15);
    expect(h.calls[0]!.values.slice(0, 6)).toEqual([id(1), id(2), id(3), id(4), id(5), id(6)]);
    expect(h.calls[0]!.values[11]).toBe("q208-operator-invoice-0001");
    expect(h.log.filter(s => s === "reserve")).toHaveLength(1);
    expect(h.log).toContain("COMMIT");
  });
  test("denies missing dual grants, private input and malformed confirmation before issuing", async () => {
    for (const route of ["readiness", "issue"] as const) {
      for (const scopes of [[], [scope], [issueScopes[0]!], [issueScopes[1]!]]) {
        const h = harness(); expect((await staffRequest(h, route, scopes)).status).toBe(403); expect(h.calls).toHaveLength(0);
      }
      const h = harness(); h.control.grants = false;
      expect((await staffRequest(h, route)).status).toBe(403); expect(h.calls).toHaveLength(0);
    }
    for (const extra of [{ tenantId: id(99) }, { valuationId: id(11) }, { actorId: id(99) }, { amountMinor: "100" }, { expectedSelectorHash: "bad" }, { recipientRegistrationId: null }, { calendarEvidence: {} }]) {
      const h = harness(); expect((await staffRequest(h, "issue", issueScopes, { ...issueBody, ...extra })).status).toBe(400); expect(h.calls).toHaveLength(0);
    }
    const h = harness();
    expect((await staffRequest(h, "issue", issueScopes, issueBody, "?recipient=secret")).status).toBe(400);
    expect((await staffRequest(h, "issue", issueScopes, issueBody, "", "")).status).toBe(400);
    expect(h.calls).toHaveLength(0);
  });
  test("rolls back stale, denied, conflicting and unsupported issue without returning database details", async () => {
    for (const [state, status] of [["P2081", 409], ["23505", 409], ["42501", 403], ["P2082", 422], ["55000", 409], ["22023", 400], ["XX000", 503]] as const) {
      const h = harness(); h.control.sqlError = state;
      const response = await staffRequest(h, "issue");
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain("sensitive database details");
      expect(h.log).toContain("ROLLBACK"); expect(h.log).not.toContain("COMMIT");
    }
  });
  test("serves invoice deep links and only the named local module assets without authentication data", async () => {
    const h = harness();
    for (const path of ["/p/" + id(2) + "/invoices", "/p/" + id(2) + "/invoices/" + id(10), "/p/" + id(2) + "/invoices/new/" + id(4) + "/" + id(5)]) {
      const response = await h.app.handle(new Request("http://yellow.test" + path));
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('id="invoices-view"');
    }
    for (const path of ["/assets/operator-invoices.js", "/assets/operator-invoice-print.js", "/assets/vendor/qrcodegen-v1.8.0-es6.js"]) {
      const response = await h.app.handle(new Request("http://yellow.test" + path));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("javascript");
    }
    expect(h.calls).toHaveLength(0);
    expect((await h.app.handle(new Request("http://yellow.test/assets/vendor/unknown.js"))).status).toBe(404);
  });

  test("reports unsupported fiscal mode explicitly after rolling back every affected read", async () => {
    for (const route of ["search", "document", "receipt"]) {
      const h = harness();
      h.control.sqlError = "P2082";
      const bearer = await token([scope, "tax-fiscal.submissions:read"]);
      const request = route === "search" ? search(bearer) : new Request(
        "http://yellow.test/api/v1/properties/" + id(2) + "/invoices/" + id(10) + (route === "receipt" ? "/receipt" : ""),
        { headers: { authorization: "Bearer " + bearer } });
      const response = await h.app.handle(request);
      expect(response.status).toBe(422);
      expect(await response.text()).toContain("unsupported_jurisdiction");
      expect(h.log).toContain("ROLLBACK");
      expect(h.log).not.toContain("COMMIT");
    }
  });

  test("reload-safe receipt lookup requires its own current permission, not document-read scope", async () => {
    const h = harness();
    const path = `http://yellow.test/api/v1/properties/${id(2)}/invoices/${id(10)}/receipt`;
    const get = async (scopes: readonly string[]) => h.app.handle(new Request(path,
      { headers: { authorization: `Bearer ${await token(scopes)}` } }));
    expect((await get([scope])).status).toBe(403);
    expect(h.calls).toHaveLength(0);
    const response = await get(["tax-fiscal.submissions:read"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ delivery: { kind: "not_requested", documentId: id(10) } });
    expect(h.calls[0]!.values).toEqual([id(1), id(2), id(10), id(3)]);
    h.control.grants = false;
    expect((await get(["tax-fiscal.submissions:read"])).status).toBe(403);
  });

  test("uses signed tenant/actor with one transaction and noncacheable POST search", async () => {
    const h = harness();
    const response = await h.app.handle(search(await token(), { issuedFrom: "2044-09-01", issuedBefore: "2044-10-01", query: "Buyer", limit: 1 }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ invoices: { items: [], matchingCount: "0", nextCursor: null } });
    expect(h.calls[0]!.values.slice(0, 3)).toEqual([id(1), id(2), id(3)]);
    expect(h.log.filter(s => s === "reserve")).toHaveLength(1);
    expect(h.log).toContain("SET LOCAL ROLE app_role");
    expect(h.log).toContain(`tenant:${id(1)}`);
    expect(h.log).toContain(`grant:${id(3)}:${scope}`);
    expect(h.log).toContain("COMMIT");
    expect(h.log.at(-1)).toBe("release");
  });

  test("rejects missing identity, wrong scope, body-injected authority, URL query and property grant", async () => {
    const h = harness();
    expect((await h.app.handle(search("invalid"))).status).toBe(401);
    expect((await h.app.handle(search(await token([])))).status).toBe(403);
    const valid = await token();
    for (const extra of [{ tenantId: id(9) }, { actorId: id(9) }, { propertyNode: id(9) }]) {
      expect((await h.app.handle(search(valid, { issuedFrom: "2044-09-01", issuedBefore: "2044-10-01", ...extra }))).status).toBe(400);
    }
    expect((await h.app.handle(search(valid, {}, "?query=Buyer"))).status).toBe(400);
    expect((await h.app.handle(search(valid, {}, "", "bad"))).status).toBe(400);
    h.control.grants = false;
    expect((await h.app.handle(search(valid))).status).toBe(403);
    expect(h.calls).toHaveLength(0);
  });

  test("validates bounded dates/filters and keeps request data out of errors", async () => {
    const h = harness();
    for (const body of [{ issuedFrom: "2044-02-30", issuedBefore: "2044-03-01" },
      { issuedFrom: "2040-01-01", issuedBefore: "2044-03-01", query: "private-guest" },
      { issuedFrom: "2044-09-01", issuedBefore: "2044-10-01", limit: 101 }]) {
      const response = await h.app.handle(search(await token(), body));
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain("private-guest");
    }
    expect(h.calls).toHaveLength(0);
  });

  test("reads documents without provider activation and returns exact not-found semantics", async () => {
    const h = harness();
    const response = await h.app.handle(new Request(`http://yellow.test/api/v1/properties/${id(2)}/invoices/${id(10)}`,
      { headers: { authorization: `Bearer ${await token()}` } }));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(h.calls[0]!.values).toEqual([id(1), id(2), id(10), id(3)]);
    expect(h.calls[0]!.sql).not.toContain("fiscal_submission");
  });

  test("handles revoked SQL permission and rolls back database failures without leaking them", async () => {
    const h = harness();
    h.control.sqlError = "42501";
    expect((await h.app.handle(search(await token()))).status).toBe(403);
    expect(h.log).toContain("ROLLBACK");
    expect(h.log).not.toContain("COMMIT");
    h.control.sqlError = "XX000";
    const response = await h.app.handle(search(await token()));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
    expect(h.log).toContain("ROLLBACK");
  });
});
