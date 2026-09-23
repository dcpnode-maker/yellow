import type { Tx } from "./db";
import { Database } from "./db";

export interface TenantIdentity {
  readonly tenantId: string;
  readonly actorId?: string;
  readonly scopes?: readonly string[];
}

export interface TenantResolver {
  resolve(request: Request): Promise<TenantIdentity | null>;
}

export interface TenantRequestContext {
  readonly request: Request;
  readonly tenantId: string;
  readonly identity: TenantIdentity;
  readonly tx: Tx;
}

export type TenantRequestHandler<T> = (context: TenantRequestContext) => Promise<T>;

export const failClosedTenantResolver: TenantResolver = Object.freeze({
  async resolve(): Promise<null> {
    return null;
  },
});

/** Wraps one database-capable request in one transaction-local tenant context. */
export class TenantContextMiddleware {
  readonly #resolver: TenantResolver;
  readonly #database: Database;

  constructor(resolver: TenantResolver, database: Database) {
    this.#resolver = resolver;
    this.#database = database;
  }

  async handle<T>(request: Request, handler: TenantRequestHandler<T>): Promise<T | Response> {
    const identity = await this.#resolver.resolve(request);
    if (identity === null) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    return this.#database.withTenantTransaction(identity.tenantId, (tx) =>
      handler({ request, tenantId: identity.tenantId, identity, tx })
    );
  }
}
