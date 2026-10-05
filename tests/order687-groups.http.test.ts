import { describe, expect, test } from "bun:test";
import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const tenantId = "00000000-0000-0000-0000-000000068701";
const propertyNode = "00000000-0000-0000-0000-000000068702";
const actorId = "00000000-0000-0000-0000-000000068703";
const groupId = "00000000-0000-0000-0000-000000068705";
const reservationId = "00000000-0000-0000-0000-000000068706";
const calls: string[] = [];
let lastListInput: unknown;
const service = {
  async list(_tx: Tx, input: unknown) { calls.push("list"); lastListInput = input; return { groups: [], nextCursor: null }; },
  async detail() { calls.push("detail"); return { group: { groupId, kind: "linked", code: "GRP", name: "Patel party", status: "tentative", memberCount: 0, roomsHeldByGroup: false }, members: [], nextMemberCursor: null }; },
  async candidate() { calls.push("candidate"); return null; },
  async create() { calls.push("create"); return { group: { groupId, kind: "linked", code: "GRP", name: "Patel party", status: "tentative", memberCount: 0, roomsHeldByGroup: false }, replayed: false }; },
  async attach() { calls.push("attach"); return { groupId, reservationId, changed: true, replayed: false }; },
};
function api(): OperatorHttpApi {
  const args = Array.from({ length: 50 }, () => undefined) as unknown as ConstructorParameters<typeof OperatorHttpApi>;
  args[0] = {} as LocalLoginService;
  args[1] = {} as AvailabilityService;
  args[49] = service as never;
  return new OperatorHttpApi(...args);
}
function context(method: string, path: string, body: unknown, scopes: readonly string[], grant = true): TenantRequestContext {
  const tx = (() => Promise.resolve(grant ? [{ id: propertyNode }] : [])) as unknown as Tx;
  return { tenantId, tx, identity: { tenantId, actorId, scopes },
    request: new Request(`http://yellow.test${path}`, { method,
      headers: { "content-type": "application/json", "idempotency-key": "order687-http-key" },
      ...(["POST", "PUT"].includes(method) ? { body: JSON.stringify(body) } : {}) }) };
}
const base = `/api/v1/properties/${propertyNode}/groups`;

describe("Order687 group HTTP authority and strict input", () => {
  test("create requires lifecycle write and property grant before service", async () => {
    const operator = api(); calls.length = 0;
    const denied = await operator.createGroup(context("POST", base, { name: "Patel party" }, []), propertyNode, { name: "Patel party" });
    expect(denied.status).toBe(403); expect(calls).toEqual([]);
    const hidden = await operator.createGroup(context("POST", base, { name: "Patel party" }, ["reservations.lifecycle:write"], false), propertyNode, { name: "Patel party" });
    expect(hidden.status).toBe(404); expect(calls).toEqual([]);
    const allowed = await operator.createGroup(context("POST", base, { name: "Patel party" }, ["reservations.lifecycle:write"]), propertyNode, { name: "Patel party" });
    expect(allowed.status).toBe(201); expect(calls).toEqual(["create"]);
  });
  test("unknown create fields and stale membership body reject before write", async () => {
    const operator = api(); calls.length = 0;
    const ctx = context("POST", base, { name: "Patel", allotment: 10 }, ["reservations.lifecycle:write"]);
    expect((await operator.createGroup(ctx, propertyNode, { name: "Patel", allotment: 10 })).status).toBe(400);
    const attachCtx = context("PUT", `${base}/${groupId}/members/${reservationId}`,
      { expectedGroupId: groupId }, ["reservations.lifecycle:write"]);
    expect((await operator.attachGroupMember(attachCtx, propertyNode, groupId, reservationId,
      { expectedGroupId: groupId })).status).toBe(400);
    expect(calls).toEqual([]);
  });
  test("read/list and candidate require lifecycle read and current property", async () => {
    const operator = api(); calls.length = 0;
    expect((await operator.listGroups(context("GET", base, null, []), propertyNode)).status).toBe(403);
    expect((await operator.listGroups(context("GET", base, null, ["reservations.lifecycle:read"], false), propertyNode)).status).toBe(403);
    expect((await operator.listGroups(context("GET", base, null, ["reservations.lifecycle:read"]), propertyNode)).status).toBe(200);
    expect((await operator.groupCandidate(context("GET", `${base}/${groupId}/candidates?confirmationNo=ABC`, null,
      ["reservations.lifecycle:read"]), propertyNode, groupId)).status).toBe(200);
    expect(calls).toEqual(["list", "candidate"]);
  });
  test("group search query is bounded and authorization precedes the read", async () => {
    const operator = api(); calls.length = 0; lastListInput = undefined;
    for (const suffix of ["?q=x", "?q=", "?q=a%00b", "?q=Needle%0A", "?q=good&q=other", `?q=${"x".repeat(101)}`]) {
      expect((await operator.listGroups(context("GET", `${base}${suffix}`, null,
        ["reservations.lifecycle:read"]), propertyNode)).status).toBe(400);
    }
    expect(calls).toEqual([]);
    expect((await operator.listGroups(context("GET", `${base}?q=Needle`, null, []), propertyNode)).status).toBe(403);
    expect((await operator.listGroups(context("GET", `${base}?q=Needle`, null,
      ["reservations.lifecycle:read"], false), propertyNode)).status).toBe(403);
    expect(calls).toEqual([]);
    expect((await operator.listGroups(context("GET", `${base}?q=%25_`, null,
      ["reservations.lifecycle:read"]), propertyNode)).status).toBe(200);
    expect(lastListInput).toMatchObject({ tenantId, propertyNode, query: "%_", limit: 50, cursor: null });
  });
  test("a previously accepted key cannot replay after current property grant is removed", async () => {
    const operator = api(); calls.length = 0;
    const body = { name: "Patel party" };
    const permitted = await operator.createGroup(context("POST", base, body,
      ["reservations.lifecycle:write"]), propertyNode, body);
    expect(permitted.status).toBe(201);
    expect(calls).toEqual(["create"]);
    const revoked = await operator.createGroup(context("POST", base, body,
      ["reservations.lifecycle:write"], false), propertyNode, body);
    expect(revoked.status).toBe(404);
    expect(calls).toEqual(["create"]);
  });
});
