import { afterAll, describe, expect, test } from "bun:test";
import { SQL, type ReservedSQL } from "bun";

import { createApp } from "../src/app";
import { Database, type ConnectionPool, type TenantResolver } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_TENANT_CONTEXT_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_TENANT_CONTEXT === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000000002";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_TENANT_CONTEXT_URL is required by bun run test:tenant-context");
}

class CountingPool implements ConnectionPool {
  readonly sql: SQL;
  acquisitions = 0;

  constructor(max: number) {
    this.sql = new SQL(DATABASE_URL!, { max });
  }

  async reserve(): Promise<ReservedSQL> {
    this.acquisitions += 1;
    return this.sql.reserve();
  }

  async close(): Promise<void> {
    await this.sql.close();
  }
}

function resolverFromHeader(): TenantResolver {
  return {
    async resolve(request) {
      const tenantId = request.headers.get("x-test-tenant");
      return tenantId === null ? null : { tenantId };
    },
  };
}

function probeApp(pool: CountingPool) {
  return createApp({
    database: new Database(pool),
    tenantResolver: resolverFromHeader(),
  }).get("/probe", ({ request, tenantContext }) =>
    tenantContext.handle(request, async ({ tenantId, tx }) => {
      const rows = await tx<{ backend_pid: number; tenant_id: string }[]>`
        SELECT pg_backend_pid() AS backend_pid,
               current_setting('app.tenant_id', true) AS tenant_id
      `;
      return { tenantId, observed: rows[0] };
    })
  );
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
const pools: CountingPool[] = [];

afterAll(async () => {
  await Promise.all(pools.map((pool) => pool.close()));
});

databaseDescribe("Order 019 transaction-local tenant middleware", () => {
  test("P1: null identity returns 401 without acquiring a connection", async () => {
    const pool = new CountingPool(1);
    pools.push(pool);
    const app = probeApp(pool);
    const before = pool.acquisitions;
    const response = await app.handle(new Request("http://yellow.test/probe"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(pool.acquisitions).toBe(before);
  });

  test("P2/P3: context is exact and a rejected next request leaves the reused backend clear", async () => {
    const pool = new CountingPool(1);
    pools.push(pool);
    const app = probeApp(pool);
    const first = await app.handle(new Request("http://yellow.test/probe", {
      headers: { "x-test-tenant": TENANT_A },
    }));
    expect(first.status).toBe(200);
    const firstBody = await first.json() as { observed: { backend_pid: number; tenant_id: string } };
    expect(firstBody.observed.tenant_id).toBe(TENANT_A);

    const beforeRejected = pool.acquisitions;
    const rejected = await app.handle(new Request("http://yellow.test/probe"));
    expect(rejected.status).toBe(401);
    expect(pool.acquisitions).toBe(beforeRejected);

    const observer = await pool.reserve();
    try {
      const rows = await observer<{ backend_pid: number; tenant_is_clear: boolean }[]>`
        SELECT pg_backend_pid() AS backend_pid,
               NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_is_clear
      `;
      expect(rows).toEqual([{ backend_pid: firstBody.observed.backend_pid, tenant_is_clear: true }]);
    } finally {
      observer.release();
    }
  });

  test("P4: twenty interleaved requests never observe another tenant", async () => {
    const pool = new CountingPool(4);
    pools.push(pool);
    const app = probeApp(pool);
    const tenants = Array.from({ length: 20 }, (_, index) => index % 2 === 0 ? TENANT_A : TENANT_B);
    const responses = await Promise.all(tenants.map((tenantId) =>
      app.handle(new Request("http://yellow.test/probe", { headers: { "x-test-tenant": tenantId } }))
    ));
    const bodies = await Promise.all(responses.map((response) => response.json())) as Array<{
      tenantId: string;
      observed: { tenant_id: string };
    }>;

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(bodies.map(({ tenantId, observed }) => observed.tenant_id === tenantId)).toEqual(Array(20).fill(true));
  });

  test("P5: a throwing handler rolls back and releases a clean connection", async () => {
    const pool = new CountingPool(1);
    pools.push(pool);
    const app = createApp({
      database: new Database(pool),
      tenantResolver: resolverFromHeader(),
    }).get("/throws", ({ request, tenantContext }) =>
      tenantContext.handle(request, async ({ tx }) => {
        await tx`SELECT current_setting('app.tenant_id', true)`;
        throw new Error("controlled handler failure");
      })
    );

    const failed = await app.handle(new Request("http://yellow.test/throws", {
      headers: { "x-test-tenant": TENANT_A },
    }));
    expect(failed.status).toBe(500);

    const observer = await pool.reserve();
    try {
      const rows = await observer<{ tenant_is_clear: boolean }[]>`
        SELECT NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_is_clear
      `;
      expect(rows).toEqual([{ tenant_is_clear: true }]);
    } finally {
      observer.release();
    }
  });

  test("P6: app-role RLS sees tenant A spaces and no tenant A rows as tenant B", async () => {
    const pool = new CountingPool(2);
    pools.push(pool);
    const app = createApp({
      database: new Database(pool),
      tenantResolver: resolverFromHeader(),
    }).get("/spaces", ({ request, tenantContext }) =>
      tenantContext.handle(request, async ({ tx }) => {
        const rows = await tx<{ count: number }[]>`SELECT count(*)::int AS count FROM space`;
        return { count: rows[0]?.count };
      })
    );

    const tenantA = await app.handle(new Request("http://yellow.test/spaces", {
      headers: { "x-test-tenant": TENANT_A },
    }));
    const tenantB = await app.handle(new Request("http://yellow.test/spaces", {
      headers: { "x-test-tenant": TENANT_B },
    }));
    expect(await tenantA.json()).toEqual({ count: 16 });
    expect(await tenantB.json()).toEqual({ count: 0 });
  });

  test("P7: public health stays exact and database-free with middleware installed", async () => {
    const pool = new CountingPool(1);
    pools.push(pool);
    let resolverCalls = 0;
    const app = createApp({
      database: new Database(pool),
      tenantResolver: {
        async resolve() {
          resolverCalls += 1;
          return { tenantId: TENANT_A };
        },
      },
    });
    const response = await app.handle(new Request("http://yellow.test/health"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"status":"ok"}');
    expect(resolverCalls).toBe(0);
    expect(pool.acquisitions).toBe(0);
  });
});
