import { Elysia } from "elysia";
import { isIP } from "node:net";

import { SECURITY_HEADERS } from "./http/security-headers";
import { ExtensionHttpApi } from "./http/extensions";
import { operatorAssets, type OperatorHttpApi, type OperatorLocalReviewCredentials } from "./http/operator";
import { hostedDepositAssets, type HostedDepositProviderHttpApi } from "./http/provider";
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

interface LoginPeerAddress {
  readonly address: string;
  readonly family: "IPv4" | "IPv6";
}

export function localLoginSourceKey(peer: LoginPeerAddress | null | undefined): string {
  if (!peer || typeof peer.address !== "string") return "unknown";
  const version = isIP(peer.address);
  if ((peer.family === "IPv4" && version !== 4) || (peer.family === "IPv6" && version !== 6)) {
    return "unknown";
  }
  return `${peer.family.toLowerCase()}:${peer.address.toLowerCase()}`;
}

export interface AppOptions {
  readonly database?: Database;
  readonly tenantResolver?: TenantResolver;
  readonly extensionRegistry?: ExtensionRegistry;
  readonly operatorApi?: OperatorHttpApi;
  readonly operatorLocalReviewCredentials?: OperatorLocalReviewCredentials;
  readonly hostedDepositRoutes?: HostedDepositProviderHttpApi;
  readonly hostedDepositSurface?: "guest" | "provider" | "all";
}

