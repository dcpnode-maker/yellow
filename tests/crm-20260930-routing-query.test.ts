import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { Database, TenantIdentity, TenantResolver, Tx } from "../src/kernel";
import { OperatorHttpApi } from "../src/http/operator";
import type { LocalLoginService } from "../src/contexts/identity";
import { parseDepartureServicesQuery } from "../src/http/departure-services-query";

const TENANT = "00000000-0000-0000-0000-000000593101";
const ACTOR = "00000000-0000-0000-0000-000000593102";
const PROPERTY = "00000000-0000-0000-0000-000000593103";
const ROLE = "00000000-0000-0000-0000-000000593104";
const FOREIGN_ROLE = "00000000-0000-0000-0000-000000593105";
const RESERVATION = "00000000-0000-0000-0000-000000593106";

function request(path: string): Request {
  return new Request(`http://yellow.test${path}`);
}

function harness(granted = true) {
  const identity: TenantIdentity = {
    tenantId: TENANT,
    actorId: ACTOR,
    scopes: ["stay-operations.departure-services:read"],
  };
  const calls: { readonly query: string; readonly values: readonly unknown[] }[] = [];
  const tx = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.join("?");
    calls.push({ query, values });
    if (query.includes("SELECT DISTINCT target.id, target.name")) return granted
      ? [{ id: PROPERTY, name: "Routing property", timezone: "UTC", currency: "USD" }]
      : [];
    if (query.includes("SELECT public.assert_departure_service_authority")) return [];
    if (query.includes("SELECT DISTINCT permission.permission_code AS code")) return [];
    if (query.includes("SELECT jsonb_build_object(")) return [];
    if (query.includes("SELECT DISTINCT duty.id AS \"roleId\"")) return [];
    if (query.includes("SELECT p.id AS \"partyId\"")) return [];
    throw new Error(`Unexpected controlled SQL query: ${query}`);
  }) as unknown as Tx;
  const database = {
    async withTenantTransaction<T>(_tenantId: string, operation: (transaction: Tx) => Promise<T>): Promise<T> {
      return operation(tx);
    },
  } as unknown as Database;
  const tenantResolver: TenantResolver = { async resolve() { return identity; } };
  const operator = new OperatorHttpApi({} as LocalLoginService);
  return { app: createApp({ database, tenantResolver, operatorApi: operator }), calls };
}

describe("Order CRM-20260930 departure-services role query", () => {
  test("accepts only zero parameters or one canonical property role filter", () => {
    expect(parseDepartureServicesQuery(request(`/api/v1/properties/${PROPERTY}/departure-services`), null))
      .toEqual({ targetRoleId: null });
    expect(parseDepartureServicesQuery(request(`/api/v1/properties/${PROPERTY}/departure-services?target_role_id=${ROLE}`), null))
      .toEqual({ targetRoleId: ROLE });
    expect(parseDepartureServicesQuery(request(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/departure-services`), RESERVATION))
      .toEqual({ targetRoleId: null });
  });

  test("rejects duplicate, empty, malformed, unknown, and reservation-history filters", () => {
    const path = `/api/v1/properties/${PROPERTY}/departure-services`;
    for (const query of [
      `?target_role_id=${ROLE}&target_role_id=${ROLE}`,
      "?target_role_id=",
      "?target_role_id=not-a-uuid",
      "?target_role_id=ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB",
      `?target_role_id=${ROLE}&unexpected=value`,
      "?unexpected=value",
    ]) expect(parseDepartureServicesQuery(request(`${path}${query}`), null)).toBeNull();

    expect(parseDepartureServicesQuery(
      request(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/departure-services?target_role_id=${ROLE}`),
      RESERVATION,
    )).toBeNull();
  });

  test("mounted property authorization precedes role selection and the filter reaches the queue query", async () => {
    const denied = harness(false);
    const deniedResponse = await denied.app.handle(request(
      `/api/v1/properties/${PROPERTY}/departure-services?target_role_id=${ROLE}`,
    ));
    expect(deniedResponse.status).toBe(404);
    expect(denied.calls).toHaveLength(1);
    expect(denied.calls[0]?.query).toContain("SELECT DISTINCT target.id, target.name");

    const allowed = harness(true);
    const selectedResponse = await allowed.app.handle(request(
      `/api/v1/properties/${PROPERTY}/departure-services?target_role_id=${FOREIGN_ROLE}`,
    ));
    expect(selectedResponse.status).toBe(200);
    expect(await selectedResponse.json()).toEqual({ requests: [], roles: [], staff: [] });
    const queue = allowed.calls.find(({ query }) => query.includes("SELECT jsonb_build_object("));
    expect(queue).toBeDefined();
    expect(queue?.values).toContain(FOREIGN_ROLE);
    const rolePredicate = queue?.query.indexOf("r.target_role_id=?") ?? -1;
    const ordering = queue?.query.indexOf("ORDER BY CASE") ?? -1;
    expect(rolePredicate).toBeGreaterThan(-1);
    expect(rolePredicate).toBeLessThan(ordering);
  });

  test("invalid query and filtered history fail before property or history reads", async () => {
    const app = harness(true);
    const invalid = await app.app.handle(request(
      `/api/v1/properties/${PROPERTY}/departure-services?target_role_id=${ROLE}&target_role_id=${ROLE}`,
    ));
    const history = await app.app.handle(request(
      `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/departure-services?target_role_id=${ROLE}`,
    ));
    expect(invalid.status).toBe(400);
    expect(history.status).toBe(400);
    expect(app.calls).toEqual([]);
  });
});
