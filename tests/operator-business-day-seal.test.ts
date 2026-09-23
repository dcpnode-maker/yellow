import { describe, expect, test } from "bun:test";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const tenant = "00000000-0000-0000-0000-000000389001";
const property = "00000000-0000-0000-0000-000000389002";
const actor = "00000000-0000-0000-0000-000000389003";
let received: { tx: Tx; input: Record<string, unknown> } | undefined;
const seal = { async seal(tx: Tx, input: Record<string, unknown>) {
  received = { tx, input };
  return { tenantId: tenant, propertyNode: property, businessDate: "2026-09-03", previousState: "open" as const,
    state: "sealed" as const, sealedAt: "2026-09-03T19:00:00.000Z", actorId: actor, replayed: false };
} };
const api = new (OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi)(
  {}, {}, ...Array.from({ length: 39 }), undefined, undefined, undefined, seal,
);

function context(url = `http://yellow.test/api/v1/properties/${property}/business-days/2026-09-03/seal`,
  scope = "financials.business-days:seal", body?: BodyInit, onQuery?: () => void): TenantRequestContext {
  const tx = (async () => { onQuery?.(); return [{ id: property, name: "Hotel", timezone: "UTC", currency: "USD" }]; }) as unknown as Tx;
  return { tenantId: tenant, tx, request: new Request(url, { method: "POST", body,
    headers: { "idempotency-key": "order389-key" } }),
    identity: { tenantId: tenant, actorId: actor, scopes: [scope] } };
}

describe("Order 389 audited business-day seal HTTP adapter", () => {
  test("derives authority, preserves caller tx and minimizes the receipt", async () => {
    const ctx = context();
    const response = await api.sealBusinessDay(ctx, property, "2026-09-03", undefined);
    expect(response.status).toBe(200);
    expect(received?.tx).toBe(ctx.tx);
    expect(received?.input).toMatchObject({ tenantId: tenant, propertyNode: property, businessDate: "2026-09-03",
      actorId: actor, idempotencyKey: "order389-key", envelope: { operation: "business_day.sealed" } });
    expect(await response.json()).toEqual({ propertyNode: property, businessDate: "2026-09-03", previousState: "open",
      state: "sealed", sealedAt: "2026-09-03T19:00:00.000Z", replayed: false });
  });

  test("rejects absent scope before property lookup", async () => {
    let queried = false;
    const ctx = context(undefined, "financials.business-days:read", undefined, () => { queried = true; });
    expect((await api.sealBusinessDay(ctx, property, "2026-09-03", undefined)).status).toBe(403);
    expect(queried).toBe(false);
  });

  test("fails closed for an absent actor or unwired service", async () => {
    let queried = false;
    const actorless = context(undefined, undefined, undefined, () => { queried = true; });
    const noActor = { ...actorless, identity: { tenantId: tenant, scopes: ["financials.business-days:seal"] } };
    expect((await api.sealBusinessDay(noActor, property, "2026-09-03", undefined)).status).toBe(401);
    expect(queried).toBe(false);
    const unavailable = new (OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi)(
      {}, {}, ...Array.from({ length: 39 }), undefined, undefined, undefined,
    );
    expect((await unavailable.sealBusinessDay(context(), property, "2026-09-03", undefined)).status).toBe(503);
  });
});
