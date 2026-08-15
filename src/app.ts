import { Elysia } from "elysia";

import { SECURITY_HEADERS } from "./http/security-headers";
import {
  Database,
  failClosedTenantResolver,
  TenantContextMiddleware,
  type TenantResolver,
} from "./kernel";

const unavailablePool = Object.freeze({
  async reserve(): Promise<never> {
    throw new Error("Database is not configured");
  },
});

export interface AppOptions {
  readonly database?: Database;
  readonly tenantResolver?: TenantResolver;
}

export function createApp(options: AppOptions = {}) {
  const tenantContext = new TenantContextMiddleware(
    options.tenantResolver ?? failClosedTenantResolver,
    options.database ?? new Database(unavailablePool),
  );

  return new Elysia()
    .decorate("tenantContext", tenantContext)
    .onAfterHandle(({ set }) => {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        set.headers[name] = value;
      }
    })
    .onError(({ set }) => {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        set.headers[name] = value;
      }
    })
    .get("/health", () => ({ status: "ok" as const }));
}

export const app = createApp();
