import { Elysia } from "elysia";

import { SECURITY_HEADERS } from "./http/security-headers";
import { ExtensionHttpApi } from "./http/extensions";
import {
  Database,
  type ExtensionRegistry,
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
  readonly extensionRegistry?: ExtensionRegistry;
}

export function createApp(options: AppOptions = {}) {
  const tenantContext = new TenantContextMiddleware(
    options.tenantResolver ?? failClosedTenantResolver,
    options.database ?? new Database(unavailablePool),
  );

  const app = new Elysia()
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

  if (!options.extensionRegistry) return app;
  const extensions = new ExtensionHttpApi(options.extensionRegistry);
  return app
    .post("/api/extension-types", ({ request, body, tenantContext }) =>
      tenantContext.handle(request, (context) => extensions.registerType(context, body))
    )
    .post("/api/extensions", ({ request, body, tenantContext }) =>
      tenantContext.handle(request, (context) => extensions.createInstance(context, body))
    )
    .get("/api/extensions", ({ request, tenantContext }) =>
      tenantContext.handle(request, (context) => extensions.listInstances(context))
    );
}

export const app = createApp();
