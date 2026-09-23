import { describe, expect, test } from "bun:test";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const tenant = "00000000-0000-0000-0000-000000386001";
const property = "00000000-0000-0000-0000-000000386002";
const actor = "00000000-0000-0000-0000-000000386003";
const account = "00000000-0000-0000-0000-000000386004";
const approval = "00000000-0000-0000-0000-000000386005";
let received: { method: string; tx: Tx; input: Record<string, unknown> } | undefined;

const workbench = {
  async listAccounts(tx: Tx, input: Record<string, unknown>) { received = { method: "list", tx, input }; return [{ accountReference: account,
    accountLabel: "Owner trust", ownerLabel: "Owner", currency: "USD", availableBalanceMinor: "500", canPost: true }]; },
  async previewExpense(tx: Tx, input: Record<string, unknown>) { received = { method: "preview", tx, input }; return { accountReference: account,
    accountLabel: "Owner trust", ownerLabel: "Owner", currency: "USD", amountMinor: "600", availableBalanceMinor: "500",
    projectedBalanceMinor: "-100", approvalRequired: true, approvalEvidence: { payableAccountId: "must-not-leak" } }; },
  async requestApproval(tx: Tx, input: Record<string, unknown>) { received = { method: "request", tx, input }; return { approvalId: approval,
    accountReference: account, currency: "USD", amountMinor: "600", projectedBalanceMinor: "-100", status: "pending" as const,
    requestedAt: "2026-09-03T00:00:00.000Z", replayed: false, payloadHash: "must-not-leak" }; },
  async listApprovals(tx: Tx, input: Record<string, unknown>) { received = { method: "inbox", tx, input }; return [{ approvalId: approval,
    accountReference: account, accountLabel: "Owner trust", ownerLabel: "Owner", currency: "USD", amountMinor: "600",
    availableBalanceMinor: "500", projectedBalanceMinor: "-100", reason: "Repairs", requesterLabel: "Maker", status: "pending" as const,
    requestedAt: "2026-09-03T00:00:00.000Z", decidedAt: null, canDecide: true, canPost: false }]; },
  async decideApproval(tx: Tx, input: Record<string, unknown>) { received = { method: "decide", tx, input }; return { approvalId: approval,
    status: "approved" as const, decidedAt: "2026-09-03T00:01:00.000Z", replayed: false }; },
  async postExpense(tx: Tx, input: Record<string, unknown>) { received = { method: "post", tx, input }; return { journalId: crypto.randomUUID(),
    propertyNode: property, ownerPartyId: "must-not-leak", trustAccountId: account, payableAccountId: "must-not-leak", businessDate: "2026-09-03",
    currency: "USD", amountMinor: "600", availableBeforeMinor: "500", projectedAvailableMinor: "-100", approvalRequestId: approval, replayed: false }; },
};

const api = new (OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi)(
  {}, {}, ...Array.from({ length: 39 }), undefined, undefined, undefined, undefined, workbench,
);

function context(path: string, scope = "financials.trust:post", method = "GET", body?: BodyInit, onQuery?: () => void): TenantRequestContext {
  const tx = (async () => { onQuery?.(); return [{ id: property, name: "Hotel", timezone: "UTC", currency: "USD" }]; }) as unknown as Tx;
  return { tenantId: tenant, tx, request: new Request(`http://yellow.test${path}`, { method, body,
    headers: { "idempotency-key": "order386-key" } }), identity: { tenantId: tenant, actorId: actor, scopes: [scope] } };
}

