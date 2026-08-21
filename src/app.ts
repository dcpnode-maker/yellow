import { Elysia } from "elysia";

import { SECURITY_HEADERS } from "./http/security-headers";
import { ExtensionHttpApi } from "./http/extensions";
import { operatorAssets, type OperatorHttpApi } from "./http/operator";
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
  readonly operatorApi?: OperatorHttpApi;
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

  if (options.extensionRegistry) {
    const extensions = new ExtensionHttpApi(options.extensionRegistry);
    app
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

  if (options.operatorApi) {
    const operator = options.operatorApi;
    const withOperatorTenant = async (
      request: Request,
      handler: Parameters<TenantContextMiddleware["handle"]>[1],
    ): Promise<Response> => {
      try {
        const response = await tenantContext.handle(request, handler) as Response;
        return response.status === 401 ? operator.unauthorized(request) : response;
      } catch {
        return operator.unavailable(request);
      }
    };
    app
      .get("/", () => operatorAssets.html())
      .get("/p/:property/availability", () => operatorAssets.html())
      .get("/assets/operator.css", () => operatorAssets.css())
      .get("/assets/operator.js", () => operatorAssets.js())
      .post("/api/v1/auth/local:login", ({ request, body }) => operator.login(request, body))
      .get("/api/v1/me/properties", ({ request, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.properties(context))
      )
      .post("/api/v1/properties/:property/availability:search", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.search(context, params.property, body))
      );
  }

  return app;
}

export const app = createApp();