export function createApp(options: AppOptions = {}) {
  const tenantContext = new TenantContextMiddleware(
    options.tenantResolver ?? failClosedTenantResolver,
    options.database ?? new Database(unavailablePool),
  );
  const providerCsp = options.hostedDepositRoutes?.providerContentSecurityPolicy();

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
      .get("/", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/availability", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/today", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/inventory", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/restrictions", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/rates", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/operations", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/housekeeping", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/housekeeping/tasks/:task", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/vehicles", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/vehicles/:vehicle", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/reservations", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/res/:reservation", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/folios", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/folio/:folio", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/cashiers", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/p/:property/status", ({ request }) => operatorAssets.html(options.operatorLocalReviewCredentials, request))
      .get("/assets/operator.css", () => operatorAssets.css())
      .get("/assets/operator.js", () => operatorAssets.js())
      .get("/assets/operator-deposits.css", () => operatorAssets.depositCss())
      .get("/assets/operator-deposits.js", () => operatorAssets.depositJs())
      .get("/assets/operator-local-prefill.js", () => operatorAssets.localPrefillJs())
      .post("/api/v1/auth/local:login", ({ request, body, server }) =>
        operator.login(request, body, localLoginSourceKey(server?.requestIP(request)))
      )
      .get("/api/v1/me/properties", ({ request, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.properties(context))
      )
      .get("/api/operator/properties/:propertyNode/receivable-transfers/targets", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.receivableTransferTargets(context, params.propertyNode))
      )
      .post("/api/operator/properties/:propertyNode/folios/:folioId/receivable-transfers:preview", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.previewReceivableTransfer(
          context, params.propertyNode, params.folioId, body,
        ))
      )
      .post("/api/operator/properties/:propertyNode/folios/:folioId/receivable-transfers/approvals", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.requestReceivableOverLimitApproval(
          context, params.propertyNode, params.folioId, body,
        ))
      )
      .post("/api/operator/properties/:propertyNode/folios/:folioId/receivable-transfers/approvals/:approvalId/approve", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.decideReceivableOverLimitApproval(
          context, params.propertyNode, params.folioId, params.approvalId, body, "approve",
        ))
      )
      .post("/api/operator/properties/:propertyNode/folios/:folioId/receivable-transfers/approvals/:approvalId/reject", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.decideReceivableOverLimitApproval(
          context, params.propertyNode, params.folioId, params.approvalId, body, "reject",
        ))
      )
      .post("/api/operator/properties/:propertyNode/folios/:folioId/receivable-transfers", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.transferReceivableBalance(
          context, params.propertyNode, params.folioId, body,
        ))
      )
      .get("/api/v1/properties/:property/system-status", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.systemStatus(context, params.property))
      )
      .get("/api/v1/properties/:property/cashier-sessions", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.cashierSessions(context, params.property))
      )
      .post("/api/v1/properties/:property/cashier-sessions", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.openCashierSession(context, params.property, body))
      )
      .post("/api/v1/properties/:property/cashier-sessions/:sessionId/counts", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.appendCashierCount(context, params.property, params.sessionId, body))
      )
      .post("/api/v1/properties/:property/cashier-sessions/:sessionId/approvals", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.requestCashierOverShortApproval(context, params.property, params.sessionId, body))
      )
      .post("/api/v1/properties/:property/cashier-sessions/:sessionId/supervised-approvals", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.requestCashierOverShortApproval(context, params.property, params.sessionId, body, true))
      )
      .post("/api/v1/properties/:property/cashier-sessions/:sessionId/approvals/:approvalId/approve", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.approveCashierOverShort(context, params.property, params.sessionId, params.approvalId, body))
      )
      .post("/api/v1/properties/:property/cashier-sessions/:sessionId/approvals/:approvalId/reject", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.rejectCashierOverShort(context, params.property, params.sessionId, params.approvalId, body))
      )
      .post("/api/v1/properties/:property/cashier-sessions/:sessionId/close", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.closeCashierSession(context, params.property, params.sessionId, body))
      )
      .post("/api/v1/properties/:property/cashier-sessions/:sessionId/supervised-close", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.closeCashierSession(context, params.property, params.sessionId, body, true))
      )
      .get("/api/v1/properties/:property/folios/:reference/statement", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.folioStatement(
          context, params.property, params.reference,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/primary-folio", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.openPrimaryFolio(
          context, params.property, params.reservation, body,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/folios", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.openAdditionalFolio(
          context, params.property, params.reservation, body,
        ))
      )
      .post("/api/v1/properties/:property/folios/:folioId/charges", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.postFolioCharge(
          context, params.property, params.folioId, body,
        ))
      )
      .post("/api/v1/properties/:property/folios/:folioId/status", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.transitionFolioStatus(
          context, params.property, params.folioId, body,
        ))
      )
      .post("/api/v1/properties/:property/folios/:folioId/adjustments", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.correctFolioCharge(
          context, params.property, params.folioId, body,
        ))
      )
      .post("/api/v1/properties/:property/folios/:folioId/transfers:preview", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.previewFolioTransfer(
          context, params.property, params.folioId, body,
        ))
      )
      .post("/api/v1/properties/:property/folios/:folioId/transfers", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.transferFolioGroups(
          context, params.property, params.folioId, body,
        ))
      )
      .get("/api/v1/properties/:property/payments/authority", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.hostedDepositReadAuthority(context, params.property))
      )
      .post("/api/v1/properties/:property/folios/:folioId/hosted-deposits", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createHostedDeposit(
          context, params.property, params.folioId, body,
        ))
      )
      .post("/api/v1/properties/:property/hosted-deposits/:requestId/applications", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.applyHostedDeposit(
          context, params.property, params.requestId, body,
        ))
      )
      .get("/api/v1/properties/:property/hosted-deposits/:requestId", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.hostedDepositStatus(
          context, params.property, params.requestId,
        ))
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
      .post("/api/v1/properties/:property/parties:search", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.partyProfiles(context, params.property, body))
      )
      .post("/api/v1/properties/:property/parties", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createPartyProfile(context, params.property, body))
      )
      .get("/api/v1/properties/:property/reservation-guests", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationGuests(context, params.property))
      )
      .get("/api/v1/properties/:property/reservations", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationLifecycle(context, params.property))
      )
      .get("/api/v1/properties/:property/reservation-board", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationBoard(context, params.property))
      )
      .get("/api/v1/properties/:property/reservations/:reservation", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationDetail(
          context, params.property, params.reservation,
        ))
      )
      .get("/api/v1/properties/:property/reservations/:reservation/arrival-pickup-task/:task", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationPickupTaskDetail(
          context, params.property, params.reservation, params.task,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/arrival-pickup-task/:task/assign", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.transitionReservationPickupTask(
          context, params.property, params.reservation, params.task, "assign", body,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/arrival-pickup-task/:task/start", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.transitionReservationPickupTask(
          context, params.property, params.reservation, params.task, "start", body,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/arrival-pickup-task/:task/complete", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.transitionReservationPickupTask(
          context, params.property, params.reservation, params.task, "complete", body,
        ))
      )
      .get("/api/v1/properties/:property/reservations/:reservation/arrival-room-cleaning-task/candidate", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.arrivalRoomCleaningCandidate(
          context, params.property, params.reservation,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/arrival-room-cleaning-task", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.createArrivalRoomCleaningTask(
          context, params.property, params.reservation, body,
        ))
      )
      .get("/api/v1/properties/:property/reservations/:reservation/due-in-room-assignment/candidates", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.dueInRoomAssignmentCandidates(
          context, params.property, params.reservation,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/due-in-room-assignment", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.assignDueInRoom(
          context, params.property, params.reservation, body,
        ))
      )
      .get("/api/v1/properties/:property/reservations/:reservation/check-in/readiness", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.checkInReadiness(
          context, params.property, params.reservation,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/check-in", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.commitCheckIn(
          context, params.property, params.reservation, body,
        ))
      )
      .get("/api/v1/properties/:property/reservations/:reservation/checkout-readiness", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.checkoutReadiness(
          context, params.property, params.reservation,
        ))
      )
      .post("/api/v1/properties/:property/reservations/:reservation/checkout", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.commitCheckout(
          context, params.property, params.reservation, body,
        ))
      )
      .get("/api/v1/properties/:property/vehicles", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.vehicleRegister(context, params.property))
      )
      .get("/api/v1/properties/:property/vehicles/:vehicle", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.vehicleRegisterDetail(
          context, params.property, params.vehicle,
        ))
      )
      .get("/api/v1/properties/:property/housekeeping/tasks", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.housekeepingBoard(context, params.property))
      )
      .get("/api/v1/properties/:property/housekeeping/tasks/:task", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.housekeepingTaskDetail(
          context, params.property, params.task,
        ))
      )
      .get("/api/v1/properties/:property/housekeeping/conditions", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.housekeepingConditions(context, params.property))
      )
      .get("/api/v1/properties/:property/housekeeping/discrepancies", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.housekeepingDiscrepancies(context, params.property))
      )
      .post("/api/v1/properties/:property/housekeeping/discrepancies", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reportHousekeepingDiscrepancy(
          context, params.property, body,
        ))
      )
      .get("/api/v1/properties/:property/housekeeping/conditions/:space/candidate", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.housekeepingInitialConditionCandidate(
          context, params.property, params.space,
        ))
      )
      .post("/api/v1/properties/:property/housekeeping/conditions/:space/initialize", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.initializeHousekeepingCondition(
          context, params.property, params.space, body,
        ))
      )
      .get("/api/v1/properties/:property/housekeeping/sheets/preview", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.previewHousekeepingSheet(context, params.property))
      )
      .get("/api/v1/properties/:property/housekeeping/sheets", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.listHousekeepingSheets(context, params.property))
      )
      .post("/api/v1/properties/:property/housekeeping/sheets/generate", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.generateHousekeepingSheet(context, params.property, body))
      )
      .post("/api/v1/properties/:property/housekeeping/tasks/:task/transition", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.transitionHousekeepingTask(
          context, params.property, params.task, body,
        ))
      )
      .get("/api/v1/properties/:property/reservation-segments", ({ request, params, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.reservationSegments(context, params.property))
      )
      .put("/api/v1/properties/:property/reservations/:reservation/guests", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.replaceReservationGuests(
          context, params.property, params.reservation, body,
        ))
      )
      .put("/api/v1/properties/:property/reservations/:reservation/travel/:direction", ({ request, params, body, tenantContext }) =>
        withOperatorTenant(request, (context) => operator.putReservationTravel(
          context, params.property, params.reservation, params.direction, body,
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

  if (options.hostedDepositRoutes) {
    const provider = options.hostedDepositRoutes;
    const surface = options.hostedDepositSurface ?? "all";
    if (surface === "guest" || surface === "all") app
      .get("/pay/:bearer", () => hostedDepositAssets.guestHtml())
      .get("/pay/:bearer/return", () => hostedDepositAssets.guestHtml())
      .get("/pay-return/:correlation", () => hostedDepositAssets.guestHtml())
      .get("/assets/guest.css", () => hostedDepositAssets.guestCss())
      .get("/assets/guest.js", () => hostedDepositAssets.guestJs())
      .get("/api/public/hosted-deposits/:bearer", ({ request, params }) => provider.guestStatus(request, params.bearer))
      .get("/api/public/hosted-deposit-returns/:correlation", ({ request, params }) =>
        provider.guestStatusByCorrelation(request, params.correlation))
      .post("/pay/:bearer/continue", ({ request, params }) => provider.continue(request, params.bearer))
      .post("/api/v1/provider/local-deposit/callback", ({ request }) => provider.callback(request), { parse: "none" });
    if (surface === "provider" || surface === "all") app
      .get("/provider/pay", () => hostedDepositAssets.providerHtml(providerCsp))
      .get("/assets/provider.css", () => hostedDepositAssets.providerCss())
      .get("/assets/provider.js", () => hostedDepositAssets.providerJs())
      .get("/api/provider/local-deposit/handoff", ({ request }) =>
        provider.providerHandoff(new URL(request.url).searchParams.get("handoff") ?? ""))
      .post("/api/provider/local-deposit/outcome", ({ body }) => {
        const value = typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
        return provider.providerOutcome(typeof value.handoff === "string" ? value.handoff : "", value.outcome);
      });
  }

  return app;
}

export const app = createApp();
