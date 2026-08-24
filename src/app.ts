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
      .get("/p/:property/reservations", () => operatorAssets.html())
      .get("/p/:property/status", () => operatorAssets.html())
      .get("/assets/operator.css", () => operatorAssets.css())
      .get("/assets/operator.js", () => operatorAssets.js())
      .post("/api/v1/auth/local:login", ({ request, body }) => operator.login(request, body))
      .get("/api/v1/me/properties", ({ request, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.properties(context))
      )
      .get("/api/v1/properties/:property/system-status", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.systemStatus(context, params.property))
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
      .get("/api/v1/properties/:property/rate-builder/:ratePlanId", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.rateBuilder(context, params.property, params.ratePlanId))
      )
      .get("/api/v1/properties/:property/rate-builder/:ratePlanId/approvals", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.rateBuilderApprovals(context, params.property, params.ratePlanId))
      )
      .post("/api/v1/properties/:property/rate-builder/:ratePlanId/approvals/:approvalId/decision", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.decideRateBuilderApproval(
          context, params.property, params.ratePlanId, params.approvalId, body,
        ))
      )
      .post("/api/v1/properties/:property/rate-builder/:ratePlanId/releases", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createRateBuilderDraft(context, params.property, params.ratePlanId, body))
      )
      .post("/api/v1/properties/:property/rate-builder/:ratePlanId/intents:interpret", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.interpretRateBuilderIntent(context, params.property, params.ratePlanId, body))
      )
      .post("/api/v1/properties/:property/rate-builder/:ratePlanId/quotes:resolve", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.resolveRateBuilderQuote(context, params.property, params.ratePlanId, body))
      )
      .post("/api/v1/properties/:property/rate-builder/:ratePlanId/releases/:releaseId/simulate", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.simulateRateBuilderDraft(context, params.property, params.ratePlanId, params.releaseId, body))
      )
      .post("/api/v1/properties/:property/rate-builder/:ratePlanId/releases/:releaseId/approval-request", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.requestRateBuilderApproval(context, params.property, params.ratePlanId, params.releaseId, body))
      )
      .post("/api/v1/properties/:property/rate-builder/:ratePlanId/releases/:releaseId/publish", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.publishRateBuilderDraft(context, params.property, params.ratePlanId, params.releaseId, body))
      )
      .post("/api/v1/properties/:property/rate-builder/:ratePlanId/releases/:releaseId/undo", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createRateBuilderUndo(context, params.property, params.ratePlanId, params.releaseId, body))
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
      .post("/api/v1/reservations:commit", ({ request, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.commitReservation(context, body))
      )
      .get("/api/v1/properties/:property/reservation-guests", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationGuests(context, params.property))
      )
      .get("/api/v1/properties/:property/reservations", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationLifecycle(context, params.property))
      )
      .get("/api/v1/properties/:property/reservation-segments", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationSegments(context, params.property))
      )
      .put("/api/v1/properties/:property/reservations/:reservation/guests", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.replaceReservationGuests(
          context, params.property, params.reservation, body,
        ))
      )
      .patch("/api/v1/properties/:property/reservations/:reservation", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.modifyReservation(context, params.property, params.reservation, body))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/cancel", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.cancelReservation(context, params.property, params.reservation, body))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/reinstate", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reinstateReservation(context, params.property, params.reservation, body))
      )
      .patch("/api/v1/properties/:property/reservations/:reservation/segments/:segment/departure", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.changeReservationDeparture(
          context, params.property, params.reservation, params.segment, body,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/segments/:segment/move", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.moveReservationRoom(
          context, params.property, params.reservation, params.segment, body,
        ))
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
