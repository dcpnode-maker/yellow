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
      } catch (error) {
        return operator.failure(request, error);
      }
    };
    app
      .get("/", () => operatorAssets.html())
      .get("/p/:property/availability", () => operatorAssets.html())
      .get("/p/:property/inventory", () => operatorAssets.html())
      .get("/p/:property/restrictions", () => operatorAssets.html())
      .get("/p/:property/rates", () => operatorAssets.html())
      .get("/p/:property/operations", () => operatorAssets.html())
      .get("/assets/operator.css", () => operatorAssets.css())
      .get("/assets/operator.js", () => operatorAssets.js())
      .post("/api/v1/auth/local:login", ({ request, body }) => operator.login(request, body))
      .get("/api/v1/me/properties", ({ request, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.properties(context))
      )
      .post("/api/v1/properties/:property/availability:search", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.search(context, params.property, body))
      )
      .get("/api/v1/properties/:property/inventory", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.inventory(context, params.property))
      )
      .get("/api/v1/properties/:property/availability-projection", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.availabilityProjection(context, params.property))
      )
      .post("/api/v1/properties/:property/availability-projection:rebuild", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.rebuildAvailabilityProjection(context, params.property, body))
      )
      .get("/api/v1/properties/:property/restrictions", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.restrictions(context, params.property))
      )
      .post("/api/v1/properties/:property/restrictions", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createRestrictions(context, params.property, body))
      )
      .get("/api/v1/properties/:property/rate-configuration", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.rateConfiguration(context, params.property))
      )
      .post("/api/v1/properties/:property/rate-configuration/policies", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createPolicy(context, params.property, body))
      )
      .post("/api/v1/properties/:property/rate-configuration/rate-plans", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createRatePlan(context, params.property, body))
      )
      .get("/api/v1/properties/:property/rate-prices/current", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.currentRatePrice(context, params.property))
      )
      .post("/api/v1/properties/:property/rate-prices", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createRatePrice(context, params.property, body))
      )
      .post("/api/v1/properties/:property/rate-prices/:ratePriceId/supersede", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.supersedeRatePrice(context, params.property, params.ratePriceId, body))
      )
      .get("/api/v1/properties/:property/operational-blocks", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.operationalBlocks(context, params.property))
      )
      .post("/api/v1/properties/:property/operational-blocks", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.openOperationalBlock(context, params.property, body))
      )
      .post("/api/v1/properties/:property/operational-blocks/:blockId/close", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.closeOperationalBlock(context, params.property, params.blockId, body))
      )
      .get("/api/v1/properties/:property/inventory-policy", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.inventoryPolicy(context, params.property))
      )
      .post("/api/v1/properties/:property/inventory-policy/oos-sellability", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.setOosSellability(context, params.property, body))
      )
      .get("/api/v1/properties/:property/holds", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.activeHolds(context, params.property))
      )
      .post("/api/v1/properties/:property/holds", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.placeHold(context, params.property, body))
      )
      .post("/api/v1/properties/:property/holds/:holdId/release", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.releaseHold(context, params.property, params.holdId, body))
      )
      .get("/api/v1/properties/:property/offline-leases", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.activeOfflineLeases(context, params.property))
      )
      .post("/api/v1/properties/:property/offline-leases", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.placeOfflineLease(context, params.property, body))
      )
      .post("/api/v1/properties/:property/offline-leases/:leaseId/release", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.releaseOfflineLease(context, params.property, params.leaseId, body))
      )
      .post("/api/v1/properties/:property/inventory/unit-types", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createUnitType(context, params.property, body))
      )
      .post("/api/v1/properties/:property/inventory/spaces", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createSpace(context, params.property, body))
      )
      .post("/api/v1/properties/:property/inventory/sellable-units", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createSellableUnit(context, params.property, body))
      )
      .post("/api/v1/properties/:property/inventory/rooms:bulk", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createBulkRooms(context, params.property, body))
      );
  }

  return app;
}

export const app = createApp();
