import { expect, test } from "bun:test";
import { PostgresBrowserSessionIdentityReader, type AccessTokenClaims } from "../src/contexts/identity";
import type { Database, Tx } from "../src/kernel";
const TENANT = "6d9b7ce2-2d14-5576-b8c3-80f06501a603", ACTOR = "b2836978-73fe-58f9-b808-8b58cceac1c4";
const claims = { tid: TENANT, sub: ACTOR } as AccessTokenClaims;
test("resume identity uses existing tenant transaction, exact actor and active tenant/user read without writes or grants", async () => {
  let rows = [{ id: ACTOR, display_name: "Synthetic actor" }]; let queries = 0;
  const database: Pick<Database, "withTenantTransaction"> = { async withTenantTransaction<T>(tenant: string, run: (tx: Tx) => Promise<T>): Promise<T> {
    expect(tenant).toBe(TENANT);
    const sql = async (parts: TemplateStringsArray, ...values: unknown[]) => {
      ++queries; const source = parts.join("?");
      expect(source).toContain("JOIN tenant ON tenant.id = actor.tenant_id AND tenant.status = 'active'");
      expect(source).toContain("actor.status = 'active'"); expect(values).toEqual([TENANT, ACTOR]);
      expect(source).not.toMatch(/INSERT|UPDATE|DELETE|SET|issue/);
      return rows;
    };
    return run(sql as unknown as Tx);
  } };
  const reader = new PostgresBrowserSessionIdentityReader(database);
  expect(await reader.readActiveActor(claims)).toEqual({ id: ACTOR, displayName: "Synthetic actor" });
  rows = []; expect(await reader.readActiveActor(claims)).toBeNull();
  rows = [{ id: TENANT, display_name: "Wrong actor" }]; expect(await reader.readActiveActor(claims)).toBeNull();
  rows = [{ id: ACTOR, display_name: "" }]; expect(await reader.readActiveActor(claims)).toBeNull();
  expect(queries).toBe(4);
});
