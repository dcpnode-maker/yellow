import { SQL, type ReservedSQL } from "bun";

export type Tx = ReservedSQL;

export interface ConnectionPool {
  reserve(): Promise<ReservedSQL>;
  close?(options?: { timeout?: number }): Promise<void>;
}

export interface DatabaseOptions {
  readonly maxConnections?: number;
}

/**
 * The application-facing database capability. It deliberately exposes no raw checkout:
 * callers can only receive a connection after a tenant-local transaction is established.
 */
export class Database {
  readonly #pool: ConnectionPool;
  readonly #ownsPool: boolean;

  constructor(pool: ConnectionPool, ownsPool = false) {
    this.#pool = pool;
    this.#ownsPool = ownsPool;
  }

  static connect(databaseUrl: string, options: DatabaseOptions = {}): Database {
    const pool = new SQL(databaseUrl, { max: options.maxConnections ?? 10 });
    return new Database(pool, true);
  }

  async #assertSettlement(connection: ReservedSQL): Promise<void> {
    const rows = await connection<{ role_reset: boolean; tenant_reset: boolean }[]>`
      SELECT current_user = session_user AS role_reset,
             NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_reset
    `;
    if (rows.length !== 1 || rows[0]?.role_reset !== true || rows[0]?.tenant_reset !== true) {
      throw new Error("PostgreSQL connection retained role or tenant context after transaction settlement");
    }
  }

  async #discardAndAssertRuntimeSettlement(connection: ReservedSQL): Promise<void> {
    await connection.unsafe("DISCARD ALL");
    const rows = await connection<{
      session_user: string;
      current_user: string;
      tenant_reset: boolean;
    }[]>`
      SELECT session_user::text AS session_user,
             current_user::text AS current_user,
             NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_reset
    `;
    const row = rows[0];
    if (rows.length !== 1 || row?.session_user !== "yellow_runtime" ||
        row.current_user !== "yellow_runtime" || row.tenant_reset !== true) {
      throw new Error("PostgreSQL connection did not settle to the runtime identity");
    }
  }

  async withTenantTransaction<T>(tenantId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
    const connection = await this.#pool.reserve();
    let began = false;
    let settled = false;
    let reusable = false;

    try {
      await connection.unsafe("BEGIN");
      began = true;
      const context = await connection<{ tenant_id: string }[]>`
        SELECT set_config('app.tenant_id', ${tenantId}, true) AS tenant_id
      `;
      if (context[0]?.tenant_id !== tenantId) {
        throw new Error("PostgreSQL did not establish the requested tenant context");
      }
      await connection.unsafe("SET LOCAL ROLE app_role");

      const result = await operation(connection);
      await connection.unsafe("COMMIT");
      began = false;
      settled = true;
      await this.#assertSettlement(connection);
      reusable = true;
      return result;
    } catch (error) {
      if (began) {
        try {
          await connection.unsafe("ROLLBACK");
          began = false;
          settled = true;
          await this.#assertSettlement(connection);
          reusable = true;
        } catch {
          // Preserve the request failure; the broken connection is discarded by Bun.
        }
      }
      throw error;
    } finally {
      if (!reusable && settled) {
        try {
          await this.#discardAndAssertRuntimeSettlement(connection);
          reusable = true;
        } catch {
          // Fall through to immediate close below. A failed DISCARD/reverification
          // leaves the reserved backend ineligible for pool reuse.
        }
      }
      if (!reusable) {
        // ReservedSQL has no single-connection destroy operation. Its immediate
        // close is the documented containment fallback; never release a connection
        // whose transaction, role, or tenant context could not be verified clean.
        try { await connection.close({ timeout: 0 }); } catch { /* preserve the request failure */ }
      }
      if (reusable) connection.release();
    }
  }

  async close(): Promise<void> {
    if (this.#ownsPool) await this.#pool.close?.();
  }
}