describe("Order 386 owner-trust expense HTTP adapter", () => {
  test("returns bounded account and approval pages without raw authority evidence", async () => {
    const accountContext = context(`/api/v1/properties/${property}/trust/accounts?limit=50`);
    const accountResponse = await api.ownerTrustAccounts(accountContext, property);
    expect(accountResponse.status).toBe(200); expect(received?.tx).toBe(accountContext.tx);
    expect(await accountResponse.json()).toEqual({ accounts: [{ accountReference: account, accountLabel: "Owner trust",
      ownerLabel: "Owner", currency: "USD", availableBalanceMinor: "500", canPost: true }], nextCursor: null });
    const inboxContext = context(`/api/v1/properties/${property}/trust/approval-requests?limit=50`, "financials.trust:approve-negative");
    const inboxResponse = await api.ownerTrustExpenseApprovals(inboxContext, property);
    expect(inboxResponse.status).toBe(200); expect(received?.tx).toBe(inboxContext.tx);
    const serialized = JSON.stringify(await inboxResponse.json()); expect(serialized).not.toContain("payload"); expect(serialized).not.toContain("hash");
  });

  test("requests exact server-prepared approval with header-only idempotency", async () => {
    const ctx = context(`/api/v1/properties/${property}/trust/accounts/${account}/approval-requests`, undefined, "POST");
    const response = await api.requestOwnerTrustExpenseApproval(ctx, property, account, { amountMinor: "600", reason: "Repairs" });
    expect(response.status).toBe(201); expect(received?.tx).toBe(ctx.tx);
    expect(received?.input).toMatchObject({ actorId: actor, trustAccountId: account, idempotencyKey: "order386-key",
      envelope: { operation: "approval.requested" } });
    expect(JSON.stringify(await response.json())).not.toContain("payloadHash");
  });

  test("preserves caller transaction, derives actor authority and conceals internal evidence", async () => {
    const ctx = context(`/api/v1/properties/${property}/trust/accounts/${account}/preview`, undefined, "POST");
    const response = await api.previewOwnerTrustExpense(ctx, property, account, { amountMinor: "600", reason: "Repairs" });
    expect(response.status).toBe(200); expect(received?.tx).toBe(ctx.tx);
    expect(received?.input).toMatchObject({ tenantId: tenant, propertyNode: property, actorId: actor, trustAccountId: account,
      amountMinor: "600", reason: "Repairs" });
    expect(JSON.stringify(await response.json())).not.toContain("approvalEvidence");
  });

  test("posts only minimized receipt and maps the browser approval reference", async () => {
    const ctx = context(`/api/v1/properties/${property}/trust/accounts/${account}/expenses`, undefined, "POST");
    const response = await api.postOwnerTrustExpense(ctx, property, account,
      { amountMinor: "600", reason: "Repairs", approvalRequestId: approval });
    expect(response.status).toBe(201); expect(received?.tx).toBe(ctx.tx);
    expect(received?.input).toMatchObject({ approvalId: approval, envelope: { actorId: actor, operation: "journal.posted" } });
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("ownerPartyId"); expect(serialized).not.toContain("payableAccountId");
  });

  test("checker decisions require exact zero bytes and preserve caller transaction", async () => {
    const path = `/api/v1/properties/${property}/trust/approval-requests/${approval}/approve`;
    const ctx = context(path, "financials.trust:approve-negative", "POST");
    expect((await api.decideOwnerTrustExpenseApproval(ctx, property, approval, undefined, "approved")).status).toBe(200);
    expect(received?.tx).toBe(ctx.tx); expect(received?.input).toMatchObject({ approvalId: approval, decision: "approved",
      envelope: { actorId: actor, operation: "approval.decided" } });
    const dirty = context(path, "financials.trust:approve-negative", "POST", "{}");
    expect((await api.decideOwnerTrustExpenseApproval(dirty, property, approval, {}, "approved")).status).toBe(400);
  });

  test("rejects missing scope before property lookup and strict malformed money/reason", async () => {
    let queried = false;
    const denied = context(`/api/v1/properties/${property}/trust/accounts`, "financials.folios:read", "GET", undefined,
      () => { queried = true; });
    expect((await api.ownerTrustAccounts(denied, property)).status).toBe(403); expect(queried).toBe(false);
    const malformed = context(`/api/v1/properties/${property}/trust/accounts/${account}/preview`, undefined, "POST");
    expect((await api.previewOwnerTrustExpense(malformed, property, account, { amountMinor: "01", reason: " Repairs" })).status).toBe(400);
  });
});
