import { SQL } from "bun";

export type Tx = <T>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T>;

export interface DatabaseConnectOptions {
  readonly maxConnections?: number;
  readonly prepare?: boolean;
}

export interface DatabaseCloseOptions {
  readonly timeout?: number;
}

export class Database {
  private constructor(private readonly sql: SQL) {}

  static connect(url: string, options: DatabaseConnectOptions = {}): Database {
    return new Database(
      new SQL(url, {
        ...(options.maxConnections !== undefined ? { max: options.maxConnections } : {}),
        ...(options.prepare !== undefined ? { prepare: options.prepare } : {}),
      }),
    );
  }

  async withTenantTransaction<T>(tenantId: string, run: (tx: Tx) => Promise<T>): Promise<T> {
    return this.sql.begin(async (transaction: SQL) => {
      await transaction`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await transaction.unsafe("SET LOCAL ROLE app_role");
      return run(transaction as Tx);
    });
  }

  close(options?: DatabaseCloseOptions): void {
    this.sql.close(options);
  }
}
