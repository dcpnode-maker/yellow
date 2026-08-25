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

  async withTenantTransaction<T>(tenantId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
    const connection = await this.#pool.reserve();
    let began = false;

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
      await this.#assertSettlement(connection);
      return result;
    } catch (error) {
      if (began) {
        try {
          await connection.unsafe("ROLLBACK");
          began = false;
          await this.#assertSettlement(connection);
        } catch {
          // Preserve the request failure; the broken connection is discarded by Bun.
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    if (this.#ownsPool) await this.#pool.close?.();
  }
}
